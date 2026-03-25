require('dotenv').config();
const prisma = require('./src/lib/prisma');
const dayjs = require('dayjs');

async function main() {
    const todayStr = '2026-03-25';
    const startOfToday = dayjs(todayStr, 'YYYY-MM-DD').startOf('day').toDate();
    const endOfToday = dayjs(todayStr, 'YYYY-MM-DD').endOf('day').toDate();

    console.log(`--- Restoring Today's Timesheets from Device Logs (${todayStr}) ---`);
    
    const logs = await prisma.deviceLog.findMany({
        where: {
            punchTime: { gte: startOfToday, lte: endOfToday }
        },
        orderBy: { punchTime: 'asc' }
    });

    console.log(`Found ${logs.length} device logs for today.`);
    
    const userLogs = {};
    for (const log of logs) {
        if (!userLogs[log.userId]) userLogs[log.userId] = [];
        userLogs[log.userId].push(log.punchTime);
    }

    let restoredCount = 0;
    for (const userId in userLogs) {
        const punches = userLogs[userId];
        const inAt = punches[0];
        const outAt = punches.length > 1 ? punches[punches.length - 1] : null;

        const emp = await prisma.employee.findFirst({
            where: { employeeCode: userId }
        });

        if (!emp) {
            console.log(`! Employee code not found: ${userId}`);
            continue;
        }

        await prisma.timesheet.upsert({
            where: {
                employeeId_date_tenantId: {
                    employeeId: emp.id,
                    date: startOfToday,
                    tenantId: emp.tenantId
                }
            },
            update: {
                inAt: inAt,
                outAt: outAt,
                source: 'device_restored'
            },
            create: {
                employeeId: emp.id,
                date: startOfToday,
                tenantId: emp.tenantId,
                inAt: inAt,
                outAt: outAt,
                source: 'device_restored',
                status: 'pending'
            }
        });
        restoredCount++;
        console.log(`[PASS] Restored: ${userId} (${emp.id}) | IN ${dayjs(inAt).format('HH:mm')} | OUT ${outAt ? dayjs(outAt).format('HH:mm') : '-'}`);
    }
    console.log(`\nRestore complete. ${restoredCount} records processed.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

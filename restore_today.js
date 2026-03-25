require('dotenv').config();
const prisma = require('./src/lib/prisma');
const dayjs = require('dayjs');

async function main() {
    const todayStr = '2026-03-25';
    
    console.log(`--- Restoring Today's Timesheets (March 25, 2026) ---`);
    
    // 1. Cleanup previous restoration attempt
    console.log('Cleaning up previous restoration attempt records...');
    const deleted = await prisma.timesheet.deleteMany({
        where: { source: 'device_restored' }
    });
    console.log(`Removed ${deleted.count} temporary records.`);

    // 2. Fetch all logs and filter locally by date string to be 100% sure of the local day
    console.log('Fetching and filtering device logs...');
    const allLogs = await prisma.deviceLog.findMany({
        orderBy: { punchTime: 'asc' }
    });
    
    const logs = allLogs.filter(l => dayjs(l.punchTime).format('YYYY-MM-DD') === todayStr);
    console.log(`Found ${logs.length} device logs matching precisely ${todayStr}.`);
    
    // 3. Define the target date for the database (Start of March 25 in UTC for consistency with report query)
    const targetDate = new Date('2026-03-25T00:00:00.000Z');

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
            console.log(`! Employee code not found in DB: ${userId}`);
            continue;
        }

        await prisma.timesheet.create({
            data: {
                employeeId: emp.id,
                date: targetDate,
                tenantId: emp.tenantId,
                inAt: inAt,
                outAt: outAt,
                source: 'device_restored',
                status: 'pending'
            }
        });
        restoredCount++;
        console.log(`[PASS] Restored: ${userId} | IN ${dayjs(inAt).format('HH:mm')} | OUT ${outAt ? dayjs(outAt).format('HH:mm') : '-'}`);
    }
    console.log(`\nRestore complete. ${restoredCount} records successfully created for March 25th.`);
}

main().catch(console.error).finally(async () => {
    await prisma.$disconnect();
});

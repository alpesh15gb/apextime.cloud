require('dotenv').config();
const prisma = require('./src/lib/prisma');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);

async function main() {
    const tenantId = 2; // pewec
    const targetDateStr = '2026-03-24';
    const targetDateUTC = new Date('2026-03-24T00:00:00.000Z');
    
    console.log(`--- Realigning March 24th Data (Tenant 2) ---`);

    // 1. Fix shifted records (those with date=25th but actually belonging to 24th)
    console.log('Step 1: Fixing existing shifted records...');
    const start24 = dayjs.tz('2026-03-24 00:00:00', 'Asia/Kolkata').toDate();
    const end24 = dayjs.tz('2026-03-24 23:59:59', 'Asia/Kolkata').toDate();

    const shifted = await prisma.timesheet.updateMany({
        where: {
            tenantId,
            inAt: { gte: start24, lte: end24 },
            NOT: { date: targetDateUTC }
        },
        data: {
            date: targetDateUTC
        }
    });
    console.log(`Updated ${shifted.count} records to have the correct date (March 24).`);

    // 2. Backfill missing records from device logs
    console.log('\nStep 2: Backfilling missing records from device logs...');
    const logs = await prisma.deviceLog.findMany({
        where: {
            tenantId,
            punchTime: { gte: start24, lte: end24 }
        },
        orderBy: { punchTime: 'asc' }
    });
    
    console.log(`Found ${logs.length} device logs for the 24th in IST.`);

    const userLogs = {};
    for (const log of logs) {
        if (!userLogs[log.userId]) userLogs[log.userId] = [];
        userLogs[log.userId].push(log.punchTime);
    }

    let createdCount = 0;
    for (const employeeCode in userLogs) {
        const emp = await prisma.employee.findFirst({
            where: { tenantId, employeeCode }
        });

        if (!emp) continue;

        const punches = userLogs[employeeCode];
        const inAt = punches[0];
        const outAt = punches.length > 1 ? punches[punches.length - 1] : null;

        // Check if timesheet already exists for this employee/date
        const existing = await prisma.timesheet.findFirst({
            where: { employeeId: emp.id, date: targetDateUTC }
        });

        if (!existing) {
            await prisma.timesheet.create({
                data: {
                    tenantId,
                    employeeId: emp.id,
                    date: targetDateUTC,
                    inAt,
                    outAt,
                    source: 'device_restored',
                    status: 'auto_approved'
                }
            });
            createdCount++;
            console.log(`[NEW] Created: ${employeeCode} | IN: ${dayjs(inAt).format('HH:mm')}`);
        } else {
            // Optionally update existing if it's missing in/out?
            // For now, we trust existing records but we've already fixed their date.
        }
    }

    console.log(`\nBackfill complete. Created ${createdCount} new records.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

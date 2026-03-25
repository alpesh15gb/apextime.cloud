require('dotenv').config();
const prisma = require('./src/lib/prisma');
const dayjs = require('dayjs');

async function main() {
    console.log('--- Deleting ONLY Future-Dated Records (March 26 and beyond) ---');
    // Using end of day to ensure March 25 remains untouched
    const cutoff = dayjs('2026-03-25', 'YYYY-MM-DD').endOf('day').toDate();
    
    // 1. Delete Timesheets
    const deleteTimesheets = await prisma.timesheet.deleteMany({
        where: {
            date: {
                gt: cutoff
            }
        }
    });
    console.log(`Deleted ${deleteTimesheets.count} future timesheet records (records where date > March 25).`);

    // 2. Delete Device Logs
    const deleteLogs = await prisma.deviceLog.deleteMany({
        where: {
            punchTime: {
                gt: cutoff
            }
        }
    });
    console.log(`Deleted ${deleteLogs.count} future device logs (records where punchTime > March 25 23:59:59).`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

require('dotenv').config();
const prisma = require('./src/lib/prisma');
const dayjs = require('dayjs');

async function main() {
    console.log('--- Deleting Future-Dated Attendance Records ---');
    const today = dayjs('2026-03-25');
    
    // 1. Delete Timesheets
    const deleteTimesheets = await prisma.timesheet.deleteMany({
        where: {
            date: {
                gt: today.toDate()
            }
        }
    });
    console.log(`Deleted ${deleteTimesheets.count} future timesheet records.`);

    // 2. Delete Device Logs
    const deleteLogs = await prisma.deviceLog.deleteMany({
        where: {
            punchTime: {
                gt: dayjs('2026-03-25T23:59:59').toDate() // End of today
            }
        }
    });
    console.log(`Deleted ${deleteLogs.count} future device logs.`);
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
    });

const prisma = require('../src/lib/prisma');
const dayjs = require('dayjs');

async function main() {
    console.log('Starting migration to fix shifted timezone dates for imported attendance...');

    // Fetch all timesheets from uploads
    const timesheets = await prisma.timesheet.findMany({
        where: {
            source: 'upload'
        }
    });

    console.log(`Found ${timesheets.length} uploaded timesheet records.`);

    let updated = 0;

    for (const ts of timesheets) {
        if (!ts.inAt) continue; // Safety check

        const currentDbDate = dayjs(ts.date).format('YYYY-MM-DD');

        // Let's create the correct intended date from the actual punch time (inAt)
        const punchDayjs = dayjs(ts.inAt);

        // Because of the timezone issue, we need to extract year/month/date in local time
        // and create a UTC midnight date for it.
        const intendedDate = new Date(Date.UTC(punchDayjs.year(), punchDayjs.month(), punchDayjs.date()));

        const intendedDbDate = dayjs(intendedDate).format('YYYY-MM-DD');

        // Check if the date is shifted. The actual inAt day of month should match the date column's day of month
        if (currentDbDate !== intendedDbDate) {
            console.log(`[Fixing Shift] Employee: ${ts.employeeId} | Old Date: ${currentDbDate} -> New Date: ${intendedDbDate}`);

            await prisma.timesheet.update({
                where: { id: ts.id },
                data: {
                    date: intendedDate
                }
            });
            updated++;
        }
    }

    console.log(`\nMigration complete! Fixed ${updated} out of ${timesheets.length} uploaded timesheet records.`);
}

main()
    .catch(e => {
        console.error('Error during migration:', e);
        process.exit(1);
    })
    .finally(async () => await prisma.$disconnect());

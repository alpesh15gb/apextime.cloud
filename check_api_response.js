require('dotenv').config();
const prisma = require('./src/lib/prisma');
const dayjs = require('dayjs');

async function main() {
    console.log('--- API Response Diagnostic (March 2026) ---');
    
    // Simulate the report API params
    const m = 3;
    const y = 2026;
    const startOfMonth = dayjs(`${y}-${m}-01`).startOf('month');
    const endOfMonth = startOfMonth.endOf('month');

    // Fetch Timesheets for March 2026
    const timesheets = await prisma.timesheet.findMany({
        where: {
            date: {
                gte: startOfMonth.toDate(),
                lte: endOfMonth.toDate()
            }
        },
        select: {
            id: true,
            employeeId: true,
            date: true,
            inAt: true,
            source: true
        }
    });

    console.log(`\nFound ${timesheets.length} total timesheet records for March 2026.`);
    
    const targetMonthStr = '2026-03';
    const futureRecords = timesheets.filter(t => 
        dayjs(t.date).format('YYYY-MM') === targetMonthStr && 
        dayjs(t.date).date() > 25
    );
    
    if (futureRecords.length > 0) {
        console.log(`\n!!! FOUND ${futureRecords.length} FUTURE RECORDS FOR MARCH 26-31:`);
        futureRecords.forEach(t => {
            console.log(` - ID ${t.id} | EmpId ${t.employeeId} | Date ${t.date.toISOString()} | IN ${t.inAt ? t.inAt.toISOString() : '-'} | Source ${t.source}`);
        });
    } else {
        console.log('\nSUCCESS: The server has ZERO records for March 26th-31st.');
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());

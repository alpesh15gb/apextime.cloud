require('dotenv').config();
const prisma = require('./src/lib/prisma');
const dayjs = require('dayjs');

async function main() {
    console.log('--- Database Diagnostic ---');
    const today = dayjs('2026-03-25');
    
    console.log('\n[Checking Timesheets for Today (March 25)]');
    const todayTimesheets = await prisma.timesheet.findMany({
        where: {
            date: {
                gte: today.startOf('day').toDate(),
                lte: today.endOf('day').toDate()
            }
        },
        take: 5
    });
    console.log(`Found ${todayTimesheets.length} records.`);
    todayTimesheets.forEach(t => {
        console.log(`ID: ${t.id}, EmpId: ${t.employeeId}, Date: ${t.date.toISOString()}, IN: ${t.inAt ? t.inAt.toISOString() : '-'}, OUT: ${t.outAt ? t.outAt.toISOString() : '-'}`);
    });

    console.log('\n[Checking Future Timesheets (March 26 and beyond)]');
    const futureTimesheets = await prisma.timesheet.findMany({
        where: {
            date: {
                gt: today.endOf('day').toDate()
            }
        }
    });
    console.log(`Found ${futureTimesheets.length} future records.`);
    futureTimesheets.forEach(t => {
        console.log(`ID: ${t.id}, EmpId: ${t.employeeId}, Date: ${t.date.toISOString()}, Source: ${t.source}`);
    });

    console.log('\n[Checking Future Device Logs (March 26 and beyond)]');
    const futureLogs = await prisma.deviceLog.findMany({
        where: {
            punchTime: {
                gt: today.endOf('day').toDate()
            }
        }
    });
    console.log(`Found ${futureLogs.length} future device log records.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

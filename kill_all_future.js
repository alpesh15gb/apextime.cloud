require('dotenv').config();
const prisma = require('./src/lib/prisma');
const dayjs = require('dayjs');

async function main() {
    console.log('--- Comprehensive Future Data Cleanup ---');
    
    // We'll use a string-based cutoff for maximum safety with Postgres
    const cutoffDate = '2026-03-25';
    const cutoffTime = '2026-03-25 23:59:59';

    try {
        // 1. Timesheets
        const tCount = await prisma.$executeRaw`DELETE FROM timesheets WHERE date > ${cutoffDate}::date`;
        console.log(`Deleted from timesheets: ${tCount} records.`);

        // 2. Device Logs
        const lCount = await prisma.$executeRaw`DELETE FROM device_logs WHERE punch_time > ${cutoffTime}::timestamp`;
        console.log(`Deleted from device_logs: ${lCount} records.`);

        // 3. Employee Attendances
        const aCount = await prisma.$executeRaw`DELETE FROM employee_attendances WHERE date > ${cutoffDate}::date`;
        console.log(`Deleted from employee_attendances: ${aCount} records.`);
        
        // 4. Double check what's left
        const remaining = await prisma.timesheet.findMany({
            where: { date: { gt: dayjs(cutoffDate).endOf('day').toDate() } },
            select: { id: true, date: true }
        });
        
        if (remaining.length > 0) {
            console.log(`WARNING: Still found ${remaining.length} records in timesheets after deletion!`);
            remaining.forEach(r => console.log(` - ID ${r.id}: ${r.date.toISOString()}`));
        } else {
            console.log('SUCCESS: No future records remain in timesheets.');
        }

    } catch (err) {
        console.error('Error during cleanup:', err);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());

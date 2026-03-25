require('dotenv').config();
const prisma = require('./src/lib/prisma');

async function main() {
    console.log('--- Deduplicating March 25th Timesheets ---');
    const today = new Date('2026-03-25T00:00:00.000Z');

    // 1. Fetch all 'device' records for today
    const originalRecords = await prisma.timesheet.findMany({
        where: {
            date: today,
            source: 'device'
        }
    });
    
    const originalEmpIds = originalRecords.map(r => r.employeeId);
    console.log(`Found ${originalRecords.length} original 'device' records.`);

    // 2. Delete 'device_restored' records for the same employees
    if (originalEmpIds.length > 0) {
        const deleted = await prisma.timesheet.deleteMany({
            where: {
                date: today,
                source: 'device_restored',
                employeeId: { in: originalEmpIds }
            }
        });
        console.log(`Deleted ${deleted.count} duplicate 'device_restored' records.`);
    } else {
        console.log('No duplicates to delete.');
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());

require('dotenv').config();
const prisma = require('./src/lib/prisma');

async function main() {
    console.log('--- Bulk Approving Restored Timesheets ---');
    
    const updated = await prisma.timesheet.updateMany({
        where: {
            source: 'device_restored',
            status: 'pending'
        },
        data: {
            status: 'auto_approved'
        }
    });

    console.log(`Successfully approved ${updated.count} restored records.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

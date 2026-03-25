require('dotenv').config();
const prisma = require('./src/lib/prisma');
const dayjs = require('dayjs');

async function main() {
    const tenantId = 2; // pewec
    const code = '28'; // FATIMA HASHMI
    console.log(`--- Investigative Report for FATIMA HASHMI (Tenant 2) ---`);

    const emp = await prisma.employee.findFirst({
        where: { tenantId, employeeCode: code },
        include: { contact: true }
    });

    if (!emp) {
        console.error('Employee not found in Tenant 2');
        return;
    }

    console.log(`Name: ${emp.contact.firstName} ${emp.contact.lastName || ''}`);

    const records = await prisma.timesheet.findMany({
        where: { employeeId: emp.id },
        orderBy: { date: 'asc' }
    });

    console.log(`\nFound ${records.length} total timesheets for this employee in Tenant 2.`);
    
    records.forEach(t => {
        const d = dayjs(t.date);
        console.log(`[${t.id}] Date: ${t.date.toISOString()} (${d.format('YYYY-MM-DD')}) | IN: ${t.inAt ? t.inAt.toISOString() : '-'} | OUT: ${t.outAt ? t.outAt.toISOString() : '-'} | Source: ${t.source}`);
    });

    console.log('\n--- Searching for ALL records in Tenant 2 in the future (> March 25th) ---');
    const allFuture = await prisma.timesheet.findMany({
        where: {
            tenantId: tenantId,
            OR: [
                { date: { gt: new Date('2026-03-25T00:00:00Z') } },
                { inAt: { gt: new Date('2026-03-25T23:59:59Z') } }
            ]
        }
    });
    console.log(`Found ${allFuture.length} records matching future criteria in Tenant 2.`);
    
    // FINAL PUNCH: If found, DELETE them
    if (allFuture.length > 0) {
        console.log('Deleting future records...');
        const ids = allFuture.map(t => t.id);
        const deleted = await prisma.timesheet.deleteMany({
            where: { id: { in: ids } }
        });
        console.log(`Successfully deleted ${deleted.count} future records from Tenant 2.`);
    } else {
        console.log('No future records found in Tenant 2 via Prisma. Re-checking with raw SQL...');
        const count = await prisma.$executeRaw`DELETE FROM timesheets WHERE tenant_id = 2 AND date > '2026-03-25'::date`;
        console.log(`Deleted via raw SQL: ${count} records.`);
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());

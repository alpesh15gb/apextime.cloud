require('dotenv').config();
const prisma = require('./src/lib/prisma');
const dayjs = require('dayjs');

async function main() {
    const code = '28'; // FATIMA HASHMI
    console.log(`--- Investigative Report for Employee Code ${code} ---`);

    const emp = await prisma.employee.findFirst({
        where: { employeeCode: code },
        include: { contact: true }
    });

    if (!emp) {
        console.error('Employee not found');
        return;
    }

    console.log(`Name: ${emp.contact.firstName} ${emp.contact.lastName || ''}`);
    console.log(`TenantID: ${emp.tenantId} | EmpID: ${emp.id}`);

    const records = await prisma.timesheet.findMany({
        where: { employeeId: emp.id },
        orderBy: { date: 'asc' }
    });

    console.log(`\nFound ${records.length} total timesheets for this employee.`);
    
    records.forEach(t => {
        const d = dayjs(t.date);
        console.log(`[${t.id}] Date: ${t.date.toISOString()} (${d.format('YYYY-MM-DD')}) | IN: ${t.inAt ? t.inAt.toISOString() : '-'} | OUT: ${t.outAt ? t.outAt.toISOString() : '-'} | Source: ${t.source}`);
    });

    console.log('\n--- Searching for ALL records in the future (> March 25th 12:00 IST) ---');
    const allFuture = await prisma.timesheet.findMany({
        where: {
            OR: [
                { date: { gt: new Date('2026-03-25T12:00:00Z') } },
                { inAt: { gt: new Date('2026-03-25T12:00:00Z') } },
                { outAt: { gt: new Date('2026-03-25T12:00:00Z') } }
            ]
        }
    });
    console.log(`Found ${allFuture.length} records matching future criteria.`);
    allFuture.forEach(t => {
        console.log(`ID ${t.id} | EmpID ${t.employeeId} | Date ${t.date.toISOString()} | IN ${t.inAt ? t.inAt.toISOString() : '-'}`);
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());

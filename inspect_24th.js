require('dotenv').config();
const prisma = require('./src/lib/prisma');
const dayjs = require('dayjs');

async function main() {
    console.log('--- Deep Inspection: March 24th (Tenant 2) ---');
    
    const tenantId = 2; // pewec
    const start = dayjs('2026-03-24').startOf('day').toDate();
    const end = dayjs('2026-03-24').endOf('day').toDate();

    const records = await prisma.timesheet.findMany({
        where: { tenantId, date: { gte: start, lte: end } },
        include: { employee: { include: { contact: true } } }
    });

    console.log(`Found ${records.length} records for the 24th.`);
    records.slice(0, 10).forEach(r => {
        console.log(`ID ${r.id} | ${r.employee.contact.firstName} | DateField: ${r.date.toISOString()} | IN: ${r.inAt ? r.inAt.toISOString() : '-'} | Source: ${r.source}`);
    });
    
    console.log('\n--- Checking for records that look like 24th but have date=25th ---');
    const shifted = await prisma.timesheet.findMany({
        where: {
            tenantId,
            date: { gte: dayjs('2026-03-25').startOf('day').toDate(), lte: dayjs('2026-03-25').endOf('day').toDate() },
            inAt: { gte: dayjs('2026-03-24').startOf('day').toDate(), lte: dayjs('2026-03-24').endOf('day').toDate() }
        },
        include: { employee: { include: { contact: true } } }
    });
    console.log(`Found ${shifted.length} records with date=25th but IN=24th.`);
    shifted.slice(0, 10).forEach(r => {
        console.log(`ID ${r.id} | ${r.employee.contact.firstName} | IN: ${dayjs(r.inAt).format('YYYY-MM-DD HH:mm')}`);
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());

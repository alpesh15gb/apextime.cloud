require('dotenv').config();
const prisma = require('./src/lib/prisma');
const dayjs = require('dayjs');

async function main() {
    console.log('--- Missing Data Audit: March 23rd-25th (Tenant 2) ---');
    
    const tenantId = 2; // pewec
    const targetDates = ['2026-03-23', '2026-03-24', '2026-03-25'];

    for (const dStr of targetDates) {
        const start = dayjs(dStr).startOf('day').toDate();
        const end = dayjs(dStr).endOf('day').toDate();

        const count = await prisma.timesheet.count({
            where: {
                tenantId,
                date: { gte: start, lte: end }
            }
        });

        console.log(`Date ${dStr}: Found ${count} records.`);
        
        if (count > 0 && count < 10) {
            const samples = await prisma.timesheet.findMany({
                where: { tenantId, date: { gte: start, lte: end } },
                take: 5,
                include: { employee: { include: { contact: true } } }
            });
            samples.forEach(s => {
                console.log(` - ID ${s.id} | ${s.employee.contact.firstName} | IN: ${s.inAt ? dayjs(s.inAt).format('HH:mm') : '-'} | DateValue: ${s.date.toISOString()}`);
            });
        }
    }

    console.log('\n--- Checking for potential accidental deletions (logs vs timesheets) ---');
    // See if we have logs but no timesheets for the 24th
    const logs24Count = await prisma.deviceLog.count({
        where: {
            tenantId,
            punchTime: {
                gte: dayjs('2026-03-24').startOf('day').toDate(),
                lte: dayjs('2026-03-24').endOf('day').toDate()
            }
        }
    });
    console.log(`Device logs for 24th: ${logs24Count}`);

}

main().catch(console.error).finally(() => prisma.$disconnect());

require('dotenv').config();
const prisma = require('./src/lib/prisma');

async function main() {
    console.log('--- Multi-Tenant Environment Audit ---');
    
    const tenants = await prisma.tenant.findMany();
    console.log(`Found ${tenants.length} tenants.`);
    tenants.forEach(t => {
        console.log(` - [${t.id}] ${t.name} (Slug: ${t.slug})`);
    });

    console.log('\n--- Searching for "FATIMA HASHMI" in ALL tenants ---');
    const employees = await prisma.employee.findMany({
        include: {
            contact: true,
            tenant: true
        }
    });

    const matches = employees.filter(e => 
        e.contact.firstName.toUpperCase().includes('FATIMA') || 
        e.contact.lastName?.toUpperCase().includes('HASHMI') ||
        e.employeeCode === '28'
    );

    console.log(`Found ${matches.length} matching employees.`);
    matches.forEach(e => {
        console.log(` - Code: ${e.employeeCode} | Name: ${e.contact.firstName} ${e.contact.lastName || ''} | Tenant: ${e.tenant.name} (${e.tenant.id})`);
    });

}

main().catch(console.error).finally(() => prisma.$disconnect());

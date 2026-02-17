const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('🔍 Listing Tenants and Users...');

    const tenants = await prisma.tenant.findMany({
        include: {
            users: {
                select: { username: true, role: true }
            }
        }
    });

    if (tenants.length === 0) {
        console.log('No tenants found.');
    } else {
        tenants.forEach(t => {
            console.log(`\n🏢 Organization: ${t.name} (ID/Slug: ${t.slug})`);
            console.log('   Users:');
            if (t.users.length === 0) console.log('   - No users');
            t.users.forEach(u => {
                console.log(`   - ${u.username} (${u.role})`);
            });
        });
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());

const prisma = require('../src/lib/prisma');
const bcrypt = require('bcryptjs');

async function main() {
    const args = process.argv.slice(2);
    if (args.length < 3) {
        console.error('Usage: node scripts/verify-login.js <tenant_slug> <username> <password>');
        process.exit(1);
    }

    const slug = args[0];
    const username = args[1];
    const password = args[2];

    console.log(`Verifying login for: ${username} @ ${slug}...`);

    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) {
        console.error(`❌ Tenant '${slug}' not found.`);
        process.exit(1);
    }

    if (tenant.status !== 'active') {
        console.error(`❌ Tenant '${slug}' is NOT active (Status: ${tenant.status}).`);
    }

    const user = await prisma.user.findFirst({
        where: { username, tenantId: tenant.id }
    });

    if (!user) {
        console.error(`❌ User '${username}' not found in tenant '${slug}'.`);
        process.exit(1);
    }

    if (user.status !== 'active') {
        console.error(`❌ User '${username}' is NOT active (Status: ${user.status}).`);
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (isValid) {
        console.log(`✅ SUCCESS! Password is correct.`);
        console.log(`   User Role: ${user.role}`);
        console.log(`   User ID:   ${user.id}`);
    } else {
        console.error(`❌ FAILED! Password incorrect.`);
        console.error(`   Stored Hash: ${user.passwordHash.substring(0, 10)}...`);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());

const prisma = require('../src/lib/prisma');
const bcrypt = require('bcryptjs');

async function main() {
    const args = process.argv.slice(2);
    if (args.length < 3) {
        console.error('Usage: node scripts/reset-password.js <tenant_slug> <username> <new_password>');
        process.exit(1);
    }

    const slug = args[0];
    const username = args[1];
    const password = args[2];

    console.log(`Resetting password for user: ${username} in tenant: ${slug}...`);

    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) {
        console.error(`Tenant '${slug}' not found.`);
        process.exit(1);
    }

    const user = await prisma.user.findFirst({
        where: { username, tenantId: tenant.id }
    });

    if (!user) {
        console.error(`User '${username}' not found.`);
        process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash }
    });

    console.log(`✅ Password for '${username}' updated successfully!`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());

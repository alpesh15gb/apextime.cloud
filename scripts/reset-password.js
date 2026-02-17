const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.error('Usage: node scripts/reset-password.js <username> <new_password>');
        process.exit(1);
    }

    const username = args[0];
    const password = args[1];

    console.log(`Resetting password for user: ${username}...`);

    const user = await prisma.user.findFirst({
        where: { username }
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

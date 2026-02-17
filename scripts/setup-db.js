const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

process.chdir(path.join(__dirname, '..'));

if (fs.existsSync('.env')) {
    require('dotenv').config();
}

console.log('--- DATABASE SETUP START ---');
console.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'Set' : 'Missing'}`);

try {
    console.log('\n> npx prisma generate');
    execSync('npx prisma generate', { stdio: 'inherit', env: process.env });

    console.log('\n> npx prisma db push');
    execSync('npx prisma db push', { stdio: 'inherit', env: process.env });

    console.log('\n> npx prisma db seed');
    execSync('npx prisma db seed', { stdio: 'inherit', env: process.env });

    console.log('--- DATABASE SETUP COMPLETE ---');
} catch (e) {
    console.error('\nSetup failed.');
    process.exit(1);
}

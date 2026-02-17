const fs = require('fs');
const path = require('path');
const prisma = require('../src/lib/prisma');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);
const bcrypt = require('bcryptjs');

async function main() {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.error('Usage: node scripts/import-attendance.js <tenant_slug> <csv_file_path>');
        console.log('CSV Format: No,TMNo,EnNo,Name,GMNo,Mode,In/Out,Antipass,ProxyWork,DateTime');
        process.exit(1);
    }

    const slug = args[0];
    const filePath = args[1];

    if (!fs.existsSync(filePath)) {
        console.error(`File not found: ${filePath}`);
        process.exit(1);
    }

    // 1. Find Tenant
    const tenant = await prisma.tenant.findUnique({ where: { slug } });
    if (!tenant) {
        console.error(`Tenant '${slug}' not found.`);
        process.exit(1);
    }
    console.log(`organization: ${tenant.name} (${tenant.id})`);

    // 2. Read CSV
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/).filter(l => l.trim() && !l.startsWith('No,')); // Skip empty & header if match

    console.log(`Found ${lines.length} records. Processing...`);

    let processed = 0;
    let createdUsers = 0;

    // Cache for departments/designations to avoid DB calls
    // We will put new users in a default "General" department/designation if missing
    let dept = await prisma.department.findFirst({ where: { tenantId: tenant.id } });
    if (!dept) dept = await prisma.department.create({ data: { tenantId: tenant.id, name: 'General' } });

    let desig = await prisma.designation.findFirst({ where: { tenantId: tenant.id } });
    if (!desig) desig = await prisma.designation.create({ data: { tenantId: tenant.id, name: 'Staff', departmentId: dept.id } });


    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (i === 0) console.log(`DEBUG: First line content: "${line}"`);

        // Parse CSV Line (Detect Tab or Comma)
        let cols = line.split('\t');
        if (cols.length < 5) cols = line.split(',');

        if (i === 0) console.log(`DEBUG: Columns found: ${cols.length}`);

        if (cols.length < 10) {
            if (i < 5) console.warn(`Skipping line ${i + 1}: Not enough columns (${cols.length})`);
            continue;
        }

        const empCode = cols[2]?.trim();
        const name = cols[3]?.trim();
        const dateTimeStr = cols[9]?.trim();

        if (!empCode || !dateTimeStr) continue;

        // 3. User / Employee Sync
        let employee = await prisma.employee.findUnique({
            where: { tenantId_employeeCode: { tenantId: tenant.id, employeeCode: empCode } },
            include: { contact: true }
        });

        if (!employee) {
            // Create New Employee
            console.log(`   + Creating new employee: ${name} (${empCode})`);

            // Split name
            const nameParts = name.split(' ');
            const firstName = nameParts[0];
            const lastName = nameParts.slice(1).join(' ');

            const contact = await prisma.contact.create({
                data: {
                    tenantId: tenant.id,
                    firstName: firstName || 'Unknown',
                    lastName: lastName || '',
                }
            });

            employee = await prisma.employee.create({
                data: {
                    tenantId: tenant.id,
                    contactId: contact.id,
                    employeeCode: empCode,
                    departmentId: dept.id,
                    designationId: desig.id,
                    joiningDate: new Date(),
                }
            });

            // Create Login User
            const passwordHash = await bcrypt.hash('welcome123', 10);
            await prisma.user.create({
                data: {
                    tenantId: tenant.id,
                    username: empCode,
                    passwordHash,
                    role: 'employee',
                    employeeId: employee.id,
                    status: 'active'
                }
            });
            createdUsers++;
        } else {
            // Update Name if generic
            if (name && (employee.contact.firstName === 'Unknown' || employee.contact.firstName !== name.split(' ')[0])) {
                // Optional: Update name if provided in CSV is better? 
                // We'll skip overwriting existing structure to be safe, unless it was 'Unknown'
            }
        }

        // 4. Process Attendance
        // Format: 9/11/2025 8:25 (M/D/YYYY H:mm) based on image "9/11/2025" and current date context
        // Try parsing:
        let punchDate = dayjs(dateTimeStr, 'M/D/YYYY H:mm');
        if (!punchDate.isValid()) {
            punchDate = dayjs(dateTimeStr, 'D/M/YYYY H:mm'); // Try DMY
        }

        if (punchDate.isValid()) {
            const dateOnly = punchDate.startOf('day').toDate();
            const punchTime = punchDate.toDate();

            // Find Timesheet
            const timesheet = await prisma.timesheet.findFirst({
                where: {
                    tenantId: tenant.id,
                    employeeId: employee.id,
                    date: dateOnly
                }
            });

            if (!timesheet) {
                // Create new
                await prisma.timesheet.create({
                    data: {
                        tenantId: tenant.id,
                        employeeId: employee.id,
                        date: dateOnly,
                        inAt: punchTime,
                        source: 'upload',
                        status: 'auto_approved'
                    }
                });
            } else {
                // Update Min/Max
                let newIn = timesheet.inAt;
                let newOut = timesheet.outAt;

                if (!newIn || dayjs(punchTime).isBefore(dayjs(newIn))) {
                    newIn = punchTime;
                }

                // If this punch is AFTER inAt, checking if it is the new "Out"
                // Only if punchTime > newIn (avoid same minute issues)
                if (newIn && dayjs(punchTime).isAfter(dayjs(newIn))) {
                    if (!newOut || dayjs(punchTime).isAfter(dayjs(newOut))) {
                        newOut = punchTime;
                    }
                }

                if (newIn !== timesheet.inAt || newOut !== timesheet.outAt) {
                    await prisma.timesheet.update({
                        where: { id: timesheet.id },
                        data: { inAt: newIn, outAt: newOut }
                    });
                }
            }
            processed++;
        }
    }

    console.log(`\nImport Complete!`);
    console.log(`Processed Logs: ${processed}`);
    console.log(`Created Users: ${createdUsers}`);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());

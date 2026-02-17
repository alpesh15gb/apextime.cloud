const router = require('express').Router();
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');
const { requireRole } = require('../middleware/auth');

// GET /api/employees
router.get('/', async (req, res, next) => {
    try {
        const { departmentId, designationId, status, search, page = 1, limit = 50 } = req.query;
        const where = { tenantId: req.tenantId };

        if (departmentId) where.departmentId = parseInt(departmentId);
        if (designationId) where.designationId = parseInt(designationId);
        if (status) where.status = status;
        if (search) {
            where.OR = [
                { employeeCode: { contains: search, mode: 'insensitive' } },
                { contact: { firstName: { contains: search, mode: 'insensitive' } } },
                { contact: { lastName: { contains: search, mode: 'insensitive' } } },
                { contact: { phone: { contains: search } } },
            ];
        }

        const [employees, total] = await Promise.all([
            prisma.employee.findMany({
                where,
                include: {
                    contact: true,
                    department: true,
                    designation: true,
                },
                orderBy: { employeeCode: 'asc' },
                skip: (parseInt(page) - 1) * parseInt(limit),
                take: parseInt(limit),
            }),
            prisma.employee.count({ where }),
        ]);

        res.json({
            data: employees.map(e => ({
                id: e.id,
                uuid: e.uuid,
                employeeCode: e.employeeCode,
                name: `${e.contact.firstName} ${e.contact.lastName || ''}`.trim(),
                email: e.contact.email,
                phone: e.contact.phone,
                photo: e.contact.photo,
                gender: e.contact.gender,
                department: e.department?.name,
                departmentId: e.departmentId,
                designation: e.designation?.name,
                designationId: e.designationId,
                joiningDate: e.joiningDate,
                leavingDate: e.leavingDate,
                type: e.type,
                status: e.status,
            })),
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / parseInt(limit)),
            },
        });
    } catch (error) { next(error); }
});

// GET /api/employees/:uuid
router.get('/:uuid', async (req, res, next) => {
    try {
        const employee = await prisma.employee.findUnique({
            where: { uuid: req.params.uuid },
            include: {
                contact: true,
                department: true,
                designation: true,
                users: { select: { id: true, username: true, role: true, status: true } },
            },
        });
        if (!employee || employee.tenantId !== req.tenantId) {
            return res.status(404).json({ error: 'Employee not found' });
        }
        res.json(employee);
    } catch (error) { next(error); }
});

// POST /api/employees
router.post('/', requireRole('admin', 'super_admin'), async (req, res, next) => {
    try {
        const {
            employeeCode, firstName, lastName, email, phone, gender, dateOfBirth,
            address, city, state, pincode, bloodGroup,
            departmentId, designationId, joiningDate, type,
            createUser, password,
        } = req.body;

        if (!employeeCode || !firstName) {
            return res.status(400).json({ error: 'Employee code and first name are required' });
        }

        const result = await prisma.$transaction(async (tx) => {
            // Create contact
            const contact = await tx.contact.create({
                data: {
                    tenantId: req.tenantId,
                    firstName, lastName, email, phone, gender,
                    dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
                    address, city, state, pincode, bloodGroup,
                },
            });

            // Create employee
            const employee = await tx.employee.create({
                data: {
                    tenantId: req.tenantId,
                    contactId: contact.id,
                    employeeCode,
                    departmentId: departmentId || null,
                    designationId: designationId || null,
                    joiningDate: new Date(joiningDate || Date.now()),
                    type: type || 'full_time',
                },
                include: { contact: true, department: true, designation: true },
            });

            // Optionally create user account (login = employee code)
            if (createUser !== false) {
                const passwordHash = await bcrypt.hash(password || employeeCode, 10);
                await tx.user.create({
                    data: {
                        tenantId: req.tenantId,
                        username: employeeCode,
                        passwordHash,
                        role: 'employee',
                        employeeId: employee.id,
                    },
                });
            }

            return employee;
        });

        res.status(201).json(result);
    } catch (error) { next(error); }
});

// PUT /api/employees/:uuid
router.put('/:uuid', requireRole('admin', 'super_admin'), async (req, res, next) => {
    try {
        const employee = await prisma.employee.findUnique({
            where: { uuid: req.params.uuid },
        });
        if (!employee || employee.tenantId !== req.tenantId) {
            return res.status(404).json({ error: 'Employee not found' });
        }

        const {
            employeeCode, firstName, lastName, email, phone, gender, dateOfBirth,
            address, city, state, pincode, bloodGroup,
            departmentId, designationId, joiningDate, leavingDate, type, status,
        } = req.body;

        const result = await prisma.$transaction(async (tx) => {
            // Update contact
            // Update contact
            const contactData = {};
            if (firstName) contactData.firstName = firstName;
            if (lastName) contactData.lastName = lastName;
            if (email !== undefined) contactData.email = email;
            if (phone !== undefined) contactData.phone = phone;
            if (gender) contactData.gender = gender;
            if (dateOfBirth) contactData.dateOfBirth = new Date(dateOfBirth);
            if (address !== undefined) contactData.address = address;
            if (city !== undefined) contactData.city = city;
            if (state !== undefined) contactData.state = state;
            if (pincode !== undefined) contactData.pincode = pincode;
            if (bloodGroup !== undefined) contactData.bloodGroup = bloodGroup;

            await tx.contact.update({
                where: { id: employee.contactId },
                data: contactData,
            });

            // Update employee
            const employeeData = {};
            if (employeeCode) employeeData.employeeCode = employeeCode;
            if (departmentId !== undefined) employeeData.departmentId = departmentId;
            if (designationId !== undefined) employeeData.designationId = designationId;
            if (joiningDate) employeeData.joiningDate = new Date(joiningDate);
            if (leavingDate !== undefined) employeeData.leavingDate = leavingDate ? new Date(leavingDate) : null;
            if (type) employeeData.type = type;
            if (status) employeeData.status = status;

            return tx.employee.update({
                where: { id: employee.id },
                data: employeeData,
                include: { contact: true, department: true, designation: true },
            });
        });

        res.json(result);
    } catch (error) { next(error); }
});

// DELETE /api/employees/:uuid
router.delete('/:uuid', requireRole('admin', 'super_admin'), async (req, res, next) => {
    try {
        const employee = await prisma.employee.findUnique({ where: { uuid: req.params.uuid } });
        if (!employee || employee.tenantId !== req.tenantId) {
            return res.status(404).json({ error: 'Employee not found' });
        }

        await prisma.$transaction(async (tx) => {
            await tx.user.deleteMany({ where: { employeeId: employee.id } });
            await tx.employee.delete({ where: { id: employee.id } });
            await tx.contact.delete({ where: { id: employee.contactId } });
        });

        res.json({ message: 'Employee deleted' });
    } catch (error) { next(error); }
});

// POST /api/employees/generate-users - Generate user accounts for employees who don't have one
router.post('/generate-users', requireRole('admin', 'super_admin'), async (req, res, next) => {
    try {
        const employees = await prisma.employee.findMany({
            where: { tenantId: req.tenantId },
            include: { users: true },
        });

        let created = 0;
        for (const emp of employees) {
            if (emp.users.length === 0 && emp.employeeCode) {
                const passwordHash = await bcrypt.hash(emp.employeeCode, 10);
                await prisma.user.create({
                    data: {
                        tenantId: req.tenantId,
                        username: emp.employeeCode,
                        passwordHash,
                        role: 'employee',
                        employeeId: emp.id,
                    },
                });
                created++;
            }
        }

        res.json({ message: `Generated ${created} user accounts`, created });
    } catch (error) { next(error); }
});

module.exports = router;

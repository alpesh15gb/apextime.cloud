const router = require('express').Router();
const prisma = require('../lib/prisma');
const { requireRole } = require('../middleware/auth');

// GET /api/students
router.get('/', async (req, res, next) => {
    try {
        const { batchId, status, search, page = 1, limit = 50 } = req.query;
        const where = { tenantId: req.tenantId };
        if (batchId) where.batchId = parseInt(batchId);
        if (status) where.status = status;
        if (search) {
            where.OR = [
                { admissionNo: { contains: search, mode: 'insensitive' } },
                { contact: { firstName: { contains: search, mode: 'insensitive' } } },
                { contact: { lastName: { contains: search, mode: 'insensitive' } } },
            ];
        }

        const [students, total] = await Promise.all([
            prisma.student.findMany({
                where,
                include: {
                    contact: true,
                    batch: { include: { division: { include: { program: true } } } },
                },
                orderBy: { admissionNo: 'asc' },
                skip: (parseInt(page) - 1) * parseInt(limit),
                take: parseInt(limit),
            }),
            prisma.student.count({ where }),
        ]);

        res.json({
            data: students.map(s => ({
                id: s.id,
                uuid: s.uuid,
                admissionNo: s.admissionNo,
                rollNo: s.rollNo,
                name: `${s.contact.firstName} ${s.contact.lastName || ''}`.trim(),
                email: s.contact.email,
                phone: s.contact.phone,
                photo: s.contact.photo,
                gender: s.contact.gender,
                batch: s.batch ? `${s.batch.division.program.name} - ${s.batch.division.name} - ${s.batch.name}` : null,
                batchId: s.batchId,
                status: s.status,
            })),
            pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) },
        });
    } catch (error) { next(error); }
});

// GET /api/students/:uuid
router.get('/:uuid', async (req, res, next) => {
    try {
        const student = await prisma.student.findUnique({
            where: { uuid: req.params.uuid },
            include: {
                contact: true,
                batch: { include: { division: { include: { program: true } } } },
                guardians: { include: { contact: true } },
            },
        });
        if (!student || student.tenantId !== req.tenantId) {
            return res.status(404).json({ error: 'Student not found' });
        }
        res.json(student);
    } catch (error) { next(error); }
});

// POST /api/students
router.post('/', requireRole('admin', 'super_admin', 'teacher'), async (req, res, next) => {
    try {
        const {
            admissionNo, rollNo, firstName, lastName, email, phone, gender, dateOfBirth,
            address, city, state, pincode, bloodGroup, batchId, admissionDate,
            guardian,
        } = req.body;

        if (!admissionNo || !firstName) {
            return res.status(400).json({ error: 'Admission number and first name are required' });
        }

        const result = await prisma.$transaction(async (tx) => {
            const contact = await tx.contact.create({
                data: {
                    tenantId: req.tenantId,
                    firstName, lastName, email, phone, gender,
                    dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
                    address, city, state, pincode, bloodGroup,
                },
            });

            const student = await tx.student.create({
                data: {
                    tenantId: req.tenantId,
                    contactId: contact.id,
                    admissionNo, rollNo,
                    batchId: batchId ? parseInt(batchId) : null,
                    admissionDate: admissionDate ? new Date(admissionDate) : new Date(),
                },
                include: { contact: true, batch: { include: { division: { include: { program: true } } } } },
            });

            // Create guardian if provided
            if (guardian) {
                const guardianContact = await tx.contact.create({
                    data: {
                        tenantId: req.tenantId,
                        firstName: guardian.firstName,
                        lastName: guardian.lastName,
                        phone: guardian.phone,
                        email: guardian.email,
                    },
                });
                await tx.guardian.create({
                    data: {
                        tenantId: req.tenantId,
                        contactId: guardianContact.id,
                        studentId: student.id,
                        relation: guardian.relation || 'guardian',
                        isPrimary: true,
                    },
                });
            }

            return student;
        });

        res.status(201).json(result);
    } catch (error) { next(error); }
});

// PUT /api/students/:uuid
router.put('/:uuid', requireRole('admin', 'super_admin', 'teacher'), async (req, res, next) => {
    try {
        const student = await prisma.student.findUnique({ where: { uuid: req.params.uuid } });
        if (!student || student.tenantId !== req.tenantId) {
            return res.status(404).json({ error: 'Student not found' });
        }

        const {
            admissionNo, rollNo, firstName, lastName, email, phone, gender, dateOfBirth,
            address, city, state, pincode, bloodGroup, batchId, status,
        } = req.body;

        const result = await prisma.$transaction(async (tx) => {
            await tx.contact.update({
                where: { id: student.contactId },
                data: {
                    firstName, lastName, email, phone, gender,
                    dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
                    address, city, state, pincode, bloodGroup,
                },
            });

            return tx.student.update({
                where: { id: student.id },
                data: {
                    admissionNo, rollNo,
                    batchId: batchId ? parseInt(batchId) : undefined,
                    status,
                },
                include: { contact: true, batch: { include: { division: { include: { program: true } } } } },
            });
        });

        res.json(result);
    } catch (error) { next(error); }
});

// POST /api/students/attendance - Mark batch attendance
router.post('/attendance', requireRole('admin', 'super_admin', 'teacher'), async (req, res, next) => {
    try {
        const { batchId, date, session, values } = req.body;
        // values = { studentId: "present|absent|late" }

        const attendance = await prisma.studentAttendance.upsert({
            where: {
                batchId_date_session: {
                    batchId: parseInt(batchId),
                    date: new Date(date),
                    session: session || 'full_day',
                },
            },
            create: {
                tenantId: req.tenantId,
                batchId: parseInt(batchId),
                date: new Date(date),
                session: session || 'full_day',
                values,
                createdBy: req.userId,
            },
            update: { values },
        });

        res.json({ message: 'Attendance saved', attendance });
    } catch (error) { next(error); }
});

// GET /api/students/attendance/:batchId
router.get('/attendance/:batchId', async (req, res, next) => {
    try {
        const { date, startDate, endDate } = req.query;
        const where = { batchId: parseInt(req.params.batchId) };
        if (date) where.date = new Date(date);
        if (startDate && endDate) where.date = { gte: new Date(startDate), lte: new Date(endDate) };

        const records = await prisma.studentAttendance.findMany({
            where,
            orderBy: { date: 'desc' },
        });
        res.json(records);
    } catch (error) { next(error); }
});

module.exports = router;

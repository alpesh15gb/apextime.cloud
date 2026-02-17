const router = require('express').Router();
const prisma = require('../lib/prisma');
const { requireRole } = require('../middleware/auth');

// ── Academic Sessions ──────────────────────
router.get('/sessions', async (req, res, next) => {
    try {
        const sessions = await prisma.academicSession.findMany({
            where: { tenantId: req.tenantId },
            orderBy: { startDate: 'desc' },
        });
        res.json(sessions);
    } catch (error) { next(error); }
});

router.post('/sessions', requireRole('admin', 'super_admin'), async (req, res, next) => {
    try {
        const { name, shortName, startDate, endDate, isActive } = req.body;

        // If marking as active, deactivate others
        if (isActive) {
            await prisma.academicSession.updateMany({
                where: { tenantId: req.tenantId },
                data: { isActive: false },
            });
        }

        const session = await prisma.academicSession.create({
            data: {
                tenantId: req.tenantId, name, shortName,
                startDate: new Date(startDate), endDate: new Date(endDate),
                isActive: isActive || false,
            },
        });
        res.status(201).json(session);
    } catch (error) { next(error); }
});

router.put('/sessions/:uuid', requireRole('admin', 'super_admin'), async (req, res, next) => {
    try {
        const { name, shortName, startDate, endDate, isActive } = req.body;
        if (isActive) {
            await prisma.academicSession.updateMany({
                where: { tenantId: req.tenantId },
                data: { isActive: false },
            });
        }
        const session = await prisma.academicSession.update({
            where: { uuid: req.params.uuid },
            data: { name, shortName, startDate: startDate ? new Date(startDate) : undefined, endDate: endDate ? new Date(endDate) : undefined, isActive },
        });
        res.json(session);
    } catch (error) { next(error); }
});

// ── Programs ───────────────────────────────
router.get('/programs', async (req, res, next) => {
    try {
        const programs = await prisma.program.findMany({
            where: { tenantId: req.tenantId },
            include: { _count: { select: { divisions: true } } },
            orderBy: { position: 'asc' },
        });
        res.json(programs);
    } catch (error) { next(error); }
});

router.post('/programs', requireRole('admin', 'super_admin'), async (req, res, next) => {
    try {
        const { name, shortName } = req.body;
        const program = await prisma.program.create({
            data: { tenantId: req.tenantId, name, shortName },
        });
        res.status(201).json(program);
    } catch (error) { next(error); }
});

router.put('/programs/:uuid', requireRole('admin', 'super_admin'), async (req, res, next) => {
    try {
        const program = await prisma.program.update({
            where: { uuid: req.params.uuid },
            data: req.body,
        });
        res.json(program);
    } catch (error) { next(error); }
});

router.delete('/programs/:uuid', requireRole('admin', 'super_admin'), async (req, res, next) => {
    try {
        await prisma.program.delete({ where: { uuid: req.params.uuid } });
        res.json({ message: 'Program deleted' });
    } catch (error) { next(error); }
});

// ── Divisions ──────────────────────────────
router.get('/divisions', async (req, res, next) => {
    try {
        const where = { tenantId: req.tenantId };
        if (req.query.programId) where.programId = parseInt(req.query.programId);
        const divisions = await prisma.division.findMany({
            where,
            include: { program: true, _count: { select: { batches: true } } },
            orderBy: { position: 'asc' },
        });
        res.json(divisions);
    } catch (error) { next(error); }
});

router.post('/divisions', requireRole('admin', 'super_admin'), async (req, res, next) => {
    try {
        const { programId, name, shortName } = req.body;
        const division = await prisma.division.create({
            data: { tenantId: req.tenantId, programId: parseInt(programId), name, shortName },
        });
        res.status(201).json(division);
    } catch (error) { next(error); }
});

router.put('/divisions/:uuid', requireRole('admin', 'super_admin'), async (req, res, next) => {
    try {
        const { name, shortName, position, status } = req.body;
        const division = await prisma.division.update({
            where: { uuid: req.params.uuid },
            data: { name, shortName, position, status },
        });
        res.json(division);
    } catch (error) { next(error); }
});

router.delete('/divisions/:uuid', requireRole('admin', 'super_admin'), async (req, res, next) => {
    try {
        await prisma.division.delete({ where: { uuid: req.params.uuid } });
        res.json({ message: 'Division deleted' });
    } catch (error) { next(error); }
});

// ── Batches ────────────────────────────────
router.get('/batches', async (req, res, next) => {
    try {
        const where = { tenantId: req.tenantId };
        if (req.query.divisionId) where.divisionId = parseInt(req.query.divisionId);
        const batches = await prisma.batch.findMany({
            where,
            include: { division: { include: { program: true } }, _count: { select: { students: true } } },
            orderBy: [{ division: { position: 'asc' } }, { position: 'asc' }],
        });
        res.json(batches);
    } catch (error) { next(error); }
});

router.post('/batches', requireRole('admin', 'super_admin'), async (req, res, next) => {
    try {
        const { divisionId, name, maxStrength } = req.body;
        const batch = await prisma.batch.create({
            data: { tenantId: req.tenantId, divisionId: parseInt(divisionId), name, maxStrength },
        });
        res.status(201).json(batch);
    } catch (error) { next(error); }
});

router.put('/batches/:uuid', requireRole('admin', 'super_admin'), async (req, res, next) => {
    try {
        const { name, maxStrength, position, status } = req.body;
        const batch = await prisma.batch.update({
            where: { uuid: req.params.uuid },
            data: { name, maxStrength, position, status },
        });
        res.json(batch);
    } catch (error) { next(error); }
});

router.delete('/batches/:uuid', requireRole('admin', 'super_admin'), async (req, res, next) => {
    try {
        await prisma.batch.delete({ where: { uuid: req.params.uuid } });
        res.json({ message: 'Batch deleted' });
    } catch (error) { next(error); }
});

// ── Subjects ───────────────────────────────
router.get('/subjects', async (req, res, next) => {
    try {
        const subjects = await prisma.subject.findMany({
            where: { tenantId: req.tenantId },
            orderBy: { position: 'asc' },
        });
        res.json(subjects);
    } catch (error) { next(error); }
});

router.post('/subjects', requireRole('admin', 'super_admin'), async (req, res, next) => {
    try {
        const { name, code, type } = req.body;
        const subject = await prisma.subject.create({
            data: { tenantId: req.tenantId, name, code, type },
        });
        res.status(201).json(subject);
    } catch (error) { next(error); }
});

router.put('/subjects/:uuid', requireRole('admin', 'super_admin'), async (req, res, next) => {
    try {
        const subject = await prisma.subject.update({
            where: { uuid: req.params.uuid },
            data: req.body,
        });
        res.json(subject);
    } catch (error) { next(error); }
});

router.delete('/subjects/:uuid', requireRole('admin', 'super_admin'), async (req, res, next) => {
    try {
        await prisma.subject.delete({ where: { uuid: req.params.uuid } });
        res.json({ message: 'Subject deleted' });
    } catch (error) { next(error); }
});

module.exports = router;

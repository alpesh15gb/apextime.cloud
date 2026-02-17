const router = require('express').Router();
const prisma = require('../lib/prisma');
const { requireRole } = require('../middleware/auth');

// GET /api/designations
router.get('/', async (req, res, next) => {
    try {
        const where = { tenantId: req.tenantId };
        if (req.query.departmentId) where.departmentId = parseInt(req.query.departmentId);
        const designations = await prisma.designation.findMany({
            where,
            include: { department: true, _count: { select: { employees: true } } },
            orderBy: { position: 'asc' },
        });
        res.json(designations);
    } catch (error) { next(error); }
});

// POST /api/designations
router.post('/', requireRole('admin', 'super_admin'), async (req, res, next) => {
    try {
        const { name, departmentId } = req.body;
        const desig = await prisma.designation.create({
            data: { tenantId: req.tenantId, name, departmentId },
        });
        res.status(201).json(desig);
    } catch (error) { next(error); }
});

// PUT /api/designations/:uuid
router.put('/:uuid', requireRole('admin', 'super_admin'), async (req, res, next) => {
    try {
        const { name, departmentId, position, status } = req.body;
        const desig = await prisma.designation.update({
            where: { uuid: req.params.uuid },
            data: { name, departmentId, position, status },
        });
        res.json(desig);
    } catch (error) { next(error); }
});

// DELETE /api/designations/:uuid
router.delete('/:uuid', requireRole('admin', 'super_admin'), async (req, res, next) => {
    try {
        await prisma.designation.delete({ where: { uuid: req.params.uuid } });
        res.json({ message: 'Designation deleted' });
    } catch (error) { next(error); }
});

module.exports = router;

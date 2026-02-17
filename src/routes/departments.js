const router = require('express').Router();
const prisma = require('../lib/prisma');
const { requireRole } = require('../middleware/auth');

// GET /api/departments
router.get('/', async (req, res, next) => {
    try {
        const departments = await prisma.department.findMany({
            where: { tenantId: req.tenantId },
            include: { _count: { select: { employees: true } } },
            orderBy: { position: 'asc' },
        });
        res.json(departments);
    } catch (error) { next(error); }
});

// POST /api/departments
router.post('/', requireRole('admin', 'super_admin'), async (req, res, next) => {
    try {
        const { name, description, parentId } = req.body;
        const dept = await prisma.department.create({
            data: { tenantId: req.tenantId, name, description, parentId },
        });
        res.status(201).json(dept);
    } catch (error) { next(error); }
});

// PUT /api/departments/:uuid
router.put('/:uuid', requireRole('admin', 'super_admin'), async (req, res, next) => {
    try {
        const { name, description, parentId, position, status } = req.body;
        const dept = await prisma.department.update({
            where: { uuid: req.params.uuid },
            data: { name, description, parentId, position, status },
        });
        res.json(dept);
    } catch (error) { next(error); }
});

// DELETE /api/departments/:uuid
router.delete('/:uuid', requireRole('admin', 'super_admin'), async (req, res, next) => {
    try {
        await prisma.department.delete({ where: { uuid: req.params.uuid } });
        res.json({ message: 'Department deleted' });
    } catch (error) { next(error); }
});

module.exports = router;

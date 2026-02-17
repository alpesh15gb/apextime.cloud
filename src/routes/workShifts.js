const router = require('express').Router();
const prisma = require('../lib/prisma');
const { requireRole } = require('../middleware/auth');

// GET /api/work-shifts
router.get('/', async (req, res, next) => {
    try {
        const shifts = await prisma.workShift.findMany({
            where: { tenantId: req.tenantId },
            orderBy: { name: 'asc' },
        });
        res.json(shifts);
    } catch (error) { next(error); }
});

// POST /api/work-shifts
router.post('/', requireRole('admin', 'super_admin'), async (req, res, next) => {
    try {
        const { name, records } = req.body;
        // records = [{day: 'monday', startTime: '09:00', endTime: '18:00', isOvernight: false, isOff: false}]
        const shift = await prisma.workShift.create({
            data: { tenantId: req.tenantId, name, records: records || [] },
        });
        res.status(201).json(shift);
    } catch (error) { next(error); }
});

// PUT /api/work-shifts/:uuid
router.put('/:uuid', requireRole('admin', 'super_admin'), async (req, res, next) => {
    try {
        const { name, records, status } = req.body;
        const shift = await prisma.workShift.update({
            where: { uuid: req.params.uuid },
            data: { name, records, status },
        });
        res.json(shift);
    } catch (error) { next(error); }
});

// POST /api/work-shifts/:uuid/assign - Assign employees to shift
router.post('/:uuid/assign', requireRole('admin', 'super_admin'), async (req, res, next) => {
    try {
        const shift = await prisma.workShift.findUnique({ where: { uuid: req.params.uuid } });
        if (!shift || shift.tenantId !== req.tenantId) {
            return res.status(404).json({ error: 'Work shift not found' });
        }

        const { employeeIds, startDate, endDate } = req.body;

        const assignments = await Promise.all(
            employeeIds.map(empId =>
                prisma.employeeWorkShift.create({
                    data: {
                        employeeId: parseInt(empId),
                        workShiftId: shift.id,
                        startDate: new Date(startDate),
                        endDate: new Date(endDate),
                    },
                })
            )
        );

        res.json({ message: `Assigned ${assignments.length} employees`, assignments });
    } catch (error) { next(error); }
});

// DELETE /api/work-shifts/:uuid
router.delete('/:uuid', requireRole('admin', 'super_admin'), async (req, res, next) => {
    try {
        await prisma.workShift.delete({ where: { uuid: req.params.uuid } });
        res.json({ message: 'Work shift deleted' });
    } catch (error) { next(error); }
});

module.exports = router;

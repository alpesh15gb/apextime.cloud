const router = require('express').Router();
const prisma = require('../lib/prisma');
const { requireRole } = require('../middleware/auth');

// GET /api/announcements
router.get('/', async (req, res, next) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const where = { tenantId: req.tenantId };
        if (status) where.status = status;

        // Non-admins only see published
        if (!['admin', 'super_admin'].includes(req.user.role)) {
            where.status = 'published';
        }

        const [announcements, total] = await Promise.all([
            prisma.announcement.findMany({
                where,
                include: { creator: { select: { username: true } } },
                orderBy: { createdAt: 'desc' },
                skip: (parseInt(page) - 1) * parseInt(limit),
                take: parseInt(limit),
            }),
            prisma.announcement.count({ where }),
        ]);

        res.json({
            data: announcements,
            pagination: { total, page: parseInt(page), limit: parseInt(limit) },
        });
    } catch (error) { next(error); }
});

// POST /api/announcements
router.post('/', requireRole('admin', 'super_admin'), async (req, res, next) => {
    try {
        const { title, body, audienceType, audienceIds, priority } = req.body;
        const announcement = await prisma.announcement.create({
            data: {
                tenantId: req.tenantId,
                title, body,
                audienceType: audienceType || 'all',
                audienceIds: audienceIds || [],
                priority: priority || 'normal',
                createdBy: req.userId,
            },
        });
        res.status(201).json(announcement);
    } catch (error) { next(error); }
});

// POST /api/announcements/:uuid/publish
router.post('/:uuid/publish', requireRole('admin', 'super_admin'), async (req, res, next) => {
    try {
        const announcement = await prisma.announcement.update({
            where: { uuid: req.params.uuid },
            data: { status: 'published', publishedAt: new Date() },
        });
        res.json({ message: 'Published', announcement });
    } catch (error) { next(error); }
});

// PUT /api/announcements/:uuid
router.put('/:uuid', requireRole('admin', 'super_admin'), async (req, res, next) => {
    try {
        const { title, body, audienceType, audienceIds, priority } = req.body;
        const announcement = await prisma.announcement.update({
            where: { uuid: req.params.uuid },
            data: { title, body, audienceType, audienceIds, priority },
        });
        res.json(announcement);
    } catch (error) { next(error); }
});

// DELETE /api/announcements/:uuid
router.delete('/:uuid', requireRole('admin', 'super_admin'), async (req, res, next) => {
    try {
        await prisma.announcement.delete({ where: { uuid: req.params.uuid } });
        res.json({ message: 'Announcement deleted' });
    } catch (error) { next(error); }
});

module.exports = router;

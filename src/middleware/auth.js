const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

const JWT_SECRET = process.env.JWT_SECRET || 'apextime-cloud-secret';

/**
 * Auth middleware - validates JWT and attaches user to request
 */
async function authMiddleware(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);

        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            include: {
                employee: {
                    include: {
                        contact: true,
                        department: true,
                        designation: true,
                    },
                },
            },
        });

        if (!user || user.status !== 'active') {
            return res.status(401).json({ error: 'Invalid or inactive user' });
        }

        // Verify tenant matches
        if (req.tenantId && user.tenantId !== req.tenantId) {
            return res.status(403).json({ error: 'Access denied for this organization' });
        }

        req.user = user;
        req.userId = user.id;
        if (!req.tenantId) {
            req.tenantId = user.tenantId;
        }

        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Token expired' });
        }
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: 'Invalid token' });
        }
        console.error('Auth middleware error:', error);
        res.status(500).json({ error: 'Authentication failed' });
    }
}

/**
 * Role-based access control middleware
 */
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'Insufficient permissions',
                message: `Required role: ${roles.join(' or ')}`,
            });
        }
        next();
    };
}

module.exports = { authMiddleware, requireRole, JWT_SECRET };

/**
 * Global error handler middleware
 */
function errorHandler(err, req, res, next) {
    console.error('Error:', err.message);
    if (process.env.NODE_ENV === 'development') {
        console.error(err.stack);
    }

    // Prisma errors
    if (err.code === 'P2002') {
        const field = err.meta?.target?.[0] || 'field';
        return res.status(409).json({
            error: 'Duplicate entry',
            message: `A record with this ${field} already exists.`,
        });
    }

    if (err.code === 'P2025') {
        return res.status(404).json({
            error: 'Not found',
            message: 'The requested record was not found.',
        });
    }

    // Validation errors
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Validation failed',
            message: err.message,
            details: err.details,
        });
    }

    // Multer file upload errors
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
            error: 'File too large',
            message: 'Maximum file size is 5MB.',
        });
    }

    // Default
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    });
}

module.exports = { errorHandler };

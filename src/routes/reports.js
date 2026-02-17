const router = require('express').Router();
const prisma = require('../lib/prisma');
const dayjs = require('dayjs');

// Helper to format duration (ms -> HH:mm)
const formatDuration = (ms) => {
    if (!ms || ms < 0) return '00:00';
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

// GET /api/reports/monthly
router.get('/monthly', async (req, res, next) => {
    try {
        const { month, year, departmentId } = req.query;
        // Default to current month if not provided
        const m = month ? parseInt(month) : dayjs().month() + 1;
        const y = year ? parseInt(year) : dayjs().year();

        const startOfMonth = dayjs(`${y}-${m}-01`).startOf('month');
        const endOfMonth = startOfMonth.endOf('month');
        const daysInMonth = endOfMonth.date();

        // 1. Fetch Employees
        const where = { tenantId: req.tenantId, status: 'active' };
        if (departmentId) where.departmentId = parseInt(departmentId);

        const employees = await prisma.employee.findMany({
            where,
            include: {
                contact: true,
                department: true,
                designation: true,
            },
            orderBy: { employeeCode: 'asc' }
        });

        // 2. Fetch Timesheets
        const timesheets = await prisma.timesheet.findMany({
            where: {
                tenantId: req.tenantId,
                date: { gte: startOfMonth.toDate(), lte: endOfMonth.toDate() },
                employeeId: { in: employees.map(e => e.id) }
            }
        });

        // 3. Build Grid Data
        const reportData = employees.map(emp => {
            const rowData = {
                id: emp.id,
                name: `${emp.contact.firstName} ${emp.contact.lastName || ''}`.trim(),
                code: emp.employeeCode,
                designation: emp.designation?.name || '-',
                department: emp.department?.name || '-',
                days: {}, // 1: { in: '09:00', out: '18:00', status: 'P', ... }
                stats: {
                    present: 0,
                    absent: 0,
                    wo: 0, // Weekly Off
                    leave: 0,
                    totalWorkMs: 0
                }
            };

            // Loop 1 to end of month
            for (let d = 1; d <= daysInMonth; d++) {
                // Use dayjs to get date context
                const currentDay = startOfMonth.date(d);
                const dayOfWeek = currentDay.day(); // 0 is Sunday

                let status = 'A'; // Default Absent
                let shift = 'GEN';
                let inTime = '';
                let outTime = '';
                let late = '00:00';
                let early = '00:00';
                let workMs = 0;

                // Weekend Logic (Assuming Sunday is Off)
                if (dayOfWeek === 0) {
                    status = 'WO';
                    shift = 'OFF';
                }

                // Find punch
                // Filter timesheets in memory (efficient enough for <100 employees)
                const record = timesheets.find(t => t.employeeId === emp.id && dayjs(t.date).date() === d);

                if (record) {
                    if (record.inAt) {
                        inTime = dayjs(record.inAt).format('HH:mm');
                        status = 'P'; // Present if punched in
                    }
                    if (record.outAt) {
                        outTime = dayjs(record.outAt).format('HH:mm');
                        workMs = dayjs(record.outAt).diff(dayjs(record.inAt));
                    }

                    // Override WO if worked
                    if (status === 'P' && shift === 'OFF') {
                        // Worked on Off Day -> OT? 
                        // Keep status P
                    }
                }

                // Update Stats
                if (status === 'P') rowData.stats.present++;
                else if (status === 'A') rowData.stats.absent++;
                else if (status === 'WO') rowData.stats.wo++;

                rowData.stats.totalWorkMs += workMs;

                rowData.days[d] = {
                    in: inTime,
                    out: outTime,
                    shift,
                    status,
                    late,
                    early,
                    workHrs: formatDuration(workMs)
                };
            }

            rowData.stats.totalWorkHrs = formatDuration(rowData.stats.totalWorkMs);
            return rowData;
        });

        res.json({
            meta: {
                monthName: startOfMonth.format('MMMM'),
                year: y,
                daysInMonth
            },
            data: reportData
        });

    } catch (error) { next(error); }
});

// GET /api/reports/approvals
router.get('/approvals', async (req, res, next) => {
    try {
        const { startDate, endDate, status } = req.query;

        const start = startDate ? new Date(startDate) : dayjs().startOf('month').toDate();
        const end = endDate ? new Date(endDate) : dayjs().endOf('month').toDate();

        const where = {
            tenantId: req.tenantId,
            date: { gte: start, lte: end },
            // If status is provided, use it. Otherwise default to approved/rejected.
            status: status ? status : { in: ['approved', 'rejected', 'pending'] }
        };

        const records = await prisma.timesheet.findMany({
            where,
            include: {
                employee: {
                    include: {
                        contact: true,
                        department: true
                    }
                },
                reviewer: {
                    select: { username: true, role: true }
                }
            },
            orderBy: { date: 'desc' }
        });

        const formatted = records.map(r => ({
            id: r.id,
            date: dayjs(r.date).format('YYYY-MM-DD'),
            employeeName: `${r.employee.contact.firstName} ${r.employee.contact.lastName || ''}`.trim(),
            employeeCode: r.employee.employeeCode,
            department: r.employee.department?.name || '-',
            inTime: r.inAt ? dayjs(r.inAt).format('HH:mm') : '-',
            outTime: r.outAt ? dayjs(r.outAt).format('HH:mm') : '-',
            status: r.status,
            reviewedBy: r.reviewer?.username || (r.status === 'auto_approved' ? 'System' : '-'),
            reviewedAt: r.reviewedAt ? dayjs(r.reviewedAt).format('YYYY-MM-DD HH:mm') : '-',
            remarks: r.remarks || '-',
            photoUrl: r.meta?.photo_url || null,
            location: r.meta?.latitude ? `${r.meta.latitude}, ${r.meta.longitude}` : '-'
        }));

        res.json(formatted);

    } catch (error) { next(error); }
});

module.exports = router;

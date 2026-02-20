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

// Map dayjs day() (0=Sun, 1=Mon...) to shift record day names
const DAY_MAP = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

// Parse "HH:mm" to minutes since midnight
const timeToMinutes = (t) => {
    if (!t) return null;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
};

// Find the active shift for an employee on a specific date
const getEmployeeShiftForDate = (empId, dateObj, shiftAssignments) => {
    const assignments = shiftAssignments[empId];
    if (!assignments || assignments.length === 0) return null;

    const dateMs = dateObj.valueOf();
    // Find an assignment where startDate <= date <= endDate
    for (const assign of assignments) {
        if (dateMs >= assign.startMs && dateMs <= assign.endMs) {
            const dayName = DAY_MAP[dateObj.day()];
            const dayRecord = (assign.shift.records || []).find(r => r.day === dayName);
            return {
                shiftName: assign.shift.name,
                dayRecord: dayRecord || null,
            };
        }
    }
    return null;
};

// GET /api/reports/monthly
router.get('/monthly', async (req, res, next) => {
    try {
        const { month, year, departmentId } = req.query;
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

        const empIds = employees.map(e => e.id);

        // 2. Fetch Timesheets
        const timesheets = await prisma.timesheet.findMany({
            where: {
                tenantId: req.tenantId,
                date: { gte: startOfMonth.toDate(), lte: endOfMonth.toDate() },
                employeeId: { in: empIds }
            }
        });

        // 3. Fetch Shift Assignments for all employees in this month range
        const rawAssignments = await prisma.employeeWorkShift.findMany({
            where: {
                employeeId: { in: empIds },
                startDate: { lte: endOfMonth.toDate() },
                endDate: { gte: startOfMonth.toDate() },
            },
            include: {
                workShift: true
            }
        });

        // Index assignments by employeeId for fast lookup
        const shiftAssignments = {};
        for (const a of rawAssignments) {
            if (!shiftAssignments[a.employeeId]) shiftAssignments[a.employeeId] = [];
            shiftAssignments[a.employeeId].push({
                startMs: dayjs(a.startDate).startOf('day').valueOf(),
                endMs: dayjs(a.endDate).endOf('day').valueOf(),
                shift: a.workShift,
            });
        }

        // 4. Build Grid Data
        const reportData = employees.map(emp => {
            const rowData = {
                id: emp.id,
                name: `${emp.contact.firstName} ${emp.contact.lastName || ''}`.trim(),
                code: emp.employeeCode,
                designation: emp.designation?.name || '-',
                department: emp.department?.name || '-',
                days: {},
                stats: {
                    present: 0,
                    absent: 0,
                    wo: 0,
                    leave: 0,
                    totalWorkMs: 0,
                    totalOtMs: 0,
                    totalLateMs: 0,
                }
            };

            for (let d = 1; d <= daysInMonth; d++) {
                const currentDay = startOfMonth.date(d);
                const dayOfWeek = currentDay.day(); // 0 = Sunday

                let status = 'A'; // Default Absent
                let shiftName = 'GEN';
                let inTime = '';
                let outTime = '';
                let late = '00:00';
                let early = '00:00';
                let ot = '00:00';
                let workMs = 0;
                let lateMs = 0;
                let otMs = 0;

                // === Resolve Shift ===
                const empShift = getEmployeeShiftForDate(emp.id, currentDay, shiftAssignments);

                if (empShift) {
                    // Shift is assigned
                    shiftName = empShift.shiftName;
                    const dayRec = empShift.dayRecord;

                    if (dayRec && dayRec.isOff) {
                        // Weekly off per shift definition
                        status = 'WO';
                        shiftName = 'OFF';
                    }

                    // Find punch
                    const record = timesheets.find(t => t.employeeId === emp.id && dayjs(t.date).date() === d);

                    if (record) {
                        if (record.inAt) {
                            inTime = dayjs(record.inAt).format('HH:mm');
                            status = 'P';
                        }
                        if (record.outAt) {
                            outTime = dayjs(record.outAt).format('HH:mm');
                            workMs = dayjs(record.outAt).diff(dayjs(record.inAt));
                        }

                        // === Late / OT / Early Calculation ===
                        if (dayRec && !dayRec.isOff) {
                            const shiftStartMins = timeToMinutes(dayRec.startTime);
                            const shiftEndMins = timeToMinutes(dayRec.endTime);
                            const graceMins = dayRec.graceMins || 0;

                            // Late = punchIn > (shiftStart + grace)
                            if (record.inAt && shiftStartMins !== null) {
                                const punchInMins = dayjs(record.inAt).hour() * 60 + dayjs(record.inAt).minute();
                                const allowedStart = shiftStartMins + graceMins;
                                if (punchInMins > allowedStart) {
                                    lateMs = (punchInMins - shiftStartMins) * 60000; // Late from shift start, not from grace end
                                    late = formatDuration(lateMs);
                                }
                            }

                            // OT = punchOut > shiftEnd (only for non-overnight for now)
                            if (record.outAt && shiftEndMins !== null && !dayRec.isOvernight) {
                                const punchOutMins = dayjs(record.outAt).hour() * 60 + dayjs(record.outAt).minute();
                                if (punchOutMins > shiftEndMins) {
                                    otMs = (punchOutMins - shiftEndMins) * 60000;
                                    ot = formatDuration(otMs);
                                }
                            }

                            // Early = punchOut < shiftEnd
                            if (record.outAt && shiftEndMins !== null && !dayRec.isOvernight) {
                                const punchOutMins = dayjs(record.outAt).hour() * 60 + dayjs(record.outAt).minute();
                                if (punchOutMins < shiftEndMins) {
                                    const earlyMs = (shiftEndMins - punchOutMins) * 60000;
                                    early = formatDuration(earlyMs);
                                }
                            }
                        }

                        // Worked on OFF day = OT (entire work duration is OT)
                        if (dayRec && dayRec.isOff && record.inAt) {
                            status = 'P'; // Override WO to P since they worked
                            if (workMs > 0) {
                                otMs = workMs;
                                ot = formatDuration(otMs);
                            }
                        }
                    }
                } else {
                    // No shift assigned — fallback: Sunday = WO, rest = GEN
                    if (dayOfWeek === 0) {
                        status = 'WO';
                        shiftName = 'OFF';
                    }

                    // Find punch (same logic as before)
                    const record = timesheets.find(t => t.employeeId === emp.id && dayjs(t.date).date() === d);
                    if (record) {
                        if (record.inAt) {
                            inTime = dayjs(record.inAt).format('HH:mm');
                            status = 'P';
                        }
                        if (record.outAt) {
                            outTime = dayjs(record.outAt).format('HH:mm');
                            workMs = dayjs(record.outAt).diff(dayjs(record.inAt));
                        }
                        if (status === 'P' && dayOfWeek === 0) {
                            // Worked on Sunday without shift = OT
                            if (workMs > 0) {
                                otMs = workMs;
                                ot = formatDuration(otMs);
                            }
                        }
                    }
                }

                // Update Stats
                if (status === 'P') rowData.stats.present++;
                else if (status === 'A') rowData.stats.absent++;
                else if (status === 'WO') rowData.stats.wo++;

                rowData.stats.totalWorkMs += workMs;
                rowData.stats.totalOtMs += otMs;
                rowData.stats.totalLateMs += lateMs;

                rowData.days[d] = {
                    in: inTime,
                    out: outTime,
                    shift: shiftName,
                    status,
                    late,
                    early,
                    ot,
                    workHrs: formatDuration(workMs)
                };
            }

            rowData.stats.totalWorkHrs = formatDuration(rowData.stats.totalWorkMs);
            rowData.stats.totalOtHrs = formatDuration(rowData.stats.totalOtMs);
            rowData.stats.totalLateHrs = formatDuration(rowData.stats.totalLateMs);
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

        const formatted = records.map(r => {
            const lat = r.meta?.in?.latitude || r.meta?.latitude;
            const lng = r.meta?.in?.longitude || r.meta?.longitude;

            return {
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
                photoUrl: r.meta?.in?.photo_url || r.meta?.photo_url || null,
                location: lat ? `${lat}, ${lng}` : '-'
            };
        });

        res.json(formatted);

    } catch (error) { next(error); }
});

// GET /api/reports/fix-timezone-dates (Temporary Data Fix)
router.get('/fix-timezone-dates', async (req, res, next) => {
    try {
        console.log('Starting migration to fix shifted timezone dates for imported attendance...');

        // Fetch all timesheets from uploads
        const timesheets = await prisma.timesheet.findMany({
            where: {
                source: 'upload'
            }
        });

        console.log(`Found ${timesheets.length} uploaded timesheet records.`);

        let updated = 0;

        for (const ts of timesheets) {
            if (!ts.inAt) continue; // Safety check

            const currentDbDate = dayjs(ts.date).format('YYYY-MM-DD');

            // Let's create the correct intended date from the actual punch time (inAt)
            const punchDayjs = dayjs(ts.inAt);

            // Because of the timezone issue, we need to extract year/month/date in local time
            // and create a UTC midnight date for it.
            const intendedDate = new Date(Date.UTC(punchDayjs.year(), punchDayjs.month(), punchDayjs.date()));

            const intendedDbDate = dayjs(intendedDate).format('YYYY-MM-DD');

            // Check if the date is shifted. The actual inAt day of month should match the date column's day of month
            if (currentDbDate !== intendedDbDate) {
                console.log(`[Fixing Shift] Employee: ${ts.employeeId} | Old Date: ${currentDbDate} -> New Date: ${intendedDbDate}`);

                await prisma.timesheet.update({
                    where: { id: ts.id },
                    data: {
                        date: intendedDate
                    }
                });
                updated++;
            }
        }

        res.json({ message: `Migration complete! Fixed ${updated} out of ${timesheets.length} uploaded timesheet records.` });
    } catch (error) { next(error); }
});

module.exports = router;

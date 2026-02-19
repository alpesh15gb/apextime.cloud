const router = require('express').Router();
const prisma = require('../lib/prisma');
const { requireRole } = require('../middleware/auth');
const dayjs = require('dayjs');

// ─── COMP-OFF CRUD ────────────────────────────

// GET /api/compoff?month=&year=&employeeId=
router.get('/', async (req, res, next) => {
    try {
        const { month, year, employeeId } = req.query;
        const where = { tenantId: req.tenantId };
        if (month) where.month = parseInt(month);
        if (year) where.year = parseInt(year);
        if (employeeId) where.employeeId = parseInt(employeeId);

        const entries = await prisma.compOff.findMany({
            where,
            include: {
                employee: { include: { contact: true, department: true, designation: true } },
                approver: { select: { username: true } },
            },
            orderBy: [{ employeeId: 'asc' }, { date: 'asc' }],
        });

        res.json(entries.map(e => ({
            id: e.id,
            uuid: e.uuid,
            employeeId: e.employeeId,
            employeeName: `${e.employee.contact.firstName} ${e.employee.contact.lastName || ''}`.trim(),
            employeeCode: e.employee.employeeCode,
            date: dayjs(e.date).format('DD/MM/YYYY'),
            dateRaw: e.date,
            hours: e.hours,
            days: e.days,
            reason: e.reason,
            status: e.status,
            approvedBy: e.approver?.username || null,
            month: e.month,
            year: e.year,
        })));
    } catch (error) { next(error); }
});

// POST /api/compoff
router.post('/', requireRole('admin', 'super_admin'), async (req, res, next) => {
    try {
        const { employeeId, date, hours, reason, month, year } = req.body;
        const days = parseFloat((hours / 8).toFixed(2));

        const entry = await prisma.compOff.create({
            data: {
                tenantId: req.tenantId,
                employeeId: parseInt(employeeId),
                date: new Date(date),
                hours: parseFloat(hours),
                days,
                reason,
                month: parseInt(month),
                year: parseInt(year),
            },
        });
        res.status(201).json(entry);
    } catch (error) { next(error); }
});

// POST /api/compoff/:uuid/approve
router.post('/:uuid/approve', requireRole('admin', 'super_admin'), async (req, res, next) => {
    try {
        const entry = await prisma.compOff.update({
            where: { uuid: req.params.uuid },
            data: { status: 'approved', approvedBy: req.userId },
        });
        res.json(entry);
    } catch (error) { next(error); }
});

// POST /api/compoff/:uuid/reject
router.post('/:uuid/reject', requireRole('admin', 'super_admin'), async (req, res, next) => {
    try {
        const entry = await prisma.compOff.update({
            where: { uuid: req.params.uuid },
            data: { status: 'rejected' },
        });
        res.json(entry);
    } catch (error) { next(error); }
});

// DELETE /api/compoff/:uuid
router.delete('/:uuid', requireRole('admin', 'super_admin'), async (req, res, next) => {
    try {
        await prisma.compOff.delete({ where: { uuid: req.params.uuid } });
        res.json({ message: 'Deleted' });
    } catch (error) { next(error); }
});

// ─── PERMISSION ENTRIES CRUD ─────────────────────

// GET /api/compoff/permissions?month=&year=
router.get('/permissions', async (req, res, next) => {
    try {
        const { month, year, employeeId } = req.query;
        const where = { tenantId: req.tenantId };
        if (month) where.month = parseInt(month);
        if (year) where.year = parseInt(year);
        if (employeeId) where.employeeId = parseInt(employeeId);

        const entries = await prisma.permissionEntry.findMany({
            where,
            include: {
                employee: { include: { contact: true } },
            },
            orderBy: [{ employeeId: 'asc' }, { date: 'asc' }],
        });

        res.json(entries.map(e => ({
            id: e.id,
            uuid: e.uuid,
            employeeId: e.employeeId,
            employeeName: `${e.employee.contact.firstName} ${e.employee.contact.lastName || ''}`.trim(),
            date: dayjs(e.date).format('DD/MM/YYYY'),
            dateRaw: e.date,
            type: e.type,
            hours: e.hours,
            days: e.days,
            remarks: e.remarks,
            month: e.month,
            year: e.year,
        })));
    } catch (error) { next(error); }
});

// POST /api/compoff/permissions
router.post('/permissions', requireRole('admin', 'super_admin'), async (req, res, next) => {
    try {
        const { employeeId, date, type, hours, remarks, month, year } = req.body;
        const days = parseFloat((hours / 8).toFixed(2));

        const entry = await prisma.permissionEntry.create({
            data: {
                tenantId: req.tenantId,
                employeeId: parseInt(employeeId),
                date: new Date(date),
                type, // late_coming, early_going, general
                hours: parseFloat(hours),
                days,
                remarks,
                month: parseInt(month),
                year: parseInt(year),
            },
        });
        res.status(201).json(entry);
    } catch (error) { next(error); }
});

// DELETE /api/compoff/permissions/:uuid
router.delete('/permissions/:uuid', requireRole('admin', 'super_admin'), async (req, res, next) => {
    try {
        await prisma.permissionEntry.delete({ where: { uuid: req.params.uuid } });
        res.json({ message: 'Deleted' });
    } catch (error) { next(error); }
});

// ─── DETAILS (per-employee monthly breakdown) ───

// GET /api/compoff/details?month=&year=
router.get('/details', async (req, res, next) => {
    try {
        const m = parseInt(req.query.month) || (dayjs().month() + 1);
        const y = parseInt(req.query.year) || dayjs().year();

        const startOfMonth = dayjs(`${y}-${m}-01`).startOf('month').toDate();
        const endOfMonth = dayjs(`${y}-${m}-01`).endOf('month').toDate();

        // Fetch all active employees
        const employees = await prisma.employee.findMany({
            where: { tenantId: req.tenantId, status: 'active' },
            include: { contact: true, department: true, designation: true },
            orderBy: { employeeCode: 'asc' },
        });

        const empIds = employees.map(e => e.id);

        // Fetch data in parallel
        const [compOffs, permissions, leaveRequests, timesheets, prevBalances] = await Promise.all([
            // Comp-offs for this month
            prisma.compOff.findMany({
                where: { tenantId: req.tenantId, month: m, year: y },
                orderBy: { date: 'asc' },
            }),
            // Permission entries for this month
            prisma.permissionEntry.findMany({
                where: { tenantId: req.tenantId, month: m, year: y },
                orderBy: { date: 'asc' },
            }),
            // Leave requests overlapping this month
            prisma.leaveRequest.findMany({
                where: {
                    tenantId: req.tenantId,
                    status: 'approved',
                    startDate: { lte: endOfMonth },
                    endDate: { gte: startOfMonth },
                    employeeId: { in: empIds },
                },
                include: { leaveType: true },
            }),
            // Timesheets for present count + late check-in
            prisma.timesheet.findMany({
                where: {
                    tenantId: req.tenantId,
                    date: { gte: startOfMonth, lte: endOfMonth },
                    employeeId: { in: empIds },
                },
            }),
            // Previous month balance
            (() => {
                const prevMonth = m === 1 ? 12 : m - 1;
                const prevYear = m === 1 ? y - 1 : y;
                return prisma.monthlyBalance.findMany({
                    where: { tenantId: req.tenantId, month: prevMonth, year: prevYear },
                });
            })(),
        ]);

        // Index by employee
        const compOffByEmp = {};
        compOffs.forEach(c => { (compOffByEmp[c.employeeId] = compOffByEmp[c.employeeId] || []).push(c); });

        const permByEmp = {};
        permissions.forEach(p => { (permByEmp[p.employeeId] = permByEmp[p.employeeId] || []).push(p); });

        const leaveByEmp = {};
        leaveRequests.forEach(l => { (leaveByEmp[l.employeeId] = leaveByEmp[l.employeeId] || []).push(l); });

        const prevBalByEmp = {};
        prevBalances.forEach(b => { prevBalByEmp[b.employeeId] = b; });

        // Count present days and late check-ins per employee
        const timesheetByEmp = {};
        timesheets.forEach(t => { (timesheetByEmp[t.employeeId] = timesheetByEmp[t.employeeId] || []).push(t); });

        // Build details per employee
        const details = employees.map(emp => {
            const empCompOffs = compOffByEmp[emp.id] || [];
            const empPerms = permByEmp[emp.id] || [];
            const empLeaves = leaveByEmp[emp.id] || [];
            const empTimesheets = timesheetByEmp[emp.id] || [];
            const prevBal = prevBalByEmp[emp.id] || {};

            // Present days = timesheets with inAt
            const daysPresent = empTimesheets.filter(t => t.inAt).length;

            // Late check-ins (rough: inAt exists and after 09:00 — shift-aware later)
            const lateCheckIns = empTimesheets.filter(t => {
                if (!t.inAt) return false;
                const inHour = dayjs(t.inAt).hour();
                const inMin = dayjs(t.inAt).minute();
                return inHour > 9 || (inHour === 9 && inMin > 15); // after 09:15
            });

            // Comp-off totals
            const compOffGainedHours = empCompOffs.reduce((s, c) => s + c.hours, 0);
            const compOffGainedDays = empCompOffs.reduce((s, c) => s + c.days, 0);

            // Separate leaves by type
            const clLeaves = empLeaves.filter(l => l.leaveType.code === 'CL' || l.leaveType.name.toLowerCase().includes('casual'));
            const slLeaves = empLeaves.filter(l => l.leaveType.code === 'SL' || l.leaveType.name.toLowerCase().includes('sick'));
            const elLeaves = empLeaves.filter(l => l.leaveType.code === 'EL' || l.leaveType.name.toLowerCase().includes('earned') || l.leaveType.name.toLowerCase().includes('vacation'));

            const clAvailed = clLeaves.reduce((s, l) => s + l.days, 0);
            const slAvailed = slLeaves.reduce((s, l) => s + l.days, 0);
            const elUtilised = elLeaves.reduce((s, l) => s + l.days, 0);

            // Permission totals
            const lateComingPerms = empPerms.filter(p => p.type === 'late_coming');
            const earlyGoingPerms = empPerms.filter(p => p.type === 'early_going');
            const generalPerms = empPerms.filter(p => p.type === 'general');
            const totalPermHours = empPerms.reduce((s, p) => s + p.hours, 0);
            const totalPermDays = parseFloat((totalPermHours / 8).toFixed(2));

            return {
                id: emp.id,
                name: `${emp.contact.firstName} ${emp.contact.lastName || ''}`.trim(),
                code: emp.employeeCode,
                designation: emp.designation?.name || '-',
                department: emp.department?.name || '-',
                category: emp.category || 'confirmed',
                leaveStartMonth: emp.leaveStartMonth,
                daysPresent,

                compOff: {
                    entries: empCompOffs.map(c => ({
                        date: dayjs(c.date).format('DD/MM/YYYY'),
                        hours: c.hours,
                        days: c.days,
                        reason: c.reason,
                        status: c.status,
                        uuid: c.uuid,
                    })),
                    totalHours: compOffGainedHours,
                    totalDays: compOffGainedDays,
                },

                clAvailed: {
                    entries: clLeaves.map(l => ({
                        startDate: dayjs(l.startDate).format('DD/MM/YYYY'),
                        endDate: dayjs(l.endDate).format('DD/MM/YYYY'),
                        days: l.days,
                    })),
                    totalDays: clAvailed,
                },

                lateCheckIn: {
                    count: lateCheckIns.length,
                    dates: lateCheckIns.map(t => dayjs(t.date).format('DD/MM/YYYY')),
                },

                permissions: {
                    entries: empPerms.map(p => ({
                        date: dayjs(p.date).format('DD/MM/YYYY'),
                        type: p.type,
                        hours: p.hours,
                        days: p.days,
                        uuid: p.uuid,
                    })),
                    totalHours: totalPermHours,
                    totalDays: totalPermDays,
                },

                slAvailed: {
                    entries: slLeaves.map(l => ({
                        startDate: dayjs(l.startDate).format('DD/MM/YYYY'),
                        endDate: dayjs(l.endDate).format('DD/MM/YYYY'),
                        days: l.days,
                    })),
                    totalDays: slAvailed,
                },

                elVacation: {
                    credited: 0, // EL credited for this month (would come from allocation)
                    utilised: elUtilised,
                    entries: elLeaves.map(l => ({
                        startDate: dayjs(l.startDate).format('DD/MM/YYYY'),
                        endDate: dayjs(l.endDate).format('DD/MM/YYYY'),
                        days: l.days,
                    })),
                },

                previousBalance: {
                    compOffDays: prevBal.compOffDays || 0,
                    compOffHours: prevBal.compOffHours || 0,
                    cl: prevBal.clBalance || 0,
                    sl: prevBal.slBalance || 0,
                    el: prevBal.elBalance || 0,
                    lateEarlyDays: prevBal.lateEarlyDays || 0,
                    lateEarlyHours: prevBal.lateEarlyHours || 0,
                },
            };
        });

        res.json({ month: m, year: y, data: details });
    } catch (error) { next(error); }
});

// ─── SUMMARY (consolidated all employees) ────────

// GET /api/compoff/summary?month=&year=
router.get('/summary', async (req, res, next) => {
    try {
        const m = parseInt(req.query.month) || (dayjs().month() + 1);
        const y = parseInt(req.query.year) || dayjs().year();

        // Reuse the details endpoint logic
        const detailsReq = { ...req, query: { month: m, year: y } };
        // Instead of duplicating, we call details internally
        // For now, compute summary from the same data

        const startOfMonth = dayjs(`${y}-${m}-01`).startOf('month').toDate();
        const endOfMonth = dayjs(`${y}-${m}-01`).endOf('month').toDate();

        const employees = await prisma.employee.findMany({
            where: { tenantId: req.tenantId, status: 'active' },
            include: { contact: true, department: true, designation: true },
            orderBy: { employeeCode: 'asc' },
        });

        const empIds = employees.map(e => e.id);

        const [compOffs, permissions, leaveRequests, timesheets, prevBalances, currentBalances] = await Promise.all([
            prisma.compOff.findMany({ where: { tenantId: req.tenantId, month: m, year: y } }),
            prisma.permissionEntry.findMany({ where: { tenantId: req.tenantId, month: m, year: y } }),
            prisma.leaveRequest.findMany({
                where: {
                    tenantId: req.tenantId, status: 'approved',
                    startDate: { lte: endOfMonth }, endDate: { gte: startOfMonth },
                    employeeId: { in: empIds },
                },
                include: { leaveType: true },
            }),
            prisma.timesheet.findMany({
                where: { tenantId: req.tenantId, date: { gte: startOfMonth, lte: endOfMonth }, employeeId: { in: empIds } },
            }),
            (() => {
                const prevMonth = m === 1 ? 12 : m - 1;
                const prevYear = m === 1 ? y - 1 : y;
                return prisma.monthlyBalance.findMany({ where: { tenantId: req.tenantId, month: prevMonth, year: prevYear } });
            })(),
            prisma.monthlyBalance.findMany({ where: { tenantId: req.tenantId, month: m, year: y } }),
        ]);

        // Index
        const idx = (arr, key = 'employeeId') => {
            const map = {};
            arr.forEach(item => { (map[item[key]] = map[item[key]] || []).push(item); });
            return map;
        };

        const compOffIdx = idx(compOffs);
        const permIdx = idx(permissions);
        const leaveIdx = idx(leaveRequests);
        const tsIdx = idx(timesheets);
        const prevBalIdx = {};
        prevBalances.forEach(b => { prevBalIdx[b.employeeId] = b; });
        const curBalIdx = {};
        currentBalances.forEach(b => { curBalIdx[b.employeeId] = b; });

        const summary = employees.map(emp => {
            const ec = compOffIdx[emp.id] || [];
            const ep = permIdx[emp.id] || [];
            const el = leaveIdx[emp.id] || [];
            const et = tsIdx[emp.id] || [];
            const prevBal = prevBalIdx[emp.id] || {};
            const curBal = curBalIdx[emp.id] || {};

            const daysPresent = et.filter(t => t.inAt).length;

            // Current month gains
            const compOffGainedDays = ec.filter(c => c.status === 'approved').reduce((s, c) => s + c.days, 0);
            const compOffGainedHours = ec.filter(c => c.status === 'approved').reduce((s, c) => s + c.hours, 0);

            const clLeaves = el.filter(l => l.leaveType.code === 'CL' || l.leaveType.name.toLowerCase().includes('casual'));
            const slLeaves = el.filter(l => l.leaveType.code === 'SL' || l.leaveType.name.toLowerCase().includes('sick'));
            const elLeaves = el.filter(l => l.leaveType.code === 'EL' || l.leaveType.name.toLowerCase().includes('earned') || l.leaveType.name.toLowerCase().includes('vacation'));

            const clAvailed = clLeaves.reduce((s, l) => s + l.days, 0);
            const slAvailed = slLeaves.reduce((s, l) => s + l.days, 0);
            const elUtilised = elLeaves.reduce((s, l) => s + l.days, 0);

            const lateCheckIns = et.filter(t => t.inAt && (dayjs(t.inAt).hour() > 9 || (dayjs(t.inAt).hour() === 9 && dayjs(t.inAt).minute() > 15))).length;

            const permHours = ep.reduce((s, p) => s + p.hours, 0);
            const permDays = parseFloat((permHours / 8).toFixed(2));

            // Previous month balances
            const prev = {
                compOffDays: prevBal.compOffDays || 0,
                compOffHours: prevBal.compOffHours || 0,
                cl: prevBal.clBalance || 0,
                sl: prevBal.slBalance || 0,
                el: prevBal.elBalance || 0,
                lateEarlyDays: prevBal.lateEarlyDays || 0,
                lateEarlyHours: prevBal.lateEarlyHours || 0,
            };

            // Balance c/f = previous + gained - used
            const balCompOffDays = prev.compOffDays + compOffGainedDays;
            const balCompOffHours = prev.compOffHours + compOffGainedHours;
            const balCl = prev.cl - clAvailed;
            const balSl = prev.sl - slAvailed;
            const balEl = prev.el - elUtilised;
            const balLateEarlyDays = prev.lateEarlyDays + permDays;
            const balLateEarlyHours = prev.lateEarlyHours + permHours;

            // LOP: any negative leave balance
            let lopDays = 0;
            if (balCl < 0) lopDays += Math.abs(balCl);
            if (balSl < 0) lopDays += Math.abs(balSl);

            const status = lopDays > 0 ? 'LOP' : 'FULL';

            return {
                id: emp.id,
                name: `${emp.contact.firstName} ${emp.contact.lastName || ''}`.trim(),
                code: emp.employeeCode,
                designation: emp.designation?.name || '-',
                category: emp.category || 'confirmed',
                leaveStartMonth: emp.leaveStartMonth,
                daysPresent,

                // Current month
                current: {
                    compOffDays: compOffGainedDays,
                    compOffHours: compOffGainedHours,
                    clAvailed,
                    lateCheckIns,
                    permDays,
                    permHours,
                    slAvailed,
                    elUtilised,
                },

                // Previous/accumulated balance
                previous: prev,

                // Balance carry-forward
                balance: {
                    compOffDays: Math.max(0, balCompOffDays),
                    compOffHours: Math.max(0, balCompOffHours),
                    cl: Math.max(0, balCl),
                    sl: Math.max(0, balSl),
                    el: Math.max(0, balEl),
                    lateEarlyDays: balLateEarlyDays,
                    lateEarlyHours: balLateEarlyHours,
                },

                lopDays,
                status,
                isClosed: curBal.isClosed || false,
            };
        });

        res.json({ month: m, year: y, data: summary });
    } catch (error) { next(error); }
});

// ─── CLOSE MONTH ─────────────────────────────────

// POST /api/compoff/close-month
router.post('/close-month', requireRole('admin', 'super_admin'), async (req, res, next) => {
    try {
        const { month, year } = req.body;
        const m = parseInt(month);
        const y = parseInt(year);

        // First get the summary data
        const startOfMonth = dayjs(`${y}-${m}-01`).startOf('month').toDate();
        const endOfMonth = dayjs(`${y}-${m}-01`).endOf('month').toDate();

        const employees = await prisma.employee.findMany({
            where: { tenantId: req.tenantId, status: 'active' },
        });

        const empIds = employees.map(e => e.id);

        const [compOffs, permissions, leaveRequests, prevBalances] = await Promise.all([
            prisma.compOff.findMany({ where: { tenantId: req.tenantId, month: m, year: y, status: 'approved' } }),
            prisma.permissionEntry.findMany({ where: { tenantId: req.tenantId, month: m, year: y } }),
            prisma.leaveRequest.findMany({
                where: {
                    tenantId: req.tenantId, status: 'approved',
                    startDate: { lte: endOfMonth }, endDate: { gte: startOfMonth },
                    employeeId: { in: empIds },
                },
                include: { leaveType: true },
            }),
            (() => {
                const prevMonth = m === 1 ? 12 : m - 1;
                const prevYear = m === 1 ? y - 1 : y;
                return prisma.monthlyBalance.findMany({ where: { tenantId: req.tenantId, month: prevMonth, year: prevYear } });
            })(),
        ]);

        const prevBalIdx = {};
        prevBalances.forEach(b => { prevBalIdx[b.employeeId] = b; });

        // Create/Update monthly balance for each employee
        const results = await Promise.all(employees.map(async emp => {
            const ec = compOffs.filter(c => c.employeeId === emp.id);
            const ep = permissions.filter(p => p.employeeId === emp.id);
            const el = leaveRequests.filter(l => l.employeeId === emp.id);
            const prevBal = prevBalIdx[emp.id] || {};

            const compOffDays = (prevBal.compOffDays || 0) + ec.reduce((s, c) => s + c.days, 0);
            const compOffHours = (prevBal.compOffHours || 0) + ec.reduce((s, c) => s + c.hours, 0);

            const clLeaves = el.filter(l => l.leaveType.code === 'CL' || l.leaveType.name.toLowerCase().includes('casual'));
            const slLeaves = el.filter(l => l.leaveType.code === 'SL' || l.leaveType.name.toLowerCase().includes('sick'));
            const elLeaves = el.filter(l => l.leaveType.code === 'EL' || l.leaveType.name.toLowerCase().includes('earned') || l.leaveType.name.toLowerCase().includes('vacation'));

            const clBalance = Math.max(0, (prevBal.clBalance || 0) - clLeaves.reduce((s, l) => s + l.days, 0));
            const slBalance = Math.max(0, (prevBal.slBalance || 0) - slLeaves.reduce((s, l) => s + l.days, 0));
            const elBalance = Math.max(0, (prevBal.elBalance || 0) - elLeaves.reduce((s, l) => s + l.days, 0));

            const permHours = ep.reduce((s, p) => s + p.hours, 0);
            const lateEarlyDays = (prevBal.lateEarlyDays || 0) + parseFloat((permHours / 8).toFixed(2));
            const lateEarlyHours = (prevBal.lateEarlyHours || 0) + permHours;

            // Negative balances become 0 for next month (per Notes rule 8)
            return prisma.monthlyBalance.upsert({
                where: { employeeId_month_year: { employeeId: emp.id, month: m, year: y } },
                update: {
                    compOffDays: Math.max(0, compOffDays),
                    compOffHours: Math.max(0, compOffHours),
                    clBalance: Math.max(0, clBalance),
                    slBalance: Math.max(0, slBalance),
                    elBalance: Math.max(0, elBalance),
                    lateEarlyDays,
                    lateEarlyHours,
                    isClosed: true,
                },
                create: {
                    tenantId: req.tenantId,
                    employeeId: emp.id,
                    month: m,
                    year: y,
                    compOffDays: Math.max(0, compOffDays),
                    compOffHours: Math.max(0, compOffHours),
                    clBalance: Math.max(0, clBalance),
                    slBalance: Math.max(0, slBalance),
                    elBalance: Math.max(0, elBalance),
                    lateEarlyDays,
                    lateEarlyHours,
                    isClosed: true,
                },
            });
        }));

        res.json({ message: `Month ${m}/${y} closed for ${results.length} employees`, count: results.length });
    } catch (error) { next(error); }
});

module.exports = router;

import { useState, useEffect } from 'react';
import api from '../lib/api';
import dayjs from 'dayjs';
import { Plus, X, Check, XCircle, Lock, Download, ChevronLeft, ChevronRight, Search, Clock, CalendarDays, Stethoscope, Palmtree, AlertTriangle, Settings, Zap, Printer } from 'lucide-react';
import * as XLSX from 'xlsx';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const PERM_LABELS = { late_coming: 'Late C', early_going: 'Early G', general: 'Gen.' };
const CAT_LABELS = { confirmed: 'Confirmed', time_scale: 'Time-Scale', contract: 'Contract', adhoc: 'Adhoc', part_time: 'Part-Time' };
const CAT_COLORS = { confirmed: '#22c55e', time_scale: '#3b82f6', contract: '#f59e0b', adhoc: '#8b5cf6', part_time: '#06b6d4' };

export default function CompOff() {
    const [activeTab, setActiveTab] = useState('details');
    const [month, setMonth] = useState(dayjs().month() + 1);
    const [year, setYear] = useState(dayjs().year());
    const [detailsData, setDetailsData] = useState(null);
    const [summaryData, setSummaryData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const [showCompOffModal, setShowCompOffModal] = useState(false);
    const [showPermModal, setShowPermModal] = useState(false);
    const [selectedEmpId, setSelectedEmpId] = useState(null);
    const [compOffForm, setCompOffForm] = useState({ date: '', hours: '', reason: '' });
    const [permForm, setPermForm] = useState({ date: '', type: 'late_coming', hours: '' });
    const [employees, setEmployees] = useState([]);
    const [setupMsg, setSetupMsg] = useState('');
    const [bulkForm, setBulkForm] = useState({ month: String(dayjs().month()), year: String(dayjs().year()), cl: '12', sl: '12', el: '0' });

    const loadData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'details') {
                const res = await api.get(`/compoff/details?month=${month}&year=${year}`);
                setDetailsData(res.data);
            } else {
                const res = await api.get(`/compoff/summary?month=${month}&year=${year}`);
                setSummaryData(res.data);
            }
        } catch (err) { console.error(err); }
        setLoading(false);
    };

    useEffect(() => { loadData(); }, [month, year, activeTab]);
    useEffect(() => {
        api.get('/employees?limit=500').then(r => setEmployees(r.data.data || r.data || [])).catch(() => { });
    }, []);

    const handleAddCompOff = async (e) => {
        e.preventDefault();
        try {
            await api.post('/compoff', { employeeId: selectedEmpId, date: compOffForm.date, hours: parseFloat(compOffForm.hours), reason: compOffForm.reason, month, year });
            setShowCompOffModal(false);
            setCompOffForm({ date: '', hours: '', reason: '' });
            loadData();
        } catch (err) { alert(err.response?.data?.message || 'Failed'); }
    };

    const handleApprove = async (uuid) => { try { await api.post(`/compoff/${uuid}/approve`); loadData(); } catch { alert('Failed'); } };
    const handleReject = async (uuid) => { try { await api.post(`/compoff/${uuid}/reject`); loadData(); } catch { alert('Failed'); } };
    const handleDeleteCompOff = async (uuid) => { if (!confirm('Delete?')) return; try { await api.delete(`/compoff/${uuid}`); loadData(); } catch { alert('Failed'); } };

    const handleAddPerm = async (e) => {
        e.preventDefault();
        try {
            await api.post('/compoff/permissions', { employeeId: selectedEmpId, date: permForm.date, type: permForm.type, hours: parseFloat(permForm.hours), month, year });
            setShowPermModal(false);
            setPermForm({ date: '', type: 'late_coming', hours: '' });
            loadData();
        } catch (err) { alert(err.response?.data?.message || 'Failed'); }
    };

    const handleDeletePerm = async (uuid) => { if (!confirm('Delete?')) return; try { await api.delete(`/compoff/permissions/${uuid}`); loadData(); } catch { alert('Failed'); } };

    const handleCloseMonth = async () => {
        if (!confirm(`Close ${MONTHS[month - 1]} ${year}? This will calculate final balances and carry forward to the next month.`)) return;
        try {
            const res = await api.post('/compoff/close-month', { month, year });
            alert(res.data.message);
            loadData();
        } catch (err) { alert(err.response?.data?.message || 'Failed'); }
    };

    const exportSummaryExcel = () => {
        if (!summaryData?.data) return;
        const monthName = MONTHS[month - 1];

        // Row 0: Title
        // Row 1: Section headers (with rowspan/colspan via merges)
        // Row 2: Sub-column headers
        // Row 3+: Data
        const titleRow = [`Comp-Off & Leave Summary — ${monthName} ${year}`, ...Array(23).fill(null)];
        const headerRow1 = [
            'Sl.', 'Name', 'Designation', 'Category', 'Days\nPresent',
            'CURRENT MONTH', null, null, null, null, null, null,
            'AVAILABLE / ACCUMULATED', null, null, null, null,
            'BALANCE C/F', null, null, null, null,
            'STATUS', null,
        ];
        const headerRow2 = [
            null, null, null, null, null,
            'CO.d', 'CO.h', 'CL', 'Late', 'L/E/G', 'SL', 'EL',
            'CO', 'CL', 'SL', 'EL', 'Perm',
            'CO', 'CL', 'SL', 'EL', 'L/E.h',
            'LOP Days', 'Status',
        ];

        const dataRows = summaryData.data.map((e, i) => [
            i + 1,
            `${e.name}${e.code ? ' (' + e.code + ')' : ''}`,
            e.designation || '-',
            CAT_LABELS[e.category] || e.category,
            e.daysPresent,
            // Current Month
            e.current?.compOffDays || '-',
            e.current?.compOffHours || '-',
            e.current?.clAvailed || '-',
            e.current?.lateCheckIns ? `${e.current.lateCheckIns}→${e.current.lateCheckInDays}d` : '-',
            e.current?.permDays || '-',
            e.current?.slAvailed || '-',
            e.current?.elUtilised || '-',
            // Available / Accumulated
            e.available?.compOffDays || '-',
            e.available?.cl || '-',
            e.available?.sl || '-',
            e.available?.el || '-',
            e.available?.permDays || '-',
            // Balance C/F
            e.balance?.compOffDays ?? 0,
            e.balance?.cl ?? 0,
            e.balance?.sl ?? 0,
            e.balance?.el ?? 0,
            e.balance?.permHours ?? 0,
            // Status
            e.lopDays || 0,
            e.status,
        ]);

        const ws = XLSX.utils.aoa_to_sheet([titleRow, headerRow1, headerRow2, ...dataRows]);

        ws['!merges'] = [
            // Title spans all 24 cols
            { s: { r: 0, c: 0 }, e: { r: 0, c: 23 } },
            // Fixed cols span rows 1+2
            { s: { r: 1, c: 0 }, e: { r: 2, c: 0 } },
            { s: { r: 1, c: 1 }, e: { r: 2, c: 1 } },
            { s: { r: 1, c: 2 }, e: { r: 2, c: 2 } },
            { s: { r: 1, c: 3 }, e: { r: 2, c: 3 } },
            { s: { r: 1, c: 4 }, e: { r: 2, c: 4 } },
            // Section group headers
            { s: { r: 1, c: 5 },  e: { r: 1, c: 11 } }, // Current Month  (7 cols: CO.d CO.h CL Late L/E/G SL EL)
            { s: { r: 1, c: 12 }, e: { r: 1, c: 16 } }, // Available      (5 cols: CO CL SL EL Perm)
            { s: { r: 1, c: 17 }, e: { r: 1, c: 21 } }, // Balance C/F    (5 cols: CO CL SL EL L/E.h)
            { s: { r: 1, c: 22 }, e: { r: 1, c: 23 } }, // Status         (2 cols: LOP Status)
        ];

        ws['!cols'] = [
            { wch: 5 },  // Sl
            { wch: 24 }, // Name
            { wch: 16 }, // Designation
            { wch: 11 }, // Category
            { wch: 7 },  // Days Present
            // Current Month (7)
            { wch: 7 }, { wch: 7 }, { wch: 6 }, { wch: 10 }, { wch: 7 }, { wch: 6 }, { wch: 6 },
            // Available (5)
            { wch: 7 }, { wch: 6 }, { wch: 6 }, { wch: 8 }, { wch: 7 },
            // Balance (5)
            { wch: 7 }, { wch: 6 }, { wch: 6 }, { wch: 8 }, { wch: 7 },
            // Status (2)
            { wch: 9 }, { wch: 8 },
        ];

        // Row heights: title taller, header rows slightly taller
        ws['!rows'] = [{ hpt: 20 }, { hpt: 18 }, { hpt: 16 }];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Summary');
        XLSX.writeFile(wb, `CompOff_Summary_${monthName}_${year}.xlsx`);
    };

    const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
    const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

    const filteredDetails = detailsData?.data?.filter(emp =>
        (emp.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (emp.code || '').toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

    const getInitials = (name) => (name || '?').split(' ').map(n => n[0] || '').join('').slice(0, 2).toUpperCase() || '?';

    return (
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
            {/* ───── HEADER ───── */}
            <div className="print-hide" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ fontSize: 22, fontWeight: 700 }}>Comp-Off & Leave Management</h2>
            </div>

            {/* ───── CONTROLS BAR ───── */}
            <div className="print-hide" style={{
                display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap',
                padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button className="btn btn-ghost btn-sm" onClick={prevMonth} style={{ padding: 6 }}><ChevronLeft size={16} /></button>
                    <span style={{ fontWeight: 700, fontSize: 15, minWidth: 140, textAlign: 'center', color: 'var(--text-primary)' }}>{MONTHS[month - 1]} {year}</span>
                    <button className="btn btn-ghost btn-sm" onClick={nextMonth} style={{ padding: 6 }}><ChevronRight size={16} /></button>
                </div>
                <div style={{ display: 'flex', gap: 4, background: 'var(--bg-tertiary)', borderRadius: 22, padding: 3 }}>
                    <button style={{
                        padding: '6px 18px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                        background: activeTab === 'details' ? 'var(--primary)' : 'transparent',
                        color: activeTab === 'details' ? '#fff' : 'var(--text-secondary)',
                        transition: 'var(--transition)',
                    }} onClick={() => setActiveTab('details')}>Details</button>
                    <button style={{
                        padding: '6px 18px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                        background: activeTab === 'summary' ? 'var(--primary)' : 'transparent',
                        color: activeTab === 'summary' ? '#fff' : 'var(--text-secondary)',
                        transition: 'var(--transition)',
                    }} onClick={() => setActiveTab('summary')}>Summary</button>
                    <button style={{
                        padding: '6px 18px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                        background: activeTab === 'setup' ? 'var(--primary)' : 'transparent',
                        color: activeTab === 'setup' ? '#fff' : 'var(--text-secondary)',
                        transition: 'var(--transition)',
                    }} onClick={() => setActiveTab('setup')}><Settings size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Setup</button>
                </div>
                <div style={{ position: 'relative', marginLeft: 'auto' }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--text-muted)' }} />
                    <input style={{
                        padding: '7px 12px 7px 32px', borderRadius: 20, border: '1px solid var(--border)',
                        fontSize: 13, outline: 'none', width: 200, background: 'var(--bg-tertiary)', color: 'var(--text-primary)',
                    }} placeholder="Search employee..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                {activeTab === 'summary' && (
                    <>
                        <button className="btn btn-ghost btn-sm" onClick={() => window.print()}><Printer size={14} /> Print</button>
                        <button className="btn btn-ghost btn-sm" onClick={exportSummaryExcel}><Download size={14} /> Excel</button>
                        <button className="btn btn-primary btn-sm" onClick={handleCloseMonth}><Lock size={14} /> Close Month</button>
                    </>
                )}
            </div>

            {loading && <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Loading...</div>}

            {/* ═════════ DETAILS TAB ═════════ */}
            {!loading && activeTab === 'details' && detailsData && (
                <div>
                    {/* Stat Cards */}
                    <div className="stats-grid">
                        {[
                            { label: 'Employees', value: detailsData.data.length, sub: 'Active', iconClass: 'blue', icon: '👥' },
                            { label: 'Days in Month', value: detailsData.daysInMonth, sub: MONTHS[month - 1], iconClass: 'green', icon: '📅' },
                            { label: 'Total Comp-Offs', value: detailsData.data.reduce((s, e) => s + (e.compOff?.entries?.length || 0), 0), sub: 'This month', iconClass: 'purple', icon: '⚡' },
                            { label: 'Leave Requests', value: detailsData.data.reduce((s, e) => s + (e.clAvailed?.totalDays || 0) + (e.slAvailed?.totalDays || 0), 0), sub: 'CL + SL availed', iconClass: 'yellow', icon: '🏖️' },
                        ].map((card, i) => (
                            <div key={i} className="stat-card" style={{ cursor: 'default' }}>
                                <div className={`stat-icon ${card.iconClass}`} style={{ fontSize: 22 }}>{card.icon}</div>
                                <div className="stat-info">
                                    <h3>{card.value}</h3>
                                    <p>{card.label} · {card.sub}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Employee Cards */}
                    {filteredDetails.map(emp => (
                        <details key={emp.id} style={{
                            border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', marginBottom: 12,
                            overflow: 'hidden', background: 'var(--bg-card)', backdropFilter: 'blur(10px)',
                            transition: 'var(--transition)',
                        }}>
                            <summary style={{
                                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', cursor: 'pointer',
                                listStyle: 'none', background: 'var(--bg-secondary)',
                            }}>
                                <div style={{
                                    width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontWeight: 700, fontSize: 13, color: '#fff',
                                    background: `linear-gradient(135deg, ${CAT_COLORS[emp.category] || '#6366f1'}, ${CAT_COLORS[emp.category] || '#6366f1'}aa)`,
                                    flexShrink: 0,
                                }}>{getInitials(emp.name)}</div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{emp.name}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                                        <span>{emp.designation}</span>
                                        <span style={{
                                            padding: '1px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600,
                                            background: `${CAT_COLORS[emp.category] || '#6366f1'}22`,
                                            color: CAT_COLORS[emp.category] || '#6366f1',
                                        }}>{CAT_LABELS[emp.category] || emp.category}</span>
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    <span className="badge badge-info">{emp.daysPresent} days</span>
                                    {emp.lateCheckIn?.count > 0 && <span className="badge badge-danger">{emp.lateCheckIn.count} lates</span>}
                                    {emp.compOff?.entries?.length > 0 && <span className="badge badge-purple">{emp.compOff.entries.length} CO</span>}
                                </div>
                            </summary>

                            {/* Sections Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 12, padding: '16px 20px' }}>
                                {/* Comp-Off Gained */}
                                <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 12, background: 'var(--bg-secondary)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--primary-light)', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6 }}>
                                            <Clock size={12} /> Comp-Off Gained
                                        </div>
                                        <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, padding: '2px 6px' }}
                                            onClick={(e) => { e.stopPropagation(); setSelectedEmpId(emp.id); setShowCompOffModal(true); }}>
                                            <Plus size={11} /> Add
                                        </button>
                                    </div>
                                    {emp.compOff.entries.length > 0 ? (
                                        <>
                                            {emp.compOff.entries.map((c, i) => (
                                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', fontSize: 12, borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>
                                                    <span>{c.date}</span>
                                                    <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.hours}h</span>
                                                    <div style={{ display: 'flex', gap: 2 }}>
                                                        {c.status === 'pending' && (
                                                            <>
                                                                <button className="btn btn-ghost btn-sm" style={{ padding: 2 }} onClick={() => handleApprove(c.uuid)}><Check size={12} color="#22c55e" /></button>
                                                                <button className="btn btn-ghost btn-sm" style={{ padding: 2 }} onClick={() => handleReject(c.uuid)}><XCircle size={12} color="#ef4444" /></button>
                                                            </>
                                                        )}
                                                        {c.status === 'approved' && <span className="badge badge-success" style={{ padding: '0 6px', fontSize: 9 }}>✓</span>}
                                                        {c.status === 'rejected' && <span className="badge badge-danger" style={{ padding: '0 6px', fontSize: 9 }}>✗</span>}
                                                        <button className="btn btn-ghost btn-sm" style={{ padding: 2 }} onClick={() => handleDeleteCompOff(c.uuid)}><X size={11} /></button>
                                                    </div>
                                                </div>
                                            ))}
                                            <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, textAlign: 'right', color: 'var(--primary-light)' }}>
                                                = {emp.compOff.convertedDays}d {emp.compOff.convertedHours}h
                                            </div>
                                        </>
                                    ) : <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: 8 }}>—</div>}
                                </div>

                                {/* CL Availed */}
                                <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 12, background: 'var(--bg-secondary)' }}>
                                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--info)', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                        <CalendarDays size={12} /> CL Availed
                                    </div>
                                    {emp.clAvailed.entries.length > 0 ? (
                                        emp.clAvailed.entries.map((l, i) => (
                                            <div key={i} style={{ fontSize: 12, padding: '3px 0', color: 'var(--text-secondary)' }}>{l.startDate} — <strong style={{ color: 'var(--text-primary)' }}>{l.days}d</strong></div>
                                        ))
                                    ) : <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: 8 }}>—</div>}
                                    <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, textAlign: 'right', color: 'var(--text-primary)' }}>Total: {emp.clAvailed.totalDays}d</div>
                                </div>

                                {/* Late Check-In */}
                                <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 12, background: 'var(--bg-secondary)' }}>
                                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--danger)', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                        <AlertTriangle size={12} /> Late Check-In
                                    </div>
                                    <div style={{ fontSize: 28, fontWeight: 800, textAlign: 'center', padding: '4px 0', color: emp.lateCheckIn.count > 0 ? 'var(--danger)' : 'var(--success)' }}>
                                        {emp.lateCheckIn.count}
                                    </div>
                                    {emp.lateCheckIn.count > 0 && (
                                        <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--danger)', fontWeight: 600 }}>
                                            {emp.lateCheckIn.count} lates → {emp.lateCheckIn.days} day(s)
                                        </div>
                                    )}
                                    {emp.lateCheckIn.dates?.length > 0 && (
                                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', marginTop: 4 }}>{emp.lateCheckIn.dates.join(', ')}</div>
                                    )}
                                </div>

                                {/* Late C / Early G / Gen. Perm */}
                                <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 12, background: 'var(--bg-secondary)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#8b5cf6', letterSpacing: '0.06em' }}>
                                            Late C / Early G / Gen.
                                        </div>
                                        <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, padding: '2px 6px' }}
                                            onClick={(e) => { e.stopPropagation(); setSelectedEmpId(emp.id); setShowPermModal(true); }}>
                                            <Plus size={11} /> Add
                                        </button>
                                    </div>
                                    {emp.permissions.entries.length > 0 ? (
                                        <>
                                            {emp.permissions.entries.map((p, i) => (
                                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '3px 0', borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)' }}>
                                                    <span>{p.date}</span>
                                                    <span className="badge badge-purple" style={{ padding: '0 6px', fontSize: 9 }}>{PERM_LABELS[p.type]}</span>
                                                    <span style={{ color: 'var(--text-primary)' }}>{p.hours}h</span>
                                                    <button className="btn btn-ghost btn-sm" style={{ padding: 2 }} onClick={() => handleDeletePerm(p.uuid)}><X size={11} /></button>
                                                </div>
                                            ))}
                                            <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, textAlign: 'right', color: '#8b5cf6' }}>
                                                {emp.permissions.totalHours}h = {emp.permissions.convertedDays}d {emp.permissions.convertedHours}h
                                            </div>
                                        </>
                                    ) : <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: 8 }}>—</div>}
                                </div>

                                {/* SL Availed */}
                                <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 12, background: 'var(--bg-secondary)' }}>
                                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--warning)', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                        <Stethoscope size={12} /> SL Availed
                                    </div>
                                    {emp.slAvailed.entries.length > 0 ? (
                                        emp.slAvailed.entries.map((l, i) => (
                                            <div key={i} style={{ fontSize: 12, padding: '3px 0', color: 'var(--text-secondary)' }}>{l.startDate} — <strong style={{ color: 'var(--text-primary)' }}>{l.days}d</strong></div>
                                        ))
                                    ) : <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, padding: 8 }}>—</div>}
                                    {emp.slAvailed.validation?.error && (
                                        <div style={{ color: 'var(--danger)', fontSize: 10, fontWeight: 700, marginTop: 4, padding: '4px 8px', background: 'rgba(239,68,68,0.1)', borderRadius: 6 }}>⚠ {emp.slAvailed.validation.message}</div>
                                    )}
                                    <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, textAlign: 'right', color: 'var(--text-primary)' }}>Total: {emp.slAvailed.totalDays}d</div>
                                </div>

                                {/* EL / Vacation */}
                                <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 12, background: 'var(--bg-secondary)' }}>
                                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: 'var(--success)', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                        <Palmtree size={12} /> EL / Vacation
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6, color: 'var(--text-secondary)' }}>
                                        <span>Credited: <strong style={{ color: 'var(--success)' }}>{emp.elVacation.credited}</strong></span>
                                        <span>Utilised: <strong style={{ color: 'var(--danger)' }}>{emp.elVacation.utilised}</strong></span>
                                    </div>
                                    {emp.elVacation.entries?.length > 0 && emp.elVacation.entries.map((l, i) => (
                                        <div key={i} style={{ fontSize: 12, padding: '3px 0', color: 'var(--text-secondary)' }}>{l.startDate} — {l.days}d</div>
                                    ))}
                                </div>
                            </div>

                            {/* Previous Balance */}
                            <div style={{
                                padding: '10px 20px', background: 'var(--bg-tertiary)', borderTop: '1px solid var(--border)',
                                display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 11, color: 'var(--text-secondary)',
                            }}>
                                <strong style={{ color: 'var(--primary-light)' }}>Prev. Balance:</strong>
                                <span>CO: <strong style={{ color: 'var(--text-primary)' }}>{emp.previousBalance.compOffDays}d/{emp.previousBalance.compOffHours}h</strong></span>
                                <span>CL: <strong style={{ color: 'var(--text-primary)' }}>{emp.previousBalance.cl}</strong></span>
                                <span>SL: <strong style={{ color: 'var(--text-primary)' }}>{emp.previousBalance.sl}</strong></span>
                                <span>EL: <strong style={{ color: 'var(--text-primary)' }}>{emp.previousBalance.el}</strong></span>
                                <span>L/E: <strong style={{ color: 'var(--text-primary)' }}>{emp.previousBalance.lateEarlyDays}d/{emp.previousBalance.lateEarlyHours}h</strong></span>
                            </div>
                        </details>
                    ))}
                    {filteredDetails.length === 0 && (
                        <div className="empty-state"><h3>No employees found</h3><p>Try adjusting your search or month/year</p></div>
                    )}
                </div>
            )}

            {/* ═════════ SUMMARY TAB ═════════ */}
            {!loading && activeTab === 'summary' && summaryData && (
                <div className="card" style={{ overflow: 'auto' }}>
                <div className="print-title">Comp-Off &amp; Leave Summary — {MONTHS[month - 1]} {year}</div>
                    <table className="data-table" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                        <thead>
                            <tr>
                                <th rowSpan={2} style={{ padding: 8 }}>Sl.</th>
                                <th rowSpan={2} style={{ padding: 8, minWidth: 120 }}>Name</th>
                                <th rowSpan={2} style={{ padding: 8 }}>Desig.</th>
                                <th rowSpan={2} style={{ padding: 8 }}>Cat.</th>
                                <th rowSpan={2} style={{ padding: 8 }}>Days</th>
                                <th colSpan={7} style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid var(--primary)', color: 'var(--primary-light)' }}>CURRENT MONTH</th>
                                <th colSpan={5} style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid var(--success)', color: 'var(--success)' }}>AVAILABLE / ACCUMULATED</th>
                                <th colSpan={5} style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid var(--warning)', color: 'var(--warning)' }}>BALANCE C/F</th>
                                <th colSpan={2} style={{ padding: 8, textAlign: 'center', borderBottom: '2px solid var(--danger)', color: 'var(--danger)' }}>STATUS</th>
                            </tr>
                            <tr>
                                <th style={{ padding: 6, textAlign: 'center', fontSize: 9 }}>CO.d</th>
                                <th style={{ padding: 6, textAlign: 'center', fontSize: 9 }}>CO.h</th>
                                <th style={{ padding: 6, textAlign: 'center', fontSize: 9 }}>CL</th>
                                <th style={{ padding: 6, textAlign: 'center', fontSize: 9 }}>Late</th>
                                <th style={{ padding: 6, textAlign: 'center', fontSize: 9 }}>L/E/G</th>
                                <th style={{ padding: 6, textAlign: 'center', fontSize: 9 }}>SL</th>
                                <th style={{ padding: 6, textAlign: 'center', fontSize: 9 }}>EL</th>
                                <th style={{ padding: 6, textAlign: 'center', fontSize: 9 }}>CO</th>
                                <th style={{ padding: 6, textAlign: 'center', fontSize: 9 }}>CL</th>
                                <th style={{ padding: 6, textAlign: 'center', fontSize: 9 }}>SL</th>
                                <th style={{ padding: 6, textAlign: 'center', fontSize: 9 }}>EL</th>
                                <th style={{ padding: 6, textAlign: 'center', fontSize: 9 }}>L/E</th>
                                <th style={{ padding: 6, textAlign: 'center', fontSize: 9 }}>CO</th>
                                <th style={{ padding: 6, textAlign: 'center', fontSize: 9 }}>CL</th>
                                <th style={{ padding: 6, textAlign: 'center', fontSize: 9 }}>SL</th>
                                <th style={{ padding: 6, textAlign: 'center', fontSize: 9 }}>EL</th>
                                <th style={{ padding: 6, textAlign: 'center', fontSize: 9 }}>L/E.h</th>
                                <th style={{ padding: 6, textAlign: 'center', fontSize: 9 }}>LOP</th>
                                <th style={{ padding: 6, textAlign: 'center', fontSize: 9 }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {(summaryData.data || []).filter(e => (e.name || '').toLowerCase().includes(searchTerm.toLowerCase())).map((e, idx) => (
                                <tr key={e.id}>
                                    <td style={{ padding: '8px 6px', textAlign: 'center' }}>{idx + 1}</td>
                                    <td style={{ padding: '8px 6px', fontWeight: 600, fontSize: 12 }}>{e.name}</td>
                                    <td style={{ padding: '8px 6px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 11 }}>{e.designation || '-'}</td>
                                    <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                                        <span style={{
                                            padding: '1px 8px', borderRadius: 12, fontSize: 9, fontWeight: 600,
                                            background: `${CAT_COLORS[e.category] || '#6366f1'}22`, color: CAT_COLORS[e.category] || '#6366f1',
                                        }}>{CAT_LABELS[e.category]?.[0] || '-'}</span>
                                    </td>
                                    <td style={{ padding: '8px 6px', textAlign: 'center', fontWeight: 600 }}>{e.daysPresent}</td>
                                    {/* Current */}
                                    <td style={{ padding: '8px 4px', textAlign: 'center', color: 'var(--text-secondary)' }}>{e.current?.compOffDays || '-'}</td>
                                    <td style={{ padding: '8px 4px', textAlign: 'center', color: 'var(--text-secondary)' }}>{e.current?.compOffHours || '-'}</td>
                                    <td style={{ padding: '8px 4px', textAlign: 'center', color: 'var(--text-secondary)' }}>{e.current?.clAvailed || '-'}</td>
                                    <td style={{ padding: '8px 4px', textAlign: 'center', color: e.current?.lateCheckIns > 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>
                                        {e.current?.lateCheckIns ? <>{e.current.lateCheckIns}<span style={{ fontSize: 9, color: 'var(--text-muted)' }}>→{e.current.lateCheckInDays}d</span></> : '-'}
                                    </td>
                                    <td style={{ padding: '8px 4px', textAlign: 'center', color: 'var(--text-secondary)' }}>{e.current?.permDays || '-'}</td>
                                    <td style={{ padding: '8px 4px', textAlign: 'center', color: 'var(--text-secondary)' }}>{e.current?.slAvailed || '-'}</td>
                                    <td style={{ padding: '8px 4px', textAlign: 'center', color: 'var(--text-secondary)' }}>{e.current?.elUtilised || '-'}</td>
                                    {/* Available */}
                                    <td style={{ padding: '8px 4px', textAlign: 'center', color: 'var(--success)', background: 'rgba(34,197,94,0.05)' }}>{e.available?.compOffDays || '-'}</td>
                                    <td style={{ padding: '8px 4px', textAlign: 'center', color: 'var(--success)', background: 'rgba(34,197,94,0.05)' }}>{e.available?.cl || '-'}</td>
                                    <td style={{ padding: '8px 4px', textAlign: 'center', color: 'var(--success)', background: 'rgba(34,197,94,0.05)' }}>{e.available?.sl || '-'}</td>
                                    <td style={{ padding: '8px 4px', textAlign: 'center', color: 'var(--success)', background: 'rgba(34,197,94,0.05)' }}>{e.available?.el || '-'}</td>
                                    <td style={{ padding: '8px 4px', textAlign: 'center', color: 'var(--success)', background: 'rgba(34,197,94,0.05)' }}>{e.available?.permDays || '-'}</td>
                                    {/* Balance */}
                                    <td style={{ padding: '8px 4px', textAlign: 'center', fontWeight: 700, color: 'var(--warning)', background: 'rgba(245,158,11,0.05)' }}>{e.balance?.compOffDays ?? 0}</td>
                                    <td style={{ padding: '8px 4px', textAlign: 'center', fontWeight: 700, color: (e.balance?.cl ?? 0) < 0 ? 'var(--danger)' : 'var(--warning)', background: 'rgba(245,158,11,0.05)' }}>{e.balance?.cl ?? 0}</td>
                                    <td style={{ padding: '8px 4px', textAlign: 'center', fontWeight: 700, color: (e.balance?.sl ?? 0) < 0 ? 'var(--danger)' : 'var(--warning)', background: 'rgba(245,158,11,0.05)' }}>{e.balance?.sl ?? 0}</td>
                                    <td style={{ padding: '8px 4px', textAlign: 'center', fontWeight: 700, color: (e.balance?.el ?? 0) < 0 ? 'var(--danger)' : 'var(--warning)', background: 'rgba(245,158,11,0.05)' }}>{e.balance?.el ?? 0}</td>
                                    <td style={{ padding: '8px 4px', textAlign: 'center', fontWeight: 700, color: 'var(--warning)', background: 'rgba(245,158,11,0.05)' }}>{e.balance?.permHours ?? 0}</td>
                                    {/* Status */}
                                    <td style={{ padding: '8px 4px', textAlign: 'center', color: e.lopDays > 0 ? 'var(--danger)' : 'var(--text-muted)', fontWeight: e.lopDays > 0 ? 700 : 400 }}>{e.lopDays || 0}</td>
                                    <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                                        <span className={e.status === 'FULL' ? 'badge badge-success' : 'badge badge-danger'}>
                                            {e.status}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {(!summaryData.data || summaryData.data.length === 0) && (
                        <div className="empty-state"><h3>No data</h3><p>No data for this month</p></div>
                    )}
                </div>
            )}

            {/* ───── ADD COMP-OFF MODAL ───── */}
            {showCompOffModal && (
                <div className="modal-overlay" onClick={() => setShowCompOffModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
                        <div className="modal-header">
                            <h3 className="modal-title">Add Comp-Off Entry</h3>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowCompOffModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleAddCompOff}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Date *</label>
                                    <input type="date" className="form-input" value={compOffForm.date} onChange={e => setCompOffForm({ ...compOffForm, date: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Hours Worked *</label>
                                    <input type="number" step="0.5" className="form-input" value={compOffForm.hours} onChange={e => setCompOffForm({ ...compOffForm, hours: e.target.value })} required min="0.5" max="24" placeholder="e.g. 4" />
                                    {compOffForm.hours && <small style={{ color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>= {(parseFloat(compOffForm.hours) / 8).toFixed(2)} day(s) · 8 hrs = 1 day</small>}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Reason</label>
                                    <input className="form-input" value={compOffForm.reason} onChange={e => setCompOffForm({ ...compOffForm, reason: e.target.value })} placeholder="Optional" />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowCompOffModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Add</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ───── ADD PERMISSION MODAL ───── */}
            {showPermModal && (
                <div className="modal-overlay" onClick={() => setShowPermModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
                        <div className="modal-header">
                            <h3 className="modal-title">Add Late C / Early G / Gen. Perm.</h3>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowPermModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleAddPerm}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Date *</label>
                                    <input type="date" className="form-input" value={permForm.date} onChange={e => setPermForm({ ...permForm, date: e.target.value })} required />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Type *</label>
                                    <select className="form-input" value={permForm.type} onChange={e => setPermForm({ ...permForm, type: e.target.value })}>
                                        <option value="late_coming">Late Coming (L)</option>
                                        <option value="early_going">Early Going (E)</option>
                                        <option value="general">General Permission (G)</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Hours *</label>
                                    <input type="number" step="0.5" className="form-input" value={permForm.hours} onChange={e => setPermForm({ ...permForm, hours: e.target.value })} required min="0.5" max="8" placeholder="e.g. 1.5" />
                                    {permForm.hours && <small style={{ color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>= {(parseFloat(permForm.hours) / 8).toFixed(2)} day(s) · 8 hrs = 1 day</small>}
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowPermModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Add</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ═════════ SETUP TAB ═════════ */}
            {activeTab === 'setup' && (
                <div>
                    <div className="card" style={{ padding: 24, marginBottom: 20 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)' }}>
                            <Zap size={18} style={{ verticalAlign: -3, marginRight: 8, color: 'var(--warning)' }} />
                            First-Time Setup Guide
                        </h3>
                        <div style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.8 }}>
                            <div style={{ display: 'grid', gap: 12 }}>
                                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                    <span style={{ background: 'var(--primary)', color: '#fff', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>1</span>
                                    <div><strong style={{ color: 'var(--text-primary)' }}>Seed Leave Types</strong> — Click below to create CL (Casual Leave), SL (Sick Leave) and EL (Earned Leave) in the system. Only needed once.</div>
                                </div>
                                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                    <span style={{ background: 'var(--primary)', color: '#fff', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>2</span>
                                    <div><strong style={{ color: 'var(--text-primary)' }}>Set Employee Categories</strong> — Go to Employees page → edit each employee → set <strong>Category</strong> (Confirmed, Time-Scale, etc.) and <strong>Leave Start Month</strong>.</div>
                                </div>
                                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                    <span style={{ background: 'var(--primary)', color: '#fff', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>3</span>
                                    <div><strong style={{ color: 'var(--text-primary)' }}>Set Initial Balances</strong> — Set the starting CL/SL/EL balance for all employees for the previous month. This gives the system a starting point.</div>
                                </div>
                                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                    <span style={{ background: 'var(--success)', color: '#fff', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>✓</span>
                                    <div><strong style={{ color: 'var(--text-primary)' }}>Done!</strong> — From now on, just go to Details tab each month to add Comp-Off and Permission entries. Everything else (CL, SL, EL, Late counts, LOP) is calculated automatically.</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {setupMsg && (
                        <div className="toast toast-success" style={{ position: 'relative', marginBottom: 16 }}>{setupMsg}</div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                        {/* Seed Leave Types */}
                        <div className="card" style={{ padding: 24 }}>
                            <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>Step 1: Seed Leave Types</h4>
                            <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 16 }}>Creates CL, SL, EL leave types if they don't exist. Safe to click multiple times.</p>
                            <button className="btn btn-primary" onClick={async () => {
                                try {
                                    const res = await api.post('/compoff/seed-leave-types');
                                    setSetupMsg(`✅ ${res.data.results.map(r => `${r.code}: ${r.action}`).join(', ')}`);
                                } catch (err) { setSetupMsg('❌ ' + (err.response?.data?.error || 'Failed')); }
                            }}>Seed CL / SL / EL</button>
                        </div>

                        {/* Bulk Set Initial Balance */}
                        <div className="card" style={{ padding: 24 }}>
                            <h4 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>Step 3: Set Initial Balances (All Employees)</h4>
                            <p style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 12 }}>Sets starting CL/SL/EL for ALL active employees for the selected month. This is the month <em>before</em> you start tracking.</p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                                <div>
                                    <label className="form-label">Month</label>
                                    <select className="form-input" value={bulkForm.month} onChange={e => setBulkForm({ ...bulkForm, month: e.target.value })}>
                                        {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="form-label">Year</label>
                                    <input type="number" className="form-input" value={bulkForm.year} onChange={e => setBulkForm({ ...bulkForm, year: e.target.value })} />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
                                <div>
                                    <label className="form-label">CL Balance</label>
                                    <input type="number" className="form-input" value={bulkForm.cl} onChange={e => setBulkForm({ ...bulkForm, cl: e.target.value })} />
                                </div>
                                <div>
                                    <label className="form-label">SL Balance</label>
                                    <input type="number" className="form-input" value={bulkForm.sl} onChange={e => setBulkForm({ ...bulkForm, sl: e.target.value })} />
                                </div>
                                <div>
                                    <label className="form-label">EL Balance</label>
                                    <input type="number" className="form-input" value={bulkForm.el} onChange={e => setBulkForm({ ...bulkForm, el: e.target.value })} />
                                </div>
                            </div>
                            <button className="btn btn-primary" onClick={async () => {
                                if (!confirm(`Set CL=${bulkForm.cl}, SL=${bulkForm.sl}, EL=${bulkForm.el} for ALL employees at ${MONTHS[bulkForm.month]} ${bulkForm.year}?`)) return;
                                try {
                                    const res = await api.post('/compoff/bulk-set-initial-balance', {
                                        month: parseInt(bulkForm.month) + 1, year: parseInt(bulkForm.year),
                                        clBalance: bulkForm.cl, slBalance: bulkForm.sl, elBalance: bulkForm.el,
                                    });
                                    setSetupMsg(`✅ ${res.data.message}`);
                                } catch (err) { setSetupMsg('❌ ' + (err.response?.data?.error || 'Failed')); }
                            }}>Set Balances for All Employees</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ───── PRINT STYLES ───── */}
            <style>{`
                @page {
                    size: A4 landscape;
                    margin: 6mm 8mm;
                }
                @media print {
                    html, body {
                        width: 100%;
                        background: white !important;
                        color: black !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .sidebar, .navbar, .print-hide { display: none !important; }
                    .main-content { margin: 0 !important; padding: 0 !important; }
                    .card {
                        box-shadow: none !important;
                        border: none !important;
                        padding: 0 !important;
                        overflow: visible !important;
                    }
                    .data-table {
                        width: 100% !important;
                        font-size: 6.5pt !important;
                        border-collapse: collapse !important;
                        table-layout: auto !important;
                    }
                    .data-table th, .data-table td {
                        color: black !important;
                        border: 1px solid #aaa !important;
                        padding: 2px 2px !important;
                        white-space: normal !important;
                        word-break: normal !important;
                        overflow-wrap: anywhere !important;
                        overflow: visible !important;
                    }
                    /* Name column — always enough room */
                    .data-table td:nth-child(2), .data-table th:nth-child(2) {
                        min-width: 65px !important;
                        word-break: normal !important;
                    }
                    /* Designation column */
                    .data-table td:nth-child(3), .data-table th:nth-child(3) {
                        min-width: 50px !important;
                    }
                    .data-table th {
                        background-color: #efefef !important;
                        font-weight: 700 !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }

                    /* Print header above table */
                    .print-title { display: block !important; font-size: 11pt; font-weight: 700; text-align: center; margin-bottom: 6px; }
                }
                .print-title { display: none; }
            `}</style>
        </div>
    );
}

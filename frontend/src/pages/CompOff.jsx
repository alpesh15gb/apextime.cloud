import { useState, useEffect } from 'react';
import api from '../lib/api';
import dayjs from 'dayjs';
import { Plus, X, Check, XCircle, Lock, Download, ChevronLeft, ChevronRight, Search, Clock, CalendarDays, Stethoscope, Palmtree, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const PERM_LABELS = { late_coming: 'Late C', early_going: 'Early G', general: 'Gen.' };
const CAT_LABELS = { confirmed: 'Confirmed', time_scale: 'Time-Scale', contract: 'Contract', adhoc: 'Adhoc', part_time: 'Part-Time' };
const CAT_COLORS = { confirmed: '#16a34a', time_scale: '#2563eb', contract: '#d97706', adhoc: '#7c3aed', part_time: '#0891b2' };
const CAT_BGS = { confirmed: '#e6f9ed', time_scale: '#dbeafe', contract: '#fef3c7', adhoc: '#ede9fe', part_time: '#cffafe' };

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
        const rows = summaryData.data.map(e => ({
            'Sl.': e.slNo, 'Name': e.name, 'Designation': e.designation, 'Category': CAT_LABELS[e.category] || e.category,
            'Days Present': e.daysPresent,
            'CO Days': e.current?.compOffDays || 0, 'CO Hrs': e.current?.compOffHours || 0,
            'CL Availed': e.current?.clAvailed || 0, 'Late Check-In': e.current?.lateCheckIns || 0, 'Late→Days': e.current?.lateCheckInDays || 0,
            'Perm Days': e.current?.permDays || 0, 'Perm Hrs': e.current?.permHours || 0,
            'SL Availed': e.current?.slAvailed || 0, 'EL Credited': e.current?.elCredited || 0, 'EL Utilised': e.current?.elUtilised || 0,
            'Avail CO Days': e.available?.compOffDays || 0, 'Avail CO Hrs': e.available?.compOffHours || 0,
            'Avail CL': e.available?.cl || 0, 'Avail SL': e.available?.sl || 0, 'Avail EL': e.available?.el || 0,
            'Avail Perm Days': e.available?.permDays || 0,
            'Bal CO Days': e.balance?.compOffDays || 0, 'Bal CO Hrs': e.balance?.compOffHours || 0,
            'Bal CL': e.balance?.cl || 0, 'Bal SL': e.balance?.sl || 0, 'Bal EL': e.balance?.el || 0,
            'LOP Days': e.lopDays || 0, 'Status': e.status,
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Summary');
        XLSX.writeFile(wb, `CompOff_Summary_${MONTHS[month - 1]}_${year}.xlsx`);
    };

    const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
    const nextMonth = () => { if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1); };

    const filteredDetails = detailsData?.data?.filter(emp =>
        emp.name.toLowerCase().includes(searchTerm.toLowerCase()) || emp.code?.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

    const getInitials = (name) => name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

    // ─────── STYLES ───────
    const S = {
        page: { maxWidth: 1400, margin: '0 auto' },
        header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 },
        title: { fontSize: 24, fontWeight: 800, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
        // Stat cards
        statsRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 },
        statCard: (gradient) => ({
            background: `linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`,
            borderRadius: 16, padding: '20px 24px', color: '#fff', position: 'relative', overflow: 'hidden',
            boxShadow: `0 4px 20px ${gradient[0]}33`,
        }),
        statIcon: { position: 'absolute', right: 16, top: 16, opacity: 0.3, fontSize: 40 },
        statLabel: { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.9 },
        statValue: { fontSize: 28, fontWeight: 800, marginTop: 4 },
        statSub: { fontSize: 11, opacity: 0.8, marginTop: 2 },
        // Controls bar
        controlsBar: {
            display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap',
            padding: '12px 16px', background: 'var(--bg-secondary, #f8f9fa)', borderRadius: 12,
        },
        monthNav: { display: 'flex', alignItems: 'center', gap: 8 },
        monthBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 6, borderRadius: 8, display: 'flex', alignItems: 'center', color: 'var(--text, #333)' },
        monthLabel: { fontWeight: 700, fontSize: 15, minWidth: 140, textAlign: 'center' },
        tabPill: (active) => ({
            padding: '6px 18px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: active ? '#6366f1' : 'transparent', color: active ? '#fff' : 'var(--text-muted, #888)',
            transition: 'all 0.2s',
        }),
        searchInput: {
            padding: '6px 12px 6px 32px', borderRadius: 20, border: '1px solid var(--border, #e5e7eb)',
            fontSize: 13, outline: 'none', width: 200, background: '#fff',
        },
        // Employee card
        empCard: {
            border: '1px solid var(--border, #e5e7eb)', borderRadius: 14, marginBottom: 16,
            overflow: 'hidden', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            transition: 'box-shadow 0.2s',
        },
        empHeader: {
            display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', cursor: 'pointer',
            background: 'linear-gradient(to right, #fafbff, #fff)',
        },
        avatar: (color) => ({
            width: 42, height: 42, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: 14, color: '#fff', background: `linear-gradient(135deg, ${color}, ${color}cc)`,
            flexShrink: 0,
        }),
        badge: (bg, color) => ({
            display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 10, fontWeight: 600,
            background: bg, color,
        }),
        chipRow: { display: 'flex', gap: 8, flexWrap: 'wrap', marginLeft: 'auto' },
        chip: (bg, color) => ({
            padding: '3px 10px', borderRadius: 16, fontSize: 11, fontWeight: 600, background: bg, color,
        }),
        // Sections grid
        sectionsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12, padding: '0 20px 16px' },
        section: {
            border: '1px solid var(--border, #e5e7eb)', borderRadius: 10, padding: 12,
            background: '#fafbff',
        },
        sectionTitle: { fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: '#6366f1', letterSpacing: '0.06em', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 },
        sectionBigNum: (color) => ({ fontSize: 26, fontWeight: 800, color, textAlign: 'center', padding: '4px 0' }),
        prevBalRow: {
            padding: '10px 20px', background: 'linear-gradient(to right, #f1f5f9, #f8fafc)', borderTop: '1px solid var(--border, #e5e7eb)',
            display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 11, color: 'var(--text-muted, #888)',
        },
        // Summary table
        summaryTable: { width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 11 },
        thGroup: { padding: '8px 6px', textAlign: 'center', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '2px solid var(--border, #e5e7eb)' },
        th: { padding: '6px 4px', textAlign: 'center', fontWeight: 600, fontSize: 10, position: 'sticky', top: 0, background: '#f8f9fa', zIndex: 1, borderBottom: '1px solid var(--border, #e5e7eb)' },
        td: { padding: '8px 4px', textAlign: 'center', borderBottom: '1px solid #f1f5f9' },
    };

    return (
        <div style={S.page}>
            {/* ───── HEADER ───── */}
            <div style={S.header}>
                <h2 style={S.title}>Comp-Off & Leave Management</h2>
            </div>

            {/* ───── CONTROLS BAR ───── */}
            <div style={S.controlsBar}>
                <div style={S.monthNav}>
                    <button style={S.monthBtn} onClick={prevMonth}><ChevronLeft size={18} /></button>
                    <span style={S.monthLabel}>{MONTHS[month - 1]} {year}</span>
                    <button style={S.monthBtn} onClick={nextMonth}><ChevronRight size={18} /></button>
                </div>
                <div style={{ display: 'flex', gap: 4, background: '#eef2ff', borderRadius: 22, padding: 3 }}>
                    <button style={S.tabPill(activeTab === 'details')} onClick={() => setActiveTab('details')}>Details</button>
                    <button style={S.tabPill(activeTab === 'summary')} onClick={() => setActiveTab('summary')}>Summary</button>
                </div>
                <div style={{ position: 'relative', marginLeft: 'auto' }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: '#aaa' }} />
                    <input style={S.searchInput} placeholder="Search employee..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                {activeTab === 'summary' && (
                    <>
                        <button className="btn btn-ghost btn-sm" onClick={exportSummaryExcel} style={{ fontSize: 12 }}><Download size={14} /> Excel</button>
                        <button className="btn btn-primary btn-sm" onClick={handleCloseMonth} style={{ fontSize: 12 }}><Lock size={14} /> Close Month</button>
                    </>
                )}
            </div>

            {loading && <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Loading...</div>}

            {/* ═════════ DETAILS TAB ═════════ */}
            {!loading && activeTab === 'details' && detailsData && (
                <div>
                    {/* Stat Cards */}
                    <div style={S.statsRow}>
                        {[
                            { label: 'Employees', value: detailsData.data.length, sub: 'Active', gradient: ['#6366f1', '#818cf8'], icon: '👥' },
                            { label: 'Days in Month', value: detailsData.daysInMonth, sub: MONTHS[month - 1], gradient: ['#0891b2', '#06b6d4'], icon: '📅' },
                            { label: 'Total Comp-Offs', value: detailsData.data.reduce((s, e) => s + (e.compOff?.entries?.length || 0), 0), sub: 'This month', gradient: ['#7c3aed', '#a78bfa'], icon: '⚡' },
                            { label: 'Leave Requests', value: detailsData.data.reduce((s, e) => s + (e.clAvailed?.totalDays || 0) + (e.slAvailed?.totalDays || 0), 0), sub: 'CL + SL availed', gradient: ['#059669', '#34d399'], icon: '🏖️' },
                        ].map((card, i) => (
                            <div key={i} style={S.statCard(card.gradient)}>
                                <div style={S.statIcon}>{card.icon}</div>
                                <div style={S.statLabel}>{card.label}</div>
                                <div style={S.statValue}>{card.value}</div>
                                <div style={S.statSub}>{card.sub}</div>
                            </div>
                        ))}
                    </div>

                    {/* Employee Cards */}
                    {filteredDetails.map(emp => (
                        <details key={emp.id} style={S.empCard}>
                            <summary style={S.empHeader}>
                                <div style={S.avatar(CAT_COLORS[emp.category] || '#6366f1')}>{getInitials(emp.name)}</div>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: 15 }}>{emp.name}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                                        <span>{emp.designation}</span>
                                        <span style={S.badge(CAT_BGS[emp.category] || '#f3f4f6', CAT_COLORS[emp.category] || '#333')}>
                                            {CAT_LABELS[emp.category] || emp.category}
                                        </span>
                                    </div>
                                </div>
                                <div style={S.chipRow}>
                                    <span style={S.chip('#dbeafe', '#2563eb')}>{emp.daysPresent} days</span>
                                    {emp.lateCheckIn?.count > 0 && <span style={S.chip('#fde8e8', '#dc2626')}>{emp.lateCheckIn.count} lates</span>}
                                    {emp.compOff?.entries?.length > 0 && <span style={S.chip('#ede9fe', '#7c3aed')}>{emp.compOff.entries.length} comp-offs</span>}
                                </div>
                            </summary>

                            {/* Sections Grid */}
                            <div style={S.sectionsGrid}>
                                {/* Comp-Off Gained */}
                                <div style={S.section}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={S.sectionTitle}><Clock size={12} /> Comp-Off Gained</div>
                                        <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, padding: '2px 6px' }}
                                            onClick={(e) => { e.stopPropagation(); setSelectedEmpId(emp.id); setShowCompOffModal(true); }}>
                                            <Plus size={11} /> Add
                                        </button>
                                    </div>
                                    {emp.compOff.entries.length > 0 ? (
                                        <>
                                            {emp.compOff.entries.map((c, i) => (
                                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', fontSize: 12, borderBottom: '1px solid #f1f5f9' }}>
                                                    <span>{c.date}</span>
                                                    <span style={{ fontWeight: 600 }}>{c.hours}h</span>
                                                    <div style={{ display: 'flex', gap: 2 }}>
                                                        {c.status === 'pending' && (
                                                            <>
                                                                <button className="btn btn-ghost btn-sm" style={{ padding: 2 }} onClick={() => handleApprove(c.uuid)}><Check size={12} color="#16a34a" /></button>
                                                                <button className="btn btn-ghost btn-sm" style={{ padding: 2 }} onClick={() => handleReject(c.uuid)}><XCircle size={12} color="#dc2626" /></button>
                                                            </>
                                                        )}
                                                        {c.status === 'approved' && <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 600 }}>✓</span>}
                                                        {c.status === 'rejected' && <span style={{ fontSize: 10, color: '#dc2626', fontWeight: 600 }}>✗</span>}
                                                        <button className="btn btn-ghost btn-sm" style={{ padding: 2 }} onClick={() => handleDeleteCompOff(c.uuid)}><X size={11} /></button>
                                                    </div>
                                                </div>
                                            ))}
                                            <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, textAlign: 'right', color: '#6366f1' }}>
                                                = {emp.compOff.convertedDays}d {emp.compOff.convertedHours}h
                                            </div>
                                        </>
                                    ) : <div style={{ textAlign: 'center', color: '#ccc', fontSize: 12, padding: 8 }}>—</div>}
                                </div>

                                {/* CL Availed */}
                                <div style={S.section}>
                                    <div style={S.sectionTitle}><CalendarDays size={12} /> CL Availed</div>
                                    {emp.clAvailed.entries.length > 0 ? (
                                        emp.clAvailed.entries.map((l, i) => (
                                            <div key={i} style={{ fontSize: 12, padding: '2px 0' }}>{l.startDate} — {l.days}d</div>
                                        ))
                                    ) : <div style={{ textAlign: 'center', color: '#ccc', fontSize: 12, padding: 8 }}>—</div>}
                                    <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, textAlign: 'right' }}>Total: {emp.clAvailed.totalDays}d</div>
                                </div>

                                {/* Late Check-In */}
                                <div style={S.section}>
                                    <div style={S.sectionTitle}><AlertTriangle size={12} /> Late Check-In</div>
                                    <div style={S.sectionBigNum(emp.lateCheckIn.count > 0 ? '#dc2626' : '#16a34a')}>
                                        {emp.lateCheckIn.count}
                                    </div>
                                    {emp.lateCheckIn.count > 0 && (
                                        <div style={{ textAlign: 'center', fontSize: 11, color: '#dc2626', fontWeight: 600 }}>
                                            {emp.lateCheckIn.count} lates → {emp.lateCheckIn.days} day(s)
                                        </div>
                                    )}
                                    {emp.lateCheckIn.dates?.length > 0 && (
                                        <div style={{ fontSize: 10, color: '#aaa', textAlign: 'center', marginTop: 4 }}>{emp.lateCheckIn.dates.join(', ')}</div>
                                    )}
                                </div>

                                {/* Late C / Early G / Gen. Perm */}
                                <div style={S.section}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={S.sectionTitle}>Late C / Early G / Gen.</div>
                                        <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, padding: '2px 6px' }}
                                            onClick={(e) => { e.stopPropagation(); setSelectedEmpId(emp.id); setShowPermModal(true); }}>
                                            <Plus size={11} /> Add
                                        </button>
                                    </div>
                                    {emp.permissions.entries.length > 0 ? (
                                        <>
                                            {emp.permissions.entries.map((p, i) => (
                                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '2px 0', borderBottom: '1px solid #f1f5f9' }}>
                                                    <span>{p.date}</span>
                                                    <span style={{ fontSize: 10, fontWeight: 600, color: '#7c3aed' }}>{PERM_LABELS[p.type]}</span>
                                                    <span>{p.hours}h</span>
                                                    <button className="btn btn-ghost btn-sm" style={{ padding: 2 }} onClick={() => handleDeletePerm(p.uuid)}><X size={11} /></button>
                                                </div>
                                            ))}
                                            <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, textAlign: 'right', color: '#7c3aed' }}>
                                                {emp.permissions.totalHours}h = {emp.permissions.convertedDays}d {emp.permissions.convertedHours}h
                                            </div>
                                        </>
                                    ) : <div style={{ textAlign: 'center', color: '#ccc', fontSize: 12, padding: 8 }}>—</div>}
                                </div>

                                {/* SL Availed */}
                                <div style={S.section}>
                                    <div style={S.sectionTitle}><Stethoscope size={12} /> SL Availed</div>
                                    {emp.slAvailed.entries.length > 0 ? (
                                        emp.slAvailed.entries.map((l, i) => (
                                            <div key={i} style={{ fontSize: 12, padding: '2px 0' }}>{l.startDate} — {l.days}d</div>
                                        ))
                                    ) : <div style={{ textAlign: 'center', color: '#ccc', fontSize: 12, padding: 8 }}>—</div>}
                                    {emp.slAvailed.validation?.error && (
                                        <div style={{ color: '#dc2626', fontSize: 10, fontWeight: 700, marginTop: 4 }}>⚠ {emp.slAvailed.validation.message}</div>
                                    )}
                                    <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, textAlign: 'right' }}>Total: {emp.slAvailed.totalDays}d</div>
                                </div>

                                {/* EL / Vacation */}
                                <div style={S.section}>
                                    <div style={S.sectionTitle}><Palmtree size={12} /> EL / Vacation</div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                                        <span>Credited: <strong style={{ color: '#16a34a' }}>{emp.elVacation.credited}</strong></span>
                                        <span>Utilised: <strong style={{ color: '#dc2626' }}>{emp.elVacation.utilised}</strong></span>
                                    </div>
                                    {emp.elVacation.entries?.length > 0 && emp.elVacation.entries.map((l, i) => (
                                        <div key={i} style={{ fontSize: 12, padding: '2px 0' }}>{l.startDate} — {l.days}d</div>
                                    ))}
                                </div>
                            </div>

                            {/* Previous Balance */}
                            <div style={S.prevBalRow}>
                                <strong style={{ color: '#6366f1', marginRight: 8 }}>Prev. Balance:</strong>
                                <span>CO: <strong>{emp.previousBalance.compOffDays}d/{emp.previousBalance.compOffHours}h</strong></span>
                                <span>CL: <strong>{emp.previousBalance.cl}</strong></span>
                                <span>SL: <strong>{emp.previousBalance.sl}</strong></span>
                                <span>EL: <strong>{emp.previousBalance.el}</strong></span>
                                <span>L/E: <strong>{emp.previousBalance.lateEarlyDays}d/{emp.previousBalance.lateEarlyHours}h</strong></span>
                            </div>
                        </details>
                    ))}
                    {filteredDetails.length === 0 && (
                        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>No employees found</div>
                    )}
                </div>
            )}

            {/* ═════════ SUMMARY TAB ═════════ */}
            {!loading && activeTab === 'summary' && summaryData && (
                <div className="card" style={{ overflow: 'auto', borderRadius: 14 }}>
                    <table style={S.summaryTable}>
                        <thead>
                            <tr>
                                <th rowSpan={2} style={{ ...S.th, position: 'sticky', left: 0, zIndex: 2, background: '#f8f9fa' }}>Sl.</th>
                                <th rowSpan={2} style={{ ...S.th, position: 'sticky', left: 28, zIndex: 2, background: '#f8f9fa', textAlign: 'left', minWidth: 140 }}>Name</th>
                                <th rowSpan={2} style={S.th}>Desig.</th>
                                <th rowSpan={2} style={S.th}>Cat.</th>
                                <th rowSpan={2} style={S.th}>Days</th>
                                <th colSpan={7} style={{ ...S.thGroup, background: '#eef2ff', color: '#6366f1' }}>Current Month</th>
                                <th colSpan={5} style={{ ...S.thGroup, background: '#f0fdf4', color: '#16a34a' }}>Available / Accumulated</th>
                                <th colSpan={5} style={{ ...S.thGroup, background: '#fefce8', color: '#ca8a04' }}>Balance C/F</th>
                                <th colSpan={2} style={{ ...S.thGroup, background: '#fef2f2', color: '#dc2626' }}>Status</th>
                            </tr>
                            <tr style={{ fontSize: 9 }}>
                                {/* Current */}
                                <th style={S.th}>CO.d</th><th style={S.th}>CO.h</th><th style={S.th}>CL</th><th style={S.th}>Late</th>
                                <th style={S.th}>L/E/G</th><th style={S.th}>SL</th><th style={S.th}>EL</th>
                                {/* Available */}
                                <th style={{ ...S.th, background: '#f0fdf4' }}>CO</th><th style={{ ...S.th, background: '#f0fdf4' }}>CL</th>
                                <th style={{ ...S.th, background: '#f0fdf4' }}>SL</th><th style={{ ...S.th, background: '#f0fdf4' }}>EL</th>
                                <th style={{ ...S.th, background: '#f0fdf4' }}>L/E</th>
                                {/* Balance */}
                                <th style={{ ...S.th, background: '#fefce8' }}>CO</th><th style={{ ...S.th, background: '#fefce8' }}>CL</th>
                                <th style={{ ...S.th, background: '#fefce8' }}>SL</th><th style={{ ...S.th, background: '#fefce8' }}>EL</th>
                                <th style={{ ...S.th, background: '#fefce8' }}>L/E.h</th>
                                {/* Status */}
                                <th style={{ ...S.th, background: '#fef2f2' }}>LOP</th><th style={{ ...S.th, background: '#fef2f2' }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {(summaryData.data || []).filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase())).map((e, idx) => (
                                <tr key={e.id} style={{ background: idx % 2 === 0 ? '#fff' : '#fafaff' }}>
                                    <td style={{ ...S.td, position: 'sticky', left: 0, background: idx % 2 === 0 ? '#fff' : '#fafaff', zIndex: 1 }}>{idx + 1}</td>
                                    <td style={{ ...S.td, position: 'sticky', left: 28, background: idx % 2 === 0 ? '#fff' : '#fafaff', zIndex: 1, textAlign: 'left', fontWeight: 600, fontSize: 12 }}>{e.name}</td>
                                    <td style={S.td}>{e.designation}</td>
                                    <td style={S.td}>
                                        <span style={S.badge(CAT_BGS[e.category] || '#f3f4f6', CAT_COLORS[e.category] || '#333')}>
                                            {CAT_LABELS[e.category]?.[0] || e.category?.[0] || '-'}
                                        </span>
                                    </td>
                                    <td style={{ ...S.td, fontWeight: 600 }}>{e.daysPresent}</td>
                                    {/* Current */}
                                    <td style={S.td}>{e.current?.compOffDays || '-'}</td>
                                    <td style={S.td}>{e.current?.compOffHours || '-'}</td>
                                    <td style={S.td}>{e.current?.clAvailed || '-'}</td>
                                    <td style={{ ...S.td, color: e.current?.lateCheckIns > 0 ? '#dc2626' : '' }}>
                                        {e.current?.lateCheckIns ? <>{e.current.lateCheckIns}<span style={{ fontSize: 9, color: '#999' }}>→{e.current.lateCheckInDays}d</span></> : '-'}
                                    </td>
                                    <td style={S.td}>{e.current?.permDays || '-'}</td>
                                    <td style={S.td}>{e.current?.slAvailed || '-'}</td>
                                    <td style={S.td}>{e.current?.elUtilised || '-'}</td>
                                    {/* Available */}
                                    <td style={{ ...S.td, background: idx % 2 === 0 ? '#f0fdf4' : '#e8f8ee' }}>{e.available?.compOffDays || '-'}</td>
                                    <td style={{ ...S.td, background: idx % 2 === 0 ? '#f0fdf4' : '#e8f8ee' }}>{e.available?.cl || '-'}</td>
                                    <td style={{ ...S.td, background: idx % 2 === 0 ? '#f0fdf4' : '#e8f8ee' }}>{e.available?.sl || '-'}</td>
                                    <td style={{ ...S.td, background: idx % 2 === 0 ? '#f0fdf4' : '#e8f8ee' }}>{e.available?.el || '-'}</td>
                                    <td style={{ ...S.td, background: idx % 2 === 0 ? '#f0fdf4' : '#e8f8ee' }}>{e.available?.permDays || '-'}</td>
                                    {/* Balance */}
                                    <td style={{ ...S.td, fontWeight: 700, background: idx % 2 === 0 ? '#fefce8' : '#fef9c3' }}>{e.balance?.compOffDays ?? 0}</td>
                                    <td style={{ ...S.td, fontWeight: 700, color: (e.balance?.cl ?? 0) < 0 ? '#dc2626' : '', background: idx % 2 === 0 ? '#fefce8' : '#fef9c3' }}>{e.balance?.cl ?? 0}</td>
                                    <td style={{ ...S.td, fontWeight: 700, color: (e.balance?.sl ?? 0) < 0 ? '#dc2626' : '', background: idx % 2 === 0 ? '#fefce8' : '#fef9c3' }}>{e.balance?.sl ?? 0}</td>
                                    <td style={{ ...S.td, fontWeight: 700, color: (e.balance?.el ?? 0) < 0 ? '#dc2626' : '', background: idx % 2 === 0 ? '#fefce8' : '#fef9c3' }}>{e.balance?.el ?? 0}</td>
                                    <td style={{ ...S.td, fontWeight: 700, background: idx % 2 === 0 ? '#fefce8' : '#fef9c3' }}>{e.balance?.permHours ?? 0}</td>
                                    {/* Status */}
                                    <td style={{ ...S.td, color: e.lopDays > 0 ? '#dc2626' : '', fontWeight: e.lopDays > 0 ? 700 : 400 }}>{e.lopDays || 0}</td>
                                    <td style={S.td}>
                                        <span style={{
                                            padding: '3px 10px', borderRadius: 12, fontSize: 10, fontWeight: 700,
                                            background: e.status === 'FULL' ? '#e6f9ed' : '#fde8e8',
                                            color: e.status === 'FULL' ? '#16a34a' : '#dc2626',
                                        }}>{e.status}</span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {(!summaryData.data || summaryData.data.length === 0) && (
                        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>No data for this month</div>
                    )}
                </div>
            )}

            {/* ───── ADD COMP-OFF MODAL ───── */}
            {showCompOffModal && (
                <div className="modal-overlay" onClick={() => setShowCompOffModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420, borderRadius: 16 }}>
                        <div className="modal-header">
                            <h3 className="modal-title">Add Comp-Off Entry</h3>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowCompOffModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleAddCompOff}>
                            <div className="modal-body">
                                <div className="form-group" style={{ marginBottom: 14 }}>
                                    <label className="form-label">Date *</label>
                                    <input type="date" className="form-input" value={compOffForm.date} onChange={e => setCompOffForm({ ...compOffForm, date: e.target.value })} required />
                                </div>
                                <div className="form-group" style={{ marginBottom: 14 }}>
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
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420, borderRadius: 16 }}>
                        <div className="modal-header">
                            <h3 className="modal-title">Add Late C / Early G / Gen. Perm.</h3>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowPermModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleAddPerm}>
                            <div className="modal-body">
                                <div className="form-group" style={{ marginBottom: 14 }}>
                                    <label className="form-label">Date *</label>
                                    <input type="date" className="form-input" value={permForm.date} onChange={e => setPermForm({ ...permForm, date: e.target.value })} required />
                                </div>
                                <div className="form-group" style={{ marginBottom: 14 }}>
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
        </div>
    );
}

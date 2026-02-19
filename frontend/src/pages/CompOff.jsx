import { useState, useEffect } from 'react';
import api from '../lib/api';
import dayjs from 'dayjs';
import { Plus, X, Check, XCircle, Lock, Download, Printer } from 'lucide-react';
import * as XLSX from 'xlsx';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const PERM_LABELS = { late_coming: 'Late C', early_going: 'Early G', general: 'Gen.' };
const CAT_LABELS = { confirmed: 'Confirmed', time_scale: 'Time-Scale', contract: 'Contract', adhoc: 'Adhoc', part_time: 'Part-Time' };

export default function CompOff() {
    const [activeTab, setActiveTab] = useState('details');
    const [month, setMonth] = useState(dayjs().month() + 1);
    const [year, setYear] = useState(dayjs().year());
    const [detailsData, setDetailsData] = useState(null);
    const [summaryData, setSummaryData] = useState(null);
    const [loading, setLoading] = useState(false);

    // Add entry modals
    const [showCompOffModal, setShowCompOffModal] = useState(false);
    const [showPermModal, setShowPermModal] = useState(false);
    const [selectedEmpId, setSelectedEmpId] = useState(null);
    const [compOffForm, setCompOffForm] = useState({ date: '', hours: '', reason: '' });
    const [permForm, setPermForm] = useState({ date: '', type: 'late_coming', hours: '' });

    // Employees list for dropdowns
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
            await api.post('/compoff', {
                employeeId: selectedEmpId,
                date: compOffForm.date,
                hours: parseFloat(compOffForm.hours),
                reason: compOffForm.reason,
                month, year,
            });
            setShowCompOffModal(false);
            setCompOffForm({ date: '', hours: '', reason: '' });
            loadData();
        } catch (err) { alert(err.response?.data?.message || 'Failed'); }
    };

    const handleApprove = async (uuid) => {
        try { await api.post(`/compoff/${uuid}/approve`); loadData(); }
        catch (err) { alert('Failed'); }
    };

    const handleReject = async (uuid) => {
        try { await api.post(`/compoff/${uuid}/reject`); loadData(); }
        catch (err) { alert('Failed'); }
    };

    const handleDeleteCompOff = async (uuid) => {
        if (!confirm('Delete this comp-off entry?')) return;
        try { await api.delete(`/compoff/${uuid}`); loadData(); }
        catch (err) { alert('Failed'); }
    };

    const handleAddPerm = async (e) => {
        e.preventDefault();
        try {
            await api.post('/compoff/permissions', {
                employeeId: selectedEmpId,
                date: permForm.date,
                type: permForm.type,
                hours: parseFloat(permForm.hours),
                month, year,
            });
            setShowPermModal(false);
            setPermForm({ date: '', type: 'late_coming', hours: '' });
            loadData();
        } catch (err) { alert(err.response?.data?.message || 'Failed'); }
    };

    const handleDeletePerm = async (uuid) => {
        if (!confirm('Delete this permission entry?')) return;
        try { await api.delete(`/compoff/permissions/${uuid}`); loadData(); }
        catch (err) { alert('Failed'); }
    };

    const handleCloseMonth = async () => {
        if (!confirm(`Close ${MONTHS[month - 1]} ${year}? This will finalize all balances and carry forward to next month.`)) return;
        try {
            const res = await api.post('/compoff/close-month', { month, year });
            alert(res.data.message);
            loadData();
        } catch (err) { alert(err.response?.data?.message || 'Failed'); }
    };

    const exportSummaryExcel = () => {
        if (!summaryData?.data) return;
        const aoa = [];
        aoa.push([`Comp-Off & Leave Summary — ${MONTHS[month - 1]} ${year}`]);
        aoa.push([]);
        aoa.push(['Sl.', 'Name', 'Designation', 'Category', 'Leave System', 'Days Present',
            'CompOff Days', 'CompOff Hrs', 'CL Availed', 'Late Check-In', 'Perm Days', 'Perm Hrs',
            'SL Availed', 'EL Utilised',
            'Prev CompOff', 'Prev CL', 'Prev SL', 'Prev EL', 'Prev Late/Early',
            'Bal CompOff', 'Bal CL', 'Bal SL', 'Bal EL', 'Bal Late/Early',
            'LOP Days', 'Status']);

        summaryData.data.forEach((emp, idx) => {
            aoa.push([
                idx + 1, emp.name, emp.designation, CAT_LABELS[emp.category] || emp.category,
                emp.leaveStartMonth ? MONTHS[emp.leaveStartMonth - 1] : '-', emp.daysPresent,
                emp.current.compOffDays, emp.current.compOffHours,
                emp.current.clAvailed, emp.current.lateCheckIns,
                emp.current.permDays, emp.current.permHours,
                emp.current.slAvailed, emp.current.elUtilised,
                emp.previous.compOffDays, emp.previous.cl, emp.previous.sl, emp.previous.el, emp.previous.lateEarlyDays,
                emp.balance.compOffDays, emp.balance.cl, emp.balance.sl, emp.balance.el, emp.balance.lateEarlyDays,
                emp.lopDays, emp.status,
            ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws['!cols'] = [{ wch: 4 }, { wch: 22 }, { wch: 15 }, { wch: 12 }, { wch: 10 }, { wch: 6 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Summary');
        XLSX.writeFile(wb, `CompOff_Summary_${month}_${year}.xlsx`);
    };

    return (
        <div>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ fontSize: 22, fontWeight: 700 }}>Comp-Off & Leave Management</h2>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select className="form-input" style={{ width: 130 }} value={month} onChange={e => setMonth(parseInt(e.target.value))}>
                        {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                    </select>
                    <input type="number" className="form-input" style={{ width: 80 }} value={year} onChange={e => setYear(parseInt(e.target.value))} />
                </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 0, marginBottom: 20 }}>
                {['details', 'summary'].map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                        style={{
                            padding: '10px 24px', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                            border: '1px solid var(--border, #e5e7eb)',
                            background: activeTab === tab ? 'var(--primary, #7c3aed)' : 'transparent',
                            color: activeTab === tab ? '#fff' : 'var(--text)',
                            borderRadius: tab === 'details' ? '8px 0 0 8px' : '0 8px 8px 0',
                        }}>
                        {tab === 'details' ? 'Details' : 'Summary'}
                    </button>
                ))}
            </div>

            {loading && <p style={{ textAlign: 'center', padding: 40 }}>Loading...</p>}

            {/* ───── DETAILS TAB ───── */}
            {!loading && activeTab === 'details' && detailsData && (
                <div>
                    {detailsData.data.map((emp, idx) => (
                        <div key={emp.id} className="card" style={{ marginBottom: 16, padding: 16 }}>
                            {/* Employee Header */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                <div>
                                    <span style={{ fontWeight: 700, fontSize: 14 }}>{idx + 1}. {emp.name}</span>
                                    <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>({emp.code})</span>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                                        {emp.designation} | {emp.department} | <strong>{CAT_LABELS[emp.category] || emp.category}</strong>
                                        {emp.leaveStartMonth && <> | Leave from: {MONTHS[emp.leaveStartMonth - 1]}</>}
                                    </div>
                                </div>
                                <div style={{ fontSize: 12, fontWeight: 600 }}>
                                    Days Present: <span style={{ color: 'var(--primary, #7c3aed)' }}>{emp.daysPresent}</span>
                                </div>
                            </div>

                            {/* Sections in a grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12 }}>
                                {/* Comp-Off Gained */}
                                <div style={{ border: '1px solid var(--border, #e5e7eb)', borderRadius: 8, padding: 10 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                        <strong style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Comp-Off Gained</strong>
                                        <button className="btn btn-ghost btn-sm" style={{ fontSize: 10 }}
                                            onClick={() => { setSelectedEmpId(emp.id); setShowCompOffModal(true); }}>
                                            <Plus size={12} /> Add
                                        </button>
                                    </div>
                                    {emp.compOff.entries.length > 0 ? (
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead><tr style={{ background: 'var(--bg-secondary, #f5f5f5)' }}>
                                                <th style={{ padding: 4, textAlign: 'left' }}>Date</th>
                                                <th style={{ padding: 4 }}>Hrs</th>
                                                <th style={{ padding: 4 }}>Days</th>
                                                <th style={{ padding: 4 }}>Status</th>
                                                <th style={{ padding: 4 }}></th>
                                            </tr></thead>
                                            <tbody>
                                                {emp.compOff.entries.map((c, i) => (
                                                    <tr key={i} style={{ borderBottom: '1px solid var(--border, #eee)' }}>
                                                        <td style={{ padding: 3 }}>{c.date}</td>
                                                        <td style={{ padding: 3, textAlign: 'center' }}>{c.hours}</td>
                                                        <td style={{ padding: 3, textAlign: 'center' }}>{c.days}</td>
                                                        <td style={{ padding: 3, textAlign: 'center' }}>
                                                            <span style={{
                                                                padding: '1px 6px', borderRadius: 8, fontSize: 10, fontWeight: 600,
                                                                background: c.status === 'approved' ? '#e6f9ed' : c.status === 'rejected' ? '#fde8e8' : '#fef3c7',
                                                                color: c.status === 'approved' ? '#16a34a' : c.status === 'rejected' ? '#dc2626' : '#d97706',
                                                            }}>{c.status}</span>
                                                        </td>
                                                        <td style={{ padding: 3, display: 'flex', gap: 2, justifyContent: 'center' }}>
                                                            {c.status === 'pending' && <>
                                                                <button className="btn btn-ghost btn-sm" onClick={() => handleApprove(c.uuid)} title="Approve"><Check size={12} /></button>
                                                                <button className="btn btn-ghost btn-sm" onClick={() => handleReject(c.uuid)} title="Reject"><XCircle size={12} /></button>
                                                            </>}
                                                            <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteCompOff(c.uuid)} title="Delete"><X size={12} /></button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : <div style={{ color: 'var(--text-muted)', padding: 8, textAlign: 'center' }}>—</div>}
                                    {emp.compOff.totalHours > 0 && (
                                        <div style={{ marginTop: 4, fontWeight: 600, fontSize: 11, textAlign: 'right' }}>
                                            Total: {emp.compOff.totalHours} hrs = {emp.compOff.totalDays} days
                                        </div>
                                    )}
                                </div>

                                {/* CL Availed */}
                                <div style={{ border: '1px solid var(--border, #e5e7eb)', borderRadius: 8, padding: 10 }}>
                                    <strong style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>CL Availed</strong>
                                    {emp.clAvailed.entries.length > 0 ? (
                                        emp.clAvailed.entries.map((l, i) => (
                                            <div key={i} style={{ padding: '2px 0' }}>{l.startDate} — {l.days} day(s)</div>
                                        ))
                                    ) : <div style={{ color: 'var(--text-muted)', textAlign: 'center' }}>—</div>}
                                    <div style={{ marginTop: 4, fontWeight: 600, fontSize: 11, textAlign: 'right' }}>Total: {emp.clAvailed.totalDays} days</div>
                                </div>

                                {/* Late Check-in */}
                                <div style={{ border: '1px solid var(--border, #e5e7eb)', borderRadius: 8, padding: 10 }}>
                                    <strong style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Late Check-In</strong>
                                    <div style={{ textAlign: 'center', fontSize: 20, fontWeight: 700, color: emp.lateCheckIn.count > 0 ? '#dc2626' : '#16a34a' }}>
                                        {emp.lateCheckIn.count}
                                    </div>
                                    {emp.lateCheckIn.dates.length > 0 && (
                                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', marginTop: 4 }}>
                                            {emp.lateCheckIn.dates.join(', ')}
                                        </div>
                                    )}
                                </div>

                                {/* Late C / Early G / Gen. Permission */}
                                <div style={{ border: '1px solid var(--border, #e5e7eb)', borderRadius: 8, padding: 10 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                        <strong style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Late C / Early G / Gen. Perm.</strong>
                                        <button className="btn btn-ghost btn-sm" style={{ fontSize: 10 }}
                                            onClick={() => { setSelectedEmpId(emp.id); setShowPermModal(true); }}>
                                            <Plus size={12} /> Add
                                        </button>
                                    </div>
                                    {emp.permissions.entries.length > 0 ? (
                                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                            <thead><tr style={{ background: 'var(--bg-secondary, #f5f5f5)' }}>
                                                <th style={{ padding: 4, textAlign: 'left' }}>Date</th>
                                                <th style={{ padding: 4 }}>Type</th>
                                                <th style={{ padding: 4 }}>Hrs</th>
                                                <th style={{ padding: 4 }}></th>
                                            </tr></thead>
                                            <tbody>
                                                {emp.permissions.entries.map((p, i) => (
                                                    <tr key={i} style={{ borderBottom: '1px solid var(--border, #eee)' }}>
                                                        <td style={{ padding: 3 }}>{p.date}</td>
                                                        <td style={{ padding: 3, textAlign: 'center' }}>{PERM_LABELS[p.type] || p.type}</td>
                                                        <td style={{ padding: 3, textAlign: 'center' }}>{p.hours}</td>
                                                        <td style={{ padding: 3, textAlign: 'center' }}>
                                                            <button className="btn btn-ghost btn-sm" onClick={() => handleDeletePerm(p.uuid)}><X size={12} /></button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : <div style={{ color: 'var(--text-muted)', textAlign: 'center' }}>—</div>}
                                    {emp.permissions.totalHours > 0 && (
                                        <div style={{ marginTop: 4, fontWeight: 600, fontSize: 11, textAlign: 'right' }}>
                                            Total: {emp.permissions.totalHours} hrs = {emp.permissions.totalDays} days
                                        </div>
                                    )}
                                </div>

                                {/* SL Availed */}
                                <div style={{ border: '1px solid var(--border, #e5e7eb)', borderRadius: 8, padding: 10 }}>
                                    <strong style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>SL Availed</strong>
                                    {emp.slAvailed.entries.length > 0 ? (
                                        emp.slAvailed.entries.map((l, i) => (
                                            <div key={i} style={{ padding: '2px 0' }}>{l.startDate} — {l.days} day(s)</div>
                                        ))
                                    ) : <div style={{ color: 'var(--text-muted)', textAlign: 'center' }}>—</div>}
                                    <div style={{ marginTop: 4, fontWeight: 600, fontSize: 11, textAlign: 'right' }}>Total: {emp.slAvailed.totalDays} days</div>
                                </div>

                                {/* EL/Vacation */}
                                <div style={{ border: '1px solid var(--border, #e5e7eb)', borderRadius: 8, padding: 10 }}>
                                    <strong style={{ fontSize: 11, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>EL / Vacation</strong>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                        <span>Credited: {emp.elVacation.credited}</span>
                                        <span>Utilised: {emp.elVacation.utilised}</span>
                                    </div>
                                    {emp.elVacation.entries.length > 0 && emp.elVacation.entries.map((l, i) => (
                                        <div key={i} style={{ padding: '2px 0' }}>{l.startDate} — {l.days} day(s)</div>
                                    ))}
                                </div>
                            </div>

                            {/* Previous Balance */}
                            <div style={{ marginTop: 10, padding: 8, background: 'var(--bg-secondary, #f5f5f5)', borderRadius: 8, fontSize: 11 }}>
                                <strong style={{ textTransform: 'uppercase', color: 'var(--text-muted)' }}>Balance from Previous Month:</strong>
                                <div style={{ display: 'flex', gap: 16, marginTop: 4, flexWrap: 'wrap' }}>
                                    <span>Comp-Off: <strong>{emp.previousBalance.compOffDays}d / {emp.previousBalance.compOffHours}h</strong></span>
                                    <span>CL: <strong>{emp.previousBalance.cl}</strong></span>
                                    <span>SL: <strong>{emp.previousBalance.sl}</strong></span>
                                    <span>EL: <strong>{emp.previousBalance.el}</strong></span>
                                    <span>Late/Early: <strong>{emp.previousBalance.lateEarlyDays}d / {emp.previousBalance.lateEarlyHours}h</strong></span>
                                </div>
                            </div>
                        </div>
                    ))}
                    {detailsData.data.length === 0 && (
                        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>No employee data for this month</div>
                    )}
                </div>
            )}

            {/* ───── SUMMARY TAB ───── */}
            {!loading && activeTab === 'summary' && summaryData && (
                <div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 16, justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost btn-sm" onClick={exportSummaryExcel}><Download size={14} /> Excel</button>
                        <button className="btn btn-primary btn-sm" onClick={handleCloseMonth}><Lock size={14} /> Close Month</button>
                    </div>
                    <div className="card" style={{ overflowX: 'auto' }}>
                        <table className="data-table" style={{ fontSize: 11, whiteSpace: 'nowrap' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-secondary, #f5f5f5)' }}>
                                    <th rowSpan={2} style={{ padding: 6 }}>Sl.</th>
                                    <th rowSpan={2} style={{ padding: 6 }}>Name</th>
                                    <th rowSpan={2} style={{ padding: 6 }}>Desig.</th>
                                    <th rowSpan={2} style={{ padding: 6 }}>Cat.</th>
                                    <th rowSpan={2} style={{ padding: 6 }}>Days Present</th>
                                    <th colSpan={6} style={{ padding: 6, textAlign: 'center', borderBottom: '1px solid var(--border)' }}>Current Month</th>
                                    <th colSpan={5} style={{ padding: 6, textAlign: 'center', borderBottom: '1px solid var(--border)' }}>Prev. Balance</th>
                                    <th colSpan={5} style={{ padding: 6, textAlign: 'center', borderBottom: '1px solid var(--border)' }}>Balance C/F</th>
                                    <th rowSpan={2} style={{ padding: 6 }}>LOP</th>
                                    <th rowSpan={2} style={{ padding: 6 }}>Status</th>
                                </tr>
                                <tr style={{ background: 'var(--bg-secondary, #f5f5f5)', fontSize: 10 }}>
                                    <th style={{ padding: 4 }}>CO Days</th>
                                    <th style={{ padding: 4 }}>CL</th>
                                    <th style={{ padding: 4 }}>Late</th>
                                    <th style={{ padding: 4 }}>L/E/G</th>
                                    <th style={{ padding: 4 }}>SL</th>
                                    <th style={{ padding: 4 }}>EL</th>
                                    <th style={{ padding: 4 }}>CO</th>
                                    <th style={{ padding: 4 }}>CL</th>
                                    <th style={{ padding: 4 }}>SL</th>
                                    <th style={{ padding: 4 }}>EL</th>
                                    <th style={{ padding: 4 }}>L/E</th>
                                    <th style={{ padding: 4 }}>CO</th>
                                    <th style={{ padding: 4 }}>CL</th>
                                    <th style={{ padding: 4 }}>SL</th>
                                    <th style={{ padding: 4 }}>EL</th>
                                    <th style={{ padding: 4 }}>L/E</th>
                                </tr>
                            </thead>
                            <tbody>
                                {summaryData.data.map((emp, idx) => (
                                    <tr key={emp.id} style={{ borderBottom: '1px solid var(--border, #eee)' }}>
                                        <td style={{ padding: 4 }}>{idx + 1}</td>
                                        <td style={{ padding: 4, fontWeight: 500 }}>{emp.name}</td>
                                        <td style={{ padding: 4 }}>{emp.designation}</td>
                                        <td style={{ padding: 4, fontSize: 10 }}>{CAT_LABELS[emp.category] || emp.category}</td>
                                        <td style={{ padding: 4, textAlign: 'center' }}>{emp.daysPresent}</td>
                                        {/* Current */}
                                        <td style={{ padding: 4, textAlign: 'center' }}>{emp.current?.compOffDays || '-'}</td>
                                        <td style={{ padding: 4, textAlign: 'center' }}>{emp.current?.clAvailed || '-'}</td>
                                        <td style={{ padding: 4, textAlign: 'center', color: emp.current?.lateCheckIns > 0 ? '#dc2626' : '' }}>{emp.current?.lateCheckIns ? `${emp.current.lateCheckIns}→${emp.current.lateCheckInDays}d` : '-'}</td>
                                        <td style={{ padding: 4, textAlign: 'center' }}>{emp.current?.permDays || '-'}</td>
                                        <td style={{ padding: 4, textAlign: 'center' }}>{emp.current?.slAvailed || '-'}</td>
                                        <td style={{ padding: 4, textAlign: 'center' }}>{emp.current?.elUtilised || '-'}</td>
                                        {/* Available/Accumulated */}
                                        <td style={{ padding: 4, textAlign: 'center', background: '#f9fafb' }}>{emp.available?.compOffDays || '-'}</td>
                                        <td style={{ padding: 4, textAlign: 'center', background: '#f9fafb' }}>{emp.available?.cl || '-'}</td>
                                        <td style={{ padding: 4, textAlign: 'center', background: '#f9fafb' }}>{emp.available?.sl || '-'}</td>
                                        <td style={{ padding: 4, textAlign: 'center', background: '#f9fafb' }}>{emp.available?.el || '-'}</td>
                                        <td style={{ padding: 4, textAlign: 'center', background: '#f9fafb' }}>{emp.available?.permDays || '-'}</td>
                                        {/* Balance */}
                                        <td style={{ padding: 4, textAlign: 'center', fontWeight: 600 }}>{emp.balance?.compOffDays ?? 0}</td>
                                        <td style={{ padding: 4, textAlign: 'center', fontWeight: 600, color: emp.balance?.cl < 0 ? '#dc2626' : '' }}>{emp.balance?.cl ?? 0}</td>
                                        <td style={{ padding: 4, textAlign: 'center', fontWeight: 600, color: emp.balance?.sl < 0 ? '#dc2626' : '' }}>{emp.balance?.sl ?? 0}</td>
                                        <td style={{ padding: 4, textAlign: 'center', fontWeight: 600, color: emp.balance?.el < 0 ? '#dc2626' : '' }}>{emp.balance?.el ?? 0}</td>
                                        <td style={{ padding: 4, textAlign: 'center', fontWeight: 600 }}>{emp.balance?.permHours ?? 0}</td>
                                        {/* LOP/Status */}
                                        <td style={{ padding: 4, textAlign: 'center', color: emp.lopDays > 0 ? '#dc2626' : '', fontWeight: emp.lopDays > 0 ? 700 : 400 }}>{emp.lopDays || 0}</td>
                                        <td style={{ padding: 4, textAlign: 'center' }}>
                                            <span style={{
                                                padding: '2px 8px', borderRadius: 8, fontSize: 10, fontWeight: 600,
                                                background: emp.status === 'FULL' ? '#e6f9ed' : '#fde8e8',
                                                color: emp.status === 'FULL' ? '#16a34a' : '#dc2626',
                                            }}>{emp.status}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ───── ADD COMP-OFF MODAL ───── */}
            {showCompOffModal && (
                <div className="modal-overlay" onClick={() => setShowCompOffModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
                        <div className="modal-header">
                            <h3 className="modal-title">Add Comp-Off Entry</h3>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowCompOffModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleAddCompOff}>
                            <div className="modal-body">
                                <div className="form-group" style={{ marginBottom: 12 }}>
                                    <label className="form-label">Date *</label>
                                    <input type="date" className="form-input" value={compOffForm.date} onChange={e => setCompOffForm({ ...compOffForm, date: e.target.value })} required />
                                </div>
                                <div className="form-group" style={{ marginBottom: 12 }}>
                                    <label className="form-label">Hours Worked *</label>
                                    <input type="number" step="0.5" className="form-input" value={compOffForm.hours} onChange={e => setCompOffForm({ ...compOffForm, hours: e.target.value })} required min="0.5" max="24" placeholder="e.g. 4" />
                                    {compOffForm.hours && <small style={{ color: 'var(--text-muted)' }}>= {(parseFloat(compOffForm.hours) / 8).toFixed(2)} day(s)</small>}
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
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
                        <div className="modal-header">
                            <h3 className="modal-title">Add Late C / Early G / Gen. Perm.</h3>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowPermModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleAddPerm}>
                            <div className="modal-body">
                                <div className="form-group" style={{ marginBottom: 12 }}>
                                    <label className="form-label">Date *</label>
                                    <input type="date" className="form-input" value={permForm.date} onChange={e => setPermForm({ ...permForm, date: e.target.value })} required />
                                </div>
                                <div className="form-group" style={{ marginBottom: 12 }}>
                                    <label className="form-label">Type *</label>
                                    <select className="form-input" value={permForm.type} onChange={e => setPermForm({ ...permForm, type: e.target.value })}>
                                        <option value="late_coming">Late Coming</option>
                                        <option value="early_going">Early Going</option>
                                        <option value="general">General Permission</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Hours *</label>
                                    <input type="number" step="0.5" className="form-input" value={permForm.hours} onChange={e => setPermForm({ ...permForm, hours: e.target.value })} required min="0.5" max="8" placeholder="e.g. 1.5" />
                                    {permForm.hours && <small style={{ color: 'var(--text-muted)' }}>= {(parseFloat(permForm.hours) / 8).toFixed(2)} day(s)</small>}
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

import { useState, useEffect } from 'react';
import api from '../lib/api';
import dayjs from 'dayjs';
import { Download, Printer, Calendar } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function Reports() {
    const [activeTab, setActiveTab] = useState('monthly'); // monthly | approvals

    // Monthly State
    const [month, setMonth] = useState(dayjs().month() + 1);
    const [year, setYear] = useState(dayjs().year());
    const [monthlyData, setMonthlyData] = useState(null);

    // Approvals State
    const [approvalStart, setApprovalStart] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
    const [approvalEnd, setApprovalEnd] = useState(dayjs().endOf('month').format('YYYY-MM-DD'));
    const [approvalStatus, setApprovalStatus] = useState('');
    const [approvalData, setApprovalData] = useState(null);

    const [loading, setLoading] = useState(false);

    // Initial Load
    useEffect(() => {
        if (activeTab === 'monthly') loadMonthlyData();
        else loadApprovalData();
    }, [activeTab, month, year, approvalStart, approvalEnd, approvalStatus]);

    const loadMonthlyData = () => {
        setLoading(true);
        api.get(`/reports/monthly?month=${month}&year=${year}`)
            .then(res => { setMonthlyData(res.data); setLoading(false); })
            .catch(() => { alert('Failed to load report'); setLoading(false); });
    };

    const loadApprovalData = () => {
        setLoading(true);
        const query = `?startDate=${approvalStart}&endDate=${approvalEnd}${approvalStatus ? `&status=${approvalStatus}` : ''}`;
        api.get(`/reports/approvals${query}`)
            .then(res => { setApprovalData(res.data); setLoading(false); })
            .catch(() => { alert('Failed to load approvals'); setLoading(false); });
    };

    const handleExportExcel = () => {
        if (activeTab === 'monthly') exportMonthlyExcel();
        else exportApprovalsExcel();
    };

    const exportMonthlyExcel = () => {
        if (!monthlyData || !monthlyData.data) return;
        const aoa = [];
        aoa.push([`Monthly Performance Report - ${monthlyData.meta.monthName} ${monthlyData.meta.year}`]);
        aoa.push([]);

        const headerRow = ['Name', 'Code', 'Dept', 'Metric'];
        for (let i = 1; i <= monthlyData.meta.daysInMonth; i++) headerRow.push(i);
        aoa.push(headerRow);

        monthlyData.data.forEach(emp => {
            const rowIn = [emp.name, emp.code, emp.department, 'IN'];
            for (let i = 1; i <= monthlyData.meta.daysInMonth; i++) rowIn.push(emp.days[i]?.in || '');
            aoa.push(rowIn);

            const rowOut = ['', '', '', 'OUT'];
            for (let i = 1; i <= monthlyData.meta.daysInMonth; i++) rowOut.push(emp.days[i]?.out || '');
            aoa.push(rowOut);

            const rowShift = ['', '', '', 'Shift'];
            for (let i = 1; i <= monthlyData.meta.daysInMonth; i++) rowShift.push(emp.days[i]?.shift || 'GEN');
            aoa.push(rowShift);

            const rowLate = ['', '', '', 'Late'];
            for (let i = 1; i <= monthlyData.meta.daysInMonth; i++) rowLate.push(emp.days[i]?.late || '');
            aoa.push(rowLate);

            const rowStatus = ['', '', '', 'Status'];
            for (let i = 1; i <= monthlyData.meta.daysInMonth; i++) rowStatus.push(emp.days[i]?.status || '');
            aoa.push(rowStatus);

            const rowSum = [`Present: ${emp.stats.present}, Absent: ${emp.stats.absent}, Work: ${emp.stats.totalWorkHrs}`, '', '', ''];
            aoa.push(rowSum);
            aoa.push([]);
        });

        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 8 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Attendance");
        XLSX.writeFile(wb, `Attendance_Report_${month}_${year}.xlsx`);
    };

    const exportApprovalsExcel = () => {
        if (!approvalData) return;
        const ws = XLSX.utils.json_to_sheet(approvalData);
        ws['!cols'] = [{ wch: 12 }, { wch: 20 }, { wch: 10 }, { wch: 15 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 25 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Approvals");
        XLSX.writeFile(wb, `Approvals_Report_${approvalStart}_to_${approvalEnd}.xlsx`);
    };

    const handlePrint = () => window.print();

    return (
        <div>
            <div className="no-print" style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h2 style={{ fontSize: 22, fontWeight: 700 }}>Reports</h2>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button className={`btn ${activeTab === 'monthly' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('monthly')}>Monthly Performance</button>
                        <button className={`btn ${activeTab === 'approvals' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setActiveTab('approvals')}>Approvals / Day Wise</button>
                    </div>
                </div>

                <div className="card" style={{ padding: 16, display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                        {activeTab === 'monthly' ? (
                            <>
                                <select value={month} onChange={e => setMonth(e.target.value)} className="form-input" style={{ width: 140 }}>
                                    {Array.from({ length: 12 }, (_, i) => (
                                        <option key={i + 1} value={i + 1}>{dayjs().month(i).format('MMMM')}</option>
                                    ))}
                                </select>
                                <select value={year} onChange={e => setYear(e.target.value)} className="form-input" style={{ width: 100 }}>
                                    {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </>
                        ) : (
                            <>
                                <input type="date" value={approvalStart} onChange={e => setApprovalStart(e.target.value)} className="form-input" />
                                <span style={{ color: 'var(--text-secondary)' }}>to</span>
                                <input type="date" value={approvalEnd} onChange={e => setApprovalEnd(e.target.value)} className="form-input" />
                                <select value={approvalStatus} onChange={e => setApprovalStatus(e.target.value)} className="form-input" style={{ width: 140 }}>
                                    <option value="">All Status</option>
                                    <option value="approved">Approved</option>
                                    <option value="rejected">Rejected</option>
                                    <option value="pending">Pending</option>
                                </select>
                            </>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button className="btn btn-ghost" onClick={handleExportExcel} disabled={loading}><Download size={16} /> Excel</button>
                        <button className="btn btn-primary" onClick={handlePrint} disabled={loading}><Printer size={16} /> Print</button>
                    </div>
                </div>
            </div>

            {loading && <div style={{ padding: 40, textAlign: 'center' }}>Loading Report...</div>}

            {!loading && activeTab === 'monthly' && monthlyData && (
                <div className="report-container printable" style={{ background: 'white', color: 'black', padding: '20px' }}>
                    <div style={{ textAlign: 'center', marginBottom: 10 }} className="print-header">
                        <h3>Monthly Performance Report</h3>
                        <p style={{ marginBottom: 0 }}>From: {year}-{month.toString().padStart(2, '0')}-01 To: {year}-{month.toString().padStart(2, '0')}-{monthlyData.meta.daysInMonth}</p>
                    </div>

                    {monthlyData.data.map((emp, idx) => (
                        <div key={emp.id} className="report-employee-row" style={{ marginBottom: 15, border: '2px solid #000', pageBreakInside: 'avoid' }}>
                            <div style={{ display: 'flex' }}>
                                {/* Left Info Block */}
                                <div style={{ width: 220, borderRight: '2px solid #000', padding: 4, fontSize: 10, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                    <div style={{ fontWeight: 'bold', fontSize: 11 }}>{emp.name}</div>
                                    <div>Code: {emp.code}</div>
                                    <div>Dept: {emp.department}</div>
                                    <div>Desig: {emp.designation}</div>
                                    <div style={{ marginTop: 4, borderTop: '1px solid #000', paddingTop: 2, fontSize: 9 }}>
                                        <div>P: {emp.stats.present}, A: {emp.stats.absent}, WO: {emp.stats.wo}</div>
                                        <div>Total Work: {emp.stats.totalWorkHrs}</div>
                                    </div>
                                </div>

                                {/* Right Grid */}
                                <div style={{ flex: 1, overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 9, textAlign: 'center', tableLayout: 'fixed' }}>
                                        <thead>
                                            <tr style={{ background: '#eee', borderBottom: '1px solid #000', height: 20 }}>
                                                <th style={{ borderRight: '1px solid #ccc', width: 45 }}>Date</th>
                                                {Array.from({ length: monthlyData.meta.daysInMonth }, (_, i) => (
                                                    <th key={i + 1} style={{ borderRight: '1px solid #ccc' }}>{i + 1}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {/* IN, OUT, Shift, Late, Status Rows ... (Same as before) */}
                                            {['IN', 'OUT', 'Shift', 'Late', 'Status'].map((metric, rIdx) => (
                                                <tr key={metric} style={{ height: 18, background: metric === 'Status' ? '#f9f9f9' : 'transparent', borderTop: metric === 'Status' ? '1px solid #ccc' : 'none' }}>
                                                    <td style={{ fontWeight: 'bold', borderRight: '1px solid #ccc', background: '#f0f0f0' }}>{metric}</td>
                                                    {Array.from({ length: monthlyData.meta.daysInMonth }, (_, i) => {
                                                        const d = i + 1;
                                                        let content = '';
                                                        let style = { borderRight: '1px solid #ccc', fontSize: metric === 'Shift' || metric === 'Late' ? 8 : 9, background: emp.days[d]?.shift === 'OFF' ? '#ddd' : '#fff' };

                                                        if (metric === 'IN') content = emp.days[d]?.in || '';
                                                        if (metric === 'OUT') content = emp.days[d]?.out || '';
                                                        if (metric === 'Shift') content = emp.days[d]?.shift || 'GEN';
                                                        if (metric === 'Late') content = (emp.days[d]?.late === '00:00') ? '' : emp.days[d]?.late;
                                                        if (metric === 'Status') {
                                                            content = emp.days[d]?.status;
                                                            if (content === 'A') style.color = 'red';
                                                            if (content === 'P') style.color = 'green';
                                                            if (content === 'WO') style.color = 'blue';
                                                            style.fontWeight = 'bold';
                                                        }
                                                        return <td key={d} style={style}>{content}</td>
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {!loading && activeTab === 'approvals' && approvalData && (
                <div className="report-container printable" style={{ background: 'white', color: 'black', padding: '20px' }}>
                    <div style={{ textAlign: 'center', marginBottom: 20 }} className="print-header">
                        <h3>Day Wise Approval Report</h3>
                        <p>From: {approvalStart} To: {approvalEnd}</p>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                        <thead>
                            <tr style={{ background: '#eee', borderBottom: '2px solid #000' }}>
                                <th style={{ padding: 8, textAlign: 'left', border: '1px solid #ccc' }}>Date</th>
                                <th style={{ padding: 8, textAlign: 'left', border: '1px solid #ccc' }}>Employee</th>
                                <th style={{ padding: 8, textAlign: 'left', border: '1px solid #ccc' }}>Start Time</th>
                                <th style={{ padding: 8, textAlign: 'left', border: '1px solid #ccc' }}>End Time</th>
                                <th style={{ padding: 8, textAlign: 'left', border: '1px solid #ccc', width: 150 }}>Location</th>
                                <th style={{ padding: 8, textAlign: 'left', border: '1px solid #ccc' }}>Status</th>
                                <th style={{ padding: 8, textAlign: 'left', border: '1px solid #ccc' }}>Reviewer</th>
                                <th style={{ padding: 8, textAlign: 'left', border: '1px solid #ccc' }}>Review Date</th>
                                <th style={{ padding: 8, textAlign: 'left', border: '1px solid #ccc' }}>Remarks</th>
                            </tr>
                        </thead>
                        <tbody>
                            {approvalData.map(row => (
                                <tr key={row.id}>
                                    <td style={{ padding: 6, border: '1px solid #ccc' }}>{row.date}</td>
                                    <td style={{ padding: 6, border: '1px solid #ccc' }}>
                                        <div style={{ fontWeight: 'bold' }}>{row.employeeName}</div>
                                        <div style={{ fontSize: 9, color: 'gray' }}>{row.employeeCode} | {row.department}</div>
                                    </td>
                                    <td style={{ padding: 6, border: '1px solid #ccc' }}>{row.inTime}</td>
                                    <td style={{ padding: 6, border: '1px solid #ccc' }}>{row.outTime}</td>
                                    <td style={{ padding: 6, border: '1px solid #ccc', fontSize: 9 }}>
                                        {row.location}
                                        {row.photoUrl && <div style={{ fontSize: 9, color: 'blue' }}>[Has Photo]</div>}
                                    </td>
                                    <td style={{ padding: 6, border: '1px solid #ccc' }}>
                                        <span style={{
                                            fontWeight: 'bold',
                                            color: row.status === 'approved' ? 'green' : row.status === 'rejected' ? 'red' : 'orange'
                                        }}>
                                            {row.status.toUpperCase()}
                                        </span>
                                    </td>
                                    <td style={{ padding: 6, border: '1px solid #ccc' }}>{row.reviewedBy}</td>
                                    <td style={{ padding: 6, border: '1px solid #ccc' }}>{row.reviewedAt}</td>
                                    <td style={{ padding: 6, border: '1px solid #ccc' }}>{row.remarks}</td>
                                </tr>
                            ))}
                            {approvalData.length === 0 && (
                                <tr><td colSpan={9} style={{ padding: 20, textAlign: 'center', color: 'gray' }}>No records found for this period.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            <style>{`
                @media print {
                    @page { size: landscape; margin: 5mm; }
                    
                    /* CRITICAL: Reset main layout scrolling to allow full page printing */
                    html, body, #root, .app-layout, .main-content, .content-area {
                        height: auto !important;
                        min-height: auto !important;
                        overflow: visible !important;
                        overflow-y: visible !important;
                        display: block !important;
                    }

                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white !important; }
                    
                    /* Force ALL text to be black */
                    .printable, .printable * { 
                        color: #000 !important; 
                        background-color: transparent; /* Reset backgrounds */
                    }

                    /* Re-apply specific backgrounds for visual cues */
                    .printable td[style*="#ddd"] { background-color: #ddd !important; }
                    .printable td[style*="#f0f0f0"] { background-color: #f0f0f0 !important; }
                    .printable th[style*="#eee"] { background-color: #eee !important; }

                    .no-print { display: none !important; }
                    
                    .sidebar, .top-bar { display: none !important; }
                    
                    .printable { width: 100%; max-width: 100%; }
                    h3 { margin-top: 0; }
                    
                    /* Sharpen borders */
                    .report-employee-row { border: 1px solid #000 !important; break-inside: avoid; page-break-inside: avoid; }
                    th, td { border-color: #000 !important; }
                }
            `}</style>
        </div>
    );
}

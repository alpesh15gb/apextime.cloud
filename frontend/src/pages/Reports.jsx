import { useState, useEffect } from 'react';
import api from '../lib/api';
import dayjs from 'dayjs';
import { Download, Printer, Calendar } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function Reports() {
    const [month, setMonth] = useState(dayjs().month() + 1);
    const [year, setYear] = useState(dayjs().year());
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    const loadData = () => {
        setLoading(true);
        api.get(`/reports/monthly?month=${month}&year=${year}`)
            .then(res => {
                setData(res.data);
                setLoading(false);
            })
            .catch(err => {
                alert('Failed to load report');
                setLoading(false);
            });
    };

    useEffect(() => { loadData(); }, [month, year]);

    const handleExportExcel = () => {
        if (!data || !data.data) return;

        // Build Array of Arrays for precise layout control
        const aoa = [];

        // Title Row
        aoa.push([`Monthly Performance Report - ${data.meta.monthName} ${data.meta.year}`]);
        aoa.push([]); // Spacer

        // Header Row constructed dynamically
        const headerRow = ['Name', 'Code', 'Dept', 'Metric']; // Left columns
        for (let i = 1; i <= data.meta.daysInMonth; i++) headerRow.push(i); // Date columns
        aoa.push(headerRow);

        data.data.forEach(emp => {
            // Row 1: IN
            const rowIn = [emp.name, emp.code, emp.department, 'IN'];
            for (let i = 1; i <= data.meta.daysInMonth; i++) rowIn.push(emp.days[i]?.in || '');
            aoa.push(rowIn);

            // Row 2: OUT
            const rowOut = ['', '', '', 'OUT'];
            for (let i = 1; i <= data.meta.daysInMonth; i++) rowOut.push(emp.days[i]?.out || '');
            aoa.push(rowOut);

            // Row 3: Shift
            const rowShift = ['', '', '', 'Shift'];
            for (let i = 1; i <= data.meta.daysInMonth; i++) rowShift.push(emp.days[i]?.shift || 'GEN');
            aoa.push(rowShift);

            // Row 4: Late
            const rowLate = ['', '', '', 'Late'];
            for (let i = 1; i <= data.meta.daysInMonth; i++) rowLate.push(emp.days[i]?.late || '');
            aoa.push(rowLate);

            // Row 5: Status
            const rowStatus = ['', '', '', 'Status'];
            for (let i = 1; i <= data.meta.daysInMonth; i++) rowStatus.push(emp.days[i]?.status || '');
            aoa.push(rowStatus);

            // Summary (calculated mostly empty but useful)
            const rowSum = [`Present: ${emp.stats.present}, Absent: ${emp.stats.absent}, Work: ${emp.stats.totalWorkHrs}`, '', '', ''];
            aoa.push(rowSum);
            aoa.push([]); // Spacer
        });

        const ws = XLSX.utils.aoa_to_sheet(aoa);

        // Auto-width (basic)
        ws['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 8 }];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Attendance");
        XLSX.writeFile(wb, `Attendance_Report_${month}_${year}.xlsx`);
    };

    const handlePrint = () => {
        window.print();
    };

    if (loading && !data) return <div style={{ padding: 40, textAlign: 'center' }}>Loading Report...</div>;

    return (
        <div>
            <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ fontSize: 22, fontWeight: 700 }}>Monthly Performance Report</h2>
                <div style={{ display: 'flex', gap: 10 }}>
                    <select value={month} onChange={e => setMonth(e.target.value)} className="form-input" style={{ width: 120 }}>
                        {Array.from({ length: 12 }, (_, i) => (
                            <option key={i + 1} value={i + 1}>{dayjs().month(i).format('MMMM')}</option>
                        ))}
                    </select>
                    <select value={year} onChange={e => setYear(e.target.value)} className="form-input" style={{ width: 100 }}>
                        <option value={2025}>2025</option>
                        <option value={2026}>2026</option>
                    </select>
                    <button className="btn btn-ghost" onClick={handleExportExcel}><Download size={16} /> Excel</button>
                    <button className="btn btn-primary" onClick={handlePrint}><Printer size={16} /> Print</button>
                </div>
            </div>

            {data && (
                <div className="report-container printable" style={{ background: 'white', color: 'black', padding: '20px' }}>
                    <div style={{ textAlign: 'center', marginBottom: 10 }} className="print-header">
                        <h3>Monthly Performance Report</h3>
                        <p style={{ marginBottom: 0 }}>From: {year}-{month.toString().padStart(2, '0')}-01 To: {year}-{month.toString().padStart(2, '0')}-{data.meta.daysInMonth}</p>
                    </div>

                    {data.data.map((emp, idx) => (
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
                                                {Array.from({ length: data.meta.daysInMonth }, (_, i) => (
                                                    <th key={i + 1} style={{ borderRight: '1px solid #ccc' }}>{i + 1}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {/* IN Row */}
                                            <tr style={{ height: 18 }}>
                                                <td style={{ fontWeight: 'bold', borderRight: '1px solid #ccc', background: '#f0f0f0' }}>IN</td>
                                                {Array.from({ length: data.meta.daysInMonth }, (_, i) => (
                                                    <td key={i + 1} style={{ borderRight: '1px solid #ccc', background: emp.days[i + 1]?.shift === 'OFF' ? '#ddd' : '#fff' }}>
                                                        {emp.days[i + 1]?.in || ''}
                                                    </td>
                                                ))}
                                            </tr>
                                            {/* OUT Row */}
                                            <tr style={{ height: 18 }}>
                                                <td style={{ fontWeight: 'bold', borderRight: '1px solid #ccc', background: '#f0f0f0' }}>OUT</td>
                                                {Array.from({ length: data.meta.daysInMonth }, (_, i) => (
                                                    <td key={i + 1} style={{ borderRight: '1px solid #ccc', background: emp.days[i + 1]?.shift === 'OFF' ? '#ddd' : '#fff' }}>
                                                        {emp.days[i + 1]?.out || ''}
                                                    </td>
                                                ))}
                                            </tr>
                                            {/* Shift Row (New) */}
                                            <tr style={{ height: 18 }}>
                                                <td style={{ fontWeight: 'bold', borderRight: '1px solid #ccc', background: '#f0f0f0' }}>Shift</td>
                                                {Array.from({ length: data.meta.daysInMonth }, (_, i) => (
                                                    <td key={i + 1} style={{ borderRight: '1px solid #ccc', fontSize: 8, background: emp.days[i + 1]?.shift === 'OFF' ? '#ddd' : '#fff' }}>
                                                        {emp.days[i + 1]?.shift || 'GEN'}
                                                    </td>
                                                ))}
                                            </tr>
                                            {/* Late Row (New) */}
                                            <tr style={{ height: 18 }}>
                                                <td style={{ fontWeight: 'bold', borderRight: '1px solid #ccc', background: '#f0f0f0' }}>Late</td>
                                                {Array.from({ length: data.meta.daysInMonth }, (_, i) => (
                                                    <td key={i + 1} style={{ borderRight: '1px solid #ccc', fontSize: 8, background: emp.days[i + 1]?.shift === 'OFF' ? '#ddd' : '#fff' }}>
                                                        {emp.days[i + 1]?.late === '00:00' ? '' : emp.days[i + 1]?.late}
                                                    </td>
                                                ))}
                                            </tr>
                                            {/* Status Row */}
                                            <tr style={{ background: '#f9f9f9', height: 18, borderTop: '1px solid #ccc' }}>
                                                <td style={{ fontWeight: 'bold', borderRight: '1px solid #ccc' }}>Status</td>
                                                {Array.from({ length: data.meta.daysInMonth }, (_, i) => {
                                                    const stat = emp.days[i + 1]?.status;
                                                    let color = '#000';
                                                    if (stat === 'A') color = 'red';
                                                    if (stat === 'P') color = 'green';
                                                    if (stat === 'WO') color = 'blue';
                                                    return (
                                                        <td key={i + 1} style={{ borderRight: '1px solid #ccc', color, fontWeight: 'bold', background: emp.days[i + 1]?.shift === 'OFF' ? '#ddd' : '#fff' }}>
                                                            {stat}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    ))}
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

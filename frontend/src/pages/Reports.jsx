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

        // Flatten data for Excel
        const rows = [];
        data.data.forEach(emp => {
            const row = {
                'Employee Code': emp.code,
                'Name': emp.name,
                'Designation': emp.designation,
                'Department': emp.department,
                'Working Hours': emp.stats.totalWorkHrs,
                'Present': emp.stats.present,
                'Absent': emp.stats.absent,
            };
            // Add daily columns
            for (let d = 1; d <= data.meta.daysInMonth; d++) {
                const day = emp.days[d];
                row[`${d}-In`] = day?.in || '';
                row[`${d}-Out`] = day?.out || '';
                row[`${d}-Status`] = day?.status || '';
            }
            rows.push(row);
        });

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Monthly Report");
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
                <div className="report-container printable">
                    <div style={{ textAlign: 'center', marginBottom: 20 }}>
                        <h3>Monthly Performance Report</h3>
                        <p>From: {year}-{month.toString().padStart(2, '0')}-01 To: {year}-{month.toString().padStart(2, '0')}-{data.meta.daysInMonth}</p>
                    </div>

                    {data.data.map(emp => (
                        <div key={emp.id} className="report-employee-row" style={{ marginBottom: 20, border: '1px solid #000', pageBreakInside: 'avoid' }}>
                            <div style={{ display: 'flex' }}>
                                {/* Left Info Block */}
                                <div style={{ width: 250, borderRight: '1px solid #000', padding: 5, fontSize: 11 }}>
                                    <div><strong>Name:</strong> {emp.name}</div>
                                    <div><strong>Code:</strong> {emp.code}</div>
                                    <div><strong>Dept:</strong> {emp.department}</div>
                                    <div style={{ marginTop: 5, borderTop: '1px solid #ddd', paddingTop: 5 }}>
                                        <div>Present: {emp.stats.present}, Absent: {emp.stats.absent}</div>
                                        <div>Total Work: {emp.stats.totalWorkHrs}</div>
                                    </div>
                                </div>

                                {/* Right Grid */}
                                <div style={{ flex: 1, overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, textAlign: 'center' }}>
                                        <thead>
                                            <tr style={{ background: '#eee', borderBottom: '1px solid #000' }}>
                                                <th style={{ borderRight: '1px solid #ccc', width: 40 }}>Date</th>
                                                {Array.from({ length: data.meta.daysInMonth }, (_, i) => (
                                                    <th key={i + 1} style={{ borderRight: '1px solid #ccc', minWidth: 25 }}>{i + 1}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {/* IN Row */}
                                            <tr>
                                                <td style={{ fontWeight: 'bold', borderRight: '1px solid #ccc' }}>IN</td>
                                                {Array.from({ length: data.meta.daysInMonth }, (_, i) => (
                                                    <td key={i + 1} style={{ borderRight: '1px solid #ccc', background: emp.days[i + 1]?.shift === 'OFF' ? '#ddd' : '#fff' }}>
                                                        {emp.days[i + 1]?.in || '-'}
                                                    </td>
                                                ))}
                                            </tr>
                                            {/* OUT Row */}
                                            <tr>
                                                <td style={{ fontWeight: 'bold', borderRight: '1px solid #ccc' }}>OUT</td>
                                                {Array.from({ length: data.meta.daysInMonth }, (_, i) => (
                                                    <td key={i + 1} style={{ borderRight: '1px solid #ccc', background: emp.days[i + 1]?.shift === 'OFF' ? '#ddd' : '#fff' }}>
                                                        {emp.days[i + 1]?.out || '-'}
                                                    </td>
                                                ))}
                                            </tr>
                                            {/* Status Row */}
                                            <tr style={{ background: '#f9f9f9' }}>
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
                    .no-print { display: none !important; }
                    .printable { width: 100%; }
                    body { font-size: 10pt; }
                    @page { size: landscape; margin: 10mm; }
                }
            `}</style>
        </div>
    );
}

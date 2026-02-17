import { useState, useEffect } from 'react';
import api from '../lib/api';
import dayjs from 'dayjs';
import { CheckCircle2, XCircle } from 'lucide-react';

export default function LeaveRequests() {
    const [requests, setRequests] = useState([]);
    const [filter, setFilter] = useState('pending');

    const loadData = () => {
        api.get('/leave/requests', { params: { status: filter, limit: 100 } }).then(r => setRequests(r.data.data || []));
    };
    useEffect(() => { loadData(); }, [filter]);

    const handleApprove = async (uuid) => {
        try { await api.post(`/leave/${uuid}/approve`); loadData(); } catch (err) { alert('Failed'); }
    };

    const handleReject = async (uuid) => {
        const reason = prompt('Rejection reason:');
        if (reason === null) return;
        try { await api.post(`/leave/${uuid}/reject`, { remarks: reason }); loadData(); } catch (err) { alert('Failed'); }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '22px', fontWeight: 700 }}>Leave Requests</h2>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {['pending', 'approved', 'rejected'].map(s => (
                        <button key={s} className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter(s)}>
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                        </button>
                    ))}
                </div>
            </div>

            <div className="card">
                <table className="data-table">
                    <thead><tr><th>Employee</th><th>Leave Type</th><th>From</th><th>To</th><th>Days</th><th>Reason</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                        {requests.map(r => (
                            <tr key={r.uuid}>
                                <td><strong>{r.employeeName}</strong><br /><span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{r.employeeCode}</span></td>
                                <td><span className="badge badge-info">{r.leaveType}</span></td>
                                <td>{dayjs(r.startDate).format('DD MMM')}</td>
                                <td>{dayjs(r.endDate).format('DD MMM')}</td>
                                <td>{r.days}</td>
                                <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.reason || '-'}</td>
                                <td><span className={`badge badge-${r.status === 'approved' ? 'success' : r.status === 'rejected' ? 'danger' : 'warning'}`}>{r.status}</span></td>
                                <td style={{ display: 'flex', gap: '6px' }}>
                                    {r.status === 'pending' && (
                                        <>
                                            <button className="btn btn-success btn-sm" onClick={() => handleApprove(r.uuid)}><CheckCircle2 size={14} /></button>
                                            <button className="btn btn-danger btn-sm" onClick={() => handleReject(r.uuid)}><XCircle size={14} /></button>
                                        </>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {requests.length === 0 && <tr><td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No {filter} requests</td></tr>}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

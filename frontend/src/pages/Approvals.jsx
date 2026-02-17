import { useState, useEffect } from 'react';
import api from '../lib/api';
import dayjs from 'dayjs';
import { CheckCircle2, XCircle, MapPin, Camera } from 'lucide-react';

export default function Approvals() {
    const [pending, setPending] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadData = () => {
        api.get('/attendance/pending').then(r => { setPending(r.data); setLoading(false); }).catch(() => setLoading(false));
    };
    useEffect(() => { loadData(); }, []);

    const handleApprove = async (uuid) => {
        try { await api.post(`/attendance/${uuid}/approve`); loadData(); } catch (err) { alert('Failed'); }
    };

    const handleReject = async (uuid) => {
        const reason = prompt('Rejection reason:');
        if (reason === null) return;
        try { await api.post(`/attendance/${uuid}/reject`, { remarks: reason }); loadData(); } catch (err) { alert('Failed'); }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '22px', fontWeight: 700 }}>Pending Approvals</h2>
                <span className="badge badge-warning">{pending.length} pending</span>
            </div>

            {pending.length === 0 && !loading && (
                <div className="empty-state"><CheckCircle2 /><h3>All clear!</h3><p>No pending attendance approvals</p></div>
            )}

            {pending.map(t => (
                <div className="approval-card" key={t.uuid}>
                    <div className="approval-header">
                        <div className="approval-avatar">{t.employeeName?.[0]}</div>
                        <div className="approval-info">
                            <h4>{t.employeeName}</h4>
                            <p>{t.employeeCode} • {t.department}</p>
                        </div>
                        <span className="badge badge-purple" style={{ marginLeft: 'auto' }}>{t.source}</span>
                    </div>

                    <div className="approval-details">
                        <div className="approval-detail">
                            <strong>Date:</strong> {dayjs(t.date).format('DD MMM YYYY')}
                        </div>
                        <div className="approval-detail">
                            <strong>Clock In:</strong> {t.inAt ? dayjs(t.inAt).format('hh:mm A') : '-'}
                        </div>
                        <div className="approval-detail">
                            <strong>Clock Out:</strong> {t.outAt ? dayjs(t.outAt).format('hh:mm A') : 'Active'}
                        </div>
                        <div className="approval-detail">
                            <strong>Submitted:</strong> {dayjs(t.createdAt).format('hh:mm A')}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
                        {t.photoUrl && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <Camera size={14} style={{ color: 'var(--text-muted)' }} />
                                <img src={t.photoUrl} alt="Selfie" className="approval-photo" />
                            </div>
                        )}
                        {t.latitude && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                <MapPin size={14} />
                                <a href={`https://maps.google.com/?q=${t.latitude},${t.longitude}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--info)' }}>
                                    View Location
                                </a>
                            </div>
                        )}
                    </div>

                    <div className="approval-actions">
                        <button className="btn btn-success btn-sm" onClick={() => handleApprove(t.uuid)}>
                            <CheckCircle2 size={14} /> Approve
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleReject(t.uuid)}>
                            <XCircle size={14} /> Reject
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
}

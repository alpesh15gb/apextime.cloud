import { useState, useEffect } from 'react';
import api from '../lib/api';
import dayjs from 'dayjs';
import { CheckCircle2, XCircle, MapPin, Camera } from 'lucide-react';

const LocationAddress = ({ lat, lng }) => {
    const [addr, setAddr] = useState('Locating...');
    useEffect(() => {
        if (!lat || !lng) return;
        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
            .then(res => res.json())
            .then(d => {
                const parts = (d.display_name || '').split(',');
                setAddr(parts.slice(0, 2).join(', '));
            })
            .catch(() => setAddr('Unknown Location'));
    }, [lat, lng]);
    return <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', marginTop: 4 }}><MapPin size={10} style={{ marginRight: 4 }} /> {addr}</div>;
};

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

                    {/* Evidence Section */}
                    {t.source === 'mobile' && (
                        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border-light)' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                {/* IN Evidence */}
                                <div>
                                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>PUNCH IN</div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        {t.photoUrl ? (
                                            <a href={t.photoUrl.startsWith('/') ? `/api${t.photoUrl}` : t.photoUrl} target="_blank" rel="noopener noreferrer">
                                                <img src={t.photoUrl.startsWith('/') ? `/api${t.photoUrl}` : t.photoUrl} alt="In Selfie" className="approval-photo" style={{ width: 80, height: 80, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border)' }} />
                                            </a>
                                        ) : <span style={{ fontSize: '11px', color: 'var(--danger)' }}>No Photo</span>}

                                        {t.latitude && <LocationAddress lat={t.latitude} lng={t.longitude} />}
                                    </div>
                                </div>

                                {/* OUT Evidence */}
                                {t.outAt && (
                                    <div>
                                        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>PUNCH OUT</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            {t.outPhotoUrl ? (
                                                <a href={t.outPhotoUrl.startsWith('/') ? `/api${t.outPhotoUrl}` : t.outPhotoUrl} target="_blank" rel="noopener noreferrer">
                                                    <img src={t.outPhotoUrl.startsWith('/') ? `/api${t.outPhotoUrl}` : t.outPhotoUrl} alt="Out Selfie" className="approval-photo" style={{ width: 80, height: 80, borderRadius: 8, objectFit: 'cover', border: '1px solid var(--border)' }} />
                                                </a>
                                            ) : <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>-</span>}

                                            {t.outLatitude && <LocationAddress lat={t.outLatitude} lng={t.outLongitude} />}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

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

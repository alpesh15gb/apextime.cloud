import { useState, useEffect } from 'react';
import api from '../lib/api';
import dayjs from 'dayjs';
import { Plus, HardDrive, RefreshCw, Wifi, WifiOff } from 'lucide-react';

export default function Devices() {
    const [devices, setDevices] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({ name: '', serialNumber: '', ipAddress: '', type: 'biometric' });

    const loadData = () => api.get('/devices').then(r => setDevices(r.data));
    useEffect(() => { loadData(); }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try { await api.post('/devices', form); setShowModal(false); setForm({ name: '', serialNumber: '', ipAddress: '', type: 'biometric' }); loadData(); }
        catch (err) { alert(err.response?.data?.message || 'Failed'); }
    };

    const regenerateToken = async (uuid) => {
        try {
            const res = await api.post(`/devices/${uuid}/regenerate-token`);
            alert(`New token: ${res.data.token}`);
        } catch (err) { alert('Failed'); }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '22px', fontWeight: 700 }}>Devices</h2>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> Add Device</button>
            </div>

            <div className="card">
                <table className="data-table">
                    <thead><tr><th>Name</th><th>Serial</th><th>IP</th><th>Status</th><th>Last Seen</th><th>Logs</th><th>Actions</th></tr></thead>
                    <tbody>
                        {devices.map(d => (
                            <tr key={d.uuid}>
                                <td><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><HardDrive size={16} style={{ color: 'var(--primary)' }} /><strong>{d.name}</strong></div></td>
                                <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{d.serialNumber || '-'}</td>
                                <td>{d.ipAddress || '-'}</td>
                                <td>{d.status === 'active' ? <span className="badge badge-success"><Wifi size={10} /> Active</span> : <span className="badge badge-danger"><WifiOff size={10} /> Offline</span>}</td>
                                <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{d.lastSeenAt ? dayjs(d.lastSeenAt).format('DD MMM hh:mm A') : 'Never'}</td>
                                <td>{d._count?.logs || 0}</td>
                                <td><button className="btn btn-ghost btn-sm" onClick={() => regenerateToken(d.uuid)}><RefreshCw size={14} /> Token</button></td>
                            </tr>
                        ))}
                        {devices.length === 0 && <tr><td colSpan="7" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No devices registered</td></tr>}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Add Device</h3>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group"><label className="form-label">Name *</label><input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
                                <div className="form-row">
                                    <div className="form-group"><label className="form-label">Serial Number</label><input className="form-input" value={form.serialNumber} onChange={e => setForm({ ...form, serialNumber: e.target.value })} placeholder="From ESSL device sticker" /></div>
                                    <div className="form-group"><label className="form-label">IP Address</label><input className="form-input" value={form.ipAddress} onChange={e => setForm({ ...form, ipAddress: e.target.value })} placeholder="e.g. 192.168.1.100" /></div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Register Device</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

import { useState, useEffect } from 'react';
import api from '../lib/api';
import dayjs from 'dayjs';
import { Plus, Send, Edit } from 'lucide-react';

export default function Announcements() {
    const [announcements, setAnnouncements] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({ title: '', body: '', audienceType: 'all', priority: 'normal' });

    const loadData = () => api.get('/announcements').then(r => setAnnouncements(r.data.data || []));
    useEffect(() => { loadData(); }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try { await api.post('/announcements', form); setShowModal(false); setForm({ title: '', body: '', audienceType: 'all', priority: 'normal' }); loadData(); }
        catch (err) { alert('Failed'); }
    };

    const handlePublish = async (uuid) => {
        try { await api.post(`/announcements/${uuid}/publish`); loadData(); } catch (err) { alert('Failed'); }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '22px', fontWeight: 700 }}>Announcements</h2>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> New</button>
            </div>

            {announcements.map(a => (
                <div key={a.id} className="card" style={{ marginBottom: '12px' }}>
                    <div className="card-body">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                                <h4 style={{ fontSize: '15px', fontWeight: 600 }}>{a.title}</h4>
                                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>{a.body}</p>
                                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                    <span className={`badge badge-${a.status === 'published' ? 'success' : 'warning'}`}>{a.status}</span>
                                    <span className="badge badge-info">{a.audienceType}</span>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                        {a.publishedAt ? dayjs(a.publishedAt).format('DD MMM YYYY') : 'Draft'}
                                    </span>
                                </div>
                            </div>
                            {a.status !== 'published' && (
                                <button className="btn btn-success btn-sm" onClick={() => handlePublish(a.uuid)}><Send size={14} /> Publish</button>
                            )}
                        </div>
                    </div>
                </div>
            ))}
            {announcements.length === 0 && <div className="empty-state"><p>No announcements</p></div>}

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">New Announcement</h3>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group"><label className="form-label">Title *</label><input className="form-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required /></div>
                                <div className="form-group"><label className="form-label">Body *</label><textarea className="form-textarea" rows={4} value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} required /></div>
                                <div className="form-row">
                                    <div className="form-group"><label className="form-label">Audience</label>
                                        <select className="form-select" value={form.audienceType} onChange={e => setForm({ ...form, audienceType: e.target.value })}>
                                            <option value="all">Everyone</option><option value="employees">Employees Only</option><option value="students">Students Only</option>
                                        </select></div>
                                    <div className="form-group"><label className="form-label">Priority</label>
                                        <select className="form-select" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>
                                            <option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option>
                                        </select></div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Create Draft</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

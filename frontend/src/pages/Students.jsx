import { useState, useEffect } from 'react';
import api from '../lib/api';
import { Plus, Search, Edit, Trash2 } from 'lucide-react';

export default function Students() {
    const [students, setStudents] = useState([]);
    const [batches, setBatches] = useState([]);
    const [search, setSearch] = useState('');
    const [batchFilter, setBatchFilter] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [form, setForm] = useState({ admissionNo: '', firstName: '', lastName: '', email: '', phone: '', gender: 'male', batchId: '' });

    const loadData = () => {
        const params = { search, limit: 100 };
        if (batchFilter) params.batchId = batchFilter;
        api.get('/students', { params }).then(r => setStudents(r.data.data || []));
        api.get('/academic/batches').then(r => setBatches(r.data));
    };
    useEffect(() => { loadData(); }, [search, batchFilter]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editItem) await api.put(`/students/${editItem.uuid}`, form);
            else await api.post('/students', form);
            setShowModal(false); setEditItem(null); loadData();
        } catch (err) { alert(err.response?.data?.error || 'Failed'); }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '22px', fontWeight: 700 }}>Students</h2>
                <button className="btn btn-primary" onClick={() => { setEditItem(null); setForm({ admissionNo: '', firstName: '', lastName: '', email: '', phone: '', gender: 'male', batchId: '' }); setShowModal(true); }}>
                    <Plus size={16} /> Add Student
                </button>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <div style={{ position: 'relative', flex: 1, maxWidth: '300px' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input className="form-input" style={{ paddingLeft: '36px' }} placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select className="form-select" style={{ width: '200px' }} value={batchFilter} onChange={e => setBatchFilter(e.target.value)}>
                    <option value="">All Batches</option>
                    {batches.map(b => <option key={b.id} value={b.id}>{b.division?.program?.name} - {b.division?.name} - {b.name}</option>)}
                </select>
            </div>

            <div className="card">
                <table className="data-table">
                    <thead><tr><th>Adm No</th><th>Name</th><th>Batch</th><th>Phone</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                        {students.map(s => (
                            <tr key={s.uuid}>
                                <td><strong>{s.admissionNo}</strong></td>
                                <td>{s.name}</td>
                                <td>{s.batch || '-'}</td>
                                <td>{s.phone || '-'}</td>
                                <td><span className={`badge badge-${s.status === 'active' ? 'success' : 'danger'}`}>{s.status}</span></td>
                                <td style={{ display: 'flex', gap: '6px' }}>
                                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditItem(s); setForm({ admissionNo: s.admissionNo, firstName: s.name?.split(' ')[0], lastName: s.name?.split(' ').slice(1).join(' '), email: s.email, phone: s.phone, gender: s.gender, batchId: s.batchId || '' }); setShowModal(true); }}><Edit size={14} /></button>
                                </td>
                            </tr>
                        ))}
                        {students.length === 0 && <tr><td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No students found</td></tr>}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">{editItem ? 'Edit' : 'Add'} Student</h3>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-row">
                                    <div className="form-group"><label className="form-label">Admission No *</label><input className="form-input" value={form.admissionNo} onChange={e => setForm({ ...form, admissionNo: e.target.value })} required /></div>
                                    <div className="form-group"><label className="form-label">Batch</label>
                                        <select className="form-select" value={form.batchId} onChange={e => setForm({ ...form, batchId: e.target.value ? parseInt(e.target.value) : '' })}>
                                            <option value="">Select</option>{batches.map(b => <option key={b.id} value={b.id}>{b.division?.program?.name} - {b.division?.name} - {b.name}</option>)}
                                        </select></div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group"><label className="form-label">First Name *</label><input className="form-input" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} required /></div>
                                    <div className="form-group"><label className="form-label">Last Name</label><input className="form-input" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} /></div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
                                    <div className="form-group"><label className="form-label">Email</label><input className="form-input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{editItem ? 'Update' : 'Create'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

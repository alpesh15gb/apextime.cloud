import { useState, useEffect } from 'react';
import api from '../lib/api';
import { Plus, Edit, Trash2 } from 'lucide-react';

export default function Departments() {
    const [departments, setDepartments] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [form, setForm] = useState({ name: '', description: '' });

    const loadData = () => api.get('/departments').then(r => setDepartments(r.data));
    useEffect(() => { loadData(); }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editItem) await api.put(`/departments/${editItem.uuid}`, form);
            else await api.post('/departments', form);
            setShowModal(false); setEditItem(null); setForm({ name: '', description: '' }); loadData();
        } catch (err) { alert(err.response?.data?.message || 'Failed'); }
    };

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '22px', fontWeight: 700 }}>Departments</h2>
                <button className="btn btn-primary" onClick={() => { setEditItem(null); setForm({ name: '', description: '' }); setShowModal(true); }}><Plus size={16} /> Add</button>
            </div>

            <div className="card">
                <table className="data-table">
                    <thead><tr><th>Name</th><th>Employees</th><th>Actions</th></tr></thead>
                    <tbody>
                        {departments.map(d => (
                            <tr key={d.uuid}>
                                <td><strong>{d.name}</strong></td>
                                <td>{d._count?.employees || 0}</td>
                                <td style={{ display: 'flex', gap: '6px' }}>
                                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditItem(d); setForm({ name: d.name, description: d.description || '' }); setShowModal(true); }}><Edit size={14} /></button>
                                    <button className="btn btn-ghost btn-sm" onClick={async () => { if (confirm('Delete?')) { await api.delete(`/departments/${d.uuid}`); loadData(); } }}><Trash2 size={14} /></button>
                                </td>
                            </tr>
                        ))}
                        {departments.length === 0 && <tr><td colSpan="3" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No departments</td></tr>}
                    </tbody>
                </table>
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">{editItem ? 'Edit' : 'Add'} Department</h3>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group"><label className="form-label">Name *</label><input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
                                <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
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

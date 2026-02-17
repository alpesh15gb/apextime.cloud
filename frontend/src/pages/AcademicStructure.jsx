import { useState, useEffect } from 'react';
import api from '../lib/api';
import { Plus, Edit, Trash2 } from 'lucide-react';

export default function AcademicStructure() {
    const [sessions, setSessions] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [divisions, setDivisions] = useState([]);
    const [batches, setBatches] = useState([]);
    const [tab, setTab] = useState('sessions');
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({});
    const [editItem, setEditItem] = useState(null);

    const loadAll = () => {
        api.get('/academic/sessions').then(r => setSessions(r.data)).catch(() => { });
        api.get('/academic/programs').then(r => setPrograms(r.data)).catch(() => { });
        api.get('/academic/divisions').then(r => setDivisions(r.data)).catch(() => { });
        api.get('/academic/batches').then(r => setBatches(r.data)).catch(() => { });
    };
    useEffect(() => { loadAll(); }, []);

    const handleAdd = (type) => {
        setEditItem(null);
        if (type === 'sessions') setForm({ name: '', shortName: '', startDate: '', endDate: '', isActive: false });
        else if (type === 'programs') setForm({ name: '', shortName: '' });
        else if (type === 'divisions') setForm({ name: '', shortName: '', programId: '' });
        else setForm({ name: '', divisionId: '', maxStrength: 50 });
        setShowModal(type);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const endpoint = `/academic/${showModal}`;
        try {
            if (editItem) await api.put(`${endpoint}/${editItem.uuid}`, form);
            else await api.post(endpoint, form);
            setShowModal(false); loadAll();
        } catch (err) { alert(err.response?.data?.message || 'Failed'); }
    };

    const tabs = [
        { key: 'sessions', label: 'Sessions' },
        { key: 'programs', label: 'Programs' },
        { key: 'divisions', label: 'Divisions' },
        { key: 'batches', label: 'Batches' },
    ];

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '22px', fontWeight: 700 }}>Academic Structure</h2>
                <button className="btn btn-primary" onClick={() => handleAdd(tab)}><Plus size={16} /> Add {tab.slice(0, -1)}</button>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                {tabs.map(t => (
                    <button key={t.key} className={`btn btn-sm ${tab === t.key ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setTab(t.key)}>{t.label}</button>
                ))}
            </div>

            <div className="card">
                <table className="data-table">
                    {tab === 'sessions' && (
                        <>
                            <thead><tr><th>Name</th><th>Start</th><th>End</th><th>Active</th><th>Actions</th></tr></thead>
                            <tbody>{sessions.map(s => (
                                <tr key={s.uuid}><td><strong>{s.name}</strong></td><td>{s.startDate?.split('T')[0]}</td><td>{s.endDate?.split('T')[0]}</td>
                                    <td>{s.isActive ? <span className="badge badge-success">Active</span> : '-'}</td>
                                    <td style={{ display: 'flex', gap: '6px' }}>
                                        <button className="btn btn-ghost btn-sm" onClick={() => { setEditItem(s); setForm({ name: s.name, shortName: s.shortName, startDate: s.startDate?.split('T')[0], endDate: s.endDate?.split('T')[0], isActive: s.isActive }); setShowModal('sessions'); }}><Edit size={14} /></button>
                                    </td></tr>
                            ))}{sessions.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No sessions</td></tr>}</tbody>
                        </>
                    )}
                    {tab === 'programs' && (
                        <>
                            <thead><tr><th>Name</th><th>Divisions</th><th>Actions</th></tr></thead>
                            <tbody>{programs.map(p => (
                                <tr key={p.uuid}><td><strong>{p.name}</strong></td><td>{p._count?.divisions || 0}</td>
                                    <td style={{ display: 'flex', gap: '6px' }}>
                                        <button className="btn btn-ghost btn-sm" onClick={() => { setEditItem(p); setForm({ name: p.name, shortName: p.shortName }); setShowModal('programs'); }}><Edit size={14} /></button>
                                        <button className="btn btn-ghost btn-sm" onClick={async () => { if (confirm('Delete?')) { await api.delete(`/academic/programs/${p.uuid}`); loadAll(); } }}><Trash2 size={14} /></button>
                                    </td></tr>
                            ))}{programs.length === 0 && <tr><td colSpan="3" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No programs</td></tr>}</tbody>
                        </>
                    )}
                    {tab === 'divisions' && (
                        <>
                            <thead><tr><th>Name</th><th>Program</th><th>Batches</th><th>Actions</th></tr></thead>
                            <tbody>{divisions.map(d => (
                                <tr key={d.uuid}><td><strong>{d.name}</strong></td><td>{d.program?.name}</td><td>{d._count?.batches || 0}</td>
                                    <td style={{ display: 'flex', gap: '6px' }}>
                                        <button className="btn btn-ghost btn-sm" onClick={() => { setEditItem(d); setForm({ name: d.name, shortName: d.shortName, programId: d.programId }); setShowModal('divisions'); }}><Edit size={14} /></button>
                                        <button className="btn btn-ghost btn-sm" onClick={async () => { if (confirm('Delete?')) { await api.delete(`/academic/divisions/${d.uuid}`); loadAll(); } }}><Trash2 size={14} /></button>
                                    </td></tr>
                            ))}{divisions.length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No divisions</td></tr>}</tbody>
                        </>
                    )}
                    {tab === 'batches' && (
                        <>
                            <thead><tr><th>Name</th><th>Division</th><th>Program</th><th>Students</th><th>Actions</th></tr></thead>
                            <tbody>{batches.map(b => (
                                <tr key={b.uuid}><td><strong>{b.name}</strong></td><td>{b.division?.name}</td><td>{b.division?.program?.name}</td><td>{b._count?.students || 0}</td>
                                    <td style={{ display: 'flex', gap: '6px' }}>
                                        <button className="btn btn-ghost btn-sm" onClick={() => { setEditItem(b); setForm({ name: b.name, divisionId: b.divisionId, maxStrength: b.maxStrength }); setShowModal('batches'); }}><Edit size={14} /></button>
                                        <button className="btn btn-ghost btn-sm" onClick={async () => { if (confirm('Delete?')) { await api.delete(`/academic/batches/${b.uuid}`); loadAll(); } }}><Trash2 size={14} /></button>
                                    </td></tr>
                            ))}{batches.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No batches</td></tr>}</tbody>
                        </>
                    )}
                </table>
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">{editItem ? 'Edit' : 'Add'}</h3>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group"><label className="form-label">Name *</label><input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
                                {(showModal === 'sessions' || showModal === 'programs') && (
                                    <div className="form-group"><label className="form-label">Short Name</label><input className="form-input" value={form.shortName || ''} onChange={e => setForm({ ...form, shortName: e.target.value })} /></div>
                                )}
                                {showModal === 'sessions' && (
                                    <div className="form-row">
                                        <div className="form-group"><label className="form-label">Start Date</label><input className="form-input" type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /></div>
                                        <div className="form-group"><label className="form-label">End Date</label><input className="form-input" type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} /></div>
                                    </div>
                                )}
                                {showModal === 'divisions' && (
                                    <div className="form-group"><label className="form-label">Program *</label>
                                        <select className="form-select" value={form.programId} onChange={e => setForm({ ...form, programId: parseInt(e.target.value) })} required>
                                            <option value="">Select</option>{programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select></div>
                                )}
                                {showModal === 'batches' && (
                                    <>
                                        <div className="form-group"><label className="form-label">Division *</label>
                                            <select className="form-select" value={form.divisionId} onChange={e => setForm({ ...form, divisionId: parseInt(e.target.value) })} required>
                                                <option value="">Select</option>{divisions.map(d => <option key={d.id} value={d.id}>{d.name} ({d.program?.name})</option>)}
                                            </select></div>
                                        <div className="form-group"><label className="form-label">Max Strength</label><input className="form-input" type="number" value={form.maxStrength} onChange={e => setForm({ ...form, maxStrength: parseInt(e.target.value) })} /></div>
                                    </>
                                )}
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

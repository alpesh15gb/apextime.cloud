import { useState, useEffect } from 'react';
import api from '../lib/api';
import { Plus, Building, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Tenants() {
    const { user } = useAuth();
    const [tenants, setTenants] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({ name: '', slug: '', domain: '', adminUsername: 'admin', adminPassword: '' });

    const loadData = () => api.get('/tenants').then(r => setTenants(r.data));

    useEffect(() => {
        if (user?.role === 'super_admin') loadData();
    }, [user]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('/tenants', form);
            setShowModal(false);
            setForm({ name: '', slug: '', domain: '', adminUsername: 'admin', adminPassword: '' });
            loadData();
            alert('Tenant created successfully!');
        }
        catch (err) { alert(err.response?.data?.error || 'Failed to create tenant'); }
    };

    const [showUsersModal, setShowUsersModal] = useState(false);
    const [selectedTenant, setSelectedTenant] = useState(null);
    const [tenantUsers, setTenantUsers] = useState([]);
    const [resetPassword, setResetPassword] = useState('');

    const loadUsers = async (tenant) => {
        setSelectedTenant(tenant);
        try {
            const res = await api.get(`/tenants/${tenant.uuid}/users`);
            setTenantUsers(res.data);
            setShowUsersModal(true);
        } catch (err) { alert('Failed to load users'); }
    };

    const handlePasswordReset = async (username) => {
        const newPass = prompt(`Enter new password for ${username}:`);
        if (!newPass) return;
        try {
            await api.post(`/tenants/${selectedTenant.uuid}/reset-password`, { username, newPassword: newPass });
            alert('Password updated successfully');
        } catch (err) { alert(err.response?.data?.error || 'Failed to reset password'); }
    };

    if (user?.role !== 'super_admin') return <div style={{ padding: '40px', textAlign: 'center' }}>Access Denied</div>;

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '22px', fontWeight: 700 }}>Organizations</h2>
                <button className="btn btn-primary" onClick={() => { setForm({ name: '', slug: '', domain: '', adminUsername: 'admin', adminPassword: '' }); setShowModal(true); }}><Plus size={16} /> New Organization</button>
            </div>

            <div className="card">
                <table className="data-table">
                    <thead><tr><th>Name</th><th>Slug / ID</th><th>Domain</th><th>Status</th><th>Stats</th><th>Actions</th></tr></thead>
                    <tbody>
                        {tenants.map(t => (
                            <tr key={t.id}>
                                <td><div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><Building size={16} /><strong>{t.name}</strong></div></td>
                                <td><span className="badge">{t.slug}</span></td>
                                <td>{t.domain || '-'}</td>
                                <td><span className={`badge badge-${t.status === 'active' ? 'success' : 'danger'}`}>{t.status}</span></td>
                                <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                    {t._count?.users || 0} users, {t._count?.employees || 0} employees
                                </td>
                                <td>
                                    <button className="btn btn-ghost btn-sm" onClick={() => loadUsers(t)}><Users size={14} /> Users</button>
                                </td>
                            </tr>
                        ))}
                        {tenants.length === 0 && <tr><td colSpan="6" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No organizations found</td></tr>}
                    </tbody>
                </table>
            </div>

            {/* Create Tenant Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Create Organization</h3>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
                                <div className="form-group"><label className="form-label">Organization Name *</label><input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
                                <div className="form-group"><label className="form-label">Slug (ID) *</label><input className="form-input" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })} required placeholder="e.g. school-name" /></div>
                                <div className="form-group"><label className="form-label">Custom Domain</label><input className="form-input" value={form.domain} onChange={e => setForm({ ...form, domain: e.target.value })} placeholder="e.g. school.com" /></div>
                                <hr style={{ margin: '20px 0', border: '0', borderTop: '1px solid var(--border)' }} />
                                <h4 style={{ fontSize: '14px', marginBottom: '10px' }}>Initial Admin User</h4>
                                <div className="form-row">
                                    <div className="form-group"><label className="form-label">Username</label><input className="form-input" value={form.adminUsername} onChange={e => setForm({ ...form, adminUsername: e.target.value })} required /></div>
                                    <div className="form-group"><label className="form-label">Password</label><input className="form-input" type="password" value={form.adminPassword} onChange={e => setForm({ ...form, adminPassword: e.target.value })} required placeholder="Set admin password" /></div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Create Organization</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Manage Users Modal */}
            {showUsersModal && selectedTenant && (
                <div className="modal-overlay" onClick={() => setShowUsersModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">Users in {selectedTenant.name}</h3>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowUsersModal(false)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <table className="data-table" style={{ marginTop: 0 }}>
                                <thead><tr><th>Username</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
                                <tbody>
                                    {tenantUsers.map(u => (
                                        <tr key={u.id}>
                                            <td><strong>{u.username}</strong></td>
                                            <td><span className="badge">{u.role}</span></td>
                                            <td><span className={`badge badge-${u.status === 'active' ? 'success' : 'warning'}`}>{u.status}</span></td>
                                            <td>
                                                <button className="btn btn-danger btn-sm" onClick={() => handlePasswordReset(u.username)} style={{ fontSize: '11px', padding: '4px 8px' }}>Reset Pass</button>
                                            </td>
                                        </tr>
                                    ))}
                                    {tenantUsers.length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No users found</td></tr>}
                                </tbody>
                            </table>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setShowUsersModal(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

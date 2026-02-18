import { useState, useEffect } from 'react';
import api from '../lib/api';
import { Plus, Edit, Trash2, Search, Key } from 'lucide-react';

export default function Employees() {
    const [employees, setEmployees] = useState([]);
    const [departments, setDepartments] = useState([]);
    const [designations, setDesignations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editItem, setEditItem] = useState(null);
    const [form, setForm] = useState({ employeeCode: '', firstName: '', lastName: '', email: '', phone: '', gender: 'male', departmentId: '', designationId: '', joiningDate: '', password: '' });

    const loadData = () => {
        Promise.all([
            api.get('/employees', { params: { search, limit: 100 } }),
            api.get('/departments'),
            api.get('/designations'),
        ]).then(([empRes, deptRes, desigRes]) => {
            setEmployees(empRes.data.data || []);
            setDepartments(deptRes.data || []);
            setDesignations(desigRes.data || []);
            setLoading(false);
        }).catch(() => setLoading(false));
    };

    useEffect(() => { loadData(); }, [search]);
    // ... (rest of imports/methods similar)

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            // Clean payload
            const payload = { ...form };
            if (payload.departmentId === '') payload.departmentId = null;
            if (payload.designationId === '') payload.designationId = null;

            if (editItem) {
                await api.put(`/employees/${editItem.uuid}`, payload);
            } else {
                await api.post('/employees', { ...payload, createUser: true, password: form.password || form.employeeCode });
            }
            setShowModal(false);
            setEditItem(null);
            setForm({ employeeCode: '', firstName: '', lastName: '', email: '', phone: '', gender: 'male', departmentId: '', designationId: '', joiningDate: '', password: '' });
            loadData();
        } catch (err) {
            alert(err.response?.data?.error || err.response?.data?.message || 'Failed to save');
        }
    };

    // ...

    return (
        // ...
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Department</label>
                                        <select className="form-select" value={form.departmentId} onChange={e => setForm({ ...form, departmentId: e.target.value ? parseInt(e.target.value) : '' })}>
                                            <option value="">Select</option>
                                            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Designation</label>
                                        <select className="form-select" value={form.designationId} onChange={e => setForm({ ...form, designationId: e.target.value ? parseInt(e.target.value) : '' })}>
                                            <option value="">Select</option>
                                            {designations
                                                .filter(d => !form.departmentId || d.departmentId === parseInt(form.departmentId) || !d.departmentId)
                                                .map(d => <option key={d.id} value={d.id}>{d.name}</option>)
                                            }
                                        </select>
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Joining Date</label>
                                        <input className="form-input" type="date" value={form.joiningDate} onChange={e => setForm({ ...form, joiningDate: e.target.value })} />
                                    </div>
                                </div>
                                {
        !editItem && (
            <div className="form-group">
                <label className="form-label">Password (default = employee code)</label>
                <input className="form-input" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Leave blank to use employee code" />
            </div>
        )
    }
                            </div >
        <div className="modal-footer">
            <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">{editItem ? 'Update' : 'Create'}</button>
        </div>
                        </form >
                    </div >
                </div >
            )
}
        </div >
    );
}

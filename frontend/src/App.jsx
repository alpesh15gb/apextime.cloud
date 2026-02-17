import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import Departments from './pages/Departments';
import Timesheets from './pages/Timesheets';
import Approvals from './pages/Approvals';
import LeaveRequests from './pages/LeaveRequests';
import EmployeePortal from './pages/EmployeePortal';
import AcademicStructure from './pages/AcademicStructure';
import Students from './pages/Students';
import Announcements from './pages/Announcements';
import Devices from './pages/Devices';
import './index.css';

function ProtectedRoute({ children, adminOnly }) {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <div className="login-page"><div className="login-card"><p style={{ textAlign: 'center' }}>Loading...</p></div></div>;
  if (!user) return <Navigate to="/login" />;
  if (adminOnly && !isAdmin) return <Navigate to="/portal" />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Admin routes */}
      <Route path="/" element={<ProtectedRoute adminOnly><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="employees" element={<Employees />} />
        <Route path="departments" element={<Departments />} />
        <Route path="attendance" element={<Timesheets />} />
        <Route path="approvals" element={<Approvals />} />
        <Route path="leave-requests" element={<LeaveRequests />} />
        <Route path="academic" element={<AcademicStructure />} />
        <Route path="students" element={<Students />} />
        <Route path="announcements" element={<Announcements />} />
        <Route path="devices" element={<Devices />} />
      </Route>

      {/* Employee portal */}
      <Route path="/portal" element={<ProtectedRoute><EmployeePortal /></ProtectedRoute>} />

      <Route path="*" element={<Navigate to={user?.role === 'employee' || user?.role === 'teacher' ? '/portal' : '/'} />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

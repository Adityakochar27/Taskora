import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';

import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Tasks from './pages/Tasks.jsx';
import TaskDetail from './pages/TaskDetail.jsx';
import Teams from './pages/Teams.jsx';
import Departments from './pages/Departments.jsx';
import DepartmentDetail from './pages/DepartmentDetail.jsx';
import AdminPanel from './pages/AdminPanel.jsx';
import Profile from './pages/Profile.jsx';
import Notifications from './pages/Notifications.jsx';

import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Loader from './components/Loader.jsx';

export default function App() {
  const { booting } = useAuth();
  if (booting) return <Loader fullScreen />;

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/tasks/:id" element={<TaskDetail />} />
        <Route path="/teams" element={<Teams />} />
        <Route path="/departments" element={<Departments />} />
        <Route path="/departments/:id" element={<DepartmentDetail />} />
        <Route path="/admin" element={<ProtectedRoute roles={['Admin']}><AdminPanel /></ProtectedRoute>} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/profile" element={<Profile />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// src/App.jsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { ToastProvider } from './components/Toast';
import Layout from './components/Layout';

// Pages
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import PoliciesPage from './pages/PoliciesPage';
import ClaimsPage from './pages/ClaimsPage';
import SimulationPage from './pages/SimulationPage';
import AdminPage from './pages/AdminPage';
import NotFound from './pages/NotFound';

// ── Private Route ─────────────────────────────────────────────────────────────
const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen">🛡️ ShramInsure...</div>;
  return user ? children : <Navigate to="/login" replace />;
};

// ── Admin Route ──────────────────────────────────────────────────────────────
const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-screen">🛡️ ShramInsure...</div>;
  return user?.is_admin ? children : <Navigate to="/dashboard" replace />;
};

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <NotificationProvider>
          <ToastProvider>
            <Routes>
              {/* Public: Landing / Auth */}
              <Route path="/"        element={<AuthPage />} />
              <Route path="/login"   element={<AuthPage />} />
              <Route path="/signup"  element={<AuthPage />} />

              {/* Private: Layout Wrapper */}
              <Route element={<PrivateRoute><Layout /></PrivateRoute>}>
                <Route path="/dashboard"  element={<Dashboard />} />
                <Route path="/policies"   element={<PoliciesPage />} />
                <Route path="/claims"     element={<ClaimsPage />} />
                <Route path="/simulate"   element={<SimulationPage />} />
                
                {/* Admin Area */}
                <Route path="/admin"      element={<AdminRoute><AdminPage /></AdminRoute>} />
              </Route>

              {/* 404 handler */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ToastProvider>
        </NotificationProvider>
      </AuthProvider>
    </Router>
  );
}

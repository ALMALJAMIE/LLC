import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { PAGES } from './routes.gen';
import { WIRED } from './wired';
import PortalLayout from './components/layout/PortalLayout';
import { Spinner, Toaster } from './components/ui';
import { useAuth } from './lib/auth';
import { ROLE_HOME } from './lib/nav';
import Login from './pages/public/Login';
import Register from './pages/public/Register';
import { ForgotPassword, ResetPassword } from './pages/public/ForgotPassword';

function Portal({ path }: { path: string }) {
  const user = useAuth((s) => s.user);
  const ready = useAuth((s) => s.ready);
  const loc = useLocation();
  if (!user && !ready) return <Spinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  const live = WIRED[path]?.[user.role];
  const def = PAGES[path]?.[user.role];
  if (!live && !def) return <Navigate to={ROLE_HOME[user.role]} replace />;
  const C = live ?? def!.C;
  return (
    <PortalLayout header={live ? true : def!.header}>
      <C />
    </PortalLayout>
  );
}

function Home() {
  const user = useAuth((s) => s.user);
  const ready = useAuth((s) => s.ready);
  if (!user && !ready) return <Spinner />;
  return <Navigate to={user ? ROLE_HOME[user.role] : '/login'} replace />;
}

const ALL = Array.from(new Set([...Object.keys(PAGES), ...Object.keys(WIRED)]));

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        {ALL.map((p) => <Route key={p} path={p} element={<Portal path={p} />} />)}
        <Route path="*" element={<Home />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}

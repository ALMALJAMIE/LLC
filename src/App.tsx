import { Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, matchPath, useLocation } from 'react-router-dom';
import { PAGES } from './routes.gen';
import { WIRED } from './wired';
import PortalLayout from './components/layout/PortalLayout';
import { Spinner, Toaster } from './components/ui';
import { useAuth } from './lib/auth';
import { ROLE_HOME } from './lib/nav';
import Login from './pages/public/Login';
import { lazy } from 'react';
const HomePage = lazy(() => import('./pages/public/Home'));
const Catalog = lazy(() => import('./pages/public/Catalog'));
const Help = lazy(() => import('./pages/public/Help'));
const PlacementLanding = lazy(() => import('./pages/public/Landing').then((m) => ({ default: m.PlacementLanding })));
const AgentsLanding = lazy(() => import('./pages/public/Landing').then((m) => ({ default: m.AgentsLanding })));
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

const pub = (C: React.ComponentType) => <Suspense fallback={<Spinner />}><C /></Suspense>;

// Static reference screens are dropped when a connected screen covers the same URL (incl. :param routes).
const wiredKeys = Object.keys(WIRED);
const ALL = [...wiredKeys, ...Object.keys(PAGES).filter((p) => !wiredKeys.some((w) => matchPath(w, p)))];

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <Routes>
        <Route path="/" element={pub(HomePage)} />
        <Route path="/courses" element={pub(Catalog)} />
        <Route path="/help" element={pub(Help)} />
        <Route path="/placement" element={pub(PlacementLanding)} />
        <Route path="/agents" element={pub(AgentsLanding)} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        {ALL.map((p) => <Route key={p} path={p} element={<Portal path={p} />} />)}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster />
    </BrowserRouter>
  );
}

import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { PAGES } from './routes.gen';
import PortalLayout from './components/layout/PortalLayout';
import { useAuth } from './lib/auth';
import { ROLE_HOME } from './lib/nav';
import Login from './pages/public/Login';

function Portal({ path }: { path: string }) {
  const user = useAuth((s) => s.user);
  const loc = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  const def = PAGES[path]?.[user.role];
  if (!def) return <Navigate to={ROLE_HOME[user.role]} replace />;
  const C = def.C;
  return (
    <PortalLayout header={def.header}>
      <C />
    </PortalLayout>
  );
}

function Home() {
  const user = useAuth((s) => s.user);
  return <Navigate to={user ? ROLE_HOME[user.role] : '/login'} replace />;
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        {Object.keys(PAGES).map((p) => (
          <Route key={p} path={p} element={<Portal path={p} />} />
        ))}
        <Route path="*" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}

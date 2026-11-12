import { useState } from 'react';
import { Link, NavLink, Route, Routes } from 'react-router';
import { useAuth } from './context/AuthContext.jsx';
import RequireRole from './components/RequireRole.jsx';
import Home from './pages/Home.jsx';
import Post from './pages/Post.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Dashboard from './pages/admin/Dashboard.jsx';
import PostForm from './pages/admin/PostForm.jsx';
import Users from './pages/admin/Users.jsx';
import AuditLog from './pages/admin/AuditLog.jsx';
import Trash from './pages/admin/Trash.jsx';
import CommentsAdmin from './pages/admin/Comments.jsx';
import Security from './pages/Security.jsx';

const STAFF = ['editor', 'admin'];
const ALL_ROLES = ['lector', 'editor', 'admin'];

function ThemeToggle() {
  const [oscuro, setOscuro] = useState(() => document.documentElement.classList.contains('dark'));

  const cambiar = () => {
    const nuevo = !oscuro;
    setOscuro(nuevo);
    document.documentElement.classList.toggle('dark', nuevo);
    try {
      localStorage.setItem('tema', nuevo ? 'oscuro' : 'claro');
    } catch {
      // Sin almacenamiento: el cambio vale solo para esta visita
    }
  };

  return (
    <button onClick={cambiar} className="btn btn-ghost btn-sm" aria-label={oscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'} title={oscuro ? 'Modo claro' : 'Modo oscuro'}>
      {oscuro ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}

const navLink = ({ isActive }) =>
  `rounded-lg px-3 py-1.5 text-sm font-medium transition ${isActive ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'}`;

function Navbar() {
  const { user, logout } = useAuth();
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <nav className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-3">
        <Link to="/" className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-linear-to-br from-indigo-500 to-violet-600 text-sm text-white shadow-sm">M</span>
          Mi CMS
        </Link>
        <div className="flex flex-wrap items-center gap-1">
          {user ? (
            <>
              {STAFF.includes(user.role) && <NavLink to="/admin" className={navLink}>Panel</NavLink>}
              <NavLink to="/security" className={navLink}>Seguridad</NavLink>
              <span className="hidden items-center gap-2 px-2 text-sm text-slate-600 sm:flex dark:text-slate-300">
                {user.name}
                <span className="badge badge-slate">{user.role}</span>
              </span>
              <ThemeToggle />
              <button onClick={logout} className="btn btn-secondary btn-sm">Salir</button>
            </>
          ) : (
            <>
              <ThemeToggle />
              <NavLink to="/login" className={navLink}>Ingresar</NavLink>
              <Link to="/register" className="btn btn-primary btn-sm">Registrarse</Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

function NoEncontrada() {
  return (
    <div className="card mx-auto max-w-md p-8 text-center">
      <p className="text-5xl font-bold text-indigo-600">404</p>
      <p className="mt-2 text-slate-600">Página no encontrada.</p>
      <Link to="/" className="btn btn-primary mt-6">Volver al inicio</Link>
    </div>
  );
}

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/posts/:slug" element={<Post />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/admin" element={<RequireRole roles={STAFF}><Dashboard /></RequireRole>} />
          <Route path="/admin/posts/new" element={<RequireRole roles={STAFF}><PostForm /></RequireRole>} />
          <Route path="/admin/posts/:id/edit" element={<RequireRole roles={STAFF}><PostForm /></RequireRole>} />
          <Route path="/admin/comments" element={<RequireRole roles={STAFF}><CommentsAdmin /></RequireRole>} />
          <Route path="/admin/trash" element={<RequireRole roles={STAFF}><Trash /></RequireRole>} />
          <Route path="/admin/users" element={<RequireRole roles={['admin']}><Users /></RequireRole>} />
          <Route path="/admin/audit" element={<RequireRole roles={['admin']}><AuditLog /></RequireRole>} />
          <Route path="/security" element={<RequireRole roles={ALL_ROLES} allowWithoutMfa><Security /></RequireRole>} />
          <Route path="*" element={<NoEncontrada />} />
        </Routes>
      </main>
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500 dark:border-slate-800">
        Mi CMS · Proyecto de Seguridad en Aplicaciones, UMG
      </footer>
    </div>
  );
}
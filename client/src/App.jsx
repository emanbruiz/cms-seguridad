import { Link, Route, Routes } from 'react-router';
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
import Security from './pages/Security.jsx';

const STAFF = ['editor', 'admin'];
const ALL_ROLES = ['lector', 'editor', 'admin'];

function Navbar() {
  const { user, logout } = useAuth();
  return (
    <header className="border-b border-slate-200 bg-white">
      <nav className="mx-auto flex max-w-3xl items-center justify-between p-4">
        <Link to="/" className="text-lg font-bold text-slate-900">Mi CMS</Link>
        <div className="flex items-center gap-4 text-sm">
          {user ? (
            <>
              {STAFF.includes(user.role) && (
                <Link to="/admin" className="text-slate-700 hover:underline">Panel</Link>
              )}
              <Link to="/security" className="text-slate-700 hover:underline">Seguridad</Link>
              <span className="text-slate-600">{user.name} ({user.role})</span>
              <button onClick={logout} className="rounded bg-slate-900 px-3 py-1 text-white hover:bg-slate-700">Salir</button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-slate-700 hover:underline">Ingresar</Link>
              <Link to="/register" className="rounded bg-slate-900 px-3 py-1 text-white hover:bg-slate-700">Registrarse</Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <Navbar />
      <main className="mx-auto max-w-3xl p-4">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/posts/:slug" element={<Post />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/admin" element={<RequireRole roles={STAFF}><Dashboard /></RequireRole>} />
          <Route path="/admin/posts/new" element={<RequireRole roles={STAFF}><PostForm /></RequireRole>} />
          <Route path="/admin/posts/:id/edit" element={<RequireRole roles={STAFF}><PostForm /></RequireRole>} />
          <Route path="/admin/users" element={<RequireRole roles={['admin']}><Users /></RequireRole>} />
          <Route path="/admin/audit" element={<RequireRole roles={['admin']}><AuditLog /></RequireRole>} />
          <Route path="/security" element={<RequireRole roles={ALL_ROLES} allowWithoutMfa><Security /></RequireRole>} />
          <Route path="*" element={<p>Página no encontrada.</p>} />
        </Routes>
      </main>
    </div>
  );
}
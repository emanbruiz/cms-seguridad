import { Link, Route, Routes } from 'react-router';
import { useAuth } from './context/AuthContext.jsx';
import Home from './pages/Home.jsx';
import Post from './pages/Post.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';

function Navbar() {
  const { user, logout } = useAuth();
  return (
    <header className="border-b border-slate-200 bg-white">
      <nav className="mx-auto flex max-w-3xl items-center justify-between p-4">
        <Link to="/" className="text-lg font-bold text-slate-900">Mi CMS</Link>
        <div className="flex items-center gap-4 text-sm">
          {user ? (
            <>
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
          <Route path="*" element={<p>Página no encontrada.</p>} />
        </Routes>
      </main>
    </div>
  );
}
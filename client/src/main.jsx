import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import './index.css';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { UIProvider } from './components/ui.jsx';

// Tema inicial: la preferencia guardada (solo "claro" u "oscuro", nunca datos sensibles) o la del sistema
let oscuro = window.matchMedia('(prefers-color-scheme: dark)').matches;
try {
  const guardado = localStorage.getItem('tema');
  if (guardado) oscuro = guardado === 'oscuro';
} catch {
  // Sin acceso al almacenamiento: se usa la preferencia del sistema
}
document.documentElement.classList.toggle('dark', oscuro);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <UIProvider>
          <App />
        </UIProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);

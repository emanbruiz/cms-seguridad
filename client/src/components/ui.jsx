import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

// Diálogos de confirmación y avisos propios, en lugar de window.confirm y alert
const UIContext = createContext(null);

function ConfirmDialog({ dialog, onClose }) {
  const confirmRef = useRef(null);

  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onClose(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={() => onClose(false)} />
      <div role="alertdialog" aria-modal="true" aria-labelledby="dialogo-titulo" aria-describedby="dialogo-texto" className="card relative w-full max-w-md p-6">
        <h2 id="dialogo-titulo" className="text-lg font-semibold text-slate-900 dark:text-white">{dialog.title}</h2>
        <p id="dialogo-texto" className="mt-2 text-sm text-slate-600 dark:text-slate-300">{dialog.message}</p>
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => onClose(false)}>
            {dialog.cancelText || 'Cancelar'}
          </button>
          <button type="button" ref={confirmRef} className={`btn ${dialog.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => onClose(true)}>
            {dialog.confirmText || 'Aceptar'}
          </button>
        </div>
      </div>
    </div>
  );
}

const TOAST_STYLE = {
  success: 'border-emerald-200 bg-white text-emerald-800 dark:border-emerald-500/30 dark:bg-slate-900 dark:text-emerald-300',
  error: 'border-red-200 bg-white text-red-800 dark:border-red-500/30 dark:bg-slate-900 dark:text-red-300',
};

export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const nextId = useRef(0);

  const toast = useCallback((message, type = 'success') => {
    nextId.current += 1;
    const id = nextId.current;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const confirm = useCallback((options) => new Promise((resolve) => setDialog({ ...options, resolve })), []);

  const closeDialog = useCallback(
    (value) => {
      setDialog((d) => {
        d?.resolve(value);
        return null;
      });
    },
    []
  );

  return (
    <UIContext.Provider value={{ toast, confirm }}>
      {children}
      {dialog && <ConfirmDialog dialog={dialog} onClose={closeDialog} />}
      <div role="status" aria-live="polite" className="fixed right-4 bottom-4 z-50 flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={`rounded-xl border px-4 py-3 text-sm shadow-lg ${TOAST_STYLE[t.type] || TOAST_STYLE.success}`}>
            {t.message}
          </div>
        ))}
      </div>
    </UIContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useUI = () => useContext(UIContext);

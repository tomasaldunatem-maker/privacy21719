import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

export function Pill({ tone = 'neu', children }: { tone?: string; children: ReactNode }) {
  return <span className={`pill ${tone}`}>{children}</span>;
}

export function PageHead({ eyebrow, title, lede, right }: { eyebrow: ReactNode; title: string; lede?: ReactNode; right?: ReactNode }) {
  return (
    <div className="head">
      <div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{lede && <p className="lede">{lede}</p>}</div>
      {right}
    </div>
  );
}

export function Loading({ label = 'Cargando…' }: { label?: string }) {
  return <div className="empty"><span className="spinner" /> {label}</div>;
}

export function ErrorBox({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return <div className="alert bad">{error} {onRetry && <button className="linkbtn" onClick={onRetry}>Reintentar</button>}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Disclaimer() {
  return <p className="disclaimer">PRIVACY 21719 organiza y documenta el programa de cumplimiento de la clínica. No certifica cumplimiento ni reemplaza la asesoría jurídica. Las referencias a artículos de la Ley 21.719 son orientativas y deben ser validadas por un abogado especialista.</p>;
}

/** Botón que pide una segunda confirmación en la misma página (sin diálogos del navegador). */
export function ConfirmButton({ onConfirm, children, confirmText = '¿Confirmar?', className = 'btn ghost sm', disabled }: { onConfirm: () => void; children: ReactNode; confirmText?: string; className?: string; disabled?: boolean }) {
  const [armed, setArmed] = useState(false);
  return (
    <button type="button" className={armed ? 'btn danger sm' : className} disabled={disabled}
      onClick={() => { if (armed) { setArmed(false); onConfirm(); } else { setArmed(true); setTimeout(() => setArmed(false), 4000); } }}>
      {armed ? confirmText : children}
    </button>
  );
}

type Toast = { msg: string; error?: boolean } | null;
const ToastCtx = createContext<(msg: string, error?: boolean) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<Toast>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((msg: string, error?: boolean) => {
    setT({ msg, error });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setT(null), error ? 5000 : 2600);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {t && <div className={`toast ${t.error ? 'error' : ''}`} role="status">{t.msg}</div>}
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

export function FieldErrors({ errors, name }: { errors?: Record<string, string[]>; name: string }) {
  const e = errors?.[name];
  return e?.length ? <span className="field-error">{e.join(', ')}</span> : null;
}

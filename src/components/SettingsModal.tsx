import React, { useEffect, useState } from 'react';
import { X, UserRound, Pencil, LogOut, Check, LoaderCircle } from 'lucide-react';
import { createPortal } from 'react-dom';

type Profile = { firstName: string; lastName: string; nationalId: string; ownerName: string };
const empty: Profile = { firstName: '', lastName: '', nationalId: '', ownerName: '' };
const labels: Record<keyof Profile, string> = { firstName: 'Nombres', lastName: 'Apellidos', nationalId: 'Cedula', ownerName: 'Propietario de las unidades' };
interface Props { isOpen: boolean; onClose: () => void; onLogout: () => void; token: string | null; account?: string; unitsCount: number; isAdministrator: boolean }
export const SettingsModal: React.FC<Props> = ({ isOpen, onClose, onLogout, token, account, unitsCount, isAdministrator }) => {
  const [profile, setProfile] = useState<Profile>(empty);
  const [draft, setDraft] = useState<Profile>(empty);
  const [accountName, setAccountName] = useState(account || '');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!isOpen || !token) return;
    const controller = new AbortController();
    setProfile(empty); setDraft(empty); setAccountName(account || ''); setLoading(true); setEditing(false); setError(''); setSaved(false);
    fetch('/api/account/profile', { headers: { Authorization: 'Bearer ' + token }, signal: controller.signal, cache: 'no-store' })
      .then(async response => { const data = await response.json(); if (!response.ok) throw Error(data.error || 'No se pudo cargar su perfil'); if (controller.signal.aborted) return; setProfile(data.profile); setDraft(data.profile); setAccountName(data.account); })
      .catch(error => { if (!controller.signal.aborted) setError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [isOpen, token]);
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); if (saving) return;
    setSaving(true); setError(''); setSaved(false);
    try {
      const response = await fetch('/api/account/profile', { method: 'PUT', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(draft) });
      const data = await response.json(); if (!response.ok) throw Error(data.error || 'No se pudo guardar');
      setProfile(data.profile); setDraft(data.profile); setEditing(false); setSaved(true);
    } catch (error: any) { setError(error.message || 'No se pudo guardar'); }
    finally { setSaving(false); }
  };
  if (!isOpen) return null;
  const filled = (Object.keys(labels) as (keyof Profile)[]).filter(key => profile[key]);
  return createPortal(<div className="fixed inset-0 z-[2000] bg-black/75 flex items-center justify-center p-3 sm:p-5" onClick={() => { if (!saving) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label="Mi cuenta" className="w-full max-w-lg max-h-[calc(100dvh-1.5rem)] rounded-2xl bg-[#071626] border border-[#34546a] text-slate-200 flex flex-col overflow-hidden shadow-2xl" onClick={event => event.stopPropagation()}>
      <div className="p-5 border-b border-[#293a50] flex items-start gap-3">
        <div className="rounded-2xl bg-cyan-400/10 p-3 text-cyan-300"><UserRound className="w-6 h-6" /></div>
        <div className="min-w-0 flex-1"><p className="text-xs text-slate-400 mb-1">Mi cuenta</p><h2 className="text-xl font-semibold break-words">Hola {accountName}</h2></div>
        <button aria-label="Cerrar perfil" disabled={saving} onClick={onClose} className="p-2 rounded-xl bg-slate-800/70"><X className="w-5 h-5" /></button>
      </div>
      <div className="p-5 overflow-y-auto min-h-0 space-y-4">
        {loading ? <p className="flex items-center gap-2 text-cyan-200"><LoaderCircle className="w-4 h-4 animate-spin" />Cargando su perfil...</p> : editing ? <form id="account-profile-form" onSubmit={save} className="space-y-4">
          {(Object.keys(labels) as (keyof Profile)[]).map(key => <label key={key} className="block text-sm text-slate-300">{labels[key]}
            <input name={key} autoComplete={key === 'firstName' ? 'given-name' : key === 'lastName' ? 'family-name' : 'off'} inputMode={key === 'nationalId' ? 'numeric' : 'text'} pattern={key === 'nationalId' ? '[0-9]{10}' : undefined} maxLength={key === 'nationalId' ? 10 : 120} value={draft[key]} onChange={event => setDraft(old => ({ ...old, [key]: event.target.value }))} className="block mt-1.5 w-full rounded-xl bg-[#011428] border border-[#34546a] px-3 py-3 text-white outline-none focus:border-cyan-400" />
          </label>)}
          <p className="text-xs text-slate-400 leading-relaxed">Estos datos describen su perfil. Los permisos y las unidades asignadas siguen siendo los de su cuenta Ceiba.</p>
        </form> : <>
          {filled.length ? <dl className="space-y-4">{filled.map(key => <div key={key} className="rounded-xl border border-[#293a50] bg-[#011428] p-3"><dt className="text-xs text-slate-400 mb-1">{labels[key]}</dt><dd className="text-sm font-medium break-words">{profile[key]}</dd></div>)}</dl> : <p className="text-sm text-slate-400">Puede agregar sus datos desde Editar.</p>}
          <div className="rounded-xl border border-cyan-700/30 bg-cyan-500/5 p-3 text-sm">{isAdministrator ? 'Cuenta administradora' : 'Unidades asignadas a esta cuenta'}<span className="block text-xs text-slate-400 mt-1">{unitsCount} unidades autorizadas{isAdministrator ? ' · El acceso administrativo no acredita propiedad.' : ''}</span></div>
        </>}
        {error && <p role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300">{error}</p>}
        {saved && <p role="status" className="flex items-center gap-2 text-emerald-300 text-sm"><Check className="w-4 h-4" />Perfil guardado</p>}
      </div>
      <div className="p-4 border-t border-[#293a50] flex flex-wrap gap-2">
        {editing ? <><button key="save-profile" form="account-profile-form" type="submit" disabled={saving} className="flex-1 rounded-xl bg-cyan-400 text-[#00131f] px-4 py-3 font-semibold disabled:opacity-60">{saving ? 'Guardando...' : 'Guardar cambios'}</button><button key="cancel-profile" type="button" disabled={saving} onClick={() => { setDraft(profile); setEditing(false); setError(''); }} className="rounded-xl bg-slate-800 px-4 py-3">Cancelar</button></> : <><button key="edit-profile" type="button" disabled={loading || Boolean(error)} onClick={() => { setEditing(true); setSaved(false); }} className="rounded-xl border border-cyan-700 px-4 py-3 flex items-center gap-2 text-cyan-200 disabled:opacity-50"><Pencil className="w-4 h-4" />Editar</button><button onClick={onLogout} className="flex-1 rounded-xl bg-rose-500/10 border border-rose-900/70 text-rose-300 px-3 py-3 flex items-center justify-center gap-2 text-sm"><LogOut className="w-4 h-4" />Salir / Cambiar usuario</button></>}
      </div>
    </section>
  </div>, document.body);
};

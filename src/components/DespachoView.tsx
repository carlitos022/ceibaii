import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bus, CalendarDays, Search, X, MapPinned, FileText, ChevronDown, Route } from 'lucide-react';
import { Vehicle } from '../types';
import { RecorridoSelection } from './RecorridoView';

type Point = { name: string; event: string | null; time: string | null; expected: string | null; arrival: string | null; difference: number | null; fine: number; lat: number; lng: number };
type Dispatch = { id: string; route: string; start: string | null; end: string | null; status: string; fine: number; points: Point[] };
type Schedule = { id: number; fenceName: string; dueAt: string; arrival: string | null; delayMinutes: number | null; rate: number; fine: number };
type Fence = { id: string; name: string };
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export function DespachoView({ vehicles, token, onOpenRecorrido }: { vehicles: Vehicle[]; token: string | null; onOpenRecorrido: (selection: RecorridoSelection) => void }) {
  const [unit, setUnit] = useState('');
  const [date, setDate] = useState(today);
  const [search, setSearch] = useState('');
  const [picker, setPicker] = useState(false);
  const [report, setReport] = useState<Dispatch[] | null>(null);
  const [detail, setDetail] = useState<Dispatch | null>(null);
  const [mode, setMode] = useState<'route' | 'ticket'>('ticket');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [fences, setFences] = useState<Fence[]>([]);
  const [scheduleDate, setScheduleDate] = useState(today);
  const [scheduleTime, setScheduleTime] = useState('08:00');
  const [scheduleFence, setScheduleFence] = useState('');
  const [scheduleRate, setScheduleRate] = useState('0.50');
  const [saving, setSaving] = useState(false);
  const sorted = useMemo(() => [...vehicles].sort((a, b) => Number(a.status === 'offline') - Number(b.status === 'offline') || a.unitNumber.localeCompare(b.unitNumber, 'es', { numeric: true })), [vehicles]);
  const filtered = useMemo(() => sorted.filter(v => [v.unitNumber, v.plate].some(value => value?.toLowerCase().includes(search.toLowerCase()))), [sorted, search]);
  useEffect(() => { if (!vehicles.some(v => v.id === unit)) { setUnit(sorted[0]?.id || ''); setReport(null); } }, [vehicles, sorted, unit]);
  const chosen = vehicles.find(v => v.id === unit);
  useEffect(() => {
    if (!scheduleOpen || !token) return;
    fetch('/api/dispatch/fences', { headers: { Authorization: 'Bearer ' + token } })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then((items: Fence[]) => { setFences(items); setScheduleFence(current => current || items[0]?.id || ''); })
      .catch(() => setError('No se pudieron cargar las geocercas'));
  }, [scheduleOpen, token]);
  async function loadSchedules(vehicleId = unit, selectedDate = date) {
    if (!vehicleId || !token) return;
    try {
      const params = new URLSearchParams({ vehicleId, date: selectedDate });
      const response = await fetch('/api/dispatch/schedules?' + params, { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' });
      if (response.ok) setSchedules((await response.json()).schedules || []);
      else setSchedules([]);
    } catch { setSchedules([]); }
  }
  async function saveSchedule(event: React.FormEvent) {
    event.preventDefault();
    if (!token || !unit || !scheduleFence) return;
    setSaving(true); setError('');
    try {
      const response = await fetch('/api/dispatch/schedules', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ vehicleId: unit, fenceId: scheduleFence, date: scheduleDate, time: scheduleTime, rate: Number(scheduleRate) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo programar el despacho');
      setScheduleOpen(false);
      if (scheduleDate === date) await loadSchedules();
    } catch (e: any) { setError(e.message || 'No se pudo guardar'); }
    finally { setSaving(false); }
  }
  async function generate() {
    if (!unit || !token) return;
    setLoading(true); setError(''); setReport(null);
    void loadSchedules();
    try {
      const params = new URLSearchParams({ vehicleId: unit, date });
      const response = await fetch('/api/dispatch/report?' + params, { headers: { Authorization: 'Bearer ' + token }, cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'No se pudo consultar el reporte');
      setReport(data.report);
    } catch (e: any) { setError(e.message || 'Error de conexión'); }
    finally { setLoading(false); }
  }
  const open = (row: Dispatch, view: 'route' | 'ticket') => { setDetail(row); setMode(view); };
  return <section className="absolute inset-x-0 top-14 bottom-16 overflow-y-auto overscroll-contain bg-[#071626] text-slate-100">
    <div className="mx-auto max-w-4xl px-3 sm:px-6 pt-4 pb-8">
      <div className="mb-4"><h1 className="text-xl font-semibold text-white">Despachos</h1><p className="text-xs text-slate-400">Mis unidades · reportes por unidad</p></div>
      <div className="rounded-2xl border border-[#294458] bg-[#10283c] p-3 sm:p-5 shadow-xl">
        <div className="grid grid-cols-2 gap-2 sm:gap-4">
          <button type="button" onClick={() => setPicker(true)} className="min-w-0 min-h-12 rounded-xl border border-[#34546a] bg-[#0a1a2b] px-2 flex items-center gap-2 text-left">
            <Bus className="h-5 w-5 flex-none text-[#00d1ff]" /><span className="truncate text-sm font-semibold">{chosen?.unitNumber || 'Sin unidades'}</span><ChevronDown className="h-4 w-4 flex-none text-slate-400 ml-auto" />
          </button>
          <label className="min-w-0 min-h-12 rounded-xl border border-[#34546a] bg-[#0a1a2b] px-2 flex items-center gap-1">
            <CalendarDays className="h-5 w-5 flex-none text-[#00d1ff]" /><input aria-label="Fecha del despacho" type="date" value={date} onChange={e => { setDate(e.target.value); setReport(null); setSchedules([]); }} className="min-w-0 w-full bg-transparent text-xs sm:text-sm text-white outline-none [color-scheme:dark]" />
          </label>
        </div>
        <button disabled={!unit || !date || loading} onClick={generate} className="mt-3 w-full rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-[#172539] font-bold py-3 transition-colors">
          {loading ? 'Consultando despachos…' : 'GENERAR REPORTE'}
        </button>
        <button type="button" onClick={() => { setScheduleDate(date); setScheduleOpen(true); }} disabled={!unit} className="mt-3 w-full rounded-xl border border-cyan-600 px-3 py-2.5 text-sm font-semibold text-cyan-200 disabled:opacity-50">Programar paso por geocerca</button>
      </div>
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-800 bg-red-950/40 p-3 text-sm text-red-200">{error}</p>}
      {report?.length === 0 && <div className="py-20 text-center text-slate-400"><Bus className="mx-auto mb-3 h-10 w-10 opacity-50" /><p>No existen despachos para esta unidad y fecha.</p></div>}
      {report === null && schedules.length === 0 && !loading && !error && <div className="py-20 text-center text-slate-400"><FileText className="mx-auto mb-3 h-10 w-10 opacity-50" /><p>Selecciona una unidad y fecha para generar el reporte.</p></div>}
      {schedules.length > 0 && <div className="mt-4 space-y-3"><h2 className="font-semibold text-cyan-200">Pasos programados · {chosen?.unitNumber}</h2>{schedules.map(item => <article key={item.id} className="rounded-xl border border-cyan-700/50 bg-[#102337] p-4 text-sm"><strong>{item.fenceName}</strong><p className="mt-1 text-slate-300">Programado: {item.dueAt} · Llegada: {item.arrival || 'Pendiente'}</p><p className="mt-1">Retraso: {item.delayMinutes == null ? 'Pendiente' : item.delayMinutes + ' min'} · ${item.rate.toFixed(2)}/min · Multa: <strong>${item.fine.toFixed(2)}</strong></p></article>)}</div>}
      {!!report?.length && <div className="mt-4 space-y-3"><p className="text-xs text-slate-400">{report.length} {report.length === 1 ? 'despacho encontrado' : 'despachos encontrados'} · {chosen?.unitNumber}</p>
        {report.map(row => <article key={row.id} className="rounded-2xl border border-[#294458] bg-[#102337] p-4 shadow-lg">
          <div className="border-b border-[#294458] pb-2 text-sm"><span className="text-slate-400">RUTA: </span><strong className="text-white">{row.route}</strong></div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 py-3 text-sm">
            <span><span className="text-slate-400">Inicio: </span>{row.start || '—'}</span><span><span className="text-slate-400">Fin: </span>{row.end || 'En curso'}</span>
            <span><span className="text-slate-400">Multa: </span>${row.fine.toFixed(2)}</span><span className="truncate"><span className="text-slate-400">Estado: </span>{row.status.replaceAll('_', ' ')}</span>
            <span className="col-span-2 text-slate-400">{row.points.length} pasos · {new Set(row.points.map(point => point.name)).size} geocercas · {row.points.filter(point => point.event === 'ENTRO').length} entradas · {row.points.filter(point => point.event === 'SALIO').length} salidas</span>
          </div>
          <div className="space-y-1 border-t border-[#294458] py-2">{row.points.slice(0, 3).map((point, index) => <div key={index} className="flex items-center justify-between gap-2 text-xs"><span className="min-w-0 truncate text-slate-200">{point.name} · {point.event || 'Paso'}</span><span className="shrink-0 text-cyan-200">{point.time || '—'}</span></div>)}{row.points.length > 3 && <p className="text-[11px] text-slate-400">+{row.points.length - 3} pasos en el detalle</p>}</div>
          <div className="flex flex-wrap justify-end gap-2"><button onClick={() => onOpenRecorrido({ vehicleId: unit, date, fromTime: row.start?.slice(0, 5) || '00:00', toTime: row.end?.slice(0, 5) || '23:59' })} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">Recorrido</button><button onClick={() => open(row, 'ticket')} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">Ver puntos y multas</button></div>
        </article>)}
      </div>}
    </div>
    {scheduleOpen && createPortal(<div className="fixed inset-0 z-[1300] flex items-end sm:items-center justify-center bg-black/75" onClick={() => setScheduleOpen(false)}>
      <form onSubmit={saveSchedule} onClick={event => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Programar despacho" className="w-full sm:max-w-lg max-h-[85dvh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-[#34546a] bg-[#102337] p-4 pb-[max(24px,env(safe-area-inset-bottom))] space-y-3">
        <div className="flex items-center justify-between"><h2 className="text-lg font-bold">Programar despacho</h2><button type="button" aria-label="Cerrar" onClick={() => setScheduleOpen(false)}><X /></button></div>
        <label className="block text-xs text-slate-300">Unidad<select value={unit} onChange={event => { setUnit(event.target.value); setReport(null); setSchedules([]); }} className="mt-1 w-full rounded-xl border border-[#34546a] bg-[#071626] p-3 text-white">{sorted.map(v => <option key={v.id} value={v.id}>{v.unitNumber} · {v.status === 'offline' ? 'Apagada' : 'Encendida'}</option>)}</select></label>
        <label className="block text-xs text-slate-300">Geocerca<select required value={scheduleFence} onChange={event => setScheduleFence(event.target.value)} className="mt-1 w-full rounded-xl border border-[#34546a] bg-[#071626] p-3 text-white"><option value="">Seleccionar geocerca</option>{fences.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-slate-300">Fecha<input required type="date" value={scheduleDate} onChange={event => setScheduleDate(event.target.value)} className="mt-1 w-full min-w-0 rounded-xl border border-[#34546a] bg-[#071626] p-3 text-white [color-scheme:dark]" /></label>
          <label className="text-xs text-slate-300">Hora<input required type="time" value={scheduleTime} onChange={event => setScheduleTime(event.target.value)} className="mt-1 w-full min-w-0 rounded-xl border border-[#34546a] bg-[#071626] p-3 text-white [color-scheme:dark]" /></label>
        </div>
        <label className="block text-xs text-slate-300">Multa por minuto de retraso (USD)<input required type="number" min="0" max="100" step="0.01" value={scheduleRate} onChange={event => setScheduleRate(event.target.value)} className="mt-1 w-full rounded-xl border border-[#34546a] bg-[#071626] p-3 text-white" /></label>
        <p className="text-xs text-slate-400">La multa se calcula al registrar una entrada GPS a la geocerca despues de la hora programada.</p>
        <button disabled={saving || !scheduleFence} type="submit" className="w-full rounded-xl bg-amber-400 p-3 font-bold text-[#172539] disabled:opacity-50">{saving ? 'Guardando…' : 'Guardar programacion'}</button>
      </form>
    </div>, document.body)}
    {picker && createPortal(<div className="fixed inset-0 z-[1200] flex items-end bg-black/65" onClick={() => setPicker(false)}><div role="dialog" aria-label="Seleccionar unidad" onClick={e => e.stopPropagation()} className="mx-auto w-full max-w-4xl rounded-t-3xl bg-[#102337] border border-[#34546a] p-4 pb-[max(20px,env(safe-area-inset-bottom))] max-h-[75dvh] flex flex-col">
      <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-slate-500" /><div className="flex items-center gap-2"><Search className="h-5 w-5 text-slate-400" /><input autoFocus placeholder="Buscar disco o placa" value={search} onChange={e => setSearch(e.target.value)} className="min-w-0 flex-1 rounded-xl bg-[#071626] p-3 text-white outline-none border border-[#34546a]" /><button aria-label="Cerrar" onClick={() => setPicker(false)}><X /></button></div>
      <div className="mt-3 overflow-y-auto space-y-2">{filtered.map(v => <button key={v.id} onClick={() => { setUnit(v.id); setReport(null); setSchedules([]); setPicker(false); setSearch(''); }} className={`block w-full rounded-xl p-3 text-left text-sm border ${v.id === unit ? 'bg-emerald-800/60 border-emerald-500' : 'bg-[#071626] border-[#294458]'}`}><span className="flex items-center justify-between gap-2"><span>{v.unitNumber}</span><span className={v.status === 'offline' ? 'text-slate-400' : 'text-emerald-300'}>{v.status === 'offline' ? 'Apagada' : 'Encendida'}</span></span></button>)}{filtered.length === 0 && <p className="p-4 text-slate-400">No hay unidades coincidentes</p>}</div>
    </div></div>, document.body)}
    {detail && createPortal(<div className="fixed inset-0 z-[1200] flex items-end sm:items-center justify-center bg-black/75" onClick={() => setDetail(null)}><div role="dialog" aria-label={mode === 'route' ? 'Recorrido' : 'Puntos y multas'} onClick={e => e.stopPropagation()} className="w-full sm:max-w-xl max-h-[80dvh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-[#34546a] bg-[#102337] p-4 pb-[max(24px,env(safe-area-inset-bottom))]">
      <div className="flex items-start justify-between gap-3"><div><h2 className="font-bold text-lg">{mode === 'route' ? 'Recorrido' : 'Puntos y multas'}</h2><p className="text-xs text-slate-400">{chosen?.unitNumber} · {date} · {detail.route}</p></div><button aria-label="Cerrar" onClick={() => setDetail(null)}><X /></button></div>
      {mode === 'route' && <p className="mt-3 text-xs text-cyan-200 flex gap-2"><Route className="h-4 w-4 flex-none" />Puntos de paso registrados por el sistema de despachos.</p>}
      <div className="mt-4 space-y-2">{detail.points.map((point, index) => <div key={index} className="rounded-xl border border-[#294458] bg-[#071626] p-3 text-sm"><div className="flex items-start justify-between gap-2"><strong>{index + 1}. {point.name}</strong><span className="text-cyan-300 whitespace-nowrap">{point.time || '—'}</span></div><div className="mt-2 grid grid-cols-2 gap-1 text-xs text-slate-300"><span>Evento: {point.event || 'Registro'}</span><span>Hora: {point.time || '—'}</span><span>Programado: {point.expected || 'Sin horario'}</span><span>Llegada: {point.arrival || 'Sin registro'}</span><span>Diferencia: {point.difference == null ? 'Sin dato' : point.difference + ' min'}</span><span>Multa: ${point.fine.toFixed(2)}</span></div>{Number.isFinite(point.lat) && Number.isFinite(point.lng) && (point.lat !== 0 || point.lng !== 0) && <a target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex gap-1 text-xs text-cyan-300" href={`https://www.openstreetmap.org/?mlat=${point.lat}&mlon=${point.lng}#map=15/${point.lat}/${point.lng}`}><MapPinned className="h-4 w-4" />Ver punto en mapa</a>}</div>)}</div>
    </div></div>, document.body)}
  </section>;
}

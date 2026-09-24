import React, { useState, useEffect, useMemo } from 'react';
import { Download, Search, Calendar, ChevronLeft, ChevronRight, Filter, Clock, AlertCircle } from 'lucide-react';

interface VueltasViewProps {
  onSelectVehicle?: (unitNumber: string) => void;
}

function formatFechaHora(row: any): string {
  const evento = row.tipoEvento || row.tipo || '';
  const punto = row.nombrePunto || 'geocerca';
  const llego = row.llego || row.hora || '';
  const fechaRaw = row.fecha || '';
  let fechaFmt = '';
  if (fechaRaw) {
    const d = new Date(fechaRaw);
    if (!isNaN(d.getTime())) {
      const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sept','oct','nov','dic'];
      const day = String(d.getDate()).padStart(2, '0');
      const mon = meses[d.getMonth()];
      const year = d.getFullYear();
      fechaFmt = `${day}-${mon}-${year}`;
    }
  }
  let horaFmt = '';
  if (llego && llego !== '00:00:00') {
    const parts = String(llego).split(':');
    if (parts.length >= 2) {
      let h = parseInt(parts[0], 10);
      const m = parts[1];
      const ampm = h >= 12 ? 'pm' : 'am';
      const h12 = h % 12 || 12;
      horaFmt = `${String(h12).padStart(2,'0')}:${m} ${ampm}`;
    }
  }
  const accion = evento === 'ENTRO' ? 'entró a' : evento === 'SALIO' ? 'salió de' : (evento || 'pasó por');
  if (horaFmt && fechaFmt) return `${accion} ${punto} a las ${horaFmt} con fecha ${fechaFmt}`;
  if (horaFmt) return `${accion} ${punto} a las ${horaFmt}`;
  if (fechaFmt) return `${accion} ${punto} con fecha ${fechaFmt}`;
  return `${accion} ${punto}`;
}

export const VueltasView: React.FC<VueltasViewProps> = () => {
  const [buses, setBuses] = useState<any[]>([]);
  const [rutas, setRutas] = useState<any[]>([]);
  const [data, setData] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [filters, setFilters] = useState({ bus: '', ruta: '', fechaDesde: '', fechaHasta: '', punto: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load buses and rutas for filters
  useEffect(() => {
    const token = (() => { try { const s = localStorage.getItem('csrs_auth'); if (s) return JSON.parse(s).token; } catch {} return null; })();
    const headers: Record<string, string> = token ? { Authorization: 'Bearer ' + token } : {};
    fetch('/api/v1/buses', { headers }).then(r => r.json()).then(j => {
      const arr = Array.isArray(j) ? j : j.result || j.data || [];
      setBuses(arr);
    }).catch(() => {});
    fetch('/api/v1/rutas', { headers }).then(r => r.json()).then(j => {
      const arr = Array.isArray(j) ? j : j.result || j.data || [];
      setRutas(arr);
    }).catch(() => {});
  }, []);

  const fetchVueltas = async (p = page) => {
    setIsLoading(true);
    setError(null);
    const token = (() => { try { const s = localStorage.getItem('csrs_auth'); if (s) return JSON.parse(s).token; } catch {} return null; })();
    const headers: Record<string, string> = token ? { Authorization: 'Bearer ' + token } : {};
    const params = new URLSearchParams({
      page: String(p),
      pageSize: String(pageSize),
      ...(filters.bus ? { bus: filters.bus } : {}),
      ...(filters.ruta ? { ruta: filters.ruta } : {}),
      ...(filters.fechaDesde ? { fechaDesde: filters.fechaDesde, dFrom: filters.fechaDesde } : {}),
      ...(filters.fechaHasta ? { fechaHasta: filters.fechaHasta, dTo: filters.fechaHasta } : {}),
      ...(filters.punto ? { punto: filters.punto } : {}),
    });
    try {
      const r = await fetch(`/api/v1/registrosvueltas/detalle?${params.toString()}`, { headers });
      const j = await r.json();
      if (j.data && Array.isArray(j.data)) {
        setData(j.data);
        setTotal(j.total || j.data.length);
      } else if (Array.isArray(j)) {
        setData(j);
        setTotal(j.length);
      } else if (j.result && Array.isArray(j.result)) {
        setData(j.result);
        setTotal(j.total || j.result.length);
      } else {
        setData([]);
        setTotal(0);
      }
    } catch (e: any) {
      setError(e.message);
      setData([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVueltas(1);
  }, [filters.bus, filters.ruta, filters.fechaDesde, filters.fechaHasta]);

  useEffect(() => {
    fetchVueltas(page);
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex-1 flex flex-col bg-[#000f20] overflow-hidden select-none pb-20 pt-16 px-3 sm:px-4 lg:px-6 max-w-7xl mx-auto w-full">
      <div className="mb-3 border-b border-[#293a50]/60 pb-3">
        <h1 className="text-xl font-bold text-white flex items-center space-x-2 font-mono">
          <Clock className="w-5 h-5 text-[#00d1ff]" />
          <span>Registro de Vueltas – Geocercas</span>
          <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-900/30 text-emerald-400 border border-emerald-700">{total} registros</span>
        </h1>
        <p className="text-xs text-slate-400 font-mono mt-0.5">Replica exacta de https://coopcariamanga.sytes.net/vueltas • Datos reales miritrans_data.registrosvueltas</p>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3 p-3 rounded-xl bg-[#011428] border border-[#293a50]">
        <div>
          <label className="text-[10px] font-mono text-slate-400 block mb-1">Bus No.</label>
          <select value={filters.bus} onChange={(e) => setFilters({ ...filters, bus: e.target.value })} className="w-full bg-slate-900 border border-[#293a50] rounded-lg px-2 py-1.5 text-xs text-white font-mono">
            <option value="">Todos</option>
            {buses.slice(0, 100).map((b: any) => (
              <option key={b.codigoBus || b.id} value={b.codigoBus}>
                {b.codigoBus} {b.placaCompleta ? `(${b.placaCompleta})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-mono text-slate-400 block mb-1">Ruta</label>
          <select value={filters.ruta} onChange={(e) => setFilters({ ...filters, ruta: e.target.value })} className="w-full bg-slate-900 border border-[#293a50] rounded-lg px-2 py-1.5 text-xs text-white font-mono">
            <option value="">Todas</option>
            {rutas.slice(0, 100).map((r: any) => (
              <option key={r.idRuta || r.id} value={r.nombreRuta}>
                {r.nombreRuta}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-mono text-slate-400 block mb-1">Desde</label>
          <input type="date" value={filters.fechaDesde} onChange={(e) => setFilters({ ...filters, fechaDesde: e.target.value })} className="w-full bg-slate-900 border border-[#293a50] rounded-lg px-2 py-1.5 text-xs text-white font-mono" />
        </div>
        <div>
          <label className="text-[10px] font-mono text-slate-400 block mb-1">Hasta</label>
          <input type="date" value={filters.fechaHasta} onChange={(e) => setFilters({ ...filters, fechaHasta: e.target.value })} className="w-full bg-slate-900 border border-[#293a50] rounded-lg px-2 py-1.5 text-xs text-white font-mono" />
        </div>
        <div className="flex items-end">
          <button onClick={() => fetchVueltas(1)} className="w-full flex items-center justify-center space-x-1 px-3 py-1.5 rounded-lg bg-[#00d1ff] hover:bg-[#4cd6ff] text-black font-mono font-bold text-xs transition-all">
            <Search className="w-4 h-4" />
            <span>Filtrar</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-2 p-2 rounded bg-amber-900/20 border border-amber-700 text-amber-300 text-xs font-mono flex items-center space-x-2">
          <AlertCircle className="w-4 h-4" />
          <span>Error: {error}</span>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto custom-scrollbar border border-[#293a50] rounded-xl bg-[#011428]">
        <table className="w-full text-xs font-mono">
          <thead className="sticky top-0 bg-[#000f20] text-slate-400 text-[10px] uppercase tracking-wider">
            <tr>
              <th className="px-2 py-2 text-left">Orden</th>
              <th className="px-2 py-2 text-left">Fecha</th>
              <th className="px-2 py-2 text-left">Punto Marca</th>
              <th className="px-2 py-2 text-left">Tiempo Fijo</th>
              <th className="px-2 py-2 text-left">Bus No.</th>
              <th className="px-2 py-2 text-left">Debe Llegar</th>
              <th className="px-2 py-2 text-left">Llego</th>
              <th className="px-2 py-2 text-left">Evento</th>
              <th className="px-2 py-2 text-left">Diferencia</th>
              <th className="px-2 py-2 text-left">Multa</th>
              <th className="px-2 py-2 text-left">Subtotal</th>
              <th className="px-2 py-2 text-left">#Vuelta</th>
              <th className="px-2 py-2 text-left">Ruta</th>
              <th className="px-2 py-2 text-left">Despacho</th>
              <th className="px-2 py-2 text-left">Usuario</th>
              <th className="px-2 py-2 text-left">Tipo</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={16} className="px-4 py-12 text-center text-slate-500">
                  Cargando registros reales...
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={16} className="px-4 py-12 text-center text-slate-500">
                  Sin registros para los filtros seleccionados
                </td>
              </tr>
            ) : (
              data.map((row: any, idx: number) => {
                const diff = parseInt(row.diferencia) || 0;
                const llegoNull = !row.llego || row.llego === '00:00:00';
                let rowClass = '';
                if (llegoNull) rowClass = 'bg-amber-900/10';
                else if (diff === 0) rowClass = 'bg-sky-900/10';
                else if (diff > 0) rowClass = 'bg-orange-900/10';
                else rowClass = 'bg-emerald-900/10';
                const detalleHora = formatFechaHora(row);
                return (
                  <tr key={row.idRegistro || idx} className={`border-t border-[#293a50]/30 hover:bg-slate-800/30 ${rowClass}`}>
                    <td className="px-2 py-1.5 text-slate-300">{row.orden ?? '-'}</td>
                    <td className="px-2 py-1.5 text-slate-300">
                      <div className="flex flex-col">
                        <span>{row.fecha ? new Date(row.fecha).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}</span>
                        <span className="text-[9px] text-slate-500">{detalleHora}</span>
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-white font-bold">{row.nombrePunto || '-'}</td>
                    <td className="px-2 py-1.5 text-slate-400">{row.tiempoFijo || row.tiempo || '-'}</td>
                    <td className="px-2 py-1.5 text-[#00d1ff] font-bold">{row.codigoBus || row.codigoCompleto || '-'}</td>
                    <td className="px-2 py-1.5 text-slate-300">{row.horaDebeLlegar || '-'}</td>
                    <td className="px-2 py-1.5 text-white">{row.llego || row.hora || '-'}</td>
                    <td className="px-2 py-1.5">
                      <div className="flex flex-col">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold w-fit ${row.tipoEvento === 'ENTRO' ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-700' : 'bg-orange-900/30 text-orange-400 border border-orange-700'}`}>
                          {row.tipoEvento || row.tipo || '-'}
                        </span>
                        <span className="text-[9px] text-slate-400 mt-0.5">{row.tipoEvento === 'ENTRO' ? 'entró a' : row.tipoEvento === 'SALIO' ? 'salió de' : ''} {row.nombrePunto}</span>
                      </div>
                    </td>
                    <td className={`px-2 py-1.5 font-bold ${diff > 0 ? 'text-orange-400' : diff < 0 ? 'text-emerald-400' : 'text-sky-400'}`}>{diff > 0 ? `+${diff}` : diff} min</td>
                    <td className="px-2 py-1.5 text-amber-400">{row.multa || '0.00'}</td>
                    <td className="px-2 py-1.5 text-slate-300">{row.subtotal || row.multa || '0.00'}</td>
                    <td className="px-2 py-1.5 text-white">{row.numeroVuelta || row.idVuelta || '-'}</td>
                    <td className="px-2 py-1.5 text-slate-400 truncate max-w-[120px]">{row.nombreRuta || '-'}</td>
                    <td className="px-2 py-1.5 text-slate-400">{row.fecha ? new Date(row.fecha).toLocaleDateString() : '-'}</td>
                    <td className="px-2 py-1.5 text-slate-400">{row.usuario || '-'}</td>
                    <td className="px-2 py-1.5 text-slate-400">{row.tipo || row.tipoDespacho || '-'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-3 p-2 rounded-xl bg-[#011428] border border-[#293a50] text-xs font-mono">
        <span className="text-slate-400">Mostrando {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} de {total} • Página {page}/{totalPages}</span>
        <div className="flex items-center space-x-1">
          <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-2 py-1 rounded bg-[#00d1ff] text-black font-bold">{page}</span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

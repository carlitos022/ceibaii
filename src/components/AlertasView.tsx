import React, { useState } from 'react';
import { AlertItem, Vehicle } from '../types';
import { AlertTriangle, ShieldAlert, CheckCircle2, MapPin, Eye, BellRing, Filter } from 'lucide-react';

interface AlertasViewProps {
  alerts: AlertItem[];
  onSelectVehicleByUnit: (unitNumber: string) => void;
  onResolveAlert: (alertId: string) => void;
}

export const AlertasView: React.FC<AlertasViewProps> = ({
  alerts,
  onSelectVehicleByUnit,
  onResolveAlert
}) => {
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [resolvedNotice, setResolvedNotice] = useState<string | null>(null);

  const filteredAlerts = alerts.filter(a => {
    if (filterSeverity === 'all') return true;
    return a.severity === filterSeverity;
  });

  const handleResolve = (id: string, title: string) => {
    onResolveAlert(id);
    setResolvedNotice(`Alerta marcada como resuelta`);
    setTimeout(() => setResolvedNotice(null), 3000);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#000f20] overflow-hidden select-none pb-20 pt-16 px-3 sm:px-4 lg:px-6 max-w-7xl mx-auto w-full">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-[#293a50]/60 pb-3">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center space-x-2 font-mono">
            <BellRing className="w-5 h-5 text-[#ffb300]" />
            <span>Centro de Alertas & Eventos ADAS/DSM</span>
          </h1>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Monitoreo de seguridad vial y notificaciones de telemetría en tiempo real
          </p>
        </div>

        {/* Severity Filter Tabs */}
        <div className="flex items-center space-x-1.5 bg-[#011428] p-1 rounded-lg border border-[#293a50]">
          <button
            onClick={() => setFilterSeverity('all')}
            className={`px-2.5 py-1 rounded text-xs font-mono transition-colors cursor-pointer ${
              filterSeverity === 'all'
                ? 'bg-[#00d1ff] text-black font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Todos ({alerts.length})
          </button>
          <button
            onClick={() => setFilterSeverity('critical')}
            className={`px-2.5 py-1 rounded text-xs font-mono transition-colors cursor-pointer ${
              filterSeverity === 'critical'
                ? 'bg-red-500 text-white font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Críticas ({alerts.filter(a => a.severity === 'critical').length})
          </button>
          <button
            onClick={() => setFilterSeverity('warning')}
            className={`px-2.5 py-1 rounded text-xs font-mono transition-colors cursor-pointer ${
              filterSeverity === 'warning'
                ? 'bg-amber-500 text-black font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Advertencias ({alerts.filter(a => a.severity === 'warning').length})
          </button>
        </div>
      </div>

      {resolvedNotice && (
        <div className="mb-3 p-2 bg-emerald-900/60 border border-emerald-500/50 rounded-lg text-xs font-mono text-emerald-300 flex items-center space-x-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{resolvedNotice}</span>
        </div>
      )}

      {/* Alerts List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2.5 pr-1">
        {filteredAlerts.map(alert => {
          let severityBadge = 'bg-amber-500/20 text-amber-400 border-amber-500/40';
          if (alert.severity === 'critical') {
            severityBadge = 'bg-red-500/20 text-red-400 border-red-500/40';
          } else if (alert.severity === 'info') {
            severityBadge = 'bg-[#00d1ff]/20 text-[#00d1ff] border-[#00d1ff]/40';
          }

          return (
            <div
              key={alert.id}
              className={`p-3.5 rounded-xl border transition-all ${
                alert.resolved
                  ? 'bg-slate-900/40 border-[#293a50]/40 opacity-60'
                  : alert.severity === 'critical'
                  ? 'bg-red-950/20 border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.1)]'
                  : 'bg-[#011428] border-[#293a50]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start space-x-3">
                  <div className="p-2 rounded-lg bg-slate-900 border border-[#293a50] mt-0.5">
                    {alert.severity === 'critical' ? (
                      <ShieldAlert className="w-5 h-5 text-red-400 animate-pulse" />
                    ) : (
                      <AlertTriangle className="w-5 h-5 text-[#ffb300]" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2 flex-wrap gap-1">
                      <span className="font-bold text-white font-mono text-sm">
                        {alert.unitNumber}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold border ${severityBadge}`}>
                        {alert.typeLabel}
                      </span>
                      {alert.resolved && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-800">
                          Resuelta
                        </span>
                      )}
                    </div>
                    <div className="text-slate-200 font-medium text-xs mt-1">
                      {alert.title}
                    </div>
                    <div className="text-slate-400 text-[11px] mt-0.5 font-sans">
                      {alert.description}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 mt-2 flex items-center space-x-3">
                      <span>Hora: {alert.timestamp}</span>
                      <span>Velocidad: {alert.speed} km/h</span>
                      {alert.geofenceName && <span>Geocerca: {alert.geofenceName}</span>}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col space-y-1.5 flex-shrink-0">
                  <button
                    onClick={() => onSelectVehicleByUnit(alert.unitNumber)}
                    className="flex items-center space-x-1 px-2.5 py-1.5 rounded bg-[#00d1ff]/10 hover:bg-[#00d1ff] hover:text-black border border-[#00d1ff]/30 text-[#00d1ff] text-[11px] font-mono transition-all cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Ubicar</span>
                  </button>

                  {!alert.resolved && (
                    <button
                      onClick={() => handleResolve(alert.id, alert.title)}
                      className="flex items-center space-x-1 px-2.5 py-1.5 rounded bg-emerald-500/10 hover:bg-emerald-500 hover:text-white border border-emerald-500/30 text-emerald-400 text-[11px] font-mono transition-all cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Atender</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {filteredAlerts.length === 0 && (
          <div className="text-center py-12 text-slate-500 font-mono text-xs">
            No hay alertas registradas con este filtro.
          </div>
        )}
      </div>
    </div>
  );
};

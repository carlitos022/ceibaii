import React, { useState, useEffect } from 'react';
import { X, Database, Server, CheckCircle2, AlertTriangle, RefreshCw, Cpu, BookOpen, LogOut } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onLogout }) => {
  const [healthData, setHealthData] = useState<any>(null);
  const [testingDb, setTestingDb] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  const fetchHealth = async () => {
    try {
      const res = await fetch('/api/health');
      const data = await res.json();
      setHealthData(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchHealth();
    }
  }, [isOpen]);

  const handleTestConnection = async () => {
    setTestingDb(true);
    try {
      const res = await fetch('/api/test-db', { method: 'POST' });
      const data = await res.json();
      setTestResult(data);
      await fetchHealth();
    } catch (e: any) {
      setTestResult({ success: false, error: e.message });
    } finally {
      setTestingDb(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm select-none">
      <div className="bg-[#000f20] border border-[#293a50] rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#293a50] bg-[#011428]">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#00d1ff]/10 border border-[#00d1ff]/30 flex items-center justify-center">
              <Server className="w-5 h-5 text-[#00d1ff]" />
            </div>
            <div>
              <h2 className="font-mono font-bold text-white text-base leading-tight">
                Configuración & Diagnóstico Ceiba II / MySQL
              </h2>
              <span className="text-[10px] text-slate-400 font-mono">
                Servidor Local Windows • CustomServiciosRS
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800/60 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto custom-scrollbar space-y-4 text-xs">
          {/* Status Indicator Card */}
          <div className="p-3.5 rounded-xl bg-[#011428] border border-[#293a50] flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-slate-900 border border-[#293a50]">
                <Database className="w-5 h-5 text-[#00d1ff]" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-white font-bold font-mono text-sm">Estado Base de Datos MySQL:</span>
                  {healthData?.database?.connected ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-800 font-bold">
                      CONECTADO A WINDOWS
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#00d1ff]/10 text-[#00d1ff] border border-[#00d1ff]/30 font-bold">
                      MODO SIMULACIÓN ACTIVO (REDUNDANTE)
                    </span>
                  )}
                </div>
                <div className="text-[11px] font-mono text-slate-400 mt-1">
                  Host: {healthData?.database?.host}:{healthData?.database?.port} • Base: {healthData?.database?.db}
                </div>
              </div>
            </div>

            <button
              onClick={handleTestConnection}
              disabled={testingDb}
              className="flex items-center space-x-1 px-3 py-2 rounded-lg bg-[#00d1ff] hover:bg-[#4cd6ff] text-black font-bold font-mono text-xs transition-all shadow-[0_0_12px_rgba(0,209,255,0.4)] cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testingDb ? 'animate-spin' : ''}`} />
              <span>{testingDb ? 'Probando...' : 'Probar Conexión'}</span>
            </button>
          </div>

          {/* Test Results */}
          {testResult && (
            <div className={`p-3 rounded-xl border font-mono text-xs ${
              testResult.success
                ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
                : 'bg-amber-950/40 border-amber-500/50 text-amber-300'
            }`}>
              <div className="flex items-center space-x-2 font-bold mb-1">
                {testResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-amber-400" />}
                <span>
                  {testResult.success ? 'Conexión a MySQL Exitosa' : 'Servidor MySQL Local No Encontrado'}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-1">
                {testResult.success
                  ? `Latencia: ${testResult.latencyMs}ms. Se detectaron tablas en la base de datos ${testResult.config.database}.`
                  : `Para conectar con tu servidor Ceiba II en Windows, asegúrate de configurar las variables en el archivo .env (MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE). Mientras tanto, el backend opera en modo simulación de alta fidelidad.`}
              </p>
            </div>
          )}

          {/* Ceiba II Gateway Config Info */}
          <div>
            <h3 className="text-[11px] font-mono uppercase tracking-wider text-slate-400 mb-2 flex items-center space-x-1.5">
              <Cpu className="w-4 h-4 text-[#00d1ff]" />
              <span>Puertos & Servicios Ceiba II / Streamax</span>
            </h3>
            <div className="bg-slate-900/80 p-3 rounded-lg border border-[#293a50]/60 space-y-2 font-mono text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-400">Gateway API HTTP (CMSV6):</span>
                <span className="text-white">Puerto 8080 (REST API)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Media Gateway (Video RTSP/FLV):</span>
                <span className="text-[#00d1ff]">Puerto 1078 / 6605</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Servidor MySQL (ceiba2_db):</span>
                <span className="text-emerald-400">Puerto 3306</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Protocolo Telemetría:</span>
                <span className="text-slate-200">JT/T 808 & JT/T 1078 MDVR</span>
              </div>
            </div>
          </div>

          {/* AI Agent Integration Guide Box */}
          <div className="p-3.5 rounded-xl bg-[#011428] border border-[#293a50] space-y-2">
            <div className="flex items-center space-x-2 text-[#00d1ff] font-mono font-bold">
              <BookOpen className="w-4 h-4" />
              <span>Documentación de Integración para el Agente IA</span>
            </div>
            <p className="text-slate-300 text-xs leading-relaxed">
              El archivo <span className="text-[#00d1ff] font-mono bg-slate-900 px-1 py-0.5 rounded">CEIBA_II_INTEGRATION.md</span> en la raíz del proyecto contiene el script SQL DDL completo de las tablas de MySQL y ejemplos en Python/Node.js para que tu agente IA automatice consultas de telemetría, alarmas ADAS/DSM y solicitudes de video.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#293a50] bg-[#011428] flex items-center justify-between gap-3">
          <button
            onClick={onLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-800/70 font-mono text-xs font-bold transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Salir / Cambiar usuario</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#00d1ff] hover:bg-[#4cd6ff] text-black font-mono text-xs font-bold transition-all shadow-[0_0_12px_rgba(0,209,255,0.4)] cursor-pointer"
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  );
};

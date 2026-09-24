import React, { useState, useEffect } from 'react';
import { Download, FileVideo, FileText, Map, CheckCircle2, Clock, AlertCircle, Eye, Film, Trash2 } from 'lucide-react';
import { VideoPreviewModal } from './VideoPreviewModal';

function getToken() {
  try {
    const s = localStorage.getItem('csrs_auth');
    if (s) return JSON.parse(s).token;
  } catch {}
  return null;
}
function authHeaders(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: 'Bearer ' + t } : {};
}

export const DescargasView: React.FC = () => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [previewFile, setPreviewFile] = useState<{ dir: string; name: string } | null>(null);

  const loadTasks = async () => {
    try {
      const r = await fetch('/api/download/tasks', { headers: { ...authHeaders() } });
      const j = await r.json();
      // 12058 returns {code:200, tasks: [...] } or {code:200, result: [...]} or direct array
      const arr = j.tasks || j.result || j.data || (Array.isArray(j) ? j : []);
      // Normalize to array of tasks with files
      // 12058 tasks have {queueId, taskId, deviceNo, carlicense, date, status, percent, files:[{name, dirBase64, size}], partialFiles}
      // Our fallback mock has {id, title, unitNumber, status, progress, size, downloadUrl}
      if (Array.isArray(arr)) {
        // Detect if it's the old mock (has id/title) vs new real (has queueId/taskId)
        if (arr.length > 0 && (arr[0] as any).queueId) {
          // Real 12058 tasks - keep as is
          setTasks(arr);
        } else if (arr.length > 0 && (arr[0] as any).id && (arr[0] as any).title) {
          // Mock tasks from ceiba2-web old
          setTasks(arr.map((j: any) => ({
            queueId: j.id,
            taskId: j.id,
            carlicense: j.unitNumber,
            deviceNo: j.unitNumber,
            status: j.status === 'completed' ? 'completed' : j.status === 'downloading' ? 'downloading' : 'queued',
            percent: j.progress || 0,
            statusText: j.status === 'completed' ? 'Completado' : j.status,
            files: j.downloadUrl ? [{ name: j.title, dirBase64: '', size: j.size, isMp4: true }] : [],
            createdAt: j.createdAt,
            title: j.title,
            downloadUrl: j.downloadUrl,
          })));
        } else {
          setTasks(arr);
        }
      }
    } catch (e) {
      console.error('loadTasks', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
    const id = setInterval(loadTasks, 3500);
    return () => clearInterval(id);
  }, []);

  const handleDownload = (dirBase64: string, name: string) => {
    const token = getToken();
    const url = `/api/download/file?dir=${encodeURIComponent(dirBase64)}&token=${encodeURIComponent(token || '')}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = name.endsWith('.mp4') ? name : name + '.mp4';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handlePlay = (dirBase64: string, name: string) => {
    setPreviewFile({ dir: dirBase64, name });
  };

  const handleDelete = async (queueId: string, taskId: string) => {
    if (!confirm('Eliminar esta tarea?')) return;
    try {
      await fetch('/api/download/task', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ queueId, taskId }),
      });
      loadTasks();
    } catch {}
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col bg-[#000f20] overflow-hidden select-none pb-20 pt-16 px-4 max-w-4xl mx-auto w-full">
        <div className="text-center py-12 text-slate-500 font-mono text-xs flex flex-col items-center space-y-2">
          <Clock className="w-6 h-6 animate-spin text-[#00d1ff]" />
          <span>Cargando cola real desde 12058...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#000f20] overflow-hidden select-none pb-20 pt-16 px-3 sm:px-4 max-w-4xl mx-auto w-full">
      <div className="mb-3 sm:mb-4 border-b border-[#293a50]/60 pb-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg sm:text-xl font-bold text-white flex items-center space-x-2 font-mono">
            <Download className="w-5 h-5 text-[#00d1ff]" />
            <span>Cola de Descargas – 12058 Real</span>
          </h1>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#00d1ff]/10 text-[#00d1ff] border border-[#00d1ff]/30">{tasks.length} Tareas</span>
        </div>
        <p className="text-xs text-slate-400 font-mono mt-1">Descargas reales desde C:/Video • Polling 3.5s • Estados: queued → downloading (ADS %) → completed (MP4 válido) • Replica exacta 12058</p>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2.5 pr-1">
        {tasks.map((t: any) => {
          const isCompleted = t.status === 'completed' || t.percent === 100;
          const isDownloading = t.status === 'downloading';
          const isQueued = t.status === 'queued' || t.status === 'retrying';
          const files: any[] = t.files || [];
          const partialFiles: any[] = t.partialFiles || [];
          const displayFiles = files.length > 0 ? files : partialFiles;
          const pct = t.percent || 0;
          let statusColor = 'text-slate-400';
          let statusText = t.statusText || t.status || 'En cola';
          if (isCompleted) {
            statusColor = 'text-emerald-400';
            statusText = '✅ Completado';
          } else if (isDownloading) {
            statusColor = 'text-[#00d1ff]';
            statusText = t.statusText || `⬇️ Descargando ${pct}%`;
          } else if (isQueued) {
            statusColor = 'text-amber-400';
            statusText = t.statusText || '⏳ En cola';
          }
          return (
            <div key={t.queueId || t.taskId || t.id} className="p-3 sm:p-3.5 rounded-xl bg-[#011428] border border-[#293a50] shadow-md flex flex-col space-y-2 hover:border-[#00d1ff]/40 transition-all">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-start space-x-3 min-w-0">
                  <div className="p-2 rounded-lg bg-slate-900 border border-[#293a50] text-[#00d1ff] mt-0.5 flex-shrink-0">
                    <FileVideo className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center space-x-2 flex-wrap gap-1">
                      <span className="font-bold text-white font-mono text-xs sm:text-sm truncate">{t.carlicense || t.deviceNo || t.unitNumber || '-'}</span>
                      <span className="text-[10px] font-mono uppercase text-slate-400 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">CH{t.channels?.join(',') || t.channel || '1'}</span>
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${isCompleted ? 'bg-emerald-900/30 text-emerald-400 border-emerald-700' : isDownloading ? 'bg-sky-900/30 text-sky-400 border-sky-700' : 'bg-amber-900/30 text-amber-400 border-amber-700'}`}>{pct}%</span>
                    </div>
                    <div className="text-slate-200 font-medium text-xs mt-0.5 truncate">{t.taskName || t.title || `${t.carlicense} ${t.date} ${t.startTime}-${t.endTime}`}</div>
                    <div className="text-[10px] font-mono text-slate-400 mt-1">
                      {t.date || ''} {t.startTime || ''}-{t.endTime || ''} • {t.deviceNo || ''} {t.dvrDeviceNo ? `(DVR ${t.dvrDeviceNo})` : ''} • Creado: {t.createdAt || t.created_at || ''}
                    </div>
                    <div className={`text-[11px] font-mono mt-1 ${statusColor}`}>{statusText}</div>
                  </div>
                </div>
                <div className="flex items-center space-x-1.5 flex-shrink-0 self-end sm:self-center">
                  {isCompleted && displayFiles.length > 0 ? (
                    <>
                      <button onClick={() => handlePlay(displayFiles[0].dirBase64, displayFiles[0].name)} className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-[#00d1ff]/15 hover:bg-[#00d1ff] hover:text-black border border-[#00d1ff]/40 text-[#00d1ff] text-xs font-mono font-bold cursor-pointer">
                        <Eye className="w-3.5 h-3.5" />
                        <span>Ver</span>
                      </button>
                      <button onClick={() => handleDownload(displayFiles[0].dirBase64, displayFiles[0].name)} className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500 hover:text-white border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold cursor-pointer">
                        <Download className="w-3.5 h-3.5" />
                        <span>Guardar</span>
                      </button>
                    </>
                  ) : isDownloading || isQueued ? (
                    <span className="flex items-center space-x-1 text-xs font-mono text-[#00d1ff] px-2 py-1 bg-slate-900 rounded border border-[#00d1ff]/30">
                      <Clock className="w-3.5 h-3.5 animate-spin" />
                      <span>{pct}%</span>
                    </span>
                  ) : null}
                  <button onClick={() => handleDelete(t.queueId, t.taskId)} className="p-1.5 rounded bg-red-900/20 hover:bg-red-800 text-red-400 border border-red-700 cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {(isDownloading || isQueued) && (
                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden mt-1">
                  <div className="bg-[#00d1ff] h-full transition-all duration-300" style={{ width: `${Math.max(5, pct)}%` }} />
                </div>
              )}
              {displayFiles.length > 1 && (
                <div className="mt-1 space-y-1">
                  {displayFiles.slice(0, 3).map((f: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between text-[11px] font-mono bg-slate-900/50 rounded px-2 py-1 border border-[#293a50]/50">
                      <span className="text-slate-300 truncate">{f.name} ({(f.size / 1024 / 1024).toFixed(1)} MB)</span>
                      <div className="flex items-center space-x-1">
                        <button onClick={() => handlePlay(f.dirBase64, f.name)} className="p-1 rounded bg-[#00d1ff]/10 hover:bg-[#00d1ff] hover:text-black text-[#00d1ff] cursor-pointer">
                          <Eye className="w-3 h-3" />
                        </button>
                        <button onClick={() => handleDownload(f.dirBase64, f.name)} className="p-1 rounded bg-emerald-500/10 hover:bg-emerald-500 hover:text-white text-emerald-400 cursor-pointer">
                          <Download className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {tasks.length === 0 && (
          <div className="text-center py-16 text-slate-500 font-mono text-xs flex flex-col items-center justify-center space-y-2">
            <Film className="w-8 h-8 text-slate-600" />
            <span>No hay descargas. Crea una desde Biblioteca → selecciona canales, fecha y rango → Descargar.</span>
          </div>
        )}
      </div>

      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#000f20] border border-[#293a50] rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-3 border-b border-[#293a50] bg-[#011428]">
              <span className="text-white font-mono font-bold text-sm truncate">{previewFile.name}</span>
              <button onClick={() => setPreviewFile(null)} className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-white">
                ✕
              </button>
            </div>
            <div className="relative bg-black aspect-video flex items-center justify-center">
              <video
                src={`/api/download/stream?dir=${encodeURIComponent(previewFile.dir)}&token=${encodeURIComponent(getToken() || '')}`}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            </div>
            <div className="p-3 flex justify-end">
              <button onClick={() => handleDownload(previewFile.dir, previewFile.name)} className="flex items-center space-x-1 px-4 py-2 rounded-lg bg-[#00d1ff] hover:bg-[#4cd6ff] text-black font-mono font-bold text-xs">
                <Download className="w-4 h-4" />
                <span>Guardar MP4</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
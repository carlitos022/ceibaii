export type CeibaGpsSnapshot = {
  AccState?: number;
  Altitude?: number;
  AmbientTemp?: number;
  DeviceTemp?: number;
  Direction?: number;
  DriverName?: string;
  EngineState?: number;
  EngineTemp?: number;
  GpsLat?: number;
  GpsLng?: number;
  GpsTime?: string;
  Humidity?: number;
  Location?: string;
  Mileage?: number;
  Oil?: number;
  RecordSpeed?: number;
  Speed?: number;
  State?: number;
  Temperature?: number;
  TerminalID: string;
  Time?: string;
};

export type CeibaStateSnapshot = {
  terid: string;
  time?: string;
  type?: number;
};

export function ceibaConfig() {
  const host = process.env.CEIBA_INTERNAL_HOST || '127.0.0.1';
  const webApiPort = Number(process.env.CEIBA_WEB_API_PORT || 12040);
  const javaApiPort = Number(process.env.CEIBA_WEB_API_JAVA_PORT || 12046);
  const wcmsPort = Number(process.env.CEIBA_WCMS_PORT || 12056);
  return {
    host,
    webApiPort,
    javaApiPort,
    wcmsPort,
    webApiBase: `http://${host}:${webApiPort}`,
    javaApiBase: `http://${host}:${javaApiPort}`,
    wcmsBase: `http://${host}:${wcmsPort}`
  };
}

async function postJson<T>(url: string, body: unknown, timeoutMs = 5000): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) throw new Error(`Ceiba API ${response.status} ${url}`);
  return await response.json() as T;
}

export async function getLastGpsByDevice(deviceIds: string[]): Promise<CeibaGpsSnapshot[]> {
  const ids = [...new Set(deviceIds.map(String).filter(Boolean))];
  if (!ids.length) return [];
  const { webApiBase } = ceibaConfig();
  const data = await postJson<unknown>(`${webApiBase}/gps/last`, { terminals: ids.join(',') });
  return Array.isArray(data) ? data as CeibaGpsSnapshot[] : [];
}

export async function getLastStateByDevice(deviceIds: string[]): Promise<CeibaStateSnapshot[]> {
  const ids = [...new Set(deviceIds.map(String).filter(Boolean))];
  if (!ids.length) return [];
  const { webApiBase } = ceibaConfig();
  const data = await postJson<any>(`${webApiBase}/logs/state/last`, { terminals: ids.join(',') });
  return Array.isArray(data?.data) ? data.data as CeibaStateSnapshot[] : [];
}

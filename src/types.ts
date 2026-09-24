export type TabType = 'vivo' | 'tracker' | 'biblioteca' | 'geocercas' | 'alertas' | 'descargas' | 'vueltas';

export type VehicleStatus = 'moving' | 'stopped' | 'offline' | 'online' | 'alarm';

export interface GpsTrackPoint {
  lat: number;
  lng: number;
  speed: number;
  timestamp: string;
  timeSeconds: number; // Seconds from midnight (0 - 86400)
  heading: number;
  altitude?: number;
  ignition?: boolean;
  alarm?: string;
  address?: string;
}

export interface EvidenceTrackData {
  unitNumber: string;
  plate: string;
  date: string;
  totalDistanceKm: number;
  maxSpeedKmH: number;
  avgSpeedKmH: number;
  drivingDurationHours: string;
  points: GpsTrackPoint[];
}

export interface VideoChannel {
  id: number;
  channelNumber: number;
  name: string;
  status: 'live' | 'buffering' | 'offline';
  resolution: string;
  fps: number;
  bitrate: string;
  streamUrl?: string;
  posterUrl?: string;
}

export interface Vehicle {
  id: string;
  unitNumber: string; // e.g. "03_LAA4015"
  plate: string;      // e.g. "LAA-4015"
  status: VehicleStatus;
  statusText: string; // e.g. "Moviendo - Loja → Catamayo"
  speed: number;      // km/h
  lat: number;
  lng: number;
  heading: number;    // degrees (0-360)
  route: string;      // e.g. "Loja → Catamayo"
  geofence: string;   // e.g. "Tt Terrestre Catamayo"
  lastUpdate: string; // e.g. "2026-08-18 21:51:16"
  relativeTime: string; // e.g. "hace 5 segundos"
  camerasOnline: string; // e.g. "4/4 Online"
  camerasCount: number;  // 4
  camerasTotal: number;  // 4
  driverName?: string;
  driverPhone?: string;
  ignition: boolean;
  mileageKm: number;
  fuelLevelPct: number;
  engineTempC: number;
  batteryVolts: number;
  altitudeMeters: number;
  satellites: number;
  simCard?: string;
  ipAddress?: string;
  mdvrId?: string;
  deviceModel?: string;
  channels: VideoChannel[];
  trail?: [number, number][]; // GPS recent breadcrumbs
}

export interface AlertItem {
  id: string;
  vehicleId: string;
  unitNumber: string;
  type: 'panic' | 'speeding' | 'geofence' | 'fatigue' | 'video_loss' | 'disconnect' | 'harsh_brake';
  typeLabel: string;
  title: string;
  description: string;
  timestamp: string;
  severity: 'critical' | 'warning' | 'info';
  lat: number;
  lng: number;
  speed: number;
  resolved: boolean;
  geofenceName?: string;
}

export interface Geofence {
  id: string;
  name: string;
  type: 'terminal' | 'station' | 'checkpoint' | 'forbidden' | 'corridor';
  typeLabel: string;
  coordinates: [number, number][];
  center: [number, number];
  radiusMeters?: number;
  speedLimitKmH?: number;
  activeUnitsCount: number;
  alertOnEntry: boolean;
  alertOnExit: boolean;
  color: string;
}

export interface LibraryRecord {
  id: string;
  vehicleId: string;
  unitNumber: string;
  channelNumber: number;
  channelName: string;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  durationFormatted: string;
  fileSizeMb: number;
  triggerType: 'continuous' | 'alarm' | 'manual';
  storageLocation: 'device' | 'server';
  thumbnailUrl?: string;
  videoUrl?: string;
}

export interface DownloadJob {
  id: string;
  title: string;
  unitNumber: string;
  type: 'video_mp4' | 'telemetry_csv' | 'track_kml' | 'event_report_pdf';
  status: 'pending' | 'downloading' | 'completed' | 'failed';
  progress: number; // 0 - 100
  size: string;
  createdAt: string;
  downloadUrl?: string;
}

export interface HistoricEvent {
  id: string;
  vehicleId: string;
  unitNumber: string;
  plate: string;
  eventType: string;
  title: string;
  description: string;
  timestamp: string;
  lat: number;
  lng: number;
  speed: number;
  source: 'gps' | 'ignition' | 'geofence' | 'signal' | 'route';
  meta?: string;
}

export interface CeibaServerConfig {
  mysqlHost: string;
  mysqlPort: number;
  mysqlUser: string;
  mysqlDatabase: string;
  ceibaServerIp: string;
  ceibaHttpPort: number;
  ceibaStreamPort: number;
  ceibaMediaPort: number;
  ceibaAccount: string;
  isConnected: boolean;
  dbStatus: 'connected' | 'simulated' | 'error';
  lastPingMs?: number;
  errorMessage?: string;
}

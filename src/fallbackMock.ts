import { Vehicle, AlertItem, Geofence, LibraryRecord, DownloadJob } from './types';

export const INITIAL_VEHICLES: Vehicle[] = [
  {
    id: 'unit-03',
    unitNumber: '03_LAA4015',
    plate: 'LAA-4015',
    status: 'moving',
    statusText: 'Moviendo - Loja → Catamayo',
    speed: 45,
    lat: -3.9928,
    lng: -79.2845,
    heading: 125,
    route: 'Loja → Catamayo',
    geofence: 'Tt Terrestre Catamayo',
    lastUpdate: '2026-08-18 21:51:16',
    relativeTime: 'hace 5 segundos',
    camerasOnline: '4/4 Online',
    camerasCount: 4,
    camerasTotal: 4,
    driverName: 'Carlos Mendoza S.',
    driverPhone: '+593 98 765 4321',
    ignition: true,
    mileageKm: 184520.4,
    fuelLevelPct: 78,
    engineTempC: 86,
    batteryVolts: 27.8,
    altitudeMeters: 1240,
    satellites: 14,
    simCard: '8959300284729104',
    ipAddress: '192.168.1.103',
    mdvrId: 'MDVR-CARIA-03',
    deviceModel: 'Streamax X5-H0804',
    channels: [
      {
        id: 1,
        channelNumber: 1,
        name: 'CH1 - Frontal / Vía',
        status: 'live',
        resolution: '1080P',
        fps: 25,
        bitrate: '2048 Kbps',
        streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        posterUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=640&q=80'
      },
      {
        id: 2,
        channelNumber: 2,
        name: 'CH2 - Cabina / Conductor',
        status: 'live',
        resolution: '1080P',
        fps: 25,
        bitrate: '1536 Kbps',
        streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
        posterUrl: 'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?auto=format&fit=crop&w=640&q=80'
      },
      {
        id: 3,
        channelNumber: 3,
        name: 'CH3 - Pasaje / Salón',
        status: 'live',
        resolution: '720P',
        fps: 20,
        bitrate: '1024 Kbps',
        streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
        posterUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=640&q=80'
      },
      {
        id: 4,
        channelNumber: 4,
        name: 'CH4 - Puerta Trasera / Retro',
        status: 'live',
        resolution: '720P',
        fps: 20,
        bitrate: '1024 Kbps',
        streamUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
        posterUrl: 'https://images.unsplash.com/photo-1494515843206-f3117d3f51b7?auto=format&fit=crop&w=640&q=80'
      }
    ],
    trail: [
      [-3.9901, -79.2780],
      [-3.9912, -79.2805],
      [-3.9920, -79.2828],
      [-3.9928, -79.2845]
    ]
  },
  {
    id: 'unit-09',
    unitNumber: '09_MAA5740',
    plate: 'MAA-5740',
    status: 'moving',
    statusText: 'Moviendo - Catamayo → Gonzanamá',
    speed: 32,
    lat: -4.0150,
    lng: -79.3100,
    heading: 210,
    route: 'Catamayo → Gonzanamá',
    geofence: 'Vía Catamayo - Cariamanga Km 12',
    lastUpdate: '2026-08-18 21:51:10',
    relativeTime: 'hace 11 segundos',
    camerasOnline: '4/4 Online',
    camerasCount: 4,
    camerasTotal: 4,
    driverName: 'Jorge Romero B.',
    driverPhone: '+593 99 123 4567',
    ignition: true,
    mileageKm: 210340.1,
    fuelLevelPct: 62,
    engineTempC: 84,
    batteryVolts: 27.6,
    altitudeMeters: 1420,
    satellites: 12,
    simCard: '8959300284729112',
    ipAddress: '192.168.1.109',
    mdvrId: 'MDVR-CARIA-09',
    deviceModel: 'Streamax X5-H0804',
    channels: [
      { id: 1, channelNumber: 1, name: 'CH1 - Frontal', status: 'live', resolution: '1080P', fps: 25, bitrate: '2048 Kbps' },
      { id: 2, channelNumber: 2, name: 'CH2 - Cabina', status: 'live', resolution: '1080P', fps: 25, bitrate: '1536 Kbps' },
      { id: 3, channelNumber: 3, name: 'CH3 - Pasaje', status: 'live', resolution: '720P', fps: 20, bitrate: '1024 Kbps' },
      { id: 4, channelNumber: 4, name: 'CH4 - Retro', status: 'live', resolution: '720P', fps: 20, bitrate: '1024 Kbps' }
    ]
  },
  {
    id: 'unit-01',
    unitNumber: '01_AAA2539',
    plate: 'AAA-2539',
    status: 'stopped',
    statusText: 'Detenido - 15 min',
    speed: 0,
    lat: -3.9850,
    lng: -79.2620,
    heading: 90,
    route: 'Terminal Loja',
    geofence: 'Tt Terrestre Loja',
    lastUpdate: '2026-08-18 21:51:02',
    relativeTime: 'hace 19 segundos',
    camerasOnline: '4/4 Online',
    camerasCount: 4,
    camerasTotal: 4,
    driverName: 'Manuel Aguirre',
    driverPhone: '+593 98 444 8899',
    ignition: true,
    mileageKm: 342110.8,
    fuelLevelPct: 89,
    engineTempC: 72,
    batteryVolts: 27.2,
    altitudeMeters: 2060,
    satellites: 15,
    simCard: '8959300284729101',
    ipAddress: '192.168.1.101',
    mdvrId: 'MDVR-CARIA-01',
    deviceModel: 'Streamax X5-H0804',
    channels: [
      { id: 1, channelNumber: 1, name: 'CH1 - Frontal', status: 'live', resolution: '1080P', fps: 25, bitrate: '2048 Kbps' },
      { id: 2, channelNumber: 2, name: 'CH2 - Cabina', status: 'live', resolution: '1080P', fps: 25, bitrate: '1536 Kbps' },
      { id: 3, channelNumber: 3, name: 'CH3 - Pasaje', status: 'live', resolution: '720P', fps: 20, bitrate: '1024 Kbps' },
      { id: 4, channelNumber: 4, name: 'CH4 - Retro', status: 'live', resolution: '720P', fps: 20, bitrate: '1024 Kbps' }
    ]
  },
  {
    id: 'unit-12',
    unitNumber: '12_LAA5021',
    plate: 'LAA-5021',
    status: 'online',
    statusText: 'En Línea - Idle',
    speed: 0,
    lat: -4.0320,
    lng: -79.3300,
    heading: 0,
    route: 'Terminal Cariamanga',
    geofence: 'Tt Terrestre Cariamanga',
    lastUpdate: '2026-08-18 21:50:40',
    relativeTime: 'hace 41 segundos',
    camerasOnline: '4/4 Online',
    camerasCount: 4,
    camerasTotal: 4,
    driverName: 'Luis Granda P.',
    driverPhone: '+593 99 876 5432',
    ignition: false,
    mileageKm: 98450.0,
    fuelLevelPct: 54,
    engineTempC: 45,
    batteryVolts: 26.8,
    altitudeMeters: 1950,
    satellites: 11,
    simCard: '8959300284729115',
    ipAddress: '192.168.1.112',
    mdvrId: 'MDVR-CARIA-12',
    deviceModel: 'Streamax X5-H0804',
    channels: [
      { id: 1, channelNumber: 1, name: 'CH1 - Frontal', status: 'live', resolution: '1080P', fps: 25, bitrate: '2048 Kbps' },
      { id: 2, channelNumber: 2, name: 'CH2 - Cabina', status: 'live', resolution: '1080P', fps: 25, bitrate: '1536 Kbps' },
      { id: 3, channelNumber: 3, name: 'CH3 - Pasaje', status: 'live', resolution: '720P', fps: 20, bitrate: '1024 Kbps' },
      { id: 4, channelNumber: 4, name: 'CH4 - Retro', status: 'live', resolution: '720P', fps: 20, bitrate: '1024 Kbps' }
    ]
  },
  {
    id: 'unit-07',
    unitNumber: '07_LAA3070',
    plate: 'LAA-3070',
    status: 'moving',
    statusText: 'En ruta - 65 km/h',
    speed: 65,
    lat: -3.9680,
    lng: -79.2450,
    heading: 45,
    route: 'Loja → Cuenca (Panamericana)',
    geofence: 'Corredor Troncal Sierra Sur',
    lastUpdate: '2026-08-18 21:51:12',
    relativeTime: 'hace 9 segundos',
    camerasOnline: '4/4 Online',
    camerasCount: 4,
    camerasTotal: 4,
    driverName: 'Edison Cueva',
    driverPhone: '+593 99 711 2233',
    ignition: true,
    mileageKm: 290120.3,
    fuelLevelPct: 83,
    engineTempC: 88,
    batteryVolts: 28.1,
    altitudeMeters: 2150,
    satellites: 16,
    simCard: '8959300284729107',
    ipAddress: '192.168.1.107',
    mdvrId: 'MDVR-CARIA-07',
    deviceModel: 'Streamax X5-H0804',
    channels: [
      { id: 1, channelNumber: 1, name: 'CH1 - Frontal', status: 'live', resolution: '1080P', fps: 25, bitrate: '2048 Kbps' },
      { id: 2, channelNumber: 2, name: 'CH2 - Cabina', status: 'live', resolution: '1080P', fps: 25, bitrate: '1536 Kbps' },
      { id: 3, channelNumber: 3, name: 'CH3 - Pasaje', status: 'live', resolution: '720P', fps: 20, bitrate: '1024 Kbps' },
      { id: 4, channelNumber: 4, name: 'CH4 - Retro', status: 'live', resolution: '720P', fps: 20, bitrate: '1024 Kbps' }
    ]
  },
  {
    id: 'unit-05',
    unitNumber: '05_LAA2286',
    plate: 'LAA-2286',
    status: 'offline',
    statusText: 'Apagado - 2 hrs',
    speed: 0,
    lat: -3.9880,
    lng: -79.2550,
    heading: 0,
    route: 'Talleres CoopCariamanga',
    geofence: 'Talleres Loja',
    lastUpdate: '2026-08-18 19:42:00',
    relativeTime: 'hace 2 horas',
    camerasOnline: '0/4 Offline',
    camerasCount: 0,
    camerasTotal: 4,
    driverName: 'Patricio Vega',
    driverPhone: '+593 98 333 4455',
    ignition: false,
    mileageKm: 412500.0,
    fuelLevelPct: 40,
    engineTempC: 24,
    batteryVolts: 24.5,
    altitudeMeters: 2060,
    satellites: 0,
    simCard: '8959300284729105',
    ipAddress: '192.168.1.105',
    mdvrId: 'MDVR-CARIA-05',
    deviceModel: 'Streamax X5-H0804',
    channels: [
      { id: 1, channelNumber: 1, name: 'CH1 - Frontal', status: 'offline', resolution: '1080P', fps: 0, bitrate: '0 Kbps' },
      { id: 2, channelNumber: 2, name: 'CH2 - Cabina', status: 'offline', resolution: '1080P', fps: 0, bitrate: '0 Kbps' },
      { id: 3, channelNumber: 3, name: 'CH3 - Pasaje', status: 'offline', resolution: '720P', fps: 0, bitrate: '0 Kbps' },
      { id: 4, channelNumber: 4, name: 'CH4 - Retro', status: 'offline', resolution: '720P', fps: 0, bitrate: '0 Kbps' }
    ]
  },
  {
    id: 'unit-06',
    unitNumber: '06_IAA2132',
    plate: 'IAA-2132',
    status: 'offline',
    statusText: 'Apagado - 5 hrs',
    speed: 0,
    lat: -4.3250,
    lng: -79.9450,
    heading: 0,
    route: 'Terminal Macará',
    geofence: 'Tt Terrestre Macará',
    lastUpdate: '2026-08-18 16:50:00',
    relativeTime: 'hace 5 horas',
    camerasOnline: '0/4 Offline',
    camerasCount: 0,
    camerasTotal: 4,
    driverName: 'Galo Sarmiento',
    driverPhone: '+593 99 555 6677',
    ignition: false,
    mileageKm: 388200.7,
    fuelLevelPct: 65,
    engineTempC: 22,
    batteryVolts: 24.8,
    altitudeMeters: 450,
    satellites: 0,
    simCard: '8959300284729106',
    ipAddress: '192.168.1.106',
    mdvrId: 'MDVR-CARIA-06',
    deviceModel: 'Streamax X5-H0804',
    channels: [
      { id: 1, channelNumber: 1, name: 'CH1 - Frontal', status: 'offline', resolution: '1080P', fps: 0, bitrate: '0 Kbps' },
      { id: 2, channelNumber: 2, name: 'CH2 - Cabina', status: 'offline', resolution: '1080P', fps: 0, bitrate: '0 Kbps' },
      { id: 3, channelNumber: 3, name: 'CH3 - Pasaje', status: 'offline', resolution: '720P', fps: 0, bitrate: '0 Kbps' },
      { id: 4, channelNumber: 4, name: 'CH4 - Retro', status: 'offline', resolution: '720P', fps: 0, bitrate: '0 Kbps' }
    ]
  },
  {
    id: 'unit-09-laa',
    unitNumber: '09_LAA1020',
    plate: 'LAA-1020',
    status: 'online',
    statusText: 'En Línea - Idle',
    speed: 0,
    lat: -4.1350,
    lng: -79.4300,
    heading: 0,
    route: 'Gonzanamá Centro',
    geofence: 'Parada Gonzanamá',
    lastUpdate: '2026-08-18 21:49:10',
    relativeTime: 'hace 2 minutos',
    camerasOnline: '4/4 Online',
    camerasCount: 4,
    camerasTotal: 4,
    driverName: 'Raul Jaramillo',
    driverPhone: '+593 99 222 3344',
    ignition: true,
    mileageKm: 145890.2,
    fuelLevelPct: 91,
    engineTempC: 75,
    batteryVolts: 27.4,
    altitudeMeters: 1980,
    satellites: 13,
    simCard: '8959300284729109',
    ipAddress: '192.168.1.119',
    mdvrId: 'MDVR-CARIA-09B',
    deviceModel: 'Streamax X5-H0804',
    channels: [
      { id: 1, channelNumber: 1, name: 'CH1 - Frontal', status: 'live', resolution: '1080P', fps: 25, bitrate: '2048 Kbps' },
      { id: 2, channelNumber: 2, name: 'CH2 - Cabina', status: 'live', resolution: '1080P', fps: 25, bitrate: '1536 Kbps' },
      { id: 3, channelNumber: 3, name: 'CH3 - Pasaje', status: 'live', resolution: '720P', fps: 20, bitrate: '1024 Kbps' },
      { id: 4, channelNumber: 4, name: 'CH4 - Retro', status: 'live', resolution: '720P', fps: 20, bitrate: '1024 Kbps' }
    ]
  }
];

export const INITIAL_GEOFENCES: Geofence[] = [
  {
    id: 'geo-1',
    name: 'Tt Terrestre Catamayo',
    type: 'terminal',
    typeLabel: 'Terminal Terrestre',
    coordinates: [
      [-3.9910, -79.2860],
      [-3.9910, -79.2830],
      [-3.9945, -79.2830],
      [-3.9945, -79.2860]
    ],
    center: [-3.9928, -79.2845],
    radiusMeters: 300,
    speedLimitKmH: 20,
    activeUnitsCount: 1,
    alertOnEntry: true,
    alertOnExit: true,
    color: '#00d1ff'
  },
  {
    id: 'geo-2',
    name: 'Tt Terrestre Loja',
    type: 'terminal',
    typeLabel: 'Terminal Terrestre Central',
    coordinates: [
      [-3.9830, -79.2640],
      [-3.9830, -79.2600],
      [-3.9870, -79.2600],
      [-3.9870, -79.2640]
    ],
    center: [-3.9850, -79.2620],
    radiusMeters: 400,
    speedLimitKmH: 15,
    activeUnitsCount: 2,
    alertOnEntry: true,
    alertOnExit: true,
    color: '#22c55e'
  },
  {
    id: 'geo-3',
    name: 'Tt Terrestre Cariamanga',
    type: 'terminal',
    typeLabel: 'Terminal Terrestre',
    coordinates: [
      [-4.0300, -79.3320],
      [-4.0300, -79.3280],
      [-4.0340, -79.3280],
      [-4.0340, -79.3320]
    ],
    center: [-4.0320, -79.3300],
    radiusMeters: 350,
    speedLimitKmH: 20,
    activeUnitsCount: 1,
    alertOnEntry: true,
    alertOnExit: true,
    color: '#fbbf24'
  },
  {
    id: 'geo-4',
    name: 'Corredor Vía Loja - Catamayo (Curvas Peligrosas)',
    type: 'checkpoint',
    typeLabel: 'Zona de Control de Velocidad',
    coordinates: [
      [-3.9800, -79.2700],
      [-3.9900, -79.2800],
      [-4.0000, -79.2900]
    ],
    center: [-3.9900, -79.2800],
    speedLimitKmH: 60,
    activeUnitsCount: 3,
    alertOnEntry: true,
    alertOnExit: false,
    color: '#ff8a00'
  }
];

export const INITIAL_ALERTS: AlertItem[] = [
  {
    id: 'alt-01',
    vehicleId: 'unit-03',
    unitNumber: '03_LAA4015',
    type: 'speeding',
    typeLabel: 'Exceso de Velocidad',
    title: 'Exceso de velocidad registrado: 82 km/h en zona 60 km/h',
    description: 'La unidad 03_LAA4015 superó el límite establecido en el corredor Vía Loja - Catamayo Km 14.',
    timestamp: '2026-08-18 21:44:20',
    severity: 'warning',
    lat: -3.9912,
    lng: -79.2810,
    speed: 82,
    resolved: false,
    geofenceName: 'Corredor Vía Loja - Catamayo'
  },
  {
    id: 'alt-02',
    vehicleId: 'unit-07',
    unitNumber: '07_LAA3070',
    type: 'geofence',
    typeLabel: 'Salida de Geocerca',
    title: 'Salida de Terminal Loja sin autorización de despacho',
    description: 'Unidad registró salida de Geocerca Terminal Terrestre Loja.',
    timestamp: '2026-08-18 21:30:10',
    severity: 'info',
    lat: -3.9850,
    lng: -79.2620,
    speed: 25,
    resolved: true,
    geofenceName: 'Tt Terrestre Loja'
  },
  {
    id: 'alt-03',
    vehicleId: 'unit-01',
    unitNumber: '01_AAA2539',
    type: 'fatigue',
    typeLabel: 'Alerta ADAS / DSM - Fatiga',
    title: 'Sensor DSM detectó bostezo prolongado (>3s)',
    description: 'Cámara DSM de cabina activó evento preventivo de somnolencia al operador.',
    timestamp: '2026-08-18 20:15:00',
    severity: 'critical',
    lat: -3.9850,
    lng: -79.2620,
    speed: 0,
    resolved: false
  },
  {
    id: 'alt-04',
    vehicleId: 'unit-09',
    unitNumber: '09_MAA5740',
    type: 'harsh_brake',
    typeLabel: 'Frenado Brusco',
    title: 'Desaceleración súbita detectada: -4.2 m/s²',
    description: 'Evento de seguridad vial registrado por el acelerómetro del MDVR.',
    timestamp: '2026-08-18 19:55:12',
    severity: 'warning',
    lat: -4.0150,
    lng: -79.3100,
    speed: 32,
    resolved: true
  }
];

export const INITIAL_LIBRARY: LibraryRecord[] = [
  {
    id: 'lib-01',
    vehicleId: 'unit-03',
    unitNumber: '03_LAA4015',
    channelNumber: 1,
    channelName: 'CH1 - Frontal / Vía',
    startTime: '2026-08-18 21:00:00',
    endTime: '2026-08-18 21:30:00',
    durationSeconds: 1800,
    durationFormatted: '30m 00s',
    fileSizeMb: 450.2,
    triggerType: 'continuous',
    storageLocation: 'device',
    thumbnailUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=300&q=80',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
  },
  {
    id: 'lib-02',
    vehicleId: 'unit-03',
    unitNumber: '03_LAA4015',
    channelNumber: 2,
    channelName: 'CH2 - Cabina / Conductor',
    startTime: '2026-08-18 21:00:00',
    endTime: '2026-08-18 21:30:00',
    durationSeconds: 1800,
    durationFormatted: '30m 00s',
    fileSizeMb: 380.0,
    triggerType: 'continuous',
    storageLocation: 'device',
    thumbnailUrl: 'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?auto=format&fit=crop&w=300&q=80',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4'
  },
  {
    id: 'lib-03',
    vehicleId: 'unit-03',
    unitNumber: '03_LAA4015',
    channelNumber: 1,
    channelName: 'CH1 - Frontal (Alarma Exceso Velocidad)',
    startTime: '2026-08-18 21:44:00',
    endTime: '2026-08-18 21:45:00',
    durationSeconds: 60,
    durationFormatted: '01m 00s',
    fileSizeMb: 18.5,
    triggerType: 'alarm',
    storageLocation: 'server',
    thumbnailUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=300&q=80',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
  },
  {
    id: 'lib-04',
    vehicleId: 'unit-07',
    unitNumber: '07_LAA3070',
    channelNumber: 1,
    channelName: 'CH1 - Frontal / Vía',
    startTime: '2026-08-18 20:00:00',
    endTime: '2026-08-18 20:45:00',
    durationSeconds: 2700,
    durationFormatted: '45m 00s',
    fileSizeMb: 620.0,
    triggerType: 'continuous',
    storageLocation: 'server',
    thumbnailUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=300&q=80',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
  }
];

export const INITIAL_DOWNLOADS: DownloadJob[] = [
  {
    id: 'dl-01',
    title: 'Video Clip CH1 Alarma Exceso Vel. 21:44:20',
    unitNumber: '03_LAA4015',
    type: 'video_mp4',
    status: 'completed',
    progress: 100,
    size: '18.5 MB',
    createdAt: '2026-08-18 21:46:00',
    downloadUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
  },
  {
    id: 'dl-02',
    title: 'Reporte Telemetría GPS 24 Horas (CSV)',
    unitNumber: '03_LAA4015',
    type: 'telemetry_csv',
    status: 'completed',
    progress: 100,
    size: '2.4 MB',
    createdAt: '2026-08-18 21:00:00',
    downloadUrl: '#'
  },
  {
    id: 'dl-03',
    title: 'Track de Ruta KML - Loja a Cariamanga',
    unitNumber: '03_LAA4015',
    type: 'track_kml',
    status: 'completed',
    progress: 100,
    size: '850 KB',
    createdAt: '2026-08-18 20:30:00',
    downloadUrl: '#'
  }
];

// Helper to generate EvidenceTracker route points along Loja - Catamayo - Cariamanga corridor
export function getGpsTrackHistory(unitNumber: string = '03_LAA4015', dateStr: string = '2026-08-18') {
  const baseLat = -3.9928;
  const baseLng = -79.2845;
  const totalWaypoints = 180;
  const points = [];

  // Start from 06:00 (21600s) to 20:00 (72000s)
  const startSecond = 6 * 3600; // 06:00:00
  const durationSec = 14 * 3600; // 14 hours

  for (let i = 0; i < totalWaypoints; i++) {
    const progress = i / (totalWaypoints - 1);
    const timeSec = Math.round(startSecond + progress * durationSec);
    const hours = Math.floor(timeSec / 3600);
    const minutes = Math.floor((timeSec % 3600) / 60);
    const seconds = timeSec % 60;
    const timeFormatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    // Realistic curve trajectory
    const latOffset = Math.sin(progress * Math.PI * 2.5) * 0.08 + (progress - 0.5) * 0.06;
    const lngOffset = Math.cos(progress * Math.PI * 2) * 0.09 + (progress - 0.5) * 0.08;

    // Speed curve with stops at stations
    let speed = Math.round(40 + Math.sin(progress * 12) * 35);
    let ignition = true;
    let alarm = undefined;

    if (i % 25 === 0) {
      speed = 0;
      ignition = false; // Stopped at bus terminal / checkpoint
    } else if (speed > 75) {
      alarm = 'Exceso de Velocidad (>70 km/h)';
    }

    points.push({
      lat: Number((baseLat + latOffset).toFixed(6)),
      lng: Number((baseLng + lngOffset).toFixed(6)),
      speed: Math.max(0, speed),
      timestamp: `${dateStr} ${timeFormatted}`,
      timeSeconds: timeSec,
      heading: Math.round((progress * 360 + 45) % 360),
      altitude: Math.round(1200 + Math.sin(progress * 5) * 200),
      ignition,
      alarm,
      address: i < 50 ? 'Av. Isidro Ayora, Catamayo' : i < 120 ? 'Vía Panamericana Sur E35' : 'Terminal Terrestre Cariamanga'
    });
  }

  return {
    unitNumber,
    plate: unitNumber.includes('_') ? unitNumber.split('_')[1] : 'LAA-4015',
    date: dateStr,
    totalDistanceKm: 142.6,
    maxSpeedKmH: 78,
    avgSpeedKmH: 46.2,
    drivingDurationHours: '06h 45m',
    points
  };
}
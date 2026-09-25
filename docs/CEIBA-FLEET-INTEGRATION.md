# Ceiba Fleet - Integracion Ceiba II

## Arquitectura

Ceiba Fleet es un modulo independiente que consume los servicios existentes de Ceiba II sin modificar los binarios ni los 42 servicios del CMS Server.

Flujo principal:

1. Login Ceiba Fleet valida la cuenta en MySQL wcms4.
2. El backend emite JWT propio de Ceiba Fleet.
3. Los permisos de dispositivos se verifican contra BaseDataServer.
4. El Monitor obtiene snapshot de flota y abre SSE.
5. El backend conecta al Socket.IO original de WCMS5 con didArray + key WCMS.
6. GPS, estados y alarmas se retransmiten al frontend en tiempo real.
7. El video en vivo se abre directamente contra WCMS5/media_service y se repara con CeibaLiveFlv.

## Puertos y servicios confirmados

- 3010: Ceiba Fleet (frontend PWA + API propia).
- 3307: MySQL wcms4.
- 12040: Ceiba II Web API interna.
- 12046: BaseDataServer / API Java v2.
- 12056: WCMS5 Node + Socket.IO + API de video.
- 12060: media_service FLV.
- 17891: TransmitServer usado por el flujo de video.

## Fuentes GPS y estado

### Snapshot GPS

POST http://127.0.0.1:12040/gps/last

Body:

    {"terminals":"DEVICE1,DEVICE2"}

Campos observados: TerminalID, GpsLat, GpsLng, GpsTime, Speed, Direction, Altitude, AccState, EngineState, EngineTemp, DeviceTemp, AmbientTemp, Humidity, Mileage, Oil, DriverName, Location y Time.

### Ultimo estado de conexion

POST http://127.0.0.1:12040/logs/state/last

Body:

    {"terminals":"DEVICE1,DEVICE2"}

## Permisos

POST http://127.0.0.1:12046/api/v2/basic/power/device

Ceiba Fleet envia un key WCMS y la lista de terminales. Las unidades que no pertenecen a la cuenta se eliminan en backend. El frontend nunca recibe unidades no autorizadas.

## Socket.IO tiempo real

Servidor:

    http://127.0.0.1:12056

Suscripciones confirmadas:

- sub_gps
- sub_state
- sub_alarm

Para clientes API se envia:

    {
      "didArray": ["TERMINAL_ID"],
      "key": "WCMS_KEY"
    }

Las alarmas agregan:

    "alarmType": []

El propio WCMS5 valida permisos de didArray antes de aceptar la suscripcion.

## API propia Ceiba Fleet

- POST /api/auth/login
- GET /api/auth/verify
- GET /api/monitor/vehicles
- GET /api/monitor/capabilities
- GET /api/monitor/vehicle/:id/detail?section=location|trip|day|sensor
- GET /api/monitor/vehicle/:id/video-stream/:channel
- GET /api/monitor/vehicle/:id/live/:channel
- GET /api/monitor/stream
- GET /api/health

## Streaming de video

Flujo:

    Ceiba Fleet -> WCMS5 :12056 -> media_service :12060 -> CeibaLiveFlv -> navegador/WebView

CeibaLiveFlv repara el contenedor FLV nativo sin transcodificar:
- tag AVC mal identificado,
- configuracion AAC ausente,
- timestamps AAC en cero.

Se comprobo video directo con cabecera FLV valida sin pasar por el proyecto ceiba2-web :3000.

## Fallback y resiliencia

- Fuente primaria en vivo: Socket.IO WCMS5.
- Snapshot periodico: getVehicles + fuentes existentes.
- Detalle GPS: /gps/last.
- Estado: /logs/state/last.
- LastGps.txt y ARMS siguen disponibles dentro de ceiba-service como respaldo de la flota.

## Android / PWA

- App ID: com.customserviciosrs.ceibafleet
- Capacitor 8.5.2
- minSdk 24
- compileSdk 36
- targetSdk 36
- Java 17
- Android SDK: C:\Android\sdk
- PWA: vite-plugin-pwa / Workbox.
- Service worker: autoUpdate.
- API nativa: VITE_NATIVE_API_BASE_URL.
- Para pruebas HTTP se permite cleartext/mixed content. En produccion se debe usar HTTPS y retirar esas excepciones.

## CORS

El backend permite los origenes nativos:
- https://localhost
- http://localhost
- capacitor://localhost

No se usa wildcard global para las APIs autenticadas.

## Archivos principales

- server.ts: autenticacion, permisos, API Monitor, SSE, video y CORS.
- server/ceiba-api.ts: configuracion y clientes HTTP internos.
- server/ceiba-service.ts: lectura/agregacion de flota y telemetria.
- server/live-flv.ts: reparacion FLV.
- src/api.ts: seleccion de API base web vs Android.
- src/Monitor.tsx: Monitor principal.
- src/OriginalLiveVideo.tsx: reproductor de canales.
- capacitor.config.ts: configuracion nativa.
- vite.config.ts: PWA/Workbox.
- .env.example: variables sin secretos.

## Seguridad

- .env no se versiona.
- reference/ contiene material de ingenieria inversa y no debe formar parte del build de produccion.
- Los permisos se aplican en backend, no solo en interfaz.
- Los streams requieren JWT y permiso sobre la unidad/canal.

# Vivo: GPS, mapa y contenedor Android

Fecha: 2026-09-24 (UTC). Host: vmi3396267 (Cariamanga).
Proyecto: C:\customserviciosrs\ceiba2-web. Alcance: esta web y su módulo Android.
Punto de partida: commit 2b34e3f (checkpoint anterior a los cambios).
Servicio: Ceiba2Web, puerto 3000. CMS Server y descargador 12058 fuera de alcance.

## Estado observado antes de editar
- Git limpio y sincronizado con origin/main; servicio Ceiba2Web activo.
- LastGps.txt: 55 entradas; 12 con menos de 2 minutos y 26 con menos de 10 minutos en una muestra puntual; el archivo tenía 41 segundos desde su última escritura.
- Backend: lee archivo GPS y consulta ARMS; SSE transmite la flota autorizada cada 2,5 s; frontend tiene sondeo de respaldo a 10 s.
- Marcadores Leaflet: animación de 2,2 s para cambio de posición; solo moving tenía pulso.

## Objetivo y límites
Estados y coordenadas fieles a muestras nuevas; pulso específico por estado; evitar bloqueos en backend y navegador.
Contenedor Android instalable y firmado sin publicar su clave privada.
No modificar servicios CMS, bases de datos ni proyectos ajenos al puerto 3000.

## Validación pendiente
Documentar cambios finales, compilación, prueba GPS/SSE, salud HTTP, APK y condiciones de firma.

## Cambios
- Backend GPS: una consulta menos a vehicledevice por ciclo; acceso O(1) al estado previo; el trail solo añade coordenadas nuevas.
- SSE: primer envío inmediato, siguientes envíos serializados cada 2,5 s y control de cola de escritura para clientes lentos.
- Frontend: sondeo de respaldo solo ante desconexión o silencio SSE superior a 10 s; marcadores solo cambian de posición cuando llegan coordenadas distintas y conservan el pulso entre reportes.
- Pulso por estado: en ruta (naranja, rápido), detenido (rojo), conectado sin GPS reciente (amarillo), sin conexión (gris tenue); respeta reducción de movimiento.
- Android: proyecto app propio con WebView, navegación restringida al origen configurado, video a pantalla completa, firma de release configurada por variables de entorno; minSdk 24 y targetSdk 35.

## Alcance de los datos en tiempo real
El SSE entrega cada 2,5 s el último reporte disponible; no obliga a los dispositivos GPS a transmitir más a menudo.
La muestra previa de 12 segundos produjo cero timestamps nuevos y cero posiciones cambiadas de 55 unidades del archivo GPS.
Un pulso indica estado, no implica que la ubicación se haya actualizado en ese instante.
Se conserva la hora real del reporte en la ficha de la unidad y no se inventan coordenadas.

## Android: custodia y transporte
La clave y contraseña de firma están fuera del repositorio, en C:\ceibaii-buildtools\signing.
La URL de la web se configura en android/gradle.properties; este APK apunta al puerto 3000 actual.
El origen actual usa HTTP sin cifrar. Antes de distribución pública habilitar HTTPS en la web y compilar una actualización con la misma clave.

## Comprobaciones realizadas
- npm run lint: sin errores.
- npm run build: compilación final correcta (Vite + esbuild).
- Gradle :app:assembleRelease: 44 tareas, BUILD SUCCESSFUL.
- apksigner verify: firma v2 válida, un firmante. SHA-256 APK: 104C192827D5D94EA33C6B5D515D6977740185D00E2FFB2013C44767C1B7E1AB.
- Prueba en dispositivo Android físico: pendiente de la validación manual del usuario.
- Tras reiniciar Ceiba2Web: / HTTP 200, /api/health ok con DB conectada; SSE anónimo HTTP 401 en 15 ms.
- Prueba SSE autenticada e instalación en teléfono: pendientes de sesión y dispositivo del usuario.

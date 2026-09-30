# CSRS N - Nacional

Web: https://nacionalx.ddns.net/app/
APK: https://nacionalx.ddns.net/app/updates/CSRS-N-v1.0.0.apk
Actualizaciones: https://nacionalx.ddns.net/app/updates/nacional.json

## Arquitectura

Compilar web y APK en Cariamanga. Nacional ejecuta solo el backend y los archivos compilados.
La web usa Ceiba2WebNacional en 127.0.0.1:3000. CSRSNHTTPS publica el dominio con HTTPS y redirige / a /app/.
El descargador original permanece en 12058. Su unica adicion es el middleware deployment/nacional-web-proxy.cjs montado en /app; sus rutas existentes, cola, propietarios y archivos siguen a cargo de su codigo original.

bootstrap.cjs lee en memoria la configuracion del CMS y el secreto de sesion del descargador instalado en Nacional. No copiar secretos de Cariamanga.
La base csrs_nacional contiene eventos y programaciones propios; las tablas del CMS se consultan sin modificarlas.
Biblioteca comparte los permisos y trabajos del descargador existente. Vivo, Recorrido, Rastreo, Despacho y canales consultan los permisos de /api/vehicles del descargador. Ante un error de permisos se bloquea la consulta.

Despacho usa el historial GPS y las geocercas propias de Nacional (46 al revisar), sin instalar Miratrans ni copiar datos de Cariamanga.
Los cruces se calculan a partir de coordenadas validas. Un inicio de historial o una interrupcion de mas de diez minutos no inventa entradas/salidas.
Los retrasos se calculan solo para controles programados: minutos de retraso redondeados hacia arriba por la tarifa configurada. No se crea una multa sin programacion.

## Compilacion web

npm ci
npm run lint
npm run test:nacional
npm run build

Copiar dist, bootstrap.cjs y deployment/runtime-package.json como package.json a una carpeta de ejecucion separada.
Instalar solo dependencias de ejecucion. Crear .env desde .env.example en Nacional; no contiene credenciales.
El servicio ejecuta el Node existente del descargador con bootstrap.cjs, directorio C:/customserviciosrs/nacional-web.

## APK

La fuente del contenedor Nacional esta en android-national/. Usa Capacitor 8.5.2.
Nombre: CSRS N. applicationId: ec.customserviciosrs.nacional. Version inicial: 1.0.0, codigo 1.
URL: https://nacionalx.ddns.net/app/?app=android.
Las descargas usan Android DownloadManager con cookies de la sesion, carpeta Downloads y notificaciones.
Las claves de firma y sus contrasenas quedan fuera de Git. Configurar CSRS_SIGNING_STORE y CSRS_SIGNING_PASSWORD_FILE en la maquina de compilacion.
La firma estable de produccion se comprueba al instalar actualizaciones, ademas del SHA256 del APK.

## Verificacion del despliegue

- TypeScript y tres pruebas de geometrias/cruces/permiso cerrado: correctos.
- HTTPS valido y web, APK, manifiesto y descargador original: HTTP 200.
- Dos cuentas reales con unidades disjuntas y administrador: unidades y canales identicos al descargador; consultas de unidades ajenas bloqueadas.
- Navegacion por las cinco pestanas en 390x844 y 1366x900: sin errores JavaScript. Ocultar/recuperar toda la cabecera en Recorrido movil: correcto.
- Cola sin trabajos activos durante la publicacion y hash conservado tras reiniciar el descargador.
- APK release compilado en Cariamanga y firma verificada.
- No se hizo una descarga nueva ni se cancelaron trabajos reales para las pruebas. No se ha probado la APK en un telefono fisico durante este despliegue.

## Respaldo

Copia del bootstrap original del descargador:
C:/customserviciosrs/backups/national-downloader-before-web-20260930/server.cjs

Para retirar solo la integracion web, restaurar ese archivo y reiniciar CeibaVideoDownloader cuando no haya trabajos activos.
No borrar datos, session-secret, cola, videos o configuraciones del CMS.

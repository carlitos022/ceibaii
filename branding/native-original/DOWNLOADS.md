# Pestaña Descargas en CSRS X v8

El descargador permanece en `C:\Program Files (x86)\CMS Server\CeibaWebDownloader`
y sirve `http://209.126.77.129:12058/`. No se modificó el servicio, su
puerto, los endpoints, la cola ni los archivos de su webapp.

La APK oculta Playback, Data Center y Setup de la barra, conserva sus
clases y recursos y añade Descargas. Los controles del mapa se dibujan en
Canvas para evitar fallos de fuentes o codificación.

Al entrar con la cuenta `admin`, la APK utiliza la cuenta activa del login
original, recupera sus credenciales guardadas o introducidas y llama al
endpoint existente `POST /api/auth/login` del descargador. Solo presenta la
pestaña cuando el servidor devuelve `rid=1`. La cookie del descargador
se coloca en el WebView y su propia API vuelve a validar cada petición.
El formulario HTML del descargador queda oculto dentro de esa pestaña.
El usuario necesita conectividad al descargador para que aparezca.

Los MP4 descargados desde WebView pasan al DownloadManager de Android.
La integración del acceso automático debe probarse con el admin real;
no se incluyeron credenciales en el APK ni en el repositorio. Como el
servicio utiliza HTTP, planificar HTTPS antes de distribuir esta APK a
usuarios fuera de la red administrada.

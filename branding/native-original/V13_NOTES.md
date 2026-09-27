# CSRS X v13 - Vivo como inicio y mapa web

- VersionCode `2025111112`, paquete `com.googlemap.ceibaii`. Firma: misma clave P12 de v10/v11/v12, guardada fuera de Git en `C:\ceibaii-buildtools\signing`.
- Monitor permanece en el codigo y en sus recursos, pero su boton queda oculto. Vivo se abre automaticamente despues del login CMS; Descargas conserva el acceso exclusivo de admin y su implementacion anterior.
- Al volver a Vivo desde Descargas, la WebView recarga `http://209.126.77.129:3000/?embed=vivo` y obtiene los cambios web publicados sin recompilar el APK.
- El mapa web tiene dos controles superiores derechos equivalentes a los nativos: Capas y Pantalla completa. En APK, `CSRSVivoNative.setMapFullscreen(boolean)` mueve la misma WebView a un dialogo Android de pantalla completa y al salir la devuelve al mismo lugar sin perder la sesion.
- La interfaz web incluye salida de pantalla completa mediante CSS cuando la API Fullscreen del navegador no funciona. El puente nativo expone solo la accion booleana de pantalla completa, sin tokens ni credenciales.
- Compilar con `build_v13.ps1`; despues de editar solo Java, usar `repack_v13.ps1` desde el premerge de v13. APK publicada en `http://209.126.77.129:3010/downloads/CSRS-X-v13-vivo-web.apk`.
- `csrs-x-version.json` mantiene `minimumVersionCode: 2025111107`. Probar mapa, capas, pantalla completa, regreso a Vivo y Descargas en un movil antes de exigir esta version.
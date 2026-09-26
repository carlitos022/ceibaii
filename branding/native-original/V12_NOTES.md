# CSRS X v12 - verificacion de Vivo

- El error de v11 era esperar el resultado de `fetch()` desde el callback sincrono de `WebView.evaluateJavascript`; el callback recibia el objeto Promise y mostraba un falso error de sesion.
- `CsrsVivoTabs.java` comprueba el JWT con `GET /api/auth/verify` por HTTP nativo despues de iniciar sesion con el usuario CMS. Al terminar la segunda carga WebView (`?embed=vivo&ready=1`) muestra Vivo.
- VersionCode `2025111111`, mismo paquete `com.googlemap.ceibaii` y mismo certificado de v10/v11. Se preservan Monitor y Descargas.
- Compilar con `build_v12.ps1`. Firma P12 y contrasena se leen de `C:\ceibaii-buildtools\signing` sin guardarse en Git. `repack_v12.ps1` solo reempaqueta desde el premerge v12.
- Publicacion `http://209.126.77.129:3010/downloads/CSRS-X-v12-vivo-fix.apk`. `csrs-x-version.json` mantiene `minimumVersionCode: 2025111107` hasta completar las pruebas visuales.
- La v11 y la v10 funcional permanecen respaldadas en `C:\customserviciosrs\ceiba-original-brand\functional-backups`.
# CSRS X v11 - Vivo

- APK versionCode: 2025111110. Paquete: com.googlemap.ceibaii.
- Se respaldo la APK v10 funcional en `C:\customserviciosrs\ceiba-original-brand\functional-backups\CSRS-X-v10-FUNCIONAL-2026-09-26.apk`.
- La pestaña Vivo abre `http://209.126.77.129:3000/?embed=vivo`, usa la cuenta CMS del inicio nativo e inicia sesion mediante `/api/auth/login`.
- El backend web filtra `/api/vehicles`, telemetria y video segun los permisos CMS de cada cuenta.
- No modificar la pestaña Descargas ni el servidor CMS por este cambio.
- Compilar con `build_v11.ps1` desde este directorio. Para repetir solo la fase de empaquetado usar `repack_v11.ps1`.
- APK publicada: `http://209.126.77.129:3010/downloads/CSRS-X-v11-vivo.apk`.
- El manifiesto remoto `dist/downloads/csrs-x-version.json` anuncia v11 sin subir la version minima obligatoria. Probar instalacion, login y video en un telefono antes de hacerla obligatoria.
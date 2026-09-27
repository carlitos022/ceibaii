# CSRS X Clean v1

Nueva linea independiente iniciada el 2026-09-27.

## Arquitectura
- Se conserva Splash e inicio de sesion nativo de CSRS X.
- Despues del login, la app abre CleanMainActivity: un unico contenedor WebView.
- URL del contenedor: http://209.126.77.129:3000/?app=android
- El modo Android de la web expone solo Vivo y Descargas.
- Descargas conserva la misma logica y usa los mismos endpoints /api/download/* de :3000, que proxyan sin cambios a 127.0.0.1:12058.
- CMS Server, HttpSdkService y el servicio 12058 no se modifican.
- El classes3 de v15 fue eliminado por completo.
- CsrsVivoTabs, CsrsDownloadsTabs y CsrsUpdateManager no existen en Clean v1.
- tab/view y tab/viewmodel nativos antiguos fueron eliminados de la nueva APK.
- El actualizador nativo de v15 no forma parte de Clean v1.
- El puente CSRSVivoNative se conserva solo para pantalla completa del mapa.
- Las descargas MP4 se entregan al DownloadManager de Android.

## Identidad Android
- Nombre de linea: CSRS X Clean v1
- versionName: 1.0.0
- versionCode: 1
- package: com.customserviciosrs.csrsx
- Firma: exclusiva e independiente de v15
- Alias: csrsx-clean
- La nueva APK puede convivir instalada junto a v15.

## Firma Clean v1
- Keystore seguro: C:\ceibaii-buildtools\signing-csrsx-clean\csrsx-clean-release.p12
- Password seguro: C:\ceibaii-buildtools\signing-csrsx-clean\csrsx-clean-password.txt
- No copiar ni publicar la contrasena.
- SHA-256 certificado: 7B:E8:D4:CD:42:35:0A:65:41:05:EB:5B:04:76:5C:DF:8A:48:D9:51:14:40:4E:84:38:8F:C1:6A:59:C0:49:8B

## v15 congelada
- APK estable: C:\customserviciosrs\ceiba-original-brand\functional-backups\CSRS-X-v15-STABLE\CSRS-X-v15-vivo-web.apk
- SHA-256 v15: 15B5B07CEF2F6648AD8FC9D258AF548B5D476CBAD861AFD7E6F94CB7CD39B616
- Recuperacion: RECOVERY-v15.txt dentro del respaldo.
- Firma original v15: C:\ceibaii-buildtools\signing
- Clean v1 no usa ni modifica esa firma.

## Fuentes
- Clean v1: branding/native-clean-v1
- Web Android mode (GitHub main): commit 9bff0ed2249addb1b994aa6cdecfc288c73fc641
- v15 fleet tag: v15-stable-20260926
- v15 web tag: v15-web-stable-20260926

## Salida
- APK publicada: C:\customserviciosrs\ceiba-fleet\dist\downloads\CSRS-X-Clean-v1.apk
- URL: http://209.126.77.129:3010/downloads/CSRS-X-Clean-v1.apk
- SHA-256 APK final: DDA908CC29D51F1D11D9CCC12CCD768A166DAE30B5C591A3E016E2AD6829F697

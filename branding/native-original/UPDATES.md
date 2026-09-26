# Actualizaciones de CSRS X

El APK se distribuye desde `http://209.126.77.129:3010/downloads/` y consulta
`csrs-x-version.json` al abrir una actividad después de la animación.
El archivo indica `latestVersionCode`, `minimumVersionCode`, `apkUrl`,
`packageName` y el SHA-256 del APK firmado.

Una instalación con código inferior a `minimumVersionCode` muestra actualización
obligatoria. Si el usuario cancela, se cierra la aplicación. La descarga muestra
progreso; antes de instalar se comprueban SHA-256, paquete, código de versión y
firma frente a la aplicación instalada. Android exige autorización para instalar
APKs de esta fuente y confirma la instalación con su propia pantalla.

Para publicar una versión nueva, reconstruir y firmar con la misma clave de
producción, verificar con `apksigner verify` y `aapt dump badging`, y ejecutar:

```powershell
python branding/native-original/publish_version.py C:\ruta\CSRS-X-v8.apk C:\customserviciosrs\ceiba-fleet\dist\downloads 2025111107 2025111107
```

El último argumento es el código mínimo admitido: usar uno inferior permite
continuar con versiones anteriores; igualarlo al código recién publicado fuerza
la actualización. Publicar solo APKs probados y conservar el mismo packageName
`com.googlemap.ceibaii` y certificado de firma. La v6 no incorpora el cliente
actualizador: instalar v7 manualmente al menos una vez.

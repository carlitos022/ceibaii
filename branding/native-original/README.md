# CEIBA II original: diseño CustomServiciosRS

Este directorio reproduce la personalización de una copia propia de `CEIBA II.apk` 3.3.0. El login, GPS, Live y panel lateral siguen en el código de la aplicación original. No publicar en GitHub el APK original, archivos descompilados, claves ni contraseñas.

## Compilar en Windows

1. Decodificar con Apktool 3.0.3 **sin `-s`**: `java -jar apktool_3.0.3.jar d -f "CEIBA II.apk" -o decoded`.
2. Establecer temporalmente `CSRS_GOOGLE_MAPS_KEY` en el entorno del proceso; ejecutar `python apply_v2.py decoded C:\customserviciosrs\logos\ceiba_logo_animado.svg`. El script genera el arte y aplica ajustes puntuales a recursos y smali.
3. Compilar `CsrsAnimatedLogo.java` y `CsrsMapControls.java` con `javac -source 8 -target 8 -classpath <android.jar> -d helper-classes`; convertir las clases a dex con `d8 --min-api 24 --lib <android.jar> --output helper-dex <archivos .class>`.
4. Reconstruir con `java -jar apktool_3.0.3.jar b decoded -o premerge.apk`; después `python merge_helper_dex.py premerge.apk helper-dex\classes.dex unsigned.apk`.
5. Alinear y firmar con la clave privada existente de CustomServiciosRS; verificar `apksigner verify --verbose` y `aapt dump badging`. No subir la APK ni la clave privada al repositorio público.

La pantalla previa de CEIBA II se reemplaza por el fondo de marca. El logotipo C se reproduce desde el SVG proporcionado en la entrada y el login; la entrada dura 3,1 segundos. En Monitor, los controles discretos añaden selector `NORMAL`/`HYBRID` y pantalla completa moviendo la **misma vista del mapa**, con sus marcadores. El login y sus tres campos permanecen intactos.

El paquete sigue siendo `com.googlemap.ceibaii`, firmado por CustomServiciosRS. Google Maps puede requerir autorizar ese paquete y el SHA-1 de esta firma en el proyecto de Google Cloud, con Maps SDK for Android habilitado y facturación configurada. Una clave web restringida por referente HTTP no sustituye a una clave Android autorizada. Solo una prueba real en dispositivo confirmará las teselas y los controles. Conserva la APK anterior como respaldo hasta validar el resultado.

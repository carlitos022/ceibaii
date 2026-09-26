# CEIBA II original: marca CustomServiciosRS

La versión actual se construye sobre una copia legítima de `CEIBA II.apk` 3.3.0. Conserva el login nativo, Monitor, GPS, Live y panel lateral. El primer fondo y la animación nativa usan el mismo primer fotograma, y el símbolo de la empresa permanece visible durante toda la entrada y el login.

## Compilar en Windows

1. Decodificar con Apktool 3.0.3 sin `-s`: `java -jar apktool_3.0.3.jar d -f "CEIBA II.apk" -o decoded`.
2. Definir `CSRS_GOOGLE_MAPS_KEY` privadamente en el entorno del proceso; ejecutar `python apply_v3.py decoded`. Este script llama a `brand_original.py`, `brand_v2.py` y `brand_frames.py`; además aplica los cambios puntuales a recursos y smali. Requiere Pillow y fuentes de Windows.
3. Compilar **solo** `CsrsMapControls.java` con `javac -source 8 -target 8 -classpath <android.jar> -d helper-classes`; convertir esas clases a dex con `d8 --min-api 24 --lib <android.jar> --output helper-dex <archivos .class>`.
4. Reconstruir con `java -jar apktool_3.0.3.jar b decoded -o premerge.apk`; después `python merge_helper_dex.py premerge.apk helper-dex\classes.dex unsigned.apk`.
5. Alinear y firmar con la clave privada de CustomServiciosRS; verificar `apksigner verify --verbose`, `aapt dump badging` y los archivos del ZIP. No subir la APK original, el código descompilado ni credenciales al repositorio.

La animación v3 consta de 24 fotogramas de 125 ms renderizados sobre las curvas del SVG de la marca y termina con el logo completo. Evita depender del SVG en una vista web; la versión anterior `apply_v2.py` se conserva como referencia histórica. El código de los campos de acceso y del Monitor no cambia respecto a v2; el selector de capas y pantalla completa reutilizan la instancia nativa del mapa.

El paquete continúa como `com.googlemap.ceibaii` y v3 sube su `versionCode` a `2025111102` para actualizar la prueba anterior. Google Maps requiere que la clave permita el paquete y el SHA-1 de la firma, además de Maps SDK for Android habilitado. La imagen del mapa y la animación aún requieren comprobación en un teléfono real.

## Version v5: entrada y logo de CEIBA X 0.8

Decodificar por separado `C:\customserviciosrs\versiones\Ceiba2-CustomServiciosRS-0.8.apk` con `apktool d -s` en una carpeta temporal. Sobre un decode limpio de CEIBA II aplicar `apply_v4.py` con `CSRS_GOOGLE_MAPS_KEY` definido localmente, y luego `python apply_v5.py CURRENT_DECODE DECODE_0_8`. Este paso copia exactamente el HTML/SVG del splash 0.8, el icono de la app y su imagen de logo, y añade la marca al encabezado del login actual. Desactiva los fotogramas v4; conserva los campos, Monitor y controles del mapa. Sube `versionCode` a `2025111104`. No subir la APK, el decode, las claves o la contraseña al repositorio.

La firma de la v4 (`5A:45:63:A2:F3:A2:60:49:F8:3F:5C:1C:34:66:EC:28:46:8D:06:E0`) permite actualizar esa versión con la misma clave local. La 0.8 (`B8:01:...`) es otro paquete y otra firma. El splash debe probarse en un teléfono real antes de declararlo idéntico a la 0.8.

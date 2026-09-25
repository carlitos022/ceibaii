# CEIBA II original: recursos CustomServiciosRS

Este script aplica imagen de marca a una copia decodificada de la APK original de CEIBA II. No cambia `classes.dex`, `classes2.dex`, la autenticación, los tres campos del login ni el Monitor. No se publica el código descompilado ni la APK de terceros en Git.

## Construcción de prueba en el VPS

1. Partir de una copia legítima de `CEIBA II.apk` y decodificar con Apktool 3.0.3: `java -jar apktool_3.0.3.jar d -s -f "CEIBA II.apk" -o decoded`.
2. Ejecutar `python brand_original.py decoded` (requiere Pillow y fuentes de Windows).
3. Compilar: `java -jar apktool_3.0.3.jar b decoded -o unsigned.apk`.
4. Alinear y firmar con la clave privada de CustomServiciosRS mediante el script privado `SIGN-CEIBA2-RELEASE.ps1`. Nunca subir la clave ni contraseñas.
5. Verificar con `apksigner verify --verbose` y comparar los SHA-256 de cada `classes*.dex` entre APK original y resultado.

La APK conserva el identificador `com.googlemap.ceibaii` y la versión 3.3.0; una instalación oficial firmada por otro editor tendrá que desinstalarse antes de esta prueba. Guardar antes los datos locales que sean necesarios. La firma nueva puede afectar servicios con restricciones por certificado, en especial Google Maps o notificaciones; validar en un dispositivo real antes de distribuir como versión final. La entrada usa el fundido nativo de 1 segundo con el arte de CustomServiciosRS; no incluye la animación vectorial exacta del sitio web.

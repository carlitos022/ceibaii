# CEIBA II Vivo para Android

WebView nativo que abre la pestaña Vivo del servidor definido en `CEIBA_WEB_URL`.
Compilar: `gradle :app:assembleRelease` con Android SDK, JDK 17 y Gradle 8.14.
Firma: establecer `CEIBA_SIGNING_STORE_FILE`, `CEIBA_SIGNING_STORE_PASSWORD`,
`CEIBA_SIGNING_KEY_ALIAS` y `CEIBA_SIGNING_KEY_PASSWORD` fuera de Git.
Se necesita la misma clave privada para instalar versiones posteriores encima de esta.
La URL actual usa HTTP y transporta credenciales sin cifrar: habilitar HTTPS
en esta web antes de distribución pública y actualizar `CEIBA_WEB_URL`.

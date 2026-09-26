# CSRS X v9

Version code: `2025111108`. App, CMS y ruta CeibaWebDownloader intactos.
Se corrigio el orden de carga del WebView: el formulario HTML de login no
se elimina mientras la webapp consulta `/api/auth/verify`. La APK comprueba
la sesion, muestra un error con reintento si la pagina no responde y conserva
la autenticacion del descargador para todas sus llamadas.

Los botones del mapa son vistas tactiles de 52 dp con iconos Canvas centrados.
La barra inferior mide 68 dp para evitar recortar iconos o nombres en movil.
Los textos nuevos del mapa, el login y el actualizador usan ASCII en espanol
para evitar mojibake en equipos con codificacion de Java distinta a UTF-8.

El ZIP, las firmas v2/v3 y el certificado de produccion se verificaron. Sin
un movil o emulador conectado no se pudo validar visualmente la interfaz
ni ejecutar el inicio de sesion admin dentro del WebView.

La v9 esta publicada como ultima version, pero el minimo sigue siendo v8
(`2025111107`). Instalar v9 manualmente para comprobarla. Tras validar
en el telefono, se puede elevar `minimumVersionCode` a `2025111108`
en `dist/downloads/csrs-x-version.json`, sin recompilar.

Google Play Protect puede recomendar analizar una APK descargada fuera de
Play. El paquete `com.googlemap.ceibaii` ya existe en Google Play bajo
otro publicador, y la clave actual no concede control de esa ficha. Para
distribucion privada mediante Play se necesita transferencia/autorizacion
del titular o migrar de forma planificada a un identificador propio.
No se debe desactivar Play Protect como solucion.


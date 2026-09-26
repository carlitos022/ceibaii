# CSRS X v10 (2025111109)

Se inicia el mapa en Ecuador (-1.8312, -78.1834), zoom 6. El
centro se aplica al terminar la preparacion del mapa nativo y las
acciones posteriores sobre unidades siguen usando el codigo original.

Descargas usa el token de sesion que devuelve el mismo inicio de sesion
admin verificado por el backend original. La cookie se instala en el
WebView antes de cargar la pagina. Se espera a que la web termine su
propia verificacion y solo entonces se muestra el panel de reintento
si no aparecio el espacio de trabajo. Al volver a Monitor se retiran
tanto el panel de error como el WebView visible. No se toco
CeibaWebDownloader, el CMS ni las rutas y endpoints.

APK firmada: CSRS-X-v10-ecuador-descargas.apk. La firma v2/v3,
el mismo certificado SHA-1 de v9, el ZIP y la version se verificaron.
SHA-256: 2ae21a07cc8435be758747c01867bc75dda068861cd46ee2f91490f83724cf74.
Se publico como ultima version, con minimumVersionCode 2025111107
para conservar la actualizacion voluntaria mientras se prueba en movil.
No hay dispositivo Android enlazado al servidor: apertura real de la
sesion de Descargas y posicion visual del mapa pendientes de prueba.
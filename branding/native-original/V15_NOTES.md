# CSRS X v15: ocultar cajon Fleet original

- VersionCode 2025111114; paquete com.googlemap.ceibaii; misma clave P12 que v14.
- El cajon Fleet de MainActivity (drawer_layout) se bloquea y se cierra cuando la interfaz Vivo esta activa.
- apply_v15.py protege la apertura diferida y los eventos de desbloqueo de MainActivity; conserva el codigo original para poder recuperar Monitor mas adelante.
- El panel web Flota de Unidades sigue funcionando dentro de Vivo y el menu de Descargas no cambia.
- La interfaz web publicada con colores compatibles y centro inicial de Ecuador se actualiza sin compilar otra APK.
- Compilar con build_v15.ps1. minimumVersionCode 2025111107 mantiene la actualizacion opcional hasta prueba manual.
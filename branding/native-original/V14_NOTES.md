# CSRS X v14: Vivo y Descargas

- VersionCode 2025111113; mismo paquete y clave de firma P12 que v13.
- El mapa web, sus iconos de capas y pantalla completa, endpoints y configuraciones no cambian.
- CsrsVivoTabs oculta cualquier pestana nativa heredada detectada en la barra; Monitor sigue disponible en el codigo.
- Vivo y Descargas son las unicas pestanas visibles; Descargas mantiene sus permisos de admin y el codigo intacto.
- El HTML web espera la hoja de estilos antes de mostrar Vivo para evitar el panel temporal sin colores.
- Compilar con build_v14.ps1 desde el respaldo decoded-v2; apply_v14.py incrementa versionCode desde v13.
- La actualizacion conserva minimumVersionCode 2025111107 para probar la APK manualmente antes de hacerla obligatoria.
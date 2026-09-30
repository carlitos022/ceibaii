# Replica en VPS Nacional

Revision: 2026-09-30 UTC. Esta rama es una copia del codigo de Cariamanga en produccion, sin su historial local ni credenciales. La aplicacion de Nacional todavia no se ha desplegado.

## Evidencia de Nacional
- Windows Server 2016, 4 GiB de RAM y 4 CPU logicas.
- Las 42 entradas de services_name.txt aparecen Running. No equivale a una prueba funcional de cada componente.
- CeibaVideoDownloader responde HTTP 200 y /api/health informa CMS local, version 5.0.0-sd, SD 12047 y ADS 12046.
- El servicio ejecuta server.js, que carga rebuild/server.cjs. No reemplazarlo.
- Node existente: v22.23.1. La cola tenia cero trabajos activos y pendientes durante la revision.

## Permisos que deben conservarse
Nacional obtiene las unidades permitidas de grouppower por RoleID y GroupID. Solo role 1 ve toda la flota. channelpower excluye canales. Los trabajos y archivos de la cola se limitan al uid propietario o al administrador.
Cariamanga usa /api/v2/basic/power/device para visibilidad y restringe Biblioteca al administrador. No copiar esas decisiones a Nacional sin adaptar y probar: el endpoint nativo vehicle/list puede devolver toda la flota.
La replica debe usar el mismo filtro grouppower para Vivo, Rastreo, Recorrido, Despacho y video; validar siempre en servidor, no solo ocultar unidades en interfaz. Biblioteca debe delegar en el descargador existente y sus sesiones sd_session, conservando propietarios, colas y archivos.

## Despliegue de bajo consumo
1. Compilar web en Cariamanga, un PC o CI: npm ci, npm run lint, npm run build. No ejecutar clean en produccion: elimina dist.
2. Transferir dist y un manifiesto con dependencias de ejecucion. Ejecutar en Nacional con NODE_ENV=production. El backend actual importa Vite en su ruta de desarrollo, por lo que su paquete debe estar disponible hasta separar ese import.
3. Crear una carpeta y servicio propios para la web en 3000. No sustituir CeibaVideoDownloader ni modificar servicios CMS.
4. Crear .env local con la configuracion de CMS Nacional. No copiar contrasenas, JWT, session-secret, datos, videos ni claves de firma de Cariamanga. Mantener 12058 y sus archivos intactos.
5. Publicar mediante un dominio HTTPS propio. La cookie del proxy actual es Secure y no funcionara correctamente entrando por HTTP al IP:3000.
6. Probar dos cuentas propietarias y administrador: unidades, canales, historiales, alertas, archivos, cancelacion y rechazo de unidades ajenas. Primero sin crear ni cancelar descargas reales.

## Dependencias que requieren adaptacion
Despacho consulta Miratrans en localhost:8080; no se encontro un Miratrans activo en Nacional. Se requiere un informe basado en sus propias geocercas/historial o instalar esa dependencia por separado. No copiar las 44 geocercas de Cariamanga como si fueran de Nacional.
La APK es un contenedor WebView: compilarla fuera de Nacional, configurar el dominio de Nacional y la lista de hosts permitidos para descargas. Usar identificador de aplicacion y canal de actualizaciones propios; conservar las claves de firma fuera de GitHub. El navegador mantiene su descargador actual.

## Limites de esta revision
No se modificaron Nacional, su descargador, sus permisos, API ni configuraciones. GPS, video y aislamiento de cuentas de la futura replica requieren pruebas despues de adaptar e instalar la web.

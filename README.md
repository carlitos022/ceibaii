# CEIBA II Web — CustomServiciosRS

Panel web de flota, GPS y cámaras para el entorno Ceiba II / WCMS5. Aplicación React/Vite con backend Express/TypeScript.

## Desarrollo
- Requisito: Node.js compatible con las dependencias en `package-lock.json`.
- `npm ci`: instalar dependencias.
- `npm run dev`: servidor de desarrollo.
- `npm run lint`: comprobar TypeScript.
- `npm run test:live`: pruebas del normalizador FLV.
- `npm run build`: generar `dist/`.
- `npm start`: ejecutar el bundle generado.

## Configuración
Copiar `.env.example` a `.env` y completar los valores del entorno. `JWT_SECRET`, `DES_KEY` y `DES_IV` son obligatorios. Las contraseñas no se guardan en Git.

El frontend web usa `/api` en el mismo origen. El backend se conecta a WCMS5, ARMS, MySQL, Miratrans y al descargador según el entorno configurado. El servicio Windows de producción ejecuta `dist/server.cjs`; los cambios del código fuente requieren compilación y un despliegue deliberado.

## Estado de módulos
Algunas rutas de historial GPS, alertas y descargas del panel aún contienen datos de demostración. Revisar su procedencia antes de usarlas como registros reales. El servicio del descargador de video es un componente aparte y se integra mediante proxy.

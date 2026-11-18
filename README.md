# PlanEstudio

Planificador personal en español para IA y Deep Learning y desarrollo Full Stack. Usa Astro, React y una API compartida con el servidor MCP.

## Abrir en Windows

Requiere Node.js 24, pnpm y Python 3.10 o posterior. Abre una terminal en la carpeta del proyecto.

```powershell
pnpm install --frozen-lockfile --ignore-scripts
python scripts/import_library.py "<ruta privada a Biblioteca de Amazon.xlsx>"
pnpm dev
```

Abre [PlanEstudio local](http://127.0.0.1:4321/PlanEstudio/). La vista local escucha en `127.0.0.1` y guarda los datos en `.private`. Edita la fecha de inicio y los días de los bloques en Calendario. En Rutas, elige la semana para ver las tareas, prerrequisitos, guía y recursos.

## Calendario y contenido

- IA y Deep Learning comprende 78 semanas y 18 meses. Full Stack comprende 52 semanas y 12 meses y usa la plataforma de telemetría del programa de Contexto.
- Durante las primeras 52 semanas se planifican 300 minutos por ruta. Después se planifican 300 minutos de IA por 26 semanas. El total es de 650 horas.
- El avance de una ruta se calcula sobre cuatro actividades por semana. El calendario y la gráfica usan el horario de Bogotá.
- Las ocho guías del primer mes se pueden descargar para móvil o A4. Incluyen un diagrama Mermaid, un ejemplo trabajado, práctica, repaso y un criterio de avance. Agrega una guía con versión para habilitar su exportación.
- La importación privada conserva los 85 registros del Excel y los títulos repetidos que aparecen en él.

## Verificación

```powershell
$env:ASTRO_TELEMETRY_DISABLED = '1'
pnpm check
pnpm test
pnpm build
pnpm test:browser
terraform -chdir=infra init -backend=false
terraform -chdir=infra validate
terraform -chdir=infra test
```

Las pruebas usan Edge en Windows y Chromium en GitHub Actions. El flujo de validación se ejecuta al abrir una solicitud de cambios y al actualizar `main`.

[Despliegue y presupuesto](docs/despliegue.md) · [Producción de video desde Windows](docs/video.md)

export const tracks = {
  ia: { name: 'IA y Deep Learning', short: 'IA', months: 18, weeks: 78, caption: 'De las matemáticas a un modelo en producción' },
  fullstack: { name: 'Full Stack', short: 'Full Stack', months: 12, weeks: 52, caption: 'Construye y despliega una plataforma de telemetría' }
} as const;

export type Track = keyof typeof tracks;
export type RouteFilter = Track | 'all';
export const trackIds = ['ia', 'fullstack'] as const;
export const blockTypes = [
  { id: 'theory', title: 'Teoría', minutes: 90, check: 'Explicar el concepto con un ejemplo propio' },
  { id: 'lab', title: 'Laboratorio', minutes: 120, check: 'Ejecutar y verificar el laboratorio' },
  { id: 'project', title: 'Proyecto', minutes: 60, check: 'Guardar el entregable y su evidencia' },
  { id: 'review', title: 'Repaso y evaluación', minutes: 30, check: 'Resolver la evaluación y registrar el dominio' }
] as const;
export type Block = typeof blockTypes[number]['id'];
export const minutesPerTrack = blockTypes.reduce((sum, block) => sum + block.minutes, 0);

const ai = [
  ['Matemáticas', [
    'Álgebra lineal|Calcular un paso afín y comprobar las formas de un lote.',
    'Cálculo, gradientes y optimización|Derivar la pérdida cuadrática y comparar dos tasas de aprendizaje.',
    'Probabilidad y estadística|Simular una señal ruidosa y cuantificar incertidumbre en la media.',
    'Python científico y NumPy|Vectorizar un transformador de datos y compararlo con un bucle.']],
  ['Machine learning', [
    'Diseño experimental y preparación de datos|Separar datos de entrenamiento, validación y prueba sin fuga.',
    'Regresión y regularización|Medir el efecto de Ridge en un conjunto con variables correlacionadas.',
    'Clasificación y calibración|Comparar el umbral de decisión y el error de calibración.',
    'Árboles y ensambles|Comparar un bosque y un árbol con validación fija.',
    'Validación y selección de modelos|Documentar el muestreo y comparar resultados de validación cruzada.',
    'Desbalance y métricas de error|Seleccionar una métrica según el costo de falsos negativos.',
    'Clustering y reducción dimensional|Comparar segmentos con y sin reducción PCA.',
    'Evaluación integrada de ML|Publicar un informe reproducible de un clasificador de referencia.']],
  ['PyTorch y CUDA', [
    'Tensores, dispositivos y CUDA|Validar PyTorch CUDA en Anaconda y medir una multiplicación en CPU y GPU.',
    'Autograd|Contrastar un gradiente de PyTorch con diferencias finitas.',
    'Datasets, DataLoader y lotes|Probar el rendimiento de carga de datos en Windows.',
    'Módulos y bucles de entrenamiento|Sobreajustar un lote de control y guardar un checkpoint.',
    'Pérdidas y optimizadores|Medir convergencia con SGD y Adam bajo el mismo presupuesto.',
    'Regularización y generalización|Usar weight decay y comparar curvas de aprendizaje.']],
  ['Deep learning', [
    'Redes densas y normalización|Comparar activaciones y revisar las distribuciones de salida.',
    'Convoluciones y visión|Entrenar una CNN pequeña y examinar errores por clase.',
    'Transferencia y aumento de datos|Comparar ajuste completo y congelación parcial.',
    'Representaciones y autoencoders|Reconstruir muestras y visualizar las representaciones latentes.',
    'Precisión mixta y memoria|Medir VRAM con AMP, tamaños de lote y acumulación de gradiente en 16 GB.',
    'Evaluación integrada de deep learning|Replicar el mejor experimento y explicar sus límites.']],
  ['Transformers y LLM', [
    'Texto, tokens y vocabulario|Comparar tokenizadores con ejemplos en español.',
    'Embeddings y similitud|Medir ejemplos de cercanía semántica y falsos vecinos.',
    'Secuencias y modelos recurrentes|Entrenar una referencia pequeña sobre secuencias cortas.',
    'Atención y máscaras|Calcular atención causal con tensores pequeños.',
    'Arquitectura Transformer|Implementar un bloque y verificar las dimensiones.',
    'Entrenamiento de un modelo de lenguaje pequeño|Entrenar con longitud de contexto y lote acotados.',
    'Decodificación y muestreo|Comparar temperatura y top-p con semillas fijas.',
    'Modelos preentrenados y tareas NLP|Ajustar un clasificador compacto y documentar errores.',
    'Evaluación de generación|Construir una rúbrica y usar evaluaciones deterministas cuando sea posible.',
    'Instrucciones y conjuntos de ejemplos|Diseñar ejemplos con separación por grupo y una prueba retenida.',
    'Fine-tuning eficiente|Ajustar adaptadores LoRA de un modelo compacto en la RTX.',
    'Cuantización|Medir cambios de memoria, latencia y calidad.',
    'Inferencia local|Medir tokens por segundo según lote y longitud de contexto.',
    'Servicio de inferencia|Servir el modelo con una API acotada y pruebas de contrato.',
    'Multimodalidad|Comparar recuperación texto-imagen con ejemplos etiquetados.',
    'Evaluación integrada de LLM|Publicar resultados, configuración, límites y costo estimado.']],
  ['RAG', [
    'Documentos y segmentación|Comparar fragmentos con y sin solapamiento sobre preguntas reales.',
    'Índices y recuperación|Evaluar recall@k de dos estrategias de búsqueda.',
    'Búsqueda híbrida y reranking|Medir el cambio al combinar similitud y palabras clave.',
    'Generación con citas|Auditar si las respuestas se sostienen con pasajes recuperados.',
    'Evaluaciones por componentes|Medir recuperación, fidelidad y utilidad por separado.',
    'Calidad de datos y actualizaciones|Reindexar con versiones y detectar documentos repetidos.',
    'Rendimiento del sistema RAG|Medir latencia por etapa y aplicar un presupuesto de contexto.',
    'Evaluación integrada de RAG|Presentar una demo con preguntas que deberían quedar sin respuesta.']],
  ['IA aplicada y operaciones', [
    'Herramientas estructuradas|Definir entradas y salidas con esquemas y validar errores.',
    'Flujos de trabajo de IA|Implementar un flujo supervisado sobre datos de práctica.',
    'Estado y memoria de una aplicación|Comparar estado persistente y contexto temporal.',
    'Evaluación de flujos|Evaluar decisiones por etapa y costo por caso resuelto.',
    'Observabilidad de inferencia|Registrar métricas de latencia y uso sin datos privados.',
    'Versionado de modelos|Etiquetar pesos, configuración y datos de un experimento.',
    'Pruebas de regresión|Detectar variación de calidad por segmento en un conjunto fijo.',
    'Monitorización de deriva|Simular un cambio de distribución y definir umbrales.',
    'Servicio de modelos|Empaquetar una inferencia local y medir latencia p95.',
    'Contenedores de inferencia|Construir una imagen repetible con ruta de salud.',
    'Despliegue gradual y reversión|Definir criterios de promoción y ensayar un rollback local.',
    'Procesamiento por lotes|Diseñar un proceso reanudable con entradas y salidas versionadas.',
    'Optimización de inferencia|Comparar límites de contexto, memoria y latencia.',
    'Arquitectura y costos de IA|Presupuestar inferencia local y serverless con datos medidos.',
    'Privacidad y control de datos|Documentar permisos, minimización y retención de evidencia.',
    'Evaluación integrada de operaciones|Ensayar una recuperación y medir la degradación de servicio.']],
  ['Seguridad defensiva en IA', [
    'Límites de confianza y entradas no confiables|Separar instrucciones y contenido en una aplicación de estudio.',
    'Autorización y privacidad de recuperación|Verificar permisos de documentos con cuentas de prueba.',
    'Validación de salidas|Construir controles de esquema y revisión humana para acciones sensibles.',
    'Auditoría y revisión de seguridad|Revisar registros, permisos mínimos y manejo de secretos.']],
  ['Proyecto final de IA', [
    'Alcance y criterios de éxito|Definir tarea, datos permitidos, métricas y presupuesto.',
    'Datos y línea base|Etiquetar un conjunto de evaluación y entrenar la línea base.',
    'Prototipo del modelo|Implementar un modelo con memoria compatible con 16 GB.',
    'Ablaciones y selección|Comparar dos cambios con un conjunto de validación congelado.',
    'API de inferencia|Versionar el contrato y devolver resultados reproducibles.',
    'Carga, observabilidad y costos|Medir la API con lotes representativos.',
    'Evaluación reproducible|Automatizar métricas, semillas y artefactos.',
    'Documentación y reproducibilidad|Probar una instalación limpia en Windows.',
    'Ensayo de la defensa|Demostrar el sistema y responder por sus fallos conocidos.',
    'Defensa del proyecto de IA|Entregar modelo, API, informe de evaluación y evidencia.']]
] as const;

const fullStack = [
  ['Fundamentos web', [
    'Cómo funciona la Web|Trazar una solicitud HTTP y simular una lectura de telemetría.',
    'HTML semántico|Construir el formulario accesible para registrar un dispositivo.',
    'CSS moderno|Crear un panel responsive de telemetría y revisar foco y contraste.',
    'Git y entrega|Versionar el panel con una rama, un cambio revisable y una entrega.']],
  ['JavaScript y TypeScript', [
    'JavaScript esencial|Transformar lecturas y agruparlas por dispositivo.',
    'Asincronía|Cargar lecturas con cancelación y representar errores.',
    'TypeScript I|Modelar lecturas válidas y errores con tipos discriminados.',
    'TypeScript II|Reutilizar contratos genéricos y validar datos en ejecución.']],
  ['React', [
    'React mental model|Descomponer el tablero en componentes con datos derivados.',
    'Hooks|Manejar carga de lecturas y efectos con limpieza.',
    'Datos y formularios|Registrar dispositivos con feedback y validación accesible.',
    'Routing y state|Mantener filtros y vistas navegables mediante la URL.',
    'Testing frontend|Probar el formulario y sus estados de error mediante su interfaz.']],
  ['Next.js', [
    'Next.js App Router|Prototipar rutas y layouts para frontend de telemetría.',
    'Rendering|Comparar render estático y dinámico para el panel.',
    'Next full stack|Probar una frontera clara entre página y operaciones servidor.']],
  ['Backend y APIs', [
    'Node.js profundo|Medir el efecto de trabajo bloqueante sobre una ruta.',
    'Express|Construir rutas de dispositivos y un middleware de errores.',
    'NestJS|Separar ingestión y consultas en módulos.',
    'REST profesional|Validar contratos, paginación e idempotencia de ingestión.']],
  ['Persistencia y tiempo real', [
    'PostgreSQL I|Modelar dispositivos, mediciones e integridad referencial.',
    'PostgreSQL II|Comparar planes de consulta para series temporales.',
    'ORM y migrations|Ensayar una migración reversible con datos de prueba.',
    'Redis|Medir cuándo ayuda un caché de las últimas mediciones.',
    'Jobs y WebSockets|Publicar actualizaciones y recuperar una conexión interrumpida.',
    'Integración Q2|Entregar ingestión, historial y panel conectados.']],
  ['Identidad y seguridad defensiva', [
    'Identidad|Modelar una identidad separada de los datos de perfil.',
    'OAuth2 y OIDC|Integrar inicio de sesión de prueba con autorización por PKCE.',
    'Autorización|Verificar aislamiento de dispositivos entre organizaciones ficticias.',
    'OWASP|Revisar validación, límites y controles de sesión en el panel.']],
  ['Pruebas y arquitectura', [
    'Testing backend|Probar consultas, persistencia y operaciones repetidas.',
    'E2E|Probar registro, ingestión y consulta en un entorno aislado.',
    'Clean y Hexagonal|Aislar las reglas de dominio detrás de puertos comprobables.',
    'DDD pragmático|Modelar reglas de alertas y límites de ingestión.',
    'Modular monolith|Establecer límites y dependencias entre módulos.']],
  ['Entrega y operación', [
    'Docker|Construir y ejecutar imágenes con configuración de entorno.',
    'CI/CD|Automatizar verificación y empaquetado con GitHub Actions.',
    'AWS|Diseñar una publicación económica del panel y su API.',
    'Producción|Ejecutar un ensayo de despliegue, restauración y reversión.']],
  ['Sistemas distribuidos', [
    'Eventos y colas|Separar el procesamiento de lecturas de su ingestión.',
    'Consistencia|Probar repetición segura y procesamiento fuera de orden.',
    'Observabilidad|Correlacionar logs, métricas y trazas de una medición.',
    'Reliability|Diseñar y medir un objetivo de servicio.',
    'Terraform|Versionar la infraestructura con un plan revisable.',
    'Kubernetes fundamentals|Describir cómo se publica un servicio de prueba local.']],
  ['Integración de IA', [
    'FastAPI|Exponer una predicción de ejemplo con un contrato de datos.',
    'LLM application layer|Diseñar un resumen de incidencias con salida validada.',
    'Embeddings y RAG|Recuperar notas de telemetría con evidencia.',
    'Evaluación de IA|Evaluar resúmenes y recuperación con casos reproducibles.']],
  ['Proyecto final Full Stack', [
    'System Design|Argumentar compromisos de escala, latencia y consistencia.',
    'Hardening|Revisar permisos, errores, límites de uso y recuperación.',
    'Defensa|Demostrar la plataforma de telemetría y explicar sus decisiones.']]
] as const;

export type Week = {
  track: Track;
  number: number;
  month: number;
  title: string;
  module: string;
  deliverable: string;
  prerequisites: number[];
};

function weeksFor(track: Track, modules: readonly (readonly [string, readonly string[]])[]): Week[] {
  let number = 0;
  return modules.flatMap(([module, lessons], moduleIndex) => lessons.map(lesson => {
    number++;
    const [title, deliverable] = lesson.split('|');
    const iaMonth = Math.floor((number - 1) / 13) * 3 + (number % 13 >= 1 && number % 13 <= 4 ? 1 : number % 13 <= 8 && number % 13 !== 0 ? 2 : 3);
    return { track, number, month: track === 'ia' ? iaMonth : moduleIndex + 1, title, module, deliverable, prerequisites: number === 1 ? [] : [number - 1] };
  }));
}

export const roadmap: Record<Track, Week[]> = { ia: weeksFor('ia', ai), fullstack: weeksFor('fullstack', fullStack) };
export const weekKey = (track: Track, week: number) => track + '-' + week;
export const activityKey = (track: Track, week: number, block: Block) => weekKey(track, week) + '-' + block;

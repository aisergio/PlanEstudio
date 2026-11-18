import type { Book, Resource } from './calendar.ts';
import type { Track, Week } from './curriculum.ts';

export type Suggestion = { title: string; kind: 'Biblioteca' | 'Coursera Plus' | 'YouTube' | 'Documentación' | 'Recurso adicional'; why: string; url?: string };
type Selection = { track: Track; first: number; last: number; books: string[]; links: Suggestion[] };
const course = (title: string, slug: string, why: string): Suggestion => ({ title, kind: 'Coursera Plus', url: 'https://www.coursera.org/learn/' + slug, why });
const video = (title: string, id: string, why: string, start = 0): Suggestion => ({ title, kind: 'YouTube', url: 'https://www.youtube.com/watch?v=' + id + (start ? '&t=' + start : ''), why });
const docs = (title: string, url: string, why: string): Suggestion => ({ title, kind: 'Documentación', url, why });
const mdn = 'https://developer.mozilla.org/en-US/docs/';
const selections: Selection[] = [
  { track: 'ia', first: 1, last: 1, books: ['mathematics for machine learning', 'linear algebra'], links: [
    course('Mathematics for Machine Learning: Linear Algebra', 'linear-algebra-machine-learning', 'El módulo de matrices practica transformaciones y composición.'),
    video('3Blue1Brown · Linear transformations and matrices', 'kYB8IZa5AuE', 'Observa cómo las columnas describen una transformación del plano.')
  ] },
  { track: 'ia', first: 2, last: 2, books: ['mathematics for machine learning', 'advanced calculus'], links: [
    course('Mathematics for Machine Learning: Multivariate Calculus', 'multivariate-calculus-machine-learning', 'Usa los módulos de regla de la cadena y optimización para verificar la derivación.'),
    video('3Blue1Brown · Gradient descent', 'IHZwWFHWa-w', 'Visualiza el gradiente y el efecto de dar pasos cuesta abajo.')
  ] },
  { track: 'ia', first: 3, last: 3, books: ['probabilistic machine learning', 'mathematics for machine learning'], links: [
    course('Probability & Statistics for Machine Learning & Data Science', 'machine-learning-probability-and-statistics', 'Practica distribuciones, esperanza y variación de estadísticos.')
  ] },
  { track: 'ia', first: 4, last: 4, books: ['python data analysis', 'python programming language'], links: [
    docs('NumPy · Guía para comenzar', 'https://numpy.org/doc/stable/user/absolute_beginners.html', 'Consulta operaciones por ejes, formas y difusión de dimensiones.')
  ] },
  { track: 'ia', first: 5, last: 12, books: ['hands-on machine learning', 'probabilistic machine learning', 'why machines learn'], links: [
    course('Supervised Machine Learning: Regression and Classification', 'machine-learning-regression-and-classification', 'Complementa las prácticas de regresión, clasificación y validación.'),
    docs('scikit-learn · Guía de usuario', 'https://scikit-learn.org/stable/user_guide.html', 'Consulta las secciones de preprocesamiento, selección de modelos y métricas.')
  ] },
  { track: 'ia', first: 13, last: 24, books: ['deep learning for coders', 'understanding deep learning', 'learning deep learning'], links: [
    docs('PyTorch · Learn the Basics', 'https://pytorch.org/tutorials/beginner/basics/intro.html', 'Vincula cada práctica con tensores, cargas de datos o bucles de entrenamiento.'),
    docs('PyTorch · Instalación local para Windows y CUDA', 'https://pytorch.org/get-started/locally/', 'Selecciona un paquete CUDA compatible y comprueba la GPU en el entorno de Anaconda.')
  ] },
  { track: 'ia', first: 25, last: 40, books: ['build a large language model', 'natural language processing with transformers', 'llm engineer'], links: [
    docs('Hugging Face · LLM Course', 'https://huggingface.co/learn/llm-course/chapter1/1', 'Continúa con tokenización, modelos y evaluación en ejercicios de Transformers.')
  ] },
  { track: 'ia', first: 41, last: 48, books: ['unlocking data with generative ai and rag', 'ai engineering', 'generative ai on google cloud'], links: [
    docs('Amazon Bedrock · Recuperación y evaluación', 'https://docs.aws.amazon.com/bedrock/latest/userguide/evaluation.html', 'Relaciona relevancia y fidelidad con la evaluación reproducible del RAG.')
  ] },
  { track: 'ia', first: 49, last: 78, books: ['designing machine learning systems', 'ai engineering', 'fundamentals of data engineering'], links: [
    docs('PyTorch · Modelos e inferencia', 'https://pytorch.org/tutorials/beginner/saving_loading_models.html', 'Versiona parámetros y valida una carga reproducible para tu API.')
  ] },
  { track: 'fullstack', first: 1, last: 1, books: ['modern computer architecture'], links: [
    video('freeCodeCamp · Cómo funciona Internet', 'zN8YNNHcaZc', 'Usa la explicación de red y DNS para completar el diagrama de la solicitud.'),
    docs('MDN · Cómo funciona la Web', mdn + 'Learn_web_development/Getting_started/Web_standards/How_the_web_works', 'Comprueba dónde intervienen DNS, HTTP y la descarga de recursos.')
  ] },
  { track: 'fullstack', first: 2, last: 3, books: ['full-stack react, typescript, and node'], links: [
    course('HTML, CSS, and Javascript for Web Developers', 'html-css-javascript-for-web-developers', 'Selecciona las clases de estructura HTML y presentación adaptable según la semana.'),
    docs('MDN · HTML, CSS y JavaScript', mdn + 'Learn_web_development', 'Consulta el módulo de marcado o el de distribución CSS mientras construyes el panel.')
  ] },
  { track: 'fullstack', first: 4, last: 4, books: ['aprendiendo git y github'], links: [
    course('Introduction to Git and GitHub', 'introduction-git-github', 'Practica las secciones de ramas y trabajo con remotos.'),
    docs('Git · Pro Git en español', 'https://git-scm.com/book/es/v2', 'Consulta fundamentos y ramificación antes de entregar el primer cambio.')
  ] },
  { track: 'fullstack', first: 5, last: 16, books: ['effective typescript', 'full-stack react, typescript, and node'], links: [
    docs('TypeScript · Handbook', 'https://www.typescriptlang.org/docs/handbook/intro.html', 'Consulta los contratos y los tipos antes de integrarlos en el frontend.'),
    docs('React · Learn', 'https://react.dev/learn', 'Revisa estado derivado, formularios y dependencias de efectos.')
  ] },
  { track: 'fullstack', first: 17, last: 26, books: ['learning sql', 'full-stack react, typescript, and node', 'the data warehouse toolkit'], links: [
    docs('PostgreSQL · Documentación', 'https://www.postgresql.org/docs/current/', 'Verifica el diseño de tablas, índices y transacciones al persistir mediciones.')
  ] },
  { track: 'fullstack', first: 27, last: 39, books: ['fundamentals of software architecture', 'a philosophy of software design', 'cryptography algorithms'], links: [
    docs('AWS · Well-Architected Framework', 'https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html', 'Relaciona las decisiones del servicio con fiabilidad, seguridad y operación.')
  ] },
  { track: 'fullstack', first: 40, last: 52, books: ['fundamentals of software architecture', 'fundamentals of data engineering', 'ai engineering'], links: [
    docs('Terraform · Documentación', 'https://developer.hashicorp.com/terraform/docs', 'Consulta planes, estado y módulos durante el despliegue del proyecto.')
  ] }
];

function normalized(value: string) {
  return value.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

export function recommendations(week: Week, books: Book[], added: Resource[], limit = 3): Suggestion[] {
  const selection = selections.find(item => item.track === week.track && item.first <= week.number && item.last >= week.number);
  const associated = added
    .filter(item => (!item.track || item.track === week.track) && item.module && normalized(item.module) === normalized(week.module))
    .map<Suggestion>(item => ({ title: item.title, kind: 'Recurso adicional', url: item.url, why: 'Lo vinculaste con el módulo ' + week.module + '.' }));
  const readings = selection?.books.flatMap(fragment => {
    const book = books.find(candidate => normalized(candidate.title).includes(fragment));
    return book ? [{ title: book.title + (book.author ? ' · ' + book.author : ''), kind: 'Biblioteca' as const,
      why: 'De tu biblioteca. Úsalo para profundizar en ' + week.module + ' y contrastar el ejercicio de esta semana.' }] : [];
  }) ?? [];
  return [...associated.slice(0, 1), ...readings.slice(0, 1), ...(selection?.links ?? []), ...readings.slice(1)].slice(0, limit);
}

export type Guide = {
  version: string;
  outcome: string;
  theory: Array<[string, string]>;
  example: string;
  code?: string;
  lab: string[];
  mobile: string;
  quiz: Array<[string, string]>;
  exit: string;
  diagram: string;
};

const reviewed: Record<string, Omit<Guide, 'version'>> = {
  'ia-1': {
    outcome: 'Interpreta un lote como una matriz, predice la forma del resultado y calcula un paso afín a mano y con NumPy.',
    theory: [
      ['Vectores y coordenadas', 'Un vector guarda coordenadas en un orden fijo. En un modelo, una fila representa una observación y cada columna una característica. Cambiar el orden de las columnas cambia el significado aunque la forma siga siendo la misma.'],
      ['Producto escalar', 'Multiplica las coordenadas correspondientes y suma los productos. Una neurona usa esta operación para ponderar señales. Si las coordenadas son ortogonales, el producto vale cero. La norma euclidiana mide la longitud.'],
      ['Matrices y formas', 'Si X tiene forma (n, d) y W tiene forma (d, k), X @ W tiene forma (n, k). Las dimensiones interiores deben coincidir. Cada columna de W define cómo combinar las d características para producir una salida. Un sesgo b de forma (k,) se suma por igual a cada fila.'],
      ['Transformaciones', 'Una matriz transforma vectores y preserva el origen. Añadir un sesgo produce una transformación afín. Varias capas afines sin activación equivalen a una sola transformación afín.']
    ],
    example: 'Usa X = [[1, 2], [3, 0]], W = [[2, -1], [1, 3]] y b = [0, 1]. La primera salida es [4, 6] porque (1×2 + 2×1) = 4 y (1×−1 + 2×3 + 1) = 6. La segunda es [6, −2]. Hay dos muestras y dos salidas.',
    code: 'import numpy as np\nX = np.array([[1, 2], [3, 0]])\nW = np.array([[2, -1], [1, 3]])\nb = np.array([0, 1])\nY = X @ W + b\nassert Y.shape == (2, 2)\nnp.testing.assert_array_equal(Y, [[4, 6], [6, -2]])',
    lab: ['Trabaja en tu entorno de Anaconda en VS Code y ejecuta el ejemplo.', 'Agrega una tercera muestra y explica la forma antes de ejecutar.', 'Usa pesos de forma (2, 1) y verifica que el resultado conserva el eje del lote. Guarda los dos controles.'],
    mobile: 'Dibuja las dos columnas de W como tarjetas. Resuelve la fila [2, 1] y verifica que la salida es [5, 2]. Describe qué dimensión compartirían X y W en un lote de 32 muestras.',
    quiz: [['¿Qué forma produce una matriz (32, 8) multiplicada por una (8, 4)?', '(32, 4). Hay 32 observaciones y cuatro salidas.'], ['¿Qué cambia si reemplazas @ por *?', 'El producto * opera elemento a elemento. No realiza una suma sobre las características.']],
    exit: 'Explica la forma, pasa las dos comprobaciones y entrega una tabla de entradas y salidas. La próxima semana calcularás cómo cambia la pérdida al mover esos pesos.',
    diagram: 'flowchart LR\n  X["Lote X, n × d"] --> A["X @ W"]\n  W["Pesos W, d × k"] --> A\n  A --> Y["Suma b → Y, n × k"]'
  },
  'ia-2': {
    outcome: 'Deriva una pérdida cuadrática y comprueba cómo la tasa de aprendizaje altera su convergencia.',
    theory: [
      ['Pendiente local', 'La derivada mide la razón de cambio cerca de un punto. Si la pendiente es positiva, una disminución pequeña de la variable reduce el valor. La aproximación local pierde precisión con pasos grandes.'],
      ['Regla de la cadena', 'Para una predicción p y un objetivo y, la pérdida L = (p − y)²/2 tiene derivada p − y respecto a p. Con p = w·x, multiplica por x para obtener dL/dw.'],
      ['Gradiente', 'Para varios parámetros, agrupa sus derivadas parciales en un vector. Un paso de descenso usa w nuevo = w − tasa × gradiente. La tasa controla la magnitud del paso.'],
      ['Comprobación numérica', 'Aproxima una derivada con (L(w + h) − L(w − h))/(2h). Usa esta prueba con un h pequeño como 0,0001. Pasos cercanos a la precisión de máquina pueden amplificar errores de redondeo.']
    ],
    example: 'Con x = 2, y = 6 y w = 1, predices 2 y obtienes pérdida 8. La derivada es (2 − 6)×2 = −8. Con tasa 0,1, el peso pasa a 1,8, la predicción a 3,6 y la pérdida baja a 2,88.',
    code: 'def loss(w):\n    return (2 * w - 6) ** 2 / 2\n\nfor rate in (0.1, 0.55):\n    w = 1.0\n    for step in range(6):\n        print(rate, step, round(w, 3), round(loss(w), 3))\n        w -= rate * (2 * w - 6) * 2',
    lab: ['Comprueba por diferencias finitas la derivada en w = 1.', 'Registra seis pasos para tasas 0,1 y 0,55, empezando con el mismo peso.', 'Incluye un gráfico o tabla y explica por qué el segundo experimento diverge.'],
    mobile: 'Repite a mano un paso con tasa 0,25. Calcula el residuo y la pérdida nueva. Estima qué ocurriría con tasa 0,5.',
    quiz: [['¿Qué sucede con tasa 0,25 en este ejemplo?', 'Se llega a w = 3 en un paso porque el gradiente es 4(w − 3).'], ['¿Qué error revela una diferencia finita con signo opuesto?', 'Conviene revisar la derivación y el signo del residuo o de la actualización.']],
    exit: 'Entrega la derivada, la comprobación y los dos experimentos. La próxima semana introducirás incertidumbre en las observaciones.',
    diagram: 'flowchart LR\n  W["Peso actual"] --> P["Predicción"] --> L["Pérdida"] --> G["Gradiente"] --> N["Peso actualizado"]'
  },
  'ia-3': {
    outcome: 'Distingue variabilidad de observaciones e incertidumbre de una media mediante simulación.',
    theory: [
      ['Variables aleatorias', 'Una distribución describe cómo varían posibles resultados. Su media resume el centro y su varianza mide dispersión cuadrática alrededor de la media.'],
      ['Muestreo y estimación', 'La media de la muestra estima la media de la población. Si las observaciones son independientes y tienen varianza σ², la varianza de la media es σ²/n. Muestras correlacionadas reducen la información efectiva.'],
      ['Intervalos', 'Simula muchas muestras o remuestrea con reemplazo cuando corresponda. Un intervalo frecuentista del 95 % tiene cobertura aproximada bajo las condiciones del método. Un intervalo concreto puede fallar.'],
      ['Reproducibilidad', 'Fija una semilla y documenta el mecanismo de generación, el tamaño muestral y el número de réplicas. Cambia un factor a la vez al comparar resultados.']
    ],
    example: 'Si el ruido individual tiene desviación 4 y promedias 16 observaciones independientes, la desviación de la media es 4/√16 = 1. Con 64 cae a 0,5. Las observaciones individuales siguen igual de dispersas.',
    code: 'import numpy as np\nrng = np.random.default_rng(42)\nfor n in (16, 64):\n    samples = rng.normal(10, 4, size=(2000, n))\n    estimates = samples.mean(axis=1)\n    print(n, estimates.std(), np.quantile(estimates, [.025, .975]))',
    lab: ['Compara la dispersión empírica de las medias con 4/√n.', 'Agrega una señal de ruido compartida dentro de cada muestra y conserva la semilla.', 'Explica por qué la dependencia impide que la incertidumbre caiga al ritmo anterior.'],
    mobile: 'Calcula el error estándar para tamaños 4, 16 y 100. Describe qué efecto tendría repetir la misma observación sin aportar información nueva.',
    quiz: [['¿Cuántas observaciones hacen falta para reducir a la mitad el error estándar?', 'Cuatro veces más, si se mantienen la independencia y la varianza.'], ['¿Qué resume un histograma de 2.000 medias?', 'La distribución de muestreo empírica del estimador.']],
    exit: 'Conserva la semilla, los intervalos y una explicación de las condiciones. La próxima semana empaquetarás estos cálculos como operaciones vectorizadas.',
    diagram: 'flowchart LR\n  P["Población"] --> M["Muestras independientes"] --> E["Medias"] --> H["Distribución de muestreo"]'
  },
  'ia-4': {
    outcome: 'Implementa una transformación vectorizada de datos y valida formas, granularidad y reproducibilidad.',
    theory: [
      ['Arreglos y ejes', 'En una matriz de muestras por características, reducir axis=0 produce un resumen por columna. Conservar las dimensiones reducidas permite comunicar la intención y alinear las operaciones posteriores.'],
      ['Difusión de dimensiones', 'NumPy compara las formas desde la derecha. Dos dimensiones son compatibles si coinciden o si una vale uno. Revisa el resultado de las formas antes de aplicar una operación a todo el lote.'],
      ['Ajuste y transformación', 'Para normalizar, guarda media y escala del conjunto de entrenamiento. Usa esos mismos parámetros para validación o prueba. Estimar la escala con todo el conjunto introduce información fuera del entrenamiento.'],
      ['Comprobación', 'Primero escribe un caso manual, luego una referencia sencilla. Usa tolerancias para valores de punto flotante y mide rendimiento con datos representativos.']
    ],
    example: 'Las columnas de [[1, 10], [3, 20]] tienen medias [2, 15] y desviaciones [1, 5]. La transformación produce filas [−1, −1] y [1, 1]. La nueva fila [5, 15] debe producir [3, 0] usando los mismos parámetros.',
    code: 'import numpy as np\ntrain = np.array([[1., 10.], [3., 20.]])\nmean = train.mean(axis=0)\nscale = train.std(axis=0)\nscale = np.where(scale == 0, 1, scale)\nnp.testing.assert_allclose((train - mean) / scale, [[-1, -1], [1, 1]])\nnp.testing.assert_allclose(([[5., 15.]] - mean) / scale, [[3, 0]])',
    lab: ['Implementa una versión de referencia por columnas y compara contra NumPy.', 'Incluye una columna constante y comprueba que el resultado sigue siendo finito.', 'Cronometra ambas versiones con una matriz de 10.000 por 16 y registra la mediana de cinco mediciones.'],
    mobile: 'Normaliza a mano un lote de dos filas. Escribe el significado de axis=0 y el tamaño del vector de parámetros.',
    quiz: [['¿Por qué calcular estadísticas solo en entrenamiento?', 'Para que validación y prueba sigan representando datos que el ajuste no conocía.'], ['¿Cómo tratar una columna con varianza cero?', 'Puedes asignar escala 1 y documentar la decisión, o excluir la variable desde el ajuste.']],
    exit: 'Entrega el transformador con comprobaciones y mediciones. El siguiente módulo usará esta separación para evaluar modelos sin fuga.',
    diagram: 'flowchart LR\n  T["Entrenamiento"] --> S["Media y escala"]\n  S --> F["Transformar cualquier lote"]\n  V["Validación y prueba"] --> F'
  },
  'fullstack-1': {
    outcome: 'Traza una solicitud HTTPS completa y explica el intercambio de datos de una lectura de telemetría.',
    theory: [
      ['URL y DNS', 'Una URL identifica el esquema, el host, la ruta y, si existe, la consulta. DNS resuelve nombres a direcciones. La ruta pertenece a HTTP y se envía tras establecer la conexión.'],
      ['Transporte y TLS', 'HTTPS protege el intercambio mediante TLS y autentica el servidor con su certificado. HTTP/1.1 y HTTP/2 suelen viajar sobre TCP. HTTP/3 usa QUIC sobre UDP.'],
      ['Contrato HTTP', 'El método describe la intención. GET consulta una representación y POST puede aceptar una medición. Las cabeceras comunican metadatos como el tipo de contenido. El estado indica el resultado.'],
      ['Entrega al navegador', 'El navegador descarga y analiza el documento, solicita dependencias y ejecuta JavaScript según la página. Una falla de red, un estado 4xx y un error al interpretar JSON ocurren en capas distintas.']
    ],
    example: 'Un sensor envía POST /mediciones con Content-Type: application/json y el objeto {"deviceId":"lab-01","celsius":23.4}. Si el servidor crea la medición, responde 201. Un JSON mal formado puede producir 400. Si se derriba el servidor, el cliente recibe un error de conexión.',
    code: 'const reading = { deviceId: "lab-01", celsius: 23.4 }\nconst preview = new Request("https://example.test/mediciones", {\n  method: "POST",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify(reading)\n})\nconsole.log(preview.method, preview.url, await preview.json())',
    lab: ['Abre la pestaña Network de DevTools y recarga una página HTTPS. Identifica documento, cabeceras y recursos.', 'Ejecuta el ejemplo en un archivo .mjs en VS Code. Construye una tabla de método, ruta, cuerpo y estados esperados.', 'Documenta las responsabilidades del sensor, la API, la persistencia y el panel de consulta.'],
    mobile: 'Separa el dominio y la ruta de una URL. Dibuja DNS, TLS y HTTP y explica dónde ocurre cada paso.',
    quiz: [['¿En qué momento se usa la ruta /mediciones?', 'En la solicitud HTTP. DNS resuelve el nombre de host.'], ['¿Qué diferencia hay entre 400 y error de conexión?', '400 es una respuesta HTTP. Un error de conexión ocurre antes de recibir una respuesta HTTP.']],
    exit: 'Entrega la traza y el primer contrato de ingestión. La siguiente sesión convertirá ese contrato en un formulario accesible.',
    diagram: 'sequenceDiagram\n  participant B as Navegador\n  participant D as DNS\n  participant A as API\n  B->>D: Resolver nombre\n  D-->>B: Dirección\n  B->>A: Negociar TLS y enviar HTTP\n  A-->>B: Respuesta y estado'
  },
  'fullstack-2': {
    outcome: 'Construye un formulario operable con teclado y con una estructura que permite identificar controles y errores.',
    theory: [
      ['Estructura', 'Usa main para el contenido principal, títulos para un esquema comprensible y elementos nativos para acciones e información. Un botón tiene foco y activación por teclado incorporados.'],
      ['Etiquetas', 'Une label y control mediante for e id. Un placeholder puede ilustrar el formato; la etiqueta comunica el propósito y permanece visible. Usa fieldset y legend para agrupar controles relacionados.'],
      ['Validación', 'El navegador puede comprobar required y límites. La aplicación también valida en su frontera con la API porque cualquier cliente puede enviar solicitudes. Asocia los mensajes con el campo mediante aria-describedby cuando haga falta.'],
      ['Recorrido', 'El orden del documento guía la navegación con Tab. Recorre el formulario de principio a fin y verifica nombres, foco visible y mensajes al enviar.']
    ],
    example: 'Para registrar un identificador, usa una etiqueta visible «Dispositivo» y un campo con name="deviceId". El id une el control con la etiqueta. El atributo name define la clave enviada en el formulario.',
    code: '<main>\n  <h1>Registrar dispositivo</h1>\n  <form action="/dispositivos" method="post">\n    <label for="device">Dispositivo</label>\n    <input id="device" name="deviceId" required maxlength="32">\n    <button type="submit">Registrar</button>\n  </form>\n</main>',
    lab: ['Añade nombre, ubicación y unidad de medición con etiquetas propias.', 'Prueba recorrido Tab y envío inválido. Inspecciona el nombre accesible de un campo.', 'Documenta tres comprobaciones y guarda una captura con un error inteligible.'],
    mobile: 'Esboza cuatro etiquetas para un registro de dispositivo. Para cada una escribe ejemplo válido y mensaje de error.',
    quiz: [['¿Qué aporta un button frente a un div al que se le añade un clic?', 'Semántica de botón, capacidad de recibir foco y activación por teclado.'], ['¿Dónde se valida el contrato definitivo?', 'En la API, al recibir datos no confiables.']],
    exit: 'El registro tiene etiquetas, foco y validación comprensible. La próxima semana conservarás estas propiedades en el panel responsive.',
    diagram: 'flowchart TD\n  A["Etiqueta y control"] --> B["Validación interactiva"] --> C["Solicitud"] --> D["Validación en API"] --> E["Resultado accesible"]'
  },
  'fullstack-3': {
    outcome: 'Organiza el panel con cuadrículas flexibles y verifica que conserve lectura y foco en el celular.',
    theory: [
      ['Cascada', 'La declaración aplicable depende del origen, capas, especificidad y orden. Define estilos base predecibles para componentes y evita selectores que dificulten sobrescribir una variante.'],
      ['Cuadrícula y flujo', 'Grid controla filas y columnas. minmax permite declarar un mínimo y un máximo flexible por tarjeta. El contenido puede envolver texto y seguir siendo legible cuando disminuye el ancho.'],
      ['Diseño responsive', 'Empieza por el ancho mínimo útil. Una tarjeta, el formulario o una tabla requieren pruebas con texto largo, aumento de zoom y anchos de pantalla variados.'],
      ['Foco y contraste', 'Los estados de foco, error y alerta necesitan señal visual suficiente y texto cuando corresponda. Evita depender del color como única diferencia.']
    ],
    example: 'Con una cuadrícula de mínimo 220 px y un hueco de 16 px, un contenedor de 470 px admite dos columnas. En 430 px queda una columna. Las tarjetas crecen de manera uniforme cuando hay espacio.',
    code: '.readings {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr));\n  gap: 16px;\n}\n:focus-visible { outline: 3px solid #245dde; outline-offset: 3px; }',
    lab: ['Crea tarjetas de temperatura, humedad y estado de conexión.', 'Comprueba a 360, 768 y 1280 px. Aumenta el zoom al 200 % y revisa que los controles sigan visibles.', 'Registra las pruebas y captura el panel en dos tamaños.'],
    mobile: 'Ordena tres métricas para una sola columna. Anota qué haría que una alerta siguiera siendo evidente con el color desactivado.',
    quiz: [['¿Por qué se usa min(100%, 220px)?', 'Para que el mínimo de una tarjeta pueda reducirse en un contenedor más estrecho.'], ['¿Qué comprueba :focus-visible?', 'Marca el foco en situaciones en que el navegador indica que debe hacerse visible, como navegación con teclado.']],
    exit: 'Entrega el panel y las comprobaciones. La siguiente semana publicarás una revisión del cambio mediante Git.',
    diagram: 'flowchart LR\n  A["Métricas"] --> B["Ancho del contenedor"] --> C["Grid flexible"] --> D["Una o más columnas"]'
  },
  'fullstack-4': {
    outcome: 'Produce un cambio pequeño y rastreable con Git y ensaya su entrega con verificaciones previas.',
    theory: [
      ['Estados en Git', 'El árbol de trabajo contiene cambios locales. El índice reúne la selección para el próximo commit. Un commit identifica una instantánea y queda ligado a sus padres.'],
      ['Ramas y revisión', 'Una rama es una referencia que avanza con los commits. Trabaja una pieza en una rama, revisa cambios y abre una solicitud de integración cuando exista un remoto autorizado.'],
      ['Verificación', 'Compara el cambio con su base, comprueba el resultado y revisa que no incluya credenciales, dependencias generadas ni archivos privados. Agrega instrucciones de comprobación al cambio.'],
      ['Reversión trazable', 'Una reversión en una rama compartida crea un commit nuevo que deshace el efecto de otro. Mantiene un historial legible y facilita entender la recuperación.']
    ],
    example: 'El panel agrega una tarjeta sin tocar la ingestión. El cambio describe cómo abrir el panel, verificar la tarjeta y navegar con Tab. La captura es evidencia de la vista y el commit identifica la revisión.',
    code: 'git switch -c feat/panel-telemetria\ngit status --short\ngit diff\ngit add index.html styles.css\ngit diff --cached\ngit commit -m "Agrega métricas al panel de telemetría"',
    lab: ['Crea una rama en el repositorio de prácticas y prepara solo el panel.', 'Verifica los archivos incluidos y documenta tres pasos de comprobación.', 'En otra rama local, ejecuta un revert del cambio y comprueba que el historial conserve ambos commits.'],
    mobile: 'Escribe una descripción corta de revisión con objetivo, pruebas y evidencia. Explica por qué una captura por sí sola no es suficiente.',
    quiz: [['¿Qué inspecciona git diff --cached?', 'La diferencia entre el índice y HEAD, es decir, la selección preparada para el commit.'], ['¿Cómo deshaces un commit compartido de forma trazable?', 'Con git revert y una revisión del nuevo cambio.']],
    exit: 'Entrega el enlace o hash del commit, los pasos de comprobación y evidencia del ensayo. La próxima semana transformarás lecturas con JavaScript.',
    diagram: 'flowchart LR\n  A["Archivos locales"] --> B["Índice"] --> C["Commit"] --> D["Revisión"] --> E["Entrega"]'
  }
};

export const guides: Record<string, Guide> = Object.fromEntries(Object.entries(reviewed).map(([key, guide]) => [key, { ...guide, version: '1.0' }]));

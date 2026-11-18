# Video semanal desde Windows

El flujo prepara seis escenas a 30 fps con voz femenina argentina, diagramas en movimiento, subtítulos en español, un ejemplo y un repaso. Premiere exporta el MP4 y el PC verifica con ffprobe que dure 10:00 y tenga audio y video.

## Conectar el PC

1. Usa un entorno de Anaconda con `piper-tts`, `onnxruntime-gpu`, CUDA y cuDNN compatibles. Descarga la voz Daniela y su JSON en el mismo directorio. La síntesis verifica que ONNX Runtime use CUDA. [Piper y CUDA](https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/API_PYTHON.md) · [Modelo Daniela](https://huggingface.co/rhasspy/piper-voices/blob/main/es/es_AR/daniela/high/MODEL_CARD)
2. Instala FFmpeg y ffprobe. HyperFrames y GSAP son dependencias del proyecto. HyperFrames necesita iniciar Chromium y encontrar FFmpeg. [HyperFrames](https://github.com/heygen-com/hyperframes/blob/main/docs/packages/cli.mdx)
3. Crea un cliente OAuth de escritorio separado en Google Cloud y habilita YouTube Data API v3. Guarda el JSON en `.private`. En `.private/video.json`, define `python`, `voice`, `youtubeClient`, `ffmpeg`, `ffprobe` y, si quieres otra carpeta, `jobs`. La carpeta predeterminada es `.private/video-jobs`.
4. Con UXP Developer Tool, carga `video/premiere/manifest.json` en Premiere. Abre el panel PlanEstudio, selecciona la carpeta de trabajos y un ajuste `.epr` H.264 de 720p y 30 fps. Inicia la revisión de la cola. [Exportación desde Premiere UXP](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/encodermanager)
5. Define `PLANESTUDIO_WORKER_TOKEN` en `.env` con al menos 32 caracteres alfanuméricos o guiones. Registra su SHA-256 en `worker_token_hash` de Terraform. Ejecuta `pnpm video:youtube-auth` y autoriza el canal elegido. Windows cifra el token de actualización para el usuario local mediante DPAPI.
6. Con el panel de Premiere listo, ejecuta `pnpm video:worker`. En la guía del sitio, el botón **Generar video** muestra canal, título y visibilidad pública. Confirma cada video que quieras publicar.

Al reiniciar Windows, vuelve a abrir el panel de Premiere y el proceso de video. El proceso conserva las escenas válidas, el montaje y la posición de la subida. YouTube recibe el MP4 desde Windows. La API conserva el estado y el identificador. El sitio ofrece reproducción cuando YouTube confirma que permite insertar el video. [Carga reanudable de YouTube](https://developers.google.com/youtube/data/guides/using_resumable_upload_protocol)

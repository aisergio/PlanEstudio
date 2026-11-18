const privateHeaders = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin' };

export const json = (value: unknown, status = 200, headers?: HeadersInit) => new Response(JSON.stringify(value), {
  status, headers: { ...privateHeaders, 'Content-Type': 'application/json; charset=utf-8', ...Object.fromEntries(new Headers(headers)) }
});
export const failure = (message: string, status: number, headers?: HeadersInit) => json({ error: message }, status, headers);

export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

export async function readText(request: Request, limit = 32_768) {
  const reader = request.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let text = '';
  let length = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) return text + decoder.decode();
      length += chunk.value.length;
      if (length > limit) throw new HttpError(413, 'La solicitud es demasiado grande.');
      text += decoder.decode(chunk.value, { stream: true });
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'El texto de la solicitud es inválido.');
  }
}

export async function readJson(request: Request) {
  if (!/^application\/json\b/i.test(request.headers.get('Content-Type') ?? '')) throw new HttpError(415, 'Envía el contenido como JSON.');
  const text = await readText(request);
  try { return JSON.parse(text) as unknown; } catch { throw new HttpError(400, 'El JSON de la solicitud es inválido.'); }
}

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { timingSafeEqual } from 'node:crypto';
import type { Book } from '../core/calendar.ts';
import { api } from './api.ts';
import { cognitoAuth, ownerTrigger } from './auth.ts';
import { AwsStore } from './aws-store.ts';
import { novaTutor } from './tutor.ts';

const env = process.env;
const s3 = new S3Client({});
let cachedLibrary: { at: number; value: Book[] } | undefined;
async function library(): Promise<Book[]> {
  if (cachedLibrary && Date.now() - cachedLibrary.at < 300_000) return cachedLibrary.value;
  const file = await s3.send(new GetObjectCommand({ Bucket: env.STUDY_BUCKET, Key: 'private/library.json' }));
  const value = JSON.parse(await file.Body!.transformToString()) as Book[];
  if (!Array.isArray(value) || value.length !== 85) throw new Error('Catálogo privado incompleto');
  cachedLibrary = { at: Date.now(), value };
  return value;
}

type GatewayEvent = {
  rawPath: string; rawQueryString: string; headers: Record<string, string>; cookies?: string[];
  body?: string; isBase64Encoded?: boolean; requestContext: { http: { method: string } };
};
let handle: ReturnType<typeof api>;
export async function handler(event: GatewayEvent | Parameters<typeof ownerTrigger>[0]) {
  if ('triggerSource' in event) return ownerTrigger(event, env.OWNER_EMAIL!);
  if (!handle) {
    const store = new AwsStore(env.STUDY_TABLE!);
    handle = api({ store, library, workerHash: env.WORKER_TOKEN_HASH,
      tutor: env.BEDROCK_MODEL ? novaTutor(env.BEDROCK_MODEL, store) : undefined,
      auth: cognitoAuth({
        app: env.APP_URL!, domain: env.COGNITO_DOMAIN!, poolId: env.USER_POOL!, ownerEmail: env.OWNER_EMAIL!,
        webClient: env.WEB_CLIENT!, mcpClient: env.MCP_CLIENT ?? '', mcpRedirect: env.MCP_REDIRECT ?? '',
        mcpScope: env.MCP_SCOPE!, mcpEnabled: Boolean(env.MCP_REDIRECT && env.MCP_CLIENT)
      })
    });
  }
  const headers = new Headers(event.headers);
  const provided = Buffer.from(headers.get('X-PlanEstudio-Origin') ?? '');
  const expected = Buffer.from(env.ORIGIN_SECRET ?? '');
  if (!expected.length || provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return { statusCode: 403, headers: { 'Cache-Control': 'no-store' }, body: '' };
  }
  if (event.cookies) headers.set('Cookie', event.cookies.join('; '));
  const origin = new URL(env.APP_URL!).origin;
  const request = new Request(origin + event.rawPath + (event.rawQueryString ? '?' + event.rawQueryString : ''), {
    method: event.requestContext.http.method, headers,
    ...(event.body !== undefined ? { body: event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body } : {})
  });
  const response = await handle(request);
  const responseHeaders = Object.fromEntries([...response.headers].filter(([key]) => key !== 'set-cookie'));
  return { statusCode: response.status, headers: responseHeaders, cookies: response.headers.getSetCookie(), body: await response.text() };
}

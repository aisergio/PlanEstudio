function handler(event) {
  const request = event.request;
  if (request.uri === '/PlanEstudio') {
    return { statusCode: 308, statusDescription: 'Permanent Redirect', headers: { location: { value: '/PlanEstudio/' } } };
  }
  if (!request.uri.startsWith('/PlanEstudio/') || /(?:\.\.|%2e|%2f|%5c|\\)/i.test(request.uri)) {
    return { statusCode: 404, statusDescription: 'Not Found' };
  }
  if (request.uri.endsWith('/')) request.uri += 'index.html';
  else if (!request.uri.split('/').pop().includes('.')) request.uri += '/index.html';
  return request;
}

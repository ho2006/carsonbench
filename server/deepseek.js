import { requestPayload, responseText } from '../src/protocol.js';

const API = 'https://api.deepseek.com';
export async function callDeepSeek(apiKey, input, { fetcher = fetch, signal } = {}) {
  if (typeof apiKey !== 'string' || !/^[A-Za-z0-9_-]{12,256}$/.test(apiKey)) return { status: 401, error: '请填写有效的 DeepSeek API Key。' };
  let payload;
  try { if (input) payload = requestPayload(input); } catch (error) { return { status: 400, error: error.message }; }
  try {
    const upstream = await fetcher(`${API}/${payload ? 'chat/completions' : 'models'}`, {
      method: payload ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
      signal: AbortSignal.any([AbortSignal.timeout(120000), ...(signal ? [signal] : [])]),
    });
    if (!upstream.ok) {
      const errors = { 400: 'DeepSeek 拒绝了请求，请检查模型及阅读材料。', 401: 'API Key 无效或已失效，请重新填写。', 402: 'DeepSeek 账户余额不足，请充值后重试。', 429: '请求过于频繁，请稍后再试。' };
      return { status: [400,401,402,429].includes(upstream.status) ? upstream.status : 502, error: errors[upstream.status] || 'DeepSeek 服务暂时不可用，请稍后重试。' };
    }
    const response = await upstream.json();
    if (!payload) {
      const models = response?.data?.filter(m => typeof m.id === 'string' && /^deepseek-[a-z0-9-]{1,80}$/.test(m.id)).map(m => ({ id: m.id, name: m.name || m.id }));
      if (!models?.length) throw new Error('No models');
      return { status: 200, models };
    }
    responseText(response);
    if (typeof response.id !== 'string' || typeof response.model !== 'string') throw new Error('Invalid response');
    return { status: 200, response, request: payload, receivedAt: new Date().toISOString() };
  } catch (error) {
    return { status: error.name === 'TimeoutError' || error.name === 'AbortError' ? 504 : 502, error: error.name === 'TimeoutError' || error.name === 'AbortError' ? '调用超时或已取消；不会自动重试，请确认后手动重试。' : '无法连接 DeepSeek 或响应格式异常；原有记录已保留。' };
  }
}

export async function handler(req, res) {
  const isModels = req.url.split('?')[0].endsWith('/models');
  const expectedMethod = isModels ? 'GET' : 'POST';
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== expectedMethod) { res.setHeader('Allow', expectedMethod); res.writeHead(405).end(); return; }
  // Only the caller's key is forwarded; there is no shared server key to expose.
  if (req.headers.origin) {
    try { if (new URL(req.headers.origin).host !== req.headers.host) { res.writeHead(403).end(); return; } }
    catch { res.writeHead(403).end(); return; }
  }
  const controller = new AbortController();
  res.on('close', () => { if (!res.writableEnded) controller.abort(); });
  try {
    let input;
    if (!isModels) {
      if (!req.headers['content-type']?.startsWith('application/json')) { res.writeHead(415).end(); return; }
      if (req.body !== undefined) input = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      else {
        const chunks = [];
        let bytes = 0;
        for await (const chunk of req) {
          bytes += Buffer.byteLength(chunk);
          if (bytes > 350000) { res.writeHead(413).end(JSON.stringify({ error: '输入内容过长。' })); return; }
          chunks.push(Buffer.from(chunk));
        }
        input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      }
      if (!input || typeof input !== 'object' || JSON.stringify(input).length > 350000) { res.writeHead(400).end(); return; }
    }
    const result = await callDeepSeek(req.headers.authorization?.replace(/^Bearer /, ''), input, { signal: controller.signal });
    const { status, ...body } = result;
    if (!res.destroyed) { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.writeHead(status).end(JSON.stringify(body)); }
  } catch {
    if (!res.destroyed) { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.writeHead(400).end(JSON.stringify({ error: '请求格式无效。' })); }
  }
}

export function deepSeekPlugin() {
  const setup = server => { server.middlewares.use('/api/deepseek', handler); };
  return { name: 'carsonbench-deepseek', configureServer: setup, configurePreviewServer: setup };
}

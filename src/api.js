export async function apiRequest(path, apiKey, input, signal) {
  const response = await fetch(`/api/deepseek/${path}`, {
    method: input ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey.trim()}` },
    ...(input ? { body: JSON.stringify(input) } : {}), signal,
  });
  let result;
  try { result = await response.json(); } catch { throw new Error('API 服务未就绪，请通过 npm run dev、npm run preview 或 Vercel 运行网页。'); }
  if (!response.ok) throw new Error(result.error || `调用失败（${response.status}），原有记录已保留。`);
  return result;
}

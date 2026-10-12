export async function apiRequest(path, apiKey, input, signal) {
  if (globalThis.window?.carsonBench) {
    if (signal?.aborted) throw signal.reason;
    const desktop = window.carsonBench;
    const id = crypto.randomUUID();
    let onAbort;
    const canceled = new Promise((_,reject) => {
      onAbort = () => { desktop.cancel(id); reject(signal.reason); };
      signal?.addEventListener('abort',onAbort,{once:true});
    });
    try {
      const result = await Promise.race([desktop.request(id,path,apiKey.trim(),input),canceled]);
      if (result.status !== 200) throw new Error(result.error || `调用失败（${result.status}）。`);
      const { status, ...body } = result;
      return body;
    } finally { signal?.removeEventListener('abort',onAbort); }
  }
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

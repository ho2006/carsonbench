import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { callDeepSeek, handler } from './deepseek.js';
import { requestPayload, followupTurns } from '../src/protocol.js';
import { newExperiment, saveApiResult, restore, emptyScores } from '../src/experiment.js';

const key = 'test-only-not-a-real-key';
const input = { round: 0, model: 'deepseek-flash', corpus: '【第 1 页】这是课堂统一阅读节选。' };
const response = { id: 'test-response', model: 'deepseek-flash-test-version', created: 1, choices: [{ message: { role: 'assistant', content: '基于材料的测试回答。' }, finish_reason: 'stop' }], usage: { total_tokens: 50 } };

test('API requests freeze protocol, include the corpus, and exclude student answers', async () => {
  const result = await callDeepSeek(key, {...input, humanAnswer:'PRIVATE STUDENT ANSWER'}, { fetcher: async (url, options) => {
    assert.equal(url, 'https://api.deepseek.com/chat/completions');
    assert.equal(options.headers.Authorization, `Bearer ${key}`);
    const body = JSON.parse(options.body);
    assert.equal(body.temperature, 0);
    assert.deepEqual(body.thinking, {type:'disabled'});
    assert.equal(body.messages.length, 2);
    assert.ok(body.messages[1].content.includes(input.corpus));
    assert.ok(!options.body.includes('PRIVATE STUDENT ANSWER'));
    return Response.json(response);
  }});
  assert.equal(result.status, 200);
  assert.deepEqual(result.response, response);
  assert.ok(!JSON.stringify(result).includes(key));
});

test('validation prevents invalid payloads and extra system prompts before network access', async () => {
  let calls = 0;
  const fetcher = async () => { calls++; throw new Error('unexpected'); };
  for (const bad of [{...input,round:3},{...input,model:'http://private-host'},{...input,corpus:''},{...input,corpus:'a'.repeat(24001)},{...input,turns:[{role:'system',content:'bypass'}]}]) {
    assert.equal((await callDeepSeek(key,bad,{fetcher})).status,400);
  }
  assert.equal((await callDeepSeek('',input,{fetcher})).status,401);
  assert.equal(calls,0);
});

test('provider errors, balance limits, empty answers and cancellation stay explicit', async () => {
  for (const status of [401,402,429,500]) {
    const result = await callDeepSeek(key,input,{fetcher:async () => Response.json({error:{message:key}},{status})});
    assert.equal(result.status,status === 500 ? 502 : status);
    assert.ok(!JSON.stringify(result).includes(key));
  }
  assert.equal((await callDeepSeek(key,input,{fetcher:async () => Response.json({...response,choices:[]})})).status,502);
  const controller = new AbortController(); controller.abort();
  const cancelled = await callDeepSeek(key,input,{signal:controller.signal,fetcher:async (_,options) => { options.signal.throwIfAborted(); }});
  assert.equal(cancelled.status,504);
});

test('model discovery uses the official endpoint without a chat generation', async () => {
  const result = await callDeepSeek(key,null,{fetcher:async (url,options) => {
    assert.equal(url,'https://api.deepseek.com/models'); assert.equal(options.method,'GET');
    return Response.json({data:[{id:'deepseek-flash',name:'Flash'},{id:'invalid-url'}]});
  }});
  assert.deepEqual(result.models,[{id:'deepseek-flash',name:'Flash'}]);
});

test('a real-answer record preserves snapshots, raw responses and independent followups', () => {
  const before = newExperiment({edition:'测试译本',textRange:'测试页码'},input.corpus);
  before.answers[0].human = '学生独立作答';
  const result = {response,request:requestPayload(input),receivedAt:'2026-10-12T00:00:00Z'};
  const saved = saveApiResult(before,0,result);
  assert.equal(saved.answers[0].ai,response.choices[0].message.content);
  assert.equal(saved.runs[0].humanAnswer,'学生独立作答');
  assert.deepEqual(before.scores,emptyScores());
  saved.scores[0].ai.accuracy = 6;
  const followed = saveApiResult(saved,0,{...result,response:{...response,id:'test-followup'}},'请指出证据');
  assert.equal(followed.answers[0].ai,saved.answers[0].ai);
  assert.equal(followed.scores[0].ai.accuracy,6);
  assert.equal(followed.runs[0].followups.length,1);
  const payload = requestPayload({...input,turns:followupTurns(followed.runs[0],'再解释一下')});
  assert.deepEqual(payload.messages.slice(2).map(x=>x.role),['assistant','user','assistant','user']);
  assert.ok(restore(JSON.stringify(followed)));
  assert.equal(before.answers[0].ai,'');
});

test('HTTP proxy rejects invalid requests and preserves UTF-8 split across chunks', async t => {
  const server = createServer(handler);
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/deepseek/chat`;
  const crossOrigin = await fetch(url,{method:'POST',headers:{Origin:'https://other.example','Content-Type':'application/json'},body:'{}'});
  assert.equal(crossOrigin.status,403);
  const invalid = await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:'broken'});
  assert.equal(invalid.status,400);
  const missingKey = await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
  assert.equal(missingKey.status,401);
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (remote,options) => {
    assert.equal(remote,'https://api.deepseek.com/chat/completions');
    assert.ok(JSON.parse(options.body).messages[1].content.includes(input.corpus));
    return Response.json(response);
  };
  const bytes = Buffer.from(JSON.stringify(input),'utf8');
  const chineseByte = bytes.indexOf(Buffer.from('这是')) + 1;
  const status = await new Promise((resolve,reject) => {
    const req = request(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${key}`}},res => {res.resume();res.on('end',()=>resolve(res.statusCode));});
    req.on('error',reject);
    req.write(bytes.subarray(0,chineseByte));
    req.end(bytes.subarray(chineseByte));
  });
  assert.equal(status,200);
});

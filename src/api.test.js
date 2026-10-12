import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apiRequest } from './api.js';

test('desktop transport uses the isolated bridge and preserves errors and cancellation',async t=>{
  const previous=globalThis.window;
  t.after(()=>{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;});
  let requestId;
  globalThis.window={carsonBench:{request:async (id,route,key,input)=>{
    requestId=id;assert.equal(route,'models');assert.equal(key,'test-key');assert.equal(input,null);
    return {status:200,models:[{id:'deepseek-flash'}]};
  },cancel:()=>{}}};
  assert.deepEqual(await apiRequest('models',' test-key ',null),{models:[{id:'deepseek-flash'}]});
  assert.ok(requestId);
  window.carsonBench.request=async ()=>({status:402,error:'余额不足'});
  await assert.rejects(apiRequest('chat','test-key',{}),/余额不足/);
  let canceled=false;
  window.carsonBench.request=()=>new Promise(()=>{});
  window.carsonBench.cancel=id=>{assert.ok(id);canceled=true;};
  const controller=new AbortController();
  const pending=apiRequest('chat','test-key',{},controller.signal);
  controller.abort();
  await assert.rejects(pending,{name:'AbortError'});
  assert.ok(canceled);
});

import assert from 'node:assert/strict';
import { writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { dialog } from 'electron';

export async function checkDesktop(window,root) {
  const errors = [];
  window.webContents.on('console-message',details=>{if(details.level==='error')errors.push(details.message);});
  const result = await window.webContents.executeJavaScript(`(async () => {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const image = document.querySelector('.portrait-panel img');
    await image.decode();
    const keyInput = document.querySelector('input[type=password]');
    const denied = await window.carsonBench.request('smoke-invalid-key','models','invalid',null);
    const unknown = await window.carsonBench.request('smoke-invalid-route','other','invalid',null);
    const old = localStorage.getItem('carsonbench-v1');
    location.hash = 'challenge';
    return { title: document.title, bridge: window.carsonBench.version, nodeHidden: typeof require === 'undefined' && typeof process === 'undefined', image: image.naturalWidth, input: !!keyInput, initialAnswers: [...document.querySelectorAll('textarea')].every(el => !el.value), invalidKey: denied.status, unknownRoute: unknown.status, storage: !!old && JSON.parse(old).schema === 2, origin: location.origin };
  })()`);
  assert.equal(result.bridge,'1.1.0');
  assert.equal(result.nodeHidden,true);
  assert.ok(result.image>0 && result.input && result.initialAnswers && result.storage);
  assert.equal(result.invalidKey,401);
  assert.equal(result.unknownRoute,403);
  assert.equal(result.origin,'carsonbench://app');
  assert.equal(errors.length,0,errors.join('\n'));
  const originalSave=dialog.showSaveDialog;
  const filePath=path.join(root,'.desktop-test-profile/export.json');
  try {
    dialog.showSaveDialog=async()=>({canceled:true});
    assert.equal((await window.webContents.executeJavaScript(`window.carsonBench.saveRecord('CarsonBench-smoke.json','{"text":"原文与学生记录"}')`)).canceled,true);
    dialog.showSaveDialog=async()=>({canceled:false,filePath});
    const saved=await window.webContents.executeJavaScript(`window.carsonBench.saveRecord('CarsonBench-smoke.json','{"text":"原文与学生记录"}')`);
    assert.equal(saved.saved,true);
    assert.deepEqual(JSON.parse(await readFile(filePath,'utf8')),{text:'原文与学生记录'});
    const invalid=await window.webContents.executeJavaScript(`window.carsonBench.saveRecord('../outside.json','{}')`);
    assert.ok(invalid.error);
    result.nativeExport=true;result.cancelPreservesData=true;
  } finally {dialog.showSaveDialog=originalSave;}
  await window.webContents.executeJavaScript(`new Promise(resolve=>{const check=()=>Number(getComputedStyle(document.querySelector('.hero-visual')).opacity)>.99?resolve():requestAnimationFrame(check);check();})`);
  await writeFile(path.join(root,'.desktop-smoke-result.json'),JSON.stringify(result,null,2));
  await writeFile(path.join(root,'.desktop-smoke-preview.png'),(await window.webContents.capturePage()).toPNG());
  console.log('Desktop smoke checks passed:',JSON.stringify(result));
}

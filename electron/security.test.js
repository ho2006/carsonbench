import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { APP_URL, bundledFile, externalUrl, trustedPage } from './security.js';

test('desktop IPC trusts only the app document and external links use a fixed HTTPS allowlist',()=>{
  assert.ok(trustedPage(`${APP_URL}#challenge`));
  for(const url of ['https://app/index.html','carsonbench://other/index.html','carsonbench://app/other.html','carsonbench://user@app/index.html'])assert.equal(trustedPage(url),false);
  assert.ok(externalUrl('https://github.com/ho2006/carsonbench/releases'));
  for(const url of ['file:///C:/Windows','http://github.com','https://github.com.evil.example','https://user@github.com','https://github.com:444'])assert.equal(externalUrl(url),false);
});
test('bundled resources stay inside the app directory',()=>{
  const root=path.resolve('dist');
  assert.equal(bundledFile(root,APP_URL),path.join(root,'index.html'));
  for(const url of ['carsonbench://other/index.html','carsonbench://app/%2e%2e%2fsecret','carsonbench://app/..%5csecret','carsonbench://app/%00'])assert.throws(()=>bundledFile(root,url));
});

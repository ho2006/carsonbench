import { test } from 'node:test';
import assert from 'node:assert/strict';
import pack from './reading-pack.json' with { type: 'json' };
import experiment from './experiment.json' with { type: 'json' };
import { newExperiment } from '../experiment.js';
import { requestPayload } from '../protocol.js';

test('the provided EPUB has an identified edition and all question evidence resolves', () => {
  assert.equal(pack.source.isbn,'9787532742189');
  assert.deepEqual(pack.source.translators,['吕瑞兰','李长生']);
  assert.equal(pack.atlas.length,17);
  assert.equal(new Set(pack.excerpts.map(e=>e.id)).size,10);
  const ids = new Set(pack.excerpts.map(e=>e.id));
  for (const round of experiment.rounds) for (const id of round.evidenceIds) assert.ok(ids.has(id),id);
  for (const excerpt of pack.excerpts) assert.ok(pack.corpus.includes(`[${excerpt.id}]`) && pack.corpus.includes(excerpt.text));
});
test('a fresh experiment is ready with the same book text for human and all model rounds', () => {
  const record = newExperiment();
  assert.equal(record.started,false);
  assert.equal(record.corpus,pack.corpus);
  assert.ok(record.meta.edition.includes('吕瑞兰'));
  for (const answer of record.answers) assert.deepEqual(answer,{human:'',ai:''});
  for (let round=0;round<3;round++) {
    const payload = requestPayload({round,model:'deepseek-flash',corpus:record.corpus});
    assert.ok(payload.messages[1].content.includes(pack.corpus));
    assert.ok(payload.messages[1].content.includes(experiment.rounds[round].instructions));
    for (const id of experiment.rounds[round].evidenceIds) assert.ok(payload.messages[1].content.includes(id));
  }
});

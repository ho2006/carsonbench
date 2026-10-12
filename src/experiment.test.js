import { test } from 'node:test';
import assert from 'node:assert/strict';
import data from './data/experiment.json' with { type: 'json' };
import { emptyScores, totals, roundScore, restore } from './experiment.js';
test('missing scores never become a result; zero is a valid score', () => {
  assert.deepEqual(totals(emptyScores()), {human:null, ai:null});
  assert.equal(roundScore(data.rounds[0], {accuracy:0, evidence:0}), 0);
  assert.equal(roundScore(data.rounds[0], {accuracy:7, evidence:4}), null);
});
test('each round has equal weight, including the 30-point action rubric', () => {
  const scores = data.rounds.map(r => Object.fromEntries(['human','ai'].map(w => [w, Object.fromEntries(r.rubric.map(d => [d.key,d.max]))])));
  assert.deepEqual(totals(scores), {human:30, ai:30});
  scores[2].ai.ecology = '';
  assert.equal(totals(scores).ai, null);
});
test('invalid or outdated local records are rejected', () => {
  assert.equal(restore('{broken'), null);
  assert.equal(restore(JSON.stringify({schema:0})), null);
  const record = {schema:1, meta:data, answers:data.rounds.map(() => ({human:'旧学生示例',ai:'旧 AI 示例'})), scores:emptyScores()};
  assert.ok(restore(JSON.stringify(record)));
  record.scores[0].human.accuracy = -1;
  assert.equal(restore(JSON.stringify(record)), null);
});

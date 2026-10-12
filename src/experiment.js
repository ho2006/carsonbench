import data from './data/experiment.json' with { type: 'json' };
import readingPack from './data/reading-pack.json' with { type: 'json' };
import { PROMPT_VERSION, responseText } from './protocol.js';
export function newExperiment(meta = {}, corpus = readingPack.corpus) {
  return { schema: 2, mode: 'live', started: false, corpus, meta: {
    id: `CB-${crypto.randomUUID().slice(0,8)}`, date: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date()),
    model: 'deepseek-flash', modelVersion: '等待 API 返回', promptVersion: PROMPT_VERSION,
    textRange: data.textRange, edition: data.edition, evaluator: data.evaluator,
    readingPackId: readingPack.id, sourceHash: readingPack.source.epubSha256, ...meta,
  }, answers: data.rounds.map(() => ({ human: '', ai: '' })), scores: emptyScores(), runs: [] };
}
export const emptyScores = () => data.rounds.map(r => Object.fromEntries(['human', 'ai'].map(who => [who, Object.fromEntries(r.rubric.map(d => [d.key, '']))])));
export function saveApiResult(record, index, result, question) {
  const text = responseText(result.response);
  const answer = record.answers[index];
  const run = record.runs.find(r => r.id === answer.runId);
  if (question && !run) throw new Error('没有可追问的首答记录。');
  const id = crypto.randomUUID();
  return { ...record,
    meta: { ...record.meta, modelVersion: result.response.model },
    answers: record.answers.map((a,i) => i === index && !question ? { ...a, ai: text, runId: id } : a),
    runs: question ? record.runs.map(r => r.id === run.id ? { ...r, followups: [...r.followups, { question: question.trim(), ...result }] } : r)
      : [...record.runs, { id, round: index, humanAnswer: answer.human, promptVersion: PROMPT_VERSION, ...result, followups: [], scores: emptyScores()[index] }],
    scores: record.scores.map((s,i) => i === index && !question ? emptyScores()[index] : s),
  };
}
export function roundScore(round, values) {
  if (!round.rubric.every(d => typeof values?.[d.key] === 'number' && Number.isFinite(values[d.key]) && values[d.key] >= 0 && values[d.key] <= d.max)) return null;
  return round.rubric.reduce((sum, d) => sum + values[d.key], 0) / (round.id === 'action' ? 3 : 1);
}
export function totals(scores) {
  return Object.fromEntries(['human', 'ai'].map(who => {
    const values = data.rounds.map((r, i) => roundScore(r, scores?.[i]?.[who]));
    return [who, values.includes(null) ? null : values.reduce((a, b) => a + b, 0)];
  }));
}
export function restore(raw) {
  try {
    const value = JSON.parse(raw);
    if (![1,2].includes(value?.schema) || !Array.isArray(value.answers) || value.answers.length !== 3 || !Array.isArray(value.scores) || value.scores.length !== 3 || !value.meta || typeof value.meta !== 'object') return null;
    if (!['modelVersion', 'textRange', 'edition', 'evaluator'].every(k => typeof value.meta[k] === 'string')) return null;
    for (const [i, round] of data.rounds.entries()) for (const who of ['human', 'ai']) {
      if (typeof value.answers[i]?.[who] !== 'string') return null;
      for (const d of round.rubric) {
        const n = value.scores[i]?.[who]?.[d.key];
        if (n !== '' && !(typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= d.max)) return null;
      }
    }
    if (value.schema === 1) return { ...value, meta: { ...value.meta, model: 'deepseek-flash', edition: value.meta.edition.startsWith('待填写') ? '' : value.meta.edition, evaluator: value.meta.evaluator.startsWith('待填写') ? '' : value.meta.evaluator }, schema: 2, mode: 'demo', started: false, corpus: '', runs: [] };
    if (!['demo','live'].includes(value.mode) || typeof value.started !== 'boolean' || typeof value.corpus !== 'string' || value.corpus.length > 24000 || !Array.isArray(value.runs)) return null;
    if (value.mode === 'live' && !['id','date','model','promptVersion'].every(k => typeof value.meta[k] === 'string')) return null;
    for (const run of value.runs) {
      if (typeof run.id !== 'string' || !Number.isInteger(run.round) || !data.rounds[run.round] || typeof run.humanAnswer !== 'string' || !Array.isArray(run.request?.messages) || !Array.isArray(run.followups)) return null;
      responseText(run.response);
      for (const followup of run.followups) { if (typeof followup.question !== 'string') return null; responseText(followup.response); }
    }
    for (const answer of value.answers) if (answer.runId && !value.runs.some(run => run.id === answer.runId)) return null;
    return value;
  } catch { return null; }
}
export const fmt = n => n === null ? '—' : Number(n.toFixed(1)).toString();

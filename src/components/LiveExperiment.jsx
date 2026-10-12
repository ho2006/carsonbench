import { useState } from 'react';
import { ArrowUpRight, Check, KeyRound, LoaderCircle, LockKeyhole, Network, Play, RotateCcw, Square, Download, Upload, X } from 'lucide-react';
import { PARAMETERS, PROMPT_VERSION, SYSTEM_PROMPT, responseText } from '../protocol.js';
import data from '../data/experiment.json' with { type: 'json' };
import { fmt, roundScore } from '../experiment.js';
import { apiRequest } from '../api.js';
import { ReadingPack } from './BookContent.jsx';

export function ConnectionPanel({ record, setRecord, apiKey, setApiKey, busy, onStart, onNew, onDownload, onImport }) {
  const [models, setModels] = useState([{ id: 'deepseek-flash', name: 'DeepSeek Flash' }, { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro' }]);
  const [connection, setConnection] = useState('');
  const [checking, setChecking] = useState(false);
  const locked = record.started;
  const ready = apiKey.trim();
  const editMeta = (key, value) => setRecord(prev => ({ ...prev, meta: { ...prev.meta, [key]: value } }));
  async function connect() {
    setChecking(true); setConnection('');
    try {
      const result = await apiRequest('models', apiKey, null, AbortSignal.timeout(15000));
      setModels(result.models);
      if (!locked && !result.models.some(m => m.id === record.meta.model)) editMeta('model', result.models[0].id);
      setConnection('连接成功 · 已读取账户可用模型');
    } catch (error) { setConnection(error.name === 'TimeoutError' ? '连接超时，请稍后重试。' : error.name === 'TypeError' ? '连接失败，请检查网络与本地 API 服务。' : error.message); }
    finally { setChecking(false); }
  }
  async function start() {
    setChecking(true); setConnection('');
    try {
      const result = await apiRequest('models',apiKey,null,AbortSignal.timeout(15000));
      setModels(result.models);
      if (!result.models.some(m=>m.id === (record.meta.model || 'deepseek-flash'))) {
        setConnection('该账户未返回所选模型，请从更新后的列表选择模型。'); return;
      }
      setConnection('连接成功 · 固定阅读包已就绪'); await onStart();
    } catch (error) { setConnection(error.name === 'TimeoutError' ? '连接超时，请稍后重试。' : error.name === 'TypeError' ? '连接失败，请检查网络与本地 API 服务。' : error.message); }
    finally { setChecking(false); }
  }
  return <div className="live-setup">
    <div className="live-setup-head"><div><span className="eyebrow">LIVE EXPERIMENT / {PROMPT_VERSION}</span><h3>{locked ? '实验已开始，先阅读再独立作答。' : '阅读材料已就绪，输入 Key 即可开始。'}</h3></div><span className="pill">{locked ? 'LIVE / 材料已锁定' : 'EPUB / 已配好内容'}</span></div>
    {record.mode === 'demo' && <p className="legacy-note">当前保留的是旧演示记录。开始真实实验时会先下载备份，再清空示例回答和评分。</p>}
    <div className="connection-row"><label><span><KeyRound size={14}/> DeepSeek API Key</span><input type="password" autoComplete="off" placeholder="输入你自己的 API Key" value={apiKey} disabled={busy || checking} onChange={e => { setApiKey(e.target.value); setConnection(''); }}/></label><label><span>实验模型</span><select aria-label="实验模型" value={record.meta.model || 'deepseek-flash'} disabled={locked || busy || checking} onChange={e => editMeta('model',e.target.value)}>{!models.some(m => m.id === record.meta.model) && record.meta.model && <option value={record.meta.model}>{record.meta.model}</option>}{models.map(m => <option key={m.id} value={m.id}>{m.name} · {m.id}</option>)}</select></label><button className="button outline" disabled={!apiKey.trim() || busy || checking} onClick={connect}>{checking ? <LoaderCircle size={16} className="spin"/> : <Network size={16}/>} {checking ? '连接中…' : '验证连接'}</button></div>
    {connection && <p className="connection-status" role="status">{connection}</p>}
    <p className="key-note">密钥只保存在当前页面内存中，刷新后需重新输入。调用会把统一阅读材料、固定问题和追问发送给 DeepSeek，学生答案不发送。</p>
    <div className="prepared-meta"><div><small>EDITION</small><strong>上海译文 · 2007 中译本</strong><span>吕瑞兰 / 李长生译</span></div><div><small>READING PACK</small><strong>第 1、2、8、17 章</strong><span>10 段原著节选 · 三轮共同阅读</span></div><div><small>EVALUATION</small><strong>10 + 10 + 10 分</strong><span>固定问题 · 首答人工评分</span></div></div>
    <ReadingPack record={record}/>
    <div className="live-setup-footer"><span><LockKeyhole size={14}/> {locked ? '同一模型、同一文本、同一提示词贯穿三轮' : 'API 验证成功后锁定材料与模型，进入独立作答'}</span>{locked ? <button className="text-link" disabled={busy || checking} onClick={onNew}><Download size={14}/> 导出并开始新实验</button> : <button className="button primary" disabled={!ready || busy || checking} onClick={start}>{checking ? <LoaderCircle className="spin" size={16}/> : <ArrowUpRight size={16}/>} {checking ? '验证并准备实验…' : '开始真实实验'}</button>}</div>
    <details className="request-settings"><summary>固定调用参数与提示词版本</summary><p>{PROMPT_VERSION} · temperature = {PARAMETERS.temperature} · max_tokens = {PARAMETERS.max_tokens} · 思考模式关闭。每轮初始请求不包含其他轮的回答；追问单独记录，不计入首答评分。</p></details>
    <label className={`record-import text-link ${busy || checking ? 'disabled' : ''}`}><Upload size={14}/> 导入实验 JSON，继续已有实验<input type="file" accept="application/json,.json" aria-label="导入实验记录" disabled={busy || checking} hidden onChange={async e=>{const file=e.target.files?.[0];e.target.value='';if(!file)return;setChecking(true);try{await onImport(file);}finally{setChecking(false);}}}/></label>
    {record.mode === 'demo' && <div className="legacy-actions"><button className="text-link legacy-download" onClick={onDownload}>下载旧演示记录 <Download size={13}/></button><button className="text-link legacy-download" disabled={busy || checking} onClick={onNew}>导出旧记录并进入真实实验 <ArrowUpRight size={13}/></button></div>}
  </div>;
}

export function LiveCompare({ record, active, onAnswer, onRun, onReset, onCancel, busy, error, hasKey }) {
  const [followup, setFollowup] = useState('');
  const answer = record.answers[active];
  const run = record.runs.find(r => r.id === answer.runId);
  const running = busy?.round === active;
  const startable = record.started && answer.human.trim() && hasKey && !busy;
  const stoppedEarly = run && run.response.choices[0].finish_reason !== 'stop';
  return <>
    <div className="compare live-compare"><div className="answer-card human"><div className="answer-head"><span><span className="status-dot"/> HUMAN</span><small>{run ? '已锁定 · 独立阅读答案' : '学生独立回答'}</small></div><label className="sr-only" htmlFor="human-answer">学生回答</label><textarea id="human-answer" placeholder={record.started ? '先独立写下自己的理解，再运行 AI。' : '请先在上方连接 API 并开始实验。'} value={answer.human} disabled={!record.started || !!run || !!busy} onChange={e => onAnswer('human',e.target.value)} spellCheck="false"/><span className="answer-foot">{run ? '模型调用时已保存快照；重开本轮后可修改' : '点击运行时保存并锁定，学生答案不发送给模型'}</span></div>
    <div className="answer-card ai"><div className="answer-head"><span><Network size={14}/> DEEPSEEK</span><small>{run ? 'API 实际回答 · 原始首答' : '等待实际模型回答'}</small></div>{run ? <><div className="live-response" role="region" aria-label="DeepSeek 实际回答">{answer.ai}</div><span className="answer-foot">{run.response.model} · {run.receivedAt} · {run.response.usage?.total_tokens ?? '—'} tokens</span>{stoppedEarly && <p className="api-error">模型以 {run.response.choices[0].finish_reason || '未知原因'} 结束，回答可能不完整，请评阅后决定是否重跑。</p>}</> : <div className="reveal"><Network size={29} strokeWidth={1}/><p>{!record.started ? '先输入 Key、选择模型并开始实验。' : !answer.human.trim() ? '先完成学生独立回答。' : !hasKey ? '请输入 API Key 后运行。' : '准备好后，向 DeepSeek 提交本轮固定问题。'}</p><button className="button primary" disabled={!startable} onClick={() => onRun()}>{running ? <LoaderCircle size={16} className="spin"/> : <Play size={16}/>} {running ? '正在生成回答…' : '运行 DeepSeek 实验'}</button></div>}</div></div>
    <div className="live-round-actions">{run && <button className="text-link" disabled={!!busy} onClick={onReset}><RotateCcw size={14}/> 重开本轮（保留旧记录）</button>}{running && <button className="text-link" onClick={onCancel}><Square size={13}/> 取消请求</button>}<span>{run ? <><Check size={14}/> 首答已归档，追问不改变首答评分</> : '请求按账户实际用量计费，不自动重试'}</span></div>
    {error && <p className="api-error" role="alert">{error}</p>}
    {run && <div className="followups"><div className="followup-title"><h4>实验追问</h4><span>{run.followups.length} / 4 · 仅供讨论</span></div>{run.followups.map((f,i) => <details key={f.response.id || i}><summary>追问 {i+1}：{f.question}</summary><p>{responseText(f.response)}</p><small>{f.response.model} · {f.response.usage?.total_tokens ?? '—'} tokens</small></details>)}<div className="followup-compose"><label className="sr-only" htmlFor="followup">实验追问</label><textarea id="followup" maxLength={2000} placeholder="例如：请指出支持这项判断的具体段落。" value={followup} disabled={!!busy || run.followups.length >= 4} onChange={e => setFollowup(e.target.value)}/><button className="button outline" disabled={!!busy || !hasKey || !followup.trim() || run.followups.length >= 4} onClick={async () => { const ok = await onRun(followup); if (ok) setFollowup(''); }}>{running ? <LoaderCircle size={16} className="spin"/> : <ArrowUpRight size={16}/>} 提交追问</button></div></div>}
  </>;
}

export function ExperimentLog({ record, dialog, onDownload }) {
  return <dialog ref={dialog} className="record-dialog"><div className="dialog-header"><h2>Experiment log / {record.meta.id || 'CB-001'}</h2><button className="icon-button" aria-label="关闭记录" onClick={() => dialog.current.close()}><X/></button></div>
    <p className="demo-warning">{record.mode === 'live' ? `${record.runs.length} 次真实首答调用，追问单独归档。模型版本以各次 API 返回值为准。` : '旧演示记录；示例不是模型实测。'}</p>
    <dl>{[['实验模型',record.meta.model],['最近返回模型',record.meta.modelVersion],['日期',record.meta.date || data.date],['文本',record.meta.textRange],['译本',record.meta.edition],['评分人',record.meta.evaluator || '未填写'],['提示词版本',record.meta.promptVersion || 'CarsonBench-v1']].map(([label,value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    {record.mode === 'live' && <><details><summary>统一阅读材料（实验原始输入）</summary><pre>{record.corpus || '尚未锁定材料'}</pre></details><details><summary>完整固定提示词</summary><pre>{SYSTEM_PROMPT}</pre></details></>}
    {data.rounds.map((round,i) => <article key={round.id}><h3>0{i+1} / {round.title}</h3><p>{round.question}</p>{['human','ai'].map(who => <div key={who}><strong>{who === 'human' ? 'HUMAN' : 'AI'} · {fmt(roundScore(round,record.scores[i][who]))}/10</strong><p>{record.answers[i][who] || '尚未作答'}</p></div>)}</article>)}
    {record.runs.length > 0 && <div className="raw-runs"><h3>全部 API 调用档案</h3>{record.runs.map((run,i) => <details key={run.id}><summary>调用 {i+1} / 第 {run.round+1} 轮 / {run.response.model} / {run.followups.length} 次追问</summary><p>独立学生答案快照：{run.humanAnswer}</p><pre>{JSON.stringify(run,null,2)}</pre></details>)}</div>}
    <button className="button primary" onClick={onDownload}><Download size={16}/> 下载完整 JSON 记录</button>
  </dialog>;
}


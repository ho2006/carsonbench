import { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, ArrowRight, ArrowDown, Leaf, BookOpen, ScanLine, FlaskConical, Check, Download, Plus, Bird, Sprout, Network, RotateCcw, Menu } from 'lucide-react';
import data from './data/experiment.json' with { type: 'json' };
import { emptyScores, totals, roundScore, restore, fmt, newExperiment, saveApiResult } from './experiment.js';
import { SYSTEM_PROMPT, followupTurns } from './protocol.js';
import { ConnectionPanel, LiveCompare, ExperimentLog } from './components/LiveExperiment.jsx';
import { apiRequest } from './api.js';
import readingPack from './data/reading-pack.json' with { type: 'json' };
import { BookOverview, RoundEvidence } from './components/BookContent.jsx';

const links = [['about','实验介绍'],['protocol','实验设计'],['challenge','三关挑战'],['records','实验记录'],['results','评分与结论']];
const key = 'carsonbench-v1';
function initial() {
  try { const saved = restore(localStorage.getItem(key)); if (saved) return saved; } catch { /* Storage may be unavailable in private browsers. */ }
  return newExperiment();
}
function SectionHead({no, label, title, children}) {
  return <div className="section-head"><div><div className="eyebrow"><span>{no}</span> {label}</div><h2>{title}</h2></div><p>{children}</p></div>;
}
function NatureNetwork({silent = false}) {
  const nodes = [[25,180],[58,100],[108,148],[132,52],[189,94],[223,27],[258,139],[284,72],[329,175],[356,103],[401,53],[426,153],[472,89],[488,207],[382,249],[298,260],[199,224],[104,259],[59,226]];
  return <svg className={`network-art ${silent?'is-silent':''}`} viewBox="0 0 520 310" aria-hidden="true"><defs><linearGradient id="networkFade"><stop stopColor="#a3be82"/><stop offset="1" stopColor="#d9e4c6"/></linearGradient></defs>{nodes.map(([x,y],i) => <g key={i}><path d={`M${x},${y} L${nodes[(i+1)%nodes.length].join(',')} M${x},${y} L${nodes[(i+5)%nodes.length].join(',')}`} stroke="url(#networkFade)" strokeWidth=".8" opacity=".35"/><circle cx={x} cy={y} r={i%3===0?4:2} fill="#c4d5ac"/><circle className="pulse" style={{animationDelay:`${i*.3}s`}} cx={x} cy={y} r="8" stroke="#b7c9a8" fill="none" opacity=".25"/></g>)}<path d="M270 310 Q266 229 228 181 Q214 158 178 148 M266 262 Q303 202 344 190 M253 233 Q219 226 189 212" fill="none" stroke="#b7c9a8" strokeWidth="2"/>{[[221,177,-40],[185,151,-60],[318,210,40],[196,215,-70]].map(([x,y,a],i)=><ellipse key={i} cx={x} cy={y} rx="9" ry="25" transform={`rotate(${a} ${x} ${y})`} fill="#b7c9a8" opacity=".55"/>)}</svg>;
}
function Radar({scores}) {
  const axes = ['事实准确','证据支持','文学阐释','行动可行','生态影响'];
  const point = (i, v) => {const a = -Math.PI/2+i*Math.PI*2/5; return `${180+Math.cos(a)*v*106},${160+Math.sin(a)*v*106}`;};
  const values = who => [scores[0][who].accuracy/6, (scores[0][who].evidence/4+scores[1][who].evidence/4+scores[2][who].evidence/10)/3, scores[1][who].interpretation/6, scores[2][who].feasibility/10, scores[2][who].ecology/10];
  const ready = totals(scores);
  return <svg className="radar" viewBox="0 0 360 325" role="img" aria-label="人类与 AI 的五维评分雷达图，缺少评分时不绘制结果">{[.25,.5,.75,1].map(v=><polygon key={v} points={axes.map((_,i)=>point(i,v)).join(' ')} fill="none" stroke="#d9ddd0"/>)}{axes.map((label,i)=><g key={label}><line x1="180" y1="160" x2={point(i,1).split(',')[0]} y2={point(i,1).split(',')[1]} stroke="#d9ddd0"/><text x={point(i,1.32).split(',')[0]} y={Number(point(i,1.32).split(',')[1])+4} textAnchor="middle">{label}</text></g>)}{['human','ai'].map(who=>ready[who]!==null && <polygon key={who} points={values(who).map((v,i)=>point(i,v)).join(' ')} fill={who==='human'?'#355834':'#be8053'} fillOpacity=".12" stroke={who==='human'?'#355834':'#be8053'} strokeWidth="2"/>)}{ready.human===null && ready.ai===null && <text x="180" y="164" textAnchor="middle" className="radar-wait">等待实验数据</text>}</svg>;
}
export default function App() {
  const [record, setRecord] = useState(initial);
  const [active, setActive] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [vote, setVote] = useState(null);
  const [silent, setSilent] = useState(false);
  const [menu, setMenu] = useState(false);
  const [notice, setNotice] = useState('');
  const [conclusion, setConclusion] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(null);
  const [apiError, setApiError] = useState(null);
  const requestController = useRef(null);
  const dialog = useRef(null);
  const reduced = useReducedMotion();
  const r = data.rounds[active];
  const total = totals(record.scores);
  const complete = total.human !== null && total.ai !== null;
  const progress = data.rounds.filter((round,i)=>['human','ai'].every(who=>roundScore(round,record.scores[i][who])!==null)).length;
  useEffect(()=>{try {localStorage.setItem(key,JSON.stringify(record));} catch {setNotice('浏览器无法保存，请下载记录以保留实验数据。');}},[record]);
  useEffect(()=>{if (!notice) return; const id=setTimeout(()=>setNotice(''),6000); return ()=>clearTimeout(id);},[notice]);
  function answer(who,value) {setConclusion(false); setRecord(prev=>({...prev,answers:prev.answers.map((a,i)=>i===active?{...a,[who]:value}:a),scores:prev.scores.map((s,i)=>i===active?{...s,[who]:Object.fromEntries(r.rubric.map(d=>[d.key,'']))}:s)}));}
  function score(who,dimension,value) {
    setConclusion(false);
    setRecord(prev => {
      const scores = prev.scores.map((s,i) => i === active ? { ...s, [who]: { ...s[who], [dimension]: value } } : s);
      return { ...prev, scores, runs: prev.runs.map(run => run.id === prev.answers[active].runId ? { ...run, scores: scores[active] } : run) };
    });
  }
  async function download() {
    const exported = {...record,id:record.meta.id || data.id,date:record.meta.date || data.date,kind:record.mode === 'live' ? 'DeepSeek API 实验 / 人工评分' : '旧演示记录 / 非实测',questions:data.rounds.map(x=>x.question),prompt:record.mode === 'live' ? SYSTEM_PROMPT : 'CarsonBench-v1 旧演示提示词',totals:total,rubrics:data.rounds.map(x=>x.rubric),sourceMetadata:record.meta.readingPackId===readingPack.id?readingPack.source:null,exportedAt:new Date().toISOString()};
    try {
      const filename=`CarsonBench-${exported.id}.json`;
      const content=JSON.stringify(exported,null,2);
      if (window.carsonBench) {
        const result=await window.carsonBench.saveRecord(filename,content);
        if(result.error)throw new Error(result.error);
        if(result.canceled){setNotice('已取消保存，当前实验记录保留。');return false;}
      } else {
        const url=URL.createObjectURL(new Blob([content],{type:'application/json'})); const a=document.createElement('a'); a.href=url; a.download=filename; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
      }
      setNotice('完整实验记录已导出。'); return true;
    } catch(error) {setNotice(error.message || '导出失败，当前记录已保留。');return false;}
  }
  function resetScores() {setRecord(prev=>({...prev,scores:emptyScores(),runs:prev.runs.map(run=>prev.answers.some(a=>a.runId===run.id)?{...run,scores:emptyScores()[run.round]}:run)}));setConclusion(false);setNotice('已清空评分，回答与实验设置已保留。');}
  async function startExperiment() {
    if (record.mode === 'demo' && !await download()) return;
    const model = record.meta.model || 'deepseek-flash';
    setRecord({...newExperiment({model}),started:true});
    setActive(0); setConclusion(false); setApiError(null);
    setNotice('材料已锁定。先完成学生回答，再运行本轮 AI 实验。');
  }
  async function newSession() {
    if (!await download()) return;
    setRecord(newExperiment()); setActive(0); setConclusion(false); setApiError(null);
    setNotice('上次实验已导出，新的固定阅读包已就绪。');
  }
  async function importRecord(file) {
    try {
      if (!file || file.size > 8*1024*1024) throw new Error('请选择不超过 8 MB 的实验 JSON 文件。');
      const imported=restore(await file.text());
      if (!imported) throw new Error('实验记录格式不受支持，当前记录已保留。');
      if ((record.runs.length || record.answers.some(a=>a.human.trim() || a.ai.trim())) && !await download()) return false;
      setRecord(imported);setActive(0);setConclusion(false);setApiError(null);
      setNotice('实验记录已导入；输入 Key 后可继续实验。');return true;
    } catch(error) {setNotice(error.message);return false;}
  }
  function resetRound() {
    setRecord(prev=>({...prev,answers:prev.answers.map((a,i)=>i===active?{human:a.human,ai:''}:a),scores:prev.scores.map((s,i)=>i===active?emptyScores()[i]:s)}));
    setApiError(null); setConclusion(false); setNotice('本轮已重开，旧首答与追问仍保存在完整记录中。');
  }
  async function runModel(question) {
    if (busy || !record.started || !apiKey.trim() || !record.answers[active].human.trim()) return false;
    const index = active;
    const answer = record.answers[index];
    const run = record.runs.find(r => r.id === answer.runId);
    if ((!question && run) || (question && (!run || run.followups.length >= 4))) return false;
    const turns = question ? followupTurns(run,question) : [];
    const input = { round:index, corpus:record.corpus, model:record.meta.model, turns };
    const controller = new AbortController(); requestController.current = controller;
    setBusy({round:index,kind:question?'followup':'initial'}); setApiError(null);
    try {
      const result = await apiRequest('chat',apiKey,input,AbortSignal.any([controller.signal,AbortSignal.timeout(130000)]));
      setRecord(prev => saveApiResult(prev,index,result,question));
      setConclusion(false); setNotice(question?'追问已保存，首答及评分保持不变。':'DeepSeek 实际回答已保存，可以开始人工评分。'); return true;
    } catch (error) {
      setApiError({round:index,message:error.name==='AbortError'?'已取消请求，原有回答和记录已保留。已发送的请求仍可能计费。':error.name==='TimeoutError'?'请求超时，请稍后手动重试。':error.name==='TypeError'?'无法连接 API 服务，请检查网络及本地服务。':error.message}); return false;
    } finally {setBusy(null); requestController.current=null;}
  }
  const enterRound = i => {if(busy)return;setActive(i);setRevealed(false);};
  return <>
    <a className="skip-link" href="#challenge">跳至实验</a>
    <header className="header"><a className="brand" href="#"><span className="brand-icon"><Leaf size={19}/></span>Carson<span>Bench</span><span className="brand-dot">·</span></a><nav className={menu?'nav open':'nav'} aria-label="主导航">{links.map(([id,label])=><a key={id} href={`#${id}`} onClick={()=>setMenu(false)}>{label}</a>)}</nav><a className="header-cta" href="#challenge">进入实验室 <ArrowUpRight size={16}/></a><button className="menu-toggle icon-button" aria-label="切换导航" aria-expanded={menu} onClick={()=>setMenu(!menu)}><Menu/></button></header>
    <main>{window.carsonBench && <div className="desktop-status wrap"><span>CarsonBench Desktop · v{window.carsonBench.version}</span><span>阅读材料已内置 · 实验记录保存在此设备</span></div>}
      <section className="hero wrap">
        <div className="hero-copy"><div className="eyebrow"><span className="status-dot"/> HUMANITIES MEETS ARTIFICIAL INTELLIGENCE</div><h1>当 DeepSeek<br/>遇见<span className="serif green">卡森。</span></h1><div className="hero-english">Can artificial intelligence<br/>understand <em>Silent Spring?</em></div><p className="hero-desc">一场关于事实、隐喻与生态选择的人机阅读实验。<br/>从同一段文字出发，看看我们抵达怎样的理解。</p><div className="hero-actions"><a className="button primary" href="#challenge">开始实验 <ArrowUpRight size={18}/></a><a className="text-link" href="#protocol">查看实验设计 <ArrowRight size={17}/></a></div><div className="hero-foot"><span className="tiny-cross">＋</span><span>SILENT SPRING, 1962 — REVISITED IN 2026</span><span>开放课堂实验 / v1.1</span></div></div>
        <motion.div className="hero-visual" initial={reduced?false:{opacity:0,y:18}} animate={{opacity:1,y:0}} transition={{duration:.8}}>
          <div className="visual-top"><span>FIELD NOTES / 001</span><span className="live-label"><span className="status-dot"/> EXPERIMENT READY</span></div>
          <div className="portrait-panel"><img src="/rachel-carson.jpg" alt="自然作家与海洋生物学家 Rachel Carson 的历史肖像" onError={e=>{e.currentTarget.style.display='none';}}/><div className="portrait-fallback" aria-hidden="true"><BookOpen size={80}/><span>Rachel<br/>Carson</span></div><div className="portrait-caption"><span>THE HUMAN PERSPECTIVE</span><strong>Rachel Carson</strong><small>1907–1964 · Writer & biologist</small></div></div>
          <div className="tech-panel"><div className="tech-label">THE MACHINE PERSPECTIVE <ScanLine size={16}/></div><NatureNetwork/><div className="tech-bottom"><span>Language. Logic. Learning.</span><span>01 / AI</span></div></div><div className="visual-cross">×</div><div className="visual-bottom"><span>NATURE</span><span className="line"/><span>TECHNOLOGY</span><ArrowUpRight size={16}/></div>
        </motion.div>
      </section>
      <div className="ticker"><div className="wrap ticker-inner"><span><BookOpen size={16}/> ONE BOOK</span><span>同样文本</span><i>＋</i><span><Network size={16}/> TWO PERSPECTIVES</span><span>人机共读</span><i>＋</i><span><FlaskConical size={16}/> THREE ROUNDS</span><span>公平比较</span><span className="ticker-end">NO ASSUMED WINNER <ArrowUpRight size={15}/></span></div></div>
      <section id="about" className="wrap section about"><SectionHead no="01" label="THE EXPERIMENT" title={<>同一本书，<br/><span className="serif green">两种理解方式。</span></>}>CarsonBench 是一个人机阅读实验。我们让学生与 AI 在相同文本、相同问题、相同评分标准下，共同阅读《寂静的春天》。<br/><br/>目标不是证明谁更好，而是探索：AI 能否理解文学、生态与人的价值判断？</SectionHead><div className="principles">{[[BookOpen,'01','Same text','同样原著节选','固定 2007 中译本，统一 10 段原著节选。'],[Network,'02','Same questions','同样实验问题','事实、隐喻、行动，面对同样的三重挑战。'],[ScanLine,'03','Same evaluation','同样评分标准','用可追溯的证据评分，让差异有据可依。']].map(([Icon,no,en,title,desc])=><article key={no}><div className="principle-top"><Icon size={24} strokeWidth={1.3}/><span>{no}</span></div><h3>{en}</h3><strong>{title}</strong><p>{desc}</p></article>)}</div><BookOverview/></section>
      <section id="protocol" className="protocol"><div className="wrap section"><SectionHead no="02" label="A FAIR COMPARISON" title="先约定规则，再开始比较。">公平不是口号，是每一步都可以回看的实验设计。</SectionHead><div className="protocol-grid"><div className="steps">{['阅读原著','学生独立笔记','AI 生成回答','人工评分','比较理解差异'].map((s,i)=><div className="step" key={s}><span className="step-no">0{i+1}</span><div><small>STEP {i+1}</small><h3>{s}</h3><p>{['先统一译本、节选与阅读时间','在查看 AI 回答前保存自己的思考','固定提示词，不向模型展示学生回答','按同一量表评阅，建议匿名比较','比较证据和推理，不只比较总分'][i]}</p></div>{i<4&&<ArrowDown size={15} className="step-arrow"/>}</div>)}</div><div className="controls"><span className="eyebrow">CONTROLLED VARIABLES</span><h3>把变量留在记录里。</h3><ul>{['固定文本范围与译本','固定实验问题','固定提示词与上下文','保存模型名称及版本','保存完整回答和评分'].map(t=><li key={t}><Check size={16}/>{t}</li>)}</ul><details><summary>查看固定提示词 <Plus size={16}/></summary><p>{SYSTEM_PROMPT}</p></details><div className="protocol-note"><FlaskConical size={18}/><p>真实 API 实验<br/><small>固定节选与实验任务已准备好，输入 Key 并选择模型后开始。首答作为评分依据，追问另存供讨论。</small></p></div></div></div></div></section>
      <section id="challenge" className="wrap section challenges"><SectionHead no="03" label="THE READING CHALLENGE" title={<>从读懂事实，到<span className="serif green">作出选择。</span></>}>三轮挑战，逐步深入。先独立作答，再运行 DeepSeek，最后由人工评阅。</SectionHead><ConnectionPanel record={record} setRecord={setRecord} apiKey={apiKey} setApiKey={setApiKey} busy={!!busy} onStart={startExperiment} onNew={newSession} onDownload={download} onImport={importRecord}/><div className="round-tabs" role="tablist" aria-label="三轮挑战">{data.rounds.map((round,i)=><button key={round.id} disabled={!!busy} role="tab" id={`tab-${i}`} aria-selected={active===i} aria-controls="round-panel" tabIndex={active===i?0:-1} onKeyDown={e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowRight'?1:2))%3;enterRound(next);document.getElementById(`tab-${next}`).focus();}}} className={active===i?'round-tab active':'round-tab'} onClick={()=>enterRound(i)}><span className="tab-number">0{i+1}</span><div><small>ROUND {i+1} / {round.tag}</small><strong>{round.title}</strong></div>{['human','ai'].every(w=>roundScore(round,record.scores[i][w])!==null)?<Check size={19}/>:<ArrowUpRight size={19}/>}</button>)}</div>
        <div id="round-panel" role="tabpanel" aria-labelledby={`tab-${active}`} className="round-panel"><div className="question"><span className="eyebrow">ROUND 0{active+1} — {r.english.toUpperCase()}</span><h3>{r.question}</h3><span className="pill">{active===2?'原始 30 分 · 折算 10 分':'满分 10 分'} / 人工评分</span></div><RoundEvidence round={r} enabled={record.mode === 'demo' || !!record.answers[active].runId}/>
          {active===1 && <div className={`spring-scene ${silent?'silent':''}`}><div><Bird size={32}/><span className="serif">{silent?'Silent.':'Spring.'}</span><small>{silent?'ABSENCE · LOSS · REFLECTION':'BIRDS · FLOWERS · LIFE'}</small></div><NatureNetwork silent={silent}/><button className="button scene-button" aria-pressed={silent} onClick={()=>setSilent(!silent)}>{silent?'让春天回来':'如果鸟鸣消失'} <ArrowRight size={16}/></button></div>}
          {record.mode === 'live' ? <LiveCompare key={active} record={record} active={active} onAnswer={answer} onRun={runModel} onReset={resetRound} onCancel={()=>requestController.current?.abort()} busy={busy} error={apiError?.round===active?apiError.message:null} hasKey={!!apiKey.trim()}/> : <div className="compare"><div className="answer-card human"><div className="answer-head"><span><span className="status-dot"/> HUMAN</span><small>学生独立回答 · 可编辑</small></div><label className="sr-only" htmlFor="human-answer">学生回答</label><textarea id="human-answer" value={record.answers[active].human} onChange={e=>answer('human',e.target.value)} spellCheck="false"/><span className="answer-foot">示例起点 / 请替换为实际阅读笔记</span></div><div className="answer-card ai"><div className="answer-head"><span><Network size={14}/> DEEPSEEK</span><small>平台编写示例 · 非模型实测</small></div>{revealed?<><label className="sr-only" htmlFor="ai-answer">AI 回答</label><textarea id="ai-answer" value={record.answers[active].ai} onChange={e=>answer('ai',e.target.value)} spellCheck="false"/><span className="answer-foot">可粘贴实际 AI 回答 / 修改回答将清空该侧评分</span></>:<div className="reveal"><ScanLine size={29} strokeWidth={1}/><p>先留下你的理解，再看另一种视角。</p><button className="button outline" onClick={()=>setRevealed(true)}>展开 AI 示例 <Plus size={16}/></button></div>}</div></div>}
          {active===0 && <div className="evidence-strip"><span><BookOpen size={17}/> EVIDENCE / 证据入口</span><button className="text-link" onClick={()=>{const reading=document.querySelector('.preset-reading');reading.open=true;reading.scrollIntoView({behavior:reduced?'instant':'smooth'});}}>本次 EPUB 原文节选 <BookOpen size={14}/></button><a target="_blank" rel="noreferrer" href="https://www.acs.org/education/whatischemistry/landmarks/rachel-carson-silent-spring.html">ACS · 历史资料 <ArrowUpRight size={14}/></a></div>}
          {active===1 && <div className="audience"><span>你的第一感觉？<small>个人选择，不计入评分</small></span><div>{['环境警示','科技反思','人与自然关系'].map((t,i)=><button key={t} className={vote===i?'selected':''} aria-pressed={vote===i} onClick={()=>setVote(i)}>{[<Sprout size={16}/>,<Network size={16}/>,<Leaf size={16}/>][i]}{t}{vote===i&&<Check size={14}/>}</button>)}</div></div>}
          <div className="rubric-head"><span className="eyebrow">{active===2?'THREE LAYERS OF REVIEW':'HUMAN EVALUATION'}</span><span>人工评分 · 空白 ≠ 0 分</span></div><div className="rubric-grid">{r.rubric.map(d=><div className="rubric-card" key={d.key}><span className="rubric-en">{d.en}</span><h4>{d.label} <small>/{d.max}</small></h4><p>{d.hint}</p>{['human','ai'].map(who=><label className="score-row" key={who}><span>{who==='human'?'Human':'AI'}</span><div className="meter"><div style={{width:`${(record.scores[active][who][d.key]||0)/d.max*100}%`}}/></div><input type="number" min="0" max={d.max} step="1" value={record.scores[active][who][d.key]} placeholder="—" disabled={!!busy || !record.answers[active][who].trim() || (record.mode === 'live' && !record.answers[active].runId)} aria-label={`${r.title} ${who==='human'?'人类':'AI'} ${d.label}评分，满分${d.max}`} onChange={e=>{const n=e.target.value===''?'':Number(e.target.value);if(n===''||(Number.isFinite(n)&&n>=0&&n<=d.max))score(who,d.key,n);}}/></label>)}</div>)}</div><div className="round-footer"><span>本轮得分 <strong>Human {fmt(roundScore(r,record.scores[active].human))}</strong><strong>AI {fmt(roundScore(r,record.scores[active].ai))}</strong><small>/ 10</small></span><button className="text-link" onClick={()=>{if(active<2){enterRound(active+1);document.getElementById('challenge').scrollIntoView({behavior:reduced?'instant':'smooth'});}else document.getElementById('results').scrollIntoView({behavior:reduced?'instant':'smooth'});}}>{active<2?'进入下一轮':'查看评分汇总'} <ArrowRight size={17}/></button></div></div>
      </section>
      <section id="records" className="records"><div className="wrap section"><SectionHead no="04" label="REPRODUCIBLE BY DESIGN" title="每一次回答，都有迹可循。">保存实际请求、首答、追问与用量，完整记录可下载复核。</SectionHead><div className="log"><div className="log-title"><div><span className="status-dot"/><strong>Experiment log / {record.meta.id || 'CB-001'}</strong><span className="pill">{record.mode === 'live' ? `${record.runs.length} 次 API 首答` : '旧演示记录'}</span></div><button className="text-link" onClick={download}><Download size={16}/> 下载记录</button></div><div className="log-grid"><div><small>MODEL / LAST RESPONSE</small><strong>{record.mode === 'live' ? record.meta.modelVersion : '演示示例'}</strong></div><div><small>EXPERIMENT DATE</small><strong>{record.meta.date || data.date}</strong></div><div><small>PROMPT VERSION</small><strong>{record.meta.promptVersion || 'CarsonBench-v1'}</strong></div><div><small>FULL RESPONSE + FOLLOWUPS</small><button className="text-link" onClick={()=>dialog.current.showModal()}>查看完整记录 <ArrowUpRight size={14}/></button></div></div></div></div></section>
      <section id="results" className="wrap section results"><SectionHead no="05" label="READ THE DIFFERENCE" title="分数之外，理解的轮廓。">每轮等权 10 分，总计 30 分。第三轮原始 30 分除以 3，五维雷达图按各维度满分归一化。</SectionHead><div className="results-grid"><div className="radar-panel"><div className="radar-legend"><span><i/> Human</span><span><i/> AI</span></div><Radar scores={record.scores}/><p>证据维度为三轮证据得分比例的均值</p></div><div className="scoreboard"><div className="scoreboard-top"><span className="eyebrow">EXPERIMENT SCORE</span><span>{progress} / 3 轮已评分</span></div>{['human','ai'].map(who=><div className={`total ${who}`} key={who}><span>{who==='human'?'Human':'AI'}<small>{who==='human'?'人类阅读':'人工智能'}</small></span><strong>{fmt(total[who])}<small>/ 30</small></strong></div>)}<div className="result-status"><span className="status-dot"/>{complete?'评分已就绪 · 可以生成比较结论':'Waiting for experiment data'}</div><button className="button primary" disabled={!complete || !!busy} onClick={()=>{setConclusion(true);document.getElementById('conclusion').scrollIntoView({behavior:reduced?'instant':'smooth'});}}>生成实验结论 <ArrowUpRight size={17}/></button><button className="reset text-link" disabled={!!busy} onClick={resetScores}><RotateCcw size={13}/> 清空评分</button></div></div>
      </section>
      <section id="conclusion" className="conclusion"><div className="wrap section"><div className="eyebrow"><span>06</span> BEYOND THE BENCHMARK</div><h2>技术可以分析寂静。<br/><span className="serif">而我们，决定寂静为何重要。</span></h2>{conclusion&&complete?<div className="generated"><span className="eyebrow">基于当前人工录入评分 · 单次课堂比较</span><h3>{Math.abs(total.human-total.ai)<.05?'本次评分中，双方总分相同。':`${total.human>total.ai?'人类':'AI'}在本次评分中高出 ${fmt(Math.abs(total.human-total.ai))} 分。`}</h3><p>{data.rounds.map((round,i)=>`${round.title}：Human ${fmt(roundScore(round,record.scores[i].human))} / AI ${fmt(roundScore(round,record.scores[i].ai))}`).join('；')}。</p><p>这份记录描述的是当前回答与评分，不足以推断所有人或模型的能力。请结合文本证据、评分理由与更多样本，讨论差异从何而来。</p><button className="text-link" onClick={download}>下载结论与记录 <Download size={15}/></button></div>:<div className="pending-conclusion"><FlaskConical size={18}/><p>结论等待实验数据。<small>完成双方三轮评分后，在上方生成本次比较。下列为讨论方向，并非预设实验结果。</small></p></div>}<div className="reflection-grid"><div><span>01 / POSSIBILITIES</span><h3>AI 可以帮助我们什么？</h3>{['快速整理事实与问题','提供多角度的解释','构思可供检验的行动方案'].map(t=><p key={t}><Plus size={16}/>{t}</p>)}</div><div><span>02 / HUMAN RESPONSIBILITY</span><h3>什么仍需由人来承担？</h3>{['个人阅读体验','情感共鸣与生活经验','价值判断与行动责任'].map(t=><p key={t}><Leaf size={16}/>{t}</p>)}</div></div><div className="closing">“Technology can analyze the silence,<br/>but humans decide why the silence matters.”<span>CARSONBENCH / A QUESTION WORTH KEEPING OPEN</span></div></div></section>
    </main><footer className="wrap footer"><a className="brand" href="#"><Leaf size={19}/>CarsonBench</a><span>当 DeepSeek 遇见卡森 · 人文阅读实验</span><a href="https://commons.wikimedia.org/wiki/File:Rachel-Carson.jpg" target="_blank" rel="noreferrer">肖像：USFWS / Public domain <ArrowUpRight size={12}/></a><a href="#">回到顶部 ↑</a></footer>
    <ExperimentLog record={record} dialog={dialog} onDownload={download}/>
    <div role="status" aria-live="polite" className={notice?'toast show':'toast'}>{notice}</div>
  </>;
}

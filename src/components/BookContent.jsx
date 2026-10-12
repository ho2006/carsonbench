import { BookOpen, ArrowUpRight } from 'lucide-react';
import pack from '../data/reading-pack.json' with { type: 'json' };

export function BookOverview() {
  return <div className="book-overview"><div className="book-overview-head"><div><span className="eyebrow">READING ATLAS / 17 CHAPTERS</span><h3>跟着这本书，把问题读完整。</h3></div><span className="pill">2007 中译本 / EPUB 核对</span></div><div className="book-groups">{[[1,6,'01','认识生命之网'],[7,14,'02','追踪损失与代价'],[15,17,'03','寻找另一条道路']].map(([start,end,no,title]) => <details key={no}><summary><span>{no}</span><strong>{title}</strong><small>第 {start}–{end} 章</small></summary>{pack.atlas.filter(c=>c.chapter>=start&&c.chapter<=end).map(c=><article key={c.chapter}><h4>{c.title}</h4><p>{c.summary}</p></article>)}</details>)}</div><p className="book-source">蕾切尔·卡森著 / 吕瑞兰、李长生译 / 上海译文出版社 / 2007-11 / ISBN 9787532742189。导读为平台编写，实验评分依据为下方同一份原著节选。</p></div>;
}

export function ReadingPack({ record }) {
  const custom = record.started && record.corpus !== pack.corpus;
  return <details className="preset-reading"><summary><span><BookOpen size={17}/> {custom ? '查看本次锁定阅读材料' : '阅读统一原著节选'}</span><span>{custom ? record.corpus.length : pack.corpus.length} 字符 · 展开阅读 <ArrowUpRight size={14}/></span></summary>
    <div className="reading-source"><strong>{custom ? record.meta.edition : '《寂静的春天》· 上海译文出版社 2007 年中译本'}</strong><p>{custom ? record.meta.textRange : `固定包 ${pack.id} · 第 1、2、8、17 章 · ${pack.excerpts.length} 段`}</p><small>{pack.source.locatorNote}</small></div>
    {custom ? <pre>{record.corpus}</pre> : pack.excerpts.map(e=><article id={`text-${e.id}`} key={e.id}><div><span>{e.id}</span><strong>{e.title}</strong><small>正文第 {e.paragraph} 段</small></div><p>{e.text}</p></article>)}
    <p className="reading-rights">{pack.source.rights}书中材料有其写作年代，不等同今天的校园实测结果。</p>
  </details>;
}

export function RoundEvidence({ round, enabled }) {
  return <div className="round-evidence"><div><span className="eyebrow">READING TASK</span><p>{round.instructions}</p></div><div className="evidence-ids"><BookOpen size={15}/><span>证据定位</span>{round.evidenceIds.map(id => <span className="pill" key={id}>{id}</span>)}</div><details><summary>{enabled ? '展开人工评分细则' : '人工评分细则（完成首答后解锁）'}</summary>{enabled ? <div>{round.evaluation.map(t=><p key={t}>{t}</p>)}<p>由同一评分人或按统一规则的评阅组评分。评分人与回答身份分离更有利于减少偏差。</p></div> : <p>双方作答使用同一固定问题和维度，细则在模型首答返回后展示。</p>}</details></div>;
}

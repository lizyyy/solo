from __future__ import annotations

import json
import os
from typing import List, Optional, Dict, Any

from .models import (
    RunResult,
    DeltaAttribution,
    Material,
    StanceChange,
    SortInstability,
    Record,
)


def _histogram(values: List[float], bins: int = 10) -> Dict[str, Any]:
    counts = [0] * bins
    edges = [round(i / bins, 4) for i in range(bins + 1)]
    for v in values:
        idx = int(v * bins)
        if idx >= bins:
            idx = bins - 1
        if idx < 0:
            idx = 0
        counts[idx] += 1
    return {"edges": edges, "counts": counts}


def build_report_data(
    meta: Dict[str, Any],
    baseline: RunResult,
    adjusted: Optional[RunResult],
    attribution: Optional[DeltaAttribution],
    materials: List[Material],
    stance_changes: List[StanceChange],
    sort_instabilities: List[SortInstability],
    records: List[Record],
    adjustments: Dict[str, List[str]],
    audit_entries: List[Dict[str, Any]],
    max_score: float,
) -> Dict[str, Any]:
    base_by_id = {r.record_id: r for r in baseline.records}
    adj_by_id = {r.record_id: r for r in adjusted.records} if adjusted else {}
    mat_by_id = {m.id: m for m in materials}

    rec_rows = []
    for rec in records:
        br = base_by_id.get(rec.id)
        ar = adj_by_id.get(rec.id)
        adj_mats = adjustments.get(rec.id, [])
        adj_info = [
            {
                "material_id": mid,
                "title": mat_by_id[mid].title if mid in mat_by_id else mid,
                "stance": mat_by_id[mid].stance if mid in mat_by_id else "",
                "revised": len(mat_by_id[mid].revisions) > 1 if mid in mat_by_id else False,
            }
            for mid in adj_mats
        ]
        sc_for_rec = [
            {
                "material_id": sc.material_id,
                "title": sc.title,
                "from_stance": sc.from_stance,
                "to_stance": sc.to_stance,
                "reason": sc.reason,
                "author": sc.author,
                "at": sc.at,
            }
            for sc in stance_changes
            if mid_chain_targets_record(mat_by_id.get(sc.material_id), rec.id)
        ]
        rec_rows.append(
            {
                "id": rec.id,
                "name": rec.name,
                "base_score": rec.base_score,
                "effective_score": rec.effective_score,
                "boundary": br.is_boundary if br else False,
                "baseline_prob": br.pass_prob if br else None,
                "adjusted_prob": ar.pass_prob if ar else None,
                "passed": ar.passed if ar else (br.passed if br else None),
                "rank": rec.meta.get("rank"),
                "adjustments": adj_info,
                "stance_changes": sc_for_rec,
            }
        )

    mat_rows = [
        {
            "id": m.id,
            "type": m.type,
            "title": m.title,
            "author": m.author,
            "stance": m.stance,
            "revised": len(m.revisions) > 1,
            "revisions": [r.to_dict() for r in m.revisions],
            "payload": m.payload,
        }
        for m in materials
    ]

    audit_rows = [
        {
            "run_id": e.get("run_id"),
            "at": e.get("at"),
            "operator": e.get("operator"),
            "adjusted_param": e.get("adjusted_param"),
            "params": e.get("params"),
            "stance_changes": e.get("stance_changes", []),
            "sort_instabilities": e.get("sort_instabilities", []),
            "summary": e.get("summary", {}),
        }
        for e in audit_entries
    ]

    dist_base = _histogram(baseline.distribution)
    dist_adj = _histogram(adjusted.distribution) if adjusted else {"edges": dist_base["edges"], "counts": [0] * 10}

    data = {
        "meta": meta,
        "formula": baseline.formula,
        "unit": baseline.unit,
        "max_score": max_score,
        "params_baseline": baseline.params.to_dict(),
        "params_adjusted": adjusted.params.to_dict() if adjusted else None,
        "adjusted_param": (
            {
                "name": attribution.param_name,
                "old": attribution.baseline_value,
                "new": attribution.adjusted_value,
            }
            if attribution
            else None
        ),
        "aggregate": {
            "baseline": baseline.aggregate_pass_rate,
            "adjusted": adjusted.aggregate_pass_rate if adjusted else None,
            "delta": attribution.delta if attribution else None,
        },
        "records": rec_rows,
        "materials": mat_rows,
        "stance_changes": [s.to_dict() for s in stance_changes],
        "sort_instabilities": [s.to_dict() for s in sort_instabilities],
        "distribution": {"baseline": dist_base, "adjusted": dist_adj},
        "attribution": attribution.to_dict() if attribution else None,
        "audit": audit_rows,
    }
    return data


def mid_chain_targets_record(material: Optional[Material], record_id: str) -> bool:
    if material is None:
        return False
    if material.type != "oral_explanation":
        return False
    return str(material.payload.get("target_record", "")) == record_id


_HTML_TEMPLATE = r"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>__TITLE__</title>
<style>
* { box-sizing: border-box; }
body { margin:0; font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif; color:#1f2933; background:#f4f6f9; }
header { background:linear-gradient(135deg,#3b5bdb,#5c3bbf); color:#fff; padding:18px 28px; box-shadow:0 2px 8px rgba(0,0,0,.12);}
header h1 { margin:0 0 6px; font-size:20px; }
header .meta { font-size:13px; opacity:.92; display:flex; gap:18px; flex-wrap:wrap; }
header .meta b { font-weight:600; }
.wrap { max-width:1180px; margin:0 auto; padding:22px; }
nav.tabs { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:16px; position:sticky; top:0; background:#f4f6f9; padding:8px 0; z-index:5;}
nav.tabs button { border:1px solid #d8dee9; background:#fff; padding:7px 14px; border-radius:8px; cursor:pointer; font-size:13px; color:#3b4252;}
nav.tabs button.active { background:#3b5bdb; color:#fff; border-color:#3b5bdb;}
section.panel { display:none; background:#fff; border:1px solid #e5e9f0; border-radius:12px; padding:18px; margin-bottom:18px; box-shadow:0 1px 3px rgba(0,0,0,.04);}
section.panel.active { display:block; }
h2 { margin:0 0 12px; font-size:16px; color:#2b3440; border-left:4px solid #3b5bdb; padding-left:10px;}
.kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; margin-bottom:14px;}
.kpi { background:#f8f9fc; border:1px solid #eef1f6; border-radius:10px; padding:12px;}
.kpi .label { font-size:12px; color:#6b7280; }
.kpi .value { font-size:22px; font-weight:700; color:#1f2933; margin-top:4px;}
.kpi .value.up { color:#2f9e44;} .kpi .value.down { color:#e03131;}
.kpi .sub { font-size:11px; color:#9aa3b2; }
.chart-box { background:#fff; border:1px solid #eef1f6; border-radius:10px; padding:14px; margin:10px 0; }
.chart-box .hint { font-size:12px; color:#868e96; margin-top:6px;}
.legend { display:flex; gap:14px; font-size:12px; margin:6px 0; }
.legend span { display:inline-flex; align-items:center; gap:5px;}
.legend i { width:12px; height:12px; border-radius:3px; display:inline-block;}
.card { border:1px solid #eef1f6; border-radius:10px; padding:12px 14px; margin:10px 0; background:#fff; transition:box-shadow .2s, border-color .2s;}
.card.flash { box-shadow:0 0 0 3px #ffa94d; border-color:#ffa94d; }
.card.boundary { border-left:4px solid #f59f00;}
.card.problem { border-left:4px solid #e03131;}
.card.ok { border-left:4px solid #2f9e44;}
.card h3 { margin:0 0 6px; font-size:14px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;}
.badge { font-size:11px; padding:2px 7px; border-radius:10px; background:#eef1f6; color:#495057;}
.badge.warn { background:#fff3bf; color:#976604;}
.badge.danger { background:#ffe3e3; color:#c92a2a;}
.badge.ok { background:#d3f9d8; color:#2b8a3e;}
.badge.info { background:#d0ebff; color:#1c7ed6;}
.tag { font-size:11px; color:#868e96; }
.muted { color:#868e96; font-size:12px;}
.rev { background:#f8f9fc; border-left:3px solid #ced4da; padding:8px 10px; margin:6px 0; border-radius:0 6px 6px 0; font-size:12px;}
.rev.changed { border-left-color:#fa5252; background:#fff5f5;}
.kv { font-size:12px; margin:3px 0;}
.kv b { color:#495057;}
.explain { background:#f8f9fc; border:1px dashed #ced4da; border-radius:8px; padding:10px 12px; margin:8px 0; font-size:12px; white-space:pre-wrap; line-height:1.7;}
.timeline-item { border-left:2px solid #3b5bdb; padding:6px 0 6px 14px; margin:6px 0; position:relative;}
.timeline-item::before { content:""; position:absolute; left:-5px; top:10px; width:8px; height:8px; border-radius:50%; background:#3b5bdb;}
.timeline-item .ti-head { font-size:13px; font-weight:600;}
.timeline-item .ti-sub { font-size:12px; color:#6b7280;}
details summary { cursor:pointer; font-size:13px; color:#3b5bdb; padding:4px 0;}
ul.tight { margin:4px 0; padding-left:18px;} ul.tight li{ font-size:12px; margin:2px 0;}
svg .bar { cursor:pointer; transition:opacity .15s;}
svg .bar:hover { opacity:.78;}
svg text { font-family:inherit; }
.bar-label { font-size:10px; fill:#495057;}
.grid { display:grid; grid-template-columns:1fr 1fr; gap:14px;}
@media(max-width:820px){ .grid{ grid-template-columns:1fr;} }
</style>
</head>
<body>
<header>
  <h1>概率模拟参数回放 · 报告</h1>
  <div class="meta" id="metaBar"></div>
</header>
<div class="wrap">
  <nav class="tabs" id="tabs">
    <button data-tab="overview" class="active">概览</button>
    <button data-tab="records">记录明细</button>
    <button data-tab="materials">材料</button>
    <button data-tab="stance">口径变更</button>
    <button data-tab="sort">排序不稳定</button>
    <button data-tab="audit">审计时间线</button>
  </nav>

  <section class="panel active" id="tab-overview">
    <div class="kpis" id="kpis"></div>
    <div class="grid">
      <div class="chart-box"><h2>各记录通过概率（基线 vs 调整）</h2><div id="chart-records"></div><div class="hint">点击任一条形 → 跳转并高亮对应记录明细（解决“图表好看却点不回明细”）。</div></div>
      <div class="chart-box"><h2>试验通过率分布直方图</h2><div id="chart-dist"></div><div class="hint">点击区间查看该区间试验计数。</div></div>
    </div>
    <div class="chart-box"><h2>参数复算 delta 归因</h2><div id="chart-delta"></div><div id="delta-explain"></div></div>
  </section>

  <section class="panel" id="tab-records"><h2>记录明细（含问题样本）</h2><div id="record-cards"></div></section>
  <section class="panel" id="tab-materials"><h2>输入材料</h2><div id="material-cards"></div></section>
  <section class="panel" id="tab-stance"><h2>口径变更追踪（临时改判）</h2><div id="stance-cards"></div></section>
  <section class="panel" id="tab-sort"><h2>排序不稳定 · 待确认原因与处理去向</h2><div id="sort-cards"></div></section>
  <section class="panel" id="tab-audit"><h2>审计时间线（下一班可追溯）</h2><div id="audit-list"></div></section>
</div>
<script>
var D = __REPORT_DATA__;
function el(t,cls,txt){var e=document.createElement(t);if(cls)e.className=cls;if(txt!=null)e.textContent=txt;return e;}
function pct(x){return (x==null||isNaN(x))?'—':(x*100).toFixed(1)+'%';}
function num(x,d){d=d==null?3:d;return (x==null||isNaN(x))?'—':Number(x).toFixed(d);}
function fmt(x){return (x==null||isNaN(x))?'—':x;}
function flash(id){var n=document.getElementById(id);if(!n)return;n.classList.add('flash');n.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(function(){n.classList.remove('flash');},1800);}

document.getElementById('metaBar').innerHTML =
  '<span><b>run_id</b> '+D.meta.run_id+'</span>'+
  '<span><b>操作员</b> '+esc(D.meta.operator)+'</span>'+
  '<span><b>时间</b> '+esc(D.meta.at)+'</span>'+
  '<span><b>输入</b> '+esc(D.meta.input_dir)+'</span>'+
  '<span><b>输出</b> '+esc(D.meta.output_dir)+'</span>'+
  '<span><b>公式</b> '+esc(D.formula)+'</span>'+
  '<span><b>单位</b> '+esc(D.unit)+' (满分 '+D.max_score+')</span>';
function esc(s){s=(s==null)?'':String(s);return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

(function tabs(){
  var bs=document.querySelectorAll('#tabs button');
  bs.forEach(function(b){b.onclick=function(){bs.forEach(function(x){x.classList.remove('active');document.getElementById('tab-'+x.dataset.tab).classList.remove('active');});b.classList.add('active');document.getElementById('tab-'+b.dataset.tab).classList.add('active');};});
})();

(function kpis(){
  var box=document.getElementById('kpis');
  function k(label,val,sub,cls){var d=el('div','kpi');d.appendChild(el('div','label',label));var v=el('div','value '+(cls||''),val);d.appendChild(v);if(sub)d.appendChild(el('div','sub',sub));return d;}
  box.appendChild(k('基线通过率',pct(D.aggregate.baseline),'n_trials='+D.params_baseline.n_trials));
  if(D.aggregate.adjusted!=null){
    var dv=D.aggregate.delta,cls=dv>=0?'up':'down';
    box.appendChild(k('调整后通过率',pct(D.aggregate.adjusted),null));
    box.appendChild(k('delta',num(dv,4),cls));
    box.appendChild(k('调整参数',D.adjusted_param.name+'：'+fmt(D.adjusted_param.old)+'→'+fmt(D.adjusted_param.new)));
  }
  var nb=D.records.filter(function(r){return r.boundary;}).length;
  var prob=D.records.filter(function(r){return r.adjustments.length>0||r.stance_changes.length>0||(r.baseline_prob!=null&&r.baseline_prob<0.5&&r.baseline_prob>0);}).length;
  box.appendChild(k('边界样本',nb,'|eff−thr|≤2σ'));
  box.appendChild(k('待确认问题',D.sort_instabilities.length+' 排序 / '+D.stance_changes.length+' 口径变更','见对应页签'));
})();

(function chartRecords(){
  var box=document.getElementById('chart-records');
  var recs=D.records, n=recs.length;
  var W=560,H=240,ml=34,mb=40,mr=10,mt=14,slot=Math.max(28,(W-ml-mr)/n);
  var bw=Math.min(14,slot/2-3);
  var svg='<svg viewBox="0 0 '+W+' '+H+'" width="100%" style="max-width:620px">';
  svg+='<line x1="'+ml+'" y1="'+mt+'" x2="'+ml+'" y2="'+(H-mb)+'" stroke="#adb5bd"/>';
  for(var g=0;g<=4;g++){var y=mt+(H-mt-mb)*g/4;svg+='<line x1="'+ml+'" y1="'+y+'" x2="'+(W-mr)+'" y2="'+y+'" stroke="#eef1f6"/>'+'<text x="'+(ml-4)+'" y="'+(y+3)+'" text-anchor="end" font-size="9" fill="#868e96">'+num(1-g/4,1)+'</text>';}
  svg+='<line x1="'+ml+'" y1="'+(mt+(H-mt-mb)/2)+'" x2="'+(W-mr)+'" y2="'+(mt+(H-mt-mb)/2)+'" stroke="#fa5252" stroke-dasharray="4 3"/><text x="'+(W-mr)+'" y="'+(mt+(H-mt-mb)/2-3)+'" text-anchor="end" font-size="9" fill="#fa5252">P=0.5</text>';
  recs.forEach(function(r,i){
    var slotX=ml+ i*slot + (slot-2*bw-2)/2;
    var xBase=slotX, xAdj=slotX+bw+2;
    function bar(p,x,fill,key){if(p==null)return '';var h=(H-mt-mb)*Math.max(0,Math.min(1,p));var y=H-mb-h;return '<rect class="bar" x="'+x+'" y="'+y+'" width="'+bw+'" height="'+h+'" fill="'+fill+'" data-rec="'+r.id+'" data-key="'+key+'"><title>'+esc(r.name)+'('+r.id+'): '+key+' '+pct(p)+'</title></rect>';}
    svg+=bar(r.baseline_prob,xBase,'#4dabf7','基线');
    svg+=bar(r.adjusted_prob,xAdj,'#ff922b','调整');
    if(r.boundary)svg+='<text x="'+(slotX+bw+1)+'" y="'+(H-mb+12)+'" font-size="11" fill="#f59f00">★</text>';
    svg+='<text class="bar-label" x="'+(slotX+bw+1)+'" y="'+(H-mb+26)+'" text-anchor="middle">'+esc(r.id)+'</text>';
  });
  svg+='</svg>';
  svg+='<div class="legend"><span><i style="background:#4dabf7"></i>基线</span><span><i style="background:#ff922b"></i>调整后</span><span style="color:#f59f00">★ 边界样本</span></div>';
  box.innerHTML=svg;
  box.querySelectorAll('.bar').forEach(function(b){b.onclick=function(){document.getElementById('tabs').querySelector('[data-tab=records]').click();flash('rec-'+b.getAttribute('data-rec'));};});
})();

(function chartDist(){
  var box=document.getElementById('chart-dist');
  var b=D.distribution.baseline, a=D.distribution.adjusted, edges=b.edges, n=b.edges.length-1;
  var W=560,H=200,ml=30,mb=30,mr=10,mt=10;
  var maxc=Math.max.apply(null,b.counts.concat(a.counts).concat([1]));
  var bw=Math.min(18,((W-ml-mr)/n/2)-2);
  var svg='<svg viewBox="0 0 '+W+' '+H+'" width="100%" style="max-width:620px">';
  for(var g=0;g<=4;g++){var y=mt+(H-mt-mb)*g/4;svg+='<line x1="'+ml+'" y1="'+y+'" x2="'+(W-mr)+'" y2="'+y+'" stroke="#eef1f6"/>'+'<text x="'+(ml-4)+'" y="'+(y+3)+'" text-anchor="end" font-size="9" fill="#868e96">'+Math.round(maxc*(1-g/4))+'</text>';}
  for(var i=0;i<n;i++){
    var x0=ml+i*((W-ml-mr)/n)+4;
    function bar(c,fill,key){if(!c)return '';var h=(H-mt-mb)*(c/maxc);var y=H-mb-h;return '<rect class="bar" x="'+x0+'" y="'+y+'" width="'+bw+'" height="'+h+'" fill="'+fill+'"><title>['+num(edges[i],1)+','+num(edges[i+1],1)+') '+key+': '+c+' 次</title></rect>';}
    svg+=bar(b.counts[i],'#4dabf7','基线');
    svg+=bar(a.counts[i],'#ff922b','调整');
    if(i%2===0)svg+='<text class="bar-label" x="'+(x0+bw)+'" y="'+(H-mb+12)+'" text-anchor="middle">'+num(edges[i],1)+'</text>';
  }
  svg+='</svg>';
  svg+='<div class="legend"><span><i style="background:#4dabf7"></i>基线</span><span><i style="background:#ff922b"></i>调整后</span><span class="muted">横轴：单次试验整体通过率；纵轴：试验次数</span></div>';
  box.innerHTML=svg;
})();

(function chartDelta(){
  var box=document.getElementById('chart-delta');
  if(!D.attribution){box.innerHTML='<div class="muted">本次未进行参数复算（无 --adjust），无 delta 归因。</div>';return;}
  var A=D.attribution, be=A.boundary_effect, ne=A.non_boundary_effect, tot=Math.abs(be)+Math.abs(ne)||1;
  var W=560,H=70,ml=10,mr=10;
  var seg=function(val,fill,label){var w=(Math.abs(val)/tot)*(W-ml-mr);return '<rect x="'+ml+'" y="18" width="'+w.toFixed(1)+'" height="30" fill="'+fill+'"><title>'+label+': '+num(val,4)+'</title></rect>'+(w>40?'<text x="'+(ml+w/2)+'" y="38" text-anchor="middle" font-size="11" fill="#fff">'+label+'</text>':'');};
  var off=0, bars='';
  function piece(val,fill,label){var w=(Math.abs(val)/tot)*(W-ml-mr);bars+='<rect class="bar" x="'+(ml+off)+'" y="18" width="'+w.toFixed(1)+'" height="30" fill="'+fill+'"><title>'+label+': '+num(val,4)+'</title></rect>';if(w>46)bars+='<text x="'+(ml+off+w/2)+'" y="38" text-anchor="middle" font-size="11" fill="#fff">'+label+'</text>';off+=w;}
  piece(be,'#f59f00','边界样本');
  piece(ne,'#868e96','非边界');
  var svg='<svg viewBox="0 0 '+W+' '+H+'" width="100%" style="max-width:620px">'+bars+'</svg>';
  box.innerHTML=svg+'<div class="legend"><span><i style="background:#f59f00"></i>边界样本贡献</span><span><i style="background:#868e96"></i>非边界贡献</span><span class="muted">delta='+num(A.delta,4)+' = 边界 '+num(be,4)+' + 非边界 '+num(ne,4)+'</span></div>';
  var ex=document.getElementById('delta-explain');
  ex.innerHTML='<div class="explain"><b>为什么结果变化（公式）</b>\n'+esc(A.formula_explanation)+'\n\n<b>单位口径</b>\n'+esc(A.unit_explanation)+'\n\n<b>边界样本</b>\n'+esc(A.boundary_explanation)+'</div>';
})();

(function recordCards(){
  var box=document.getElementById('record-cards');
  D.records.forEach(function(r){
    var c=el('div','card '+(r.boundary?'boundary':(r.adjustments.length||r.stance_changes.length?'problem':'ok')),'');
    c.id='rec-'+r.id;
    var h=el('h3','',r.name+' ('+r.id+')');
    h.appendChild(el('span','badge','rank '+r.rank));
    if(r.boundary)h.appendChild(el('span','badge warn','边界样本 ★'));
    if(r.adjustments.length)h.appendChild(el('span','badge danger','含人工调整'));
    if(r.passed===false)h.appendChild(el('span','badge danger','未通过'));
    else if(r.passed===true)h.appendChild(el('span','badge ok','通过'));
    c.appendChild(h);
    c.appendChild(el('div','kv','<b>基础分</b> '+num(r.base_score,1)+'　<b>有效分</b> '+num(r.effective_score,1)+(r.base_score!==r.effective_score?'　（差 '+(r.effective_score-r.base_score).toFixed(1)+'，来自人工调整）':'')));
    c.appendChild(el('div','kv','<b>基线 P(通过)</b> '+pct(r.baseline_prob)+(r.adjusted_prob!=null?'　<b>调整后</b> '+pct(r.adjusted_prob)+'　<b>Δ</b> '+(r.adjusted_prob!=null&&r.baseline_prob!=null?num(r.adjusted_prob-r.baseline_prob,4):''):'')));
    if(r.adjustments.length){
      var ul=el('ul','tight');r.adjustments.forEach(function(a){var li=el('li','','');li.innerHTML='<b>'+esc(a.title)+'</b> ('+esc(a.material_id)+')'+(a.revised?' <span class="badge warn">改过口径</span>':'')+'：'+esc(a.stance);ul.appendChild(li);});c.appendChild(el('div','muted','人工调整来源：'));c.appendChild(ul);
    }
    if(r.stance_changes.length){
      var ul2=el('ul','tight');r.stance_changes.forEach(function(s){var li=el('li','','');li.innerHTML='<b>'+esc(s.title)+'</b> '+esc(s.author)+'：'+esc(s.from_stance)+' → '+esc(s.to_stance)+'（'+esc(s.reason)+'）';ul2.appendChild(li);});c.appendChild(el('div','muted','影响本记录的临时改判：'));c.appendChild(ul2);
    }
    box.appendChild(c);
  });
})();

(function materialCards(){
  var box=document.getElementById('material-cards');
  D.materials.forEach(function(m){
    var c=el('div','card '+(m.revised?'problem':'ok'),'');c.id='mat-'+m.id;
    var h=el('h3','',m.title);
    h.appendChild(el('span','badge info',m.type));
    h.appendChild(el('span','badge','作者 '+m.author));
    if(m.revised)h.appendChild(el('span','badge danger','改过口径'));
    c.appendChild(h);
    c.appendChild(el('div','kv','<b>当前口径</b> '+m.stance));
    if(m.revisions.length){
      var dl=el('details','');dl.appendChild(el('summary','','修订历史 ('+m.revisions.length+')'));
      m.revisions.forEach(function(rv,i){var d=el('div','rev '+(i>0&&rv.stance!==m.revisions[i-1].stance?'changed':''));d.innerHTML='<b>'+esc(rv.at)+'</b> · '+esc(rv.by)+(rv.reason?' · '+esc(rv.reason):'')+'<br>'+esc(rv.stance);dl.appendChild(d);});
      c.appendChild(dl);
    }
    box.appendChild(c);
  });
})();

(function stanceCards(){
  var box=document.getElementById('stance-cards');
  if(!D.stance_changes.length){box.appendChild(el('div','muted','未检测到口径变更（材料口径在修订间未发生 stance 变化）。'));return;}
  D.stance_changes.forEach(function(s){
    var c=el('div','card problem','');c.id='stance-'+s.material_id;
    var h=el('h3','','临时改判：'+s.title);
    h.appendChild(el('span','badge danger','改过口径'));
    h.appendChild(el('span','badge','作者 '+s.author));
    c.appendChild(h);
    c.appendChild(el('div','kv','<b>变更时间</b> '+s.at));
    c.appendChild(el('div','explain','<b>原口径</b>\n'+s.from_stance+'\n\n<b>改判后</b>\n'+s.to_stance+'\n\n<b>原因</b>\n'+s.reason));
    c.appendChild(el('div','muted','下一班可通过“审计时间线”追溯到本次改判的 run_id、操作员与原因。'));
    box.appendChild(c);
  });
})();

(function sortCards(){
  var box=document.getElementById('sort-cards');
  if(!D.sort_instabilities.length){box.appendChild(el('div','muted','未检测到排序不稳定（无并列排序键）。'));return;}
  D.sort_instabilities.forEach(function(s,i){
    var c=el('div','card problem','');c.id='sort-'+i;
    var h=el('h3','','排序不稳定 #'+(i+1)+'：'+s.sort_key+' 并列 '+s.tied_value);
    h.appendChild(el('span','badge danger','排序不稳定'));
    h.appendChild(el('span','badge','涉及 '+s.record_ids.length+' 条'));
    c.appendChild(h);
    var ul=el('ul','tight');s.record_ids.forEach(function(rid){var li=el('li','',rid);ul.appendChild(li);});c.appendChild(ul);
    c.appendChild(el('div','explain','<b>待确认原因</b>\n'+s.reason_pending+'\n\n<b>处理去向</b>\n'+s.resolution));
    box.appendChild(c);
  });
})();

(function auditList(){
  var box=document.getElementById('audit-list');
  if(!D.audit.length){box.appendChild(el('div','muted','（暂无历史审计记录；本次为首次运行，已写入 audit_trail.jsonl）'));return;}
  D.audit.forEach(function(e){
    var it=el('div','timeline-item','');
    it.appendChild(el('div','ti-head','run_id '+e.run_id+' · '+e.operator+(e.adjusted_param?' · 复算 '+e.adjusted_param:'')));
    it.appendChild(el('div','ti-sub',e.at+' · 材料 '+(e.params?'':'')+Object.keys(e.summary||{}).length+' 项摘要'));
    var st=e.stance_changes||[];
    if(st.length){
      var dl=el('details','');dl.appendChild(el('summary','','本次涉及口径变更 '+st.length+' 条（可追溯临时改判）'));
      st.forEach(function(s){var d=el('div','rev changed');d.innerHTML='<b>'+esc(s.title)+'</b> '+esc(s.author)+' · '+esc(s.at)+'<br>'+esc(s.from_stance)+' → '+esc(s.to_stance)+'<br>原因：'+esc(s.reason);dl.appendChild(d);});
      it.appendChild(dl);
    }
    var si=e.sort_instabilities||[];
    if(si.length){
      var dl2=el('details','');dl2.appendChild(el('summary','','排序不稳定 '+si.length+' 处'));
      si.forEach(function(s){var d=el('div','rev');d.innerHTML=esc(s.sort_key)+' 并列 '+s.tied_value+'：'+s.record_ids.join(', ');dl2.appendChild(d);});
      it.appendChild(dl2);
    }
    box.appendChild(it);
  });
})();
</script>
</body>
</html>
"""


def render_report(data: Dict[str, Any], title: str = "概率模拟参数回放 报告") -> str:
    json_str = json.dumps(data, ensure_ascii=False)
    html = _HTML_TEMPLATE.replace("__REPORT_DATA__", json_str).replace("__TITLE__", title)
    return html


def write_report(output_dir: str, data: Dict[str, Any], filename: str = "report.html") -> str:
    os.makedirs(output_dir, exist_ok=True)
    path = os.path.join(output_dir, filename)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(render_report(data))
    return path

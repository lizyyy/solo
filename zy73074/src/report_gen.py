"""
生成分析报告页面（朴素HTML）
- 让维保主管阿敏一眼看明白晚到备件为什么影响结论
- 让阿敏能从维修照片追到CSV明细行
"""
import csv
import os
from datetime import datetime

def load_csv(pth):
    if not os.path.exists(pth):
        return []
    with open(pth, "r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))

def _fmt_late_part_block(late_parts):
    rows = ""
    for lp in late_parts:
        rows += f"""
        <tr class="late-row">
          <td>{lp['part_code']}</td>
          <td>{lp['part_name']}</td>
          <td>{lp['cabinet_id']}</td>
          <td>{lp['shutdown_window']}</td>
          <td class="bad">{lp['actual_arrival']}</td>
          <td class="bad"><b>晚到 {lp['late_hours']}h</b></td>
          <td>{lp['reason']}</td>
          <td>{lp['supplier']}</td>
        </tr>"""
    return rows

def _fmt_attribution_table(attrs, skew_map, notes_map):
    rows = ""
    for a in attrs:
        aid = a["attribution_id"]
        sk = skew_map.get(aid, {})
        pids = [p.strip() for p in (a.get("linked_photo_ids") or "").split(",") if p.strip()]
        note_badge = ""
        for p in pids:
            if p in notes_map:
                note_badge = '<span class="badge-note">有备注</span>'
                break
        
        status_class = ""
        if a.get("sampling_gap_flag") == "是":
            status_class = "gap-row"
        if a.get("anomaly_type", "").startswith("late"):
            status_class = "late-row"
        
        skew_html = ""
        if sk:
            skew_html = f"""<div class="skew-box">
                <b>拖偏结论的照片：</b>{sk['skew_photo_id']}
                → 在 <code>{sk['raw_csv_filename']}</code> 的
                <b>第 {sk['skew_photo_row_in_csv']} 行</b>
                <span class="muted">（可打开CSV直接跳转核对）</span><br/>
                <span class="muted">影响原因：{sk['skew_reason']}</span>
            </div>"""
        
        impact_html = ""
        if a.get("late_part_impact"):
            impact_html = f"""<div class="impact-box">
                <b>晚到备件如何影响结论：</b><br/>
                {a['late_part_impact']}
            </div>"""
        
        note_html = ""
        if a.get("manual_note_content"):
            note_html = f"""<div class="note-box">
                <b>人工备注 ({a.get('manual_note_author','')} @ {a.get('manual_note_time','')})：</b>
                {a['manual_note_content']}
            </div>"""
        
        gap_html = ""
        if a.get("sampling_gap_flag") == "是":
            gap_html = f"""<div class="gap-box">
                ⚠️ <b>采样断档，已标为异常处理（未默默放行）：</b>
                {a.get('gap_details','')}
            </div>"""
        
        rows += f"""
        <tr class="{status_class}">
          <td><a href="#{aid}">{aid}</a>{note_badge}</td>
          <td><b>{a['cabinet_id']}</b></td>
          <td>{a['anomaly_start']}<br/><span class="muted">→ {a['anomaly_end']}</span></td>
          <td class="peak">{a['peak_temp']}℃</td>
          <td>{a['avg_temp']}℃</td>
          <td>{a['conclusion_confidence']}</td>
          <td><span class="status-tag status-{a['process_status'].replace(' ','_')}">{a['process_status']}</span></td>
          <td>
            <div id="{aid}">
              <div><b>归因结论：</b>{a['root_cause']}</div>
              {impact_html}
              {gap_html}
              {skew_html}
              {note_html}
              <div class="muted small">诊断参数：{a.get('trace_notes','')}</div>
            </div>
          </td>
        </tr>"""
    return rows

def _fmt_source_status_table(photos):
    by_src = {}
    by_status = {}
    for p in photos:
        s = p.get("source") or p.get("数据来源") or "未知"
        st = p.get("process_status", "pending")
        by_src[s] = by_src.get(s, 0) + 1
        by_status[st] = by_status.get(st, 0) + 1
    src_rows = "".join(f"<tr><td>{k}</td><td>{v}</td></tr>" for k, v in by_src.items())
    st_rows = "".join(f"<tr><td>{k}</td><td>{v}</td></tr>" for k, v in by_status.items())
    return src_rows, st_rows

def generate_report(attribution_csv, skew_csv, normalized_csv, late_parts_data,
                    gap_info, output_html):
    attrs = load_csv(attribution_csv)
    skews = load_csv(skew_csv)
    photos = load_csv(normalized_csv)
    
    skew_map = {s["attribution_id"]: s for s in skews}
    notes_map = {}
    for a in attrs:
        if a.get("manual_note_content"):
            for p in (a.get("linked_photo_ids") or "").split(","):
                notes_map[p.strip()] = True
    
    src_rows, st_rows = _fmt_source_status_table(photos)
    
    late_count = len([a for a in attrs if a.get("late_part_impact")])
    gap_count = len([a for a in attrs if a.get("sampling_gap_flag") == "是"])
    total_peak = max([float(a["peak_temp"]) for a in attrs], default=0)
    worst = max(attrs, key=lambda x: float(x["peak_temp"])) if attrs else None
    
    html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>配电柜温升异常归因 · 月底封账版</title>
<style>
  body {{ font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
          margin: 24px; color: #222; line-height: 1.55; }}
  h1 {{ font-size: 20px; border-bottom: 2px solid #333; padding-bottom: 8px; }}
  h2 {{ font-size: 16px; margin-top: 32px; border-left: 4px solid #333; padding-left: 10px; }}
  h3 {{ font-size: 14px; margin-top: 20px; }}
  table {{ border-collapse: collapse; width: 100%; font-size: 13px; margin-top: 10px; }}
  th, td {{ border: 1px solid #ccc; padding: 8px 10px; vertical-align: top; text-align: left; }}
  th {{ background: #f3f3f3; font-weight: 600; }}
  .muted {{ color: #888; }}
  .small {{ font-size: 11px; }}
  .peak {{ color: #c0392b; font-weight: 700; }}
  .bad {{ color: #c0392b; }}
  .late-row {{ background: #fff3f0; }}
  .gap-row {{ background: #fffbe6; }}
  .status-tag {{ display: inline-block; padding: 2px 8px; border-radius: 10px;
                 font-size: 11px; font-weight: 600; }}
  .status-已归因 {{ background: #e6f7ea; color: #2e7d32; }}
  .status-异常处理 {{ background: #fdecea; color: #c62828; }}
  .status-pending {{ background: #eee; color: #555; }}
  .badge-note {{ display: inline-block; margin-left: 6px; padding: 1px 6px;
                 background: #fff3cd; color: #856404; border-radius: 8px; font-size: 11px; }}
  .impact-box {{ margin-top: 6px; padding: 8px; background: #fff3f0;
                 border-left: 3px solid #c0392b; font-size: 12.5px; }}
  .gap-box {{ margin-top: 6px; padding: 8px; background: #fffbe6;
              border-left: 3px solid #e6a817; font-size: 12.5px; }}
  .skew-box {{ margin-top: 6px; padding: 8px; background: #f0f4ff;
               border-left: 3px solid #3b6fe6; font-size: 12.5px; }}
  .note-box {{ margin-top: 6px; padding: 8px; background: #e8f5e9;
               border-left: 3px solid #2e7d32; font-size: 12.5px; }}
  code {{ background: #f5f5f5; padding: 1px 5px; border-radius: 3px; font-size: 12px; }}
  .kpi {{ display: flex; gap: 16px; flex-wrap: wrap; margin: 12px 0; }}
  .kpi > div {{ flex: 1; min-width: 180px; border: 1px solid #ddd; padding: 10px 14px; }}
  .kpi .v {{ font-size: 22px; font-weight: 700; }}
  .kpi .l {{ font-size: 12px; color: #666; }}
  .howto {{ background: #f5faff; border: 1px dashed #7aa9e6; padding: 10px 14px;
            font-size: 12.5px; margin-top: 8px; }}
  .howto b {{ color: #1d4f91; }}
  details {{ margin-top: 8px; }}
  summary {{ cursor: pointer; color: #1d4f91; font-size: 12.5px; }}
</style>
</head>
<body>

<h1>📋 配电柜温升异常归因 · 月底封账版（交付：维保主管 阿敏）</h1>
<p class="muted small">生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
  · 算法值班人维修照片字段已自动标准化 · 来源/处理状态已保留 · 采样断档已按"异常处理"标记 ·
  重复导入已去重 · 人工备注已保留</p>

<div class="kpi">
  <div><div class="v">{len(attrs)}</div><div class="l">归因异常条</div></div>
  <div><div class="v bad">{late_count}</div><div class="l">含晚到备件影响</div></div>
  <div><div class="v bad">{gap_count}</div><div class="l">采样断档(已标异常处理)</div></div>
  <div><div class="v peak">{total_peak}℃</div><div class="l">最高峰值温度</div></div>
  <div><div class="v">{len(photos)}</div><div class="l">已标准化维修照片数</div></div>
</div>

<h2>① 维保主管关心的：晚到备件清单（为什么会影响结论）</h2>
<p>备件如果在<b>计划停机窗口结束之后</b>才到货，窗口内无法执行更换，设备带病运行，温升异常会持续或扩大。
下列晚到备件已在归因结论中逐条说明影响链路。</p>
<table>
  <thead><tr>
    <th>备件编号</th><th>备件名称</th><th>配电柜</th>
    <th>计划停机窗口</th><th>实际到货</th><th>晚到时长</th>
    <th>晚到原因</th><th>供应商</th>
  </tr></thead>
  <tbody>{_fmt_late_part_block(late_parts_data)}</tbody>
</table>

<h2>② 归因结果明细（每条结论都可追溯）</h2>
<div class="howto">
  <b>📖 追溯指南（阿敏自核用）：</b><br/>
  1. <b>从归因 → 维修照片：</b>看每条里的"拖偏结论的照片"字段，会写清照片ID和它在
  <code>normalized_photos.csv</code> 中的<b>行号</b>，打开CSV直接跳到那行核对。<br/>
  2. <b>从维修照片 → 温度采样CSV明细：</b>用照片的<b>设备编号</b>和<b>拍摄日期</b>在
  <code>temperature_sampling.csv</code> 里筛 cabinet_id + 日期，即可追到原始采样点。<br/>
  3. <b>晚到备件怎么影响结论：</b>红色底色行的"晚到备件如何影响结论"框里把因果链写完整了。<br/>
  4. <b>采样断档不会默默放行：</b>黄色底色行会标出"异常处理"并注明断档时段。<br/>
  5. <b>人工备注不被覆盖：</b>有黄色"有备注"徽章的行，绿色框中会显示备注内容，重复导入不会覆盖。
</div>
<table>
  <thead><tr>
    <th>归因ID</th><th>配电柜</th><th>异常时段</th>
    <th>峰值</th><th>均值</th><th>可信度</th><th>处理状态</th>
    <th>归因结论 + 追溯信息</th>
  </tr></thead>
  <tbody>{_fmt_attribution_table(attrs, skew_map, notes_map)}</tbody>
</table>

<h2>③ 照片来源与处理状态（字段名不一致已合并，保住来源/状态）</h2>
<p>算法值班人交来的两批照片字段名不同（一批中文字段、一批英文字段），已合并到统一结构，
<b>source字段和process_status字段始终保留</b>。</p>
<table style="max-width:420px; display:inline-block; margin-right:20px;">
  <thead><tr><th>来源系统</th><th>条数</th></tr></thead>
  <tbody>{src_rows}</tbody>
</table>
<table style="max-width:420px; display:inline-block;">
  <thead><tr><th>处理状态</th><th>条数</th></tr></thead>
  <tbody>{st_rows}</tbody>
</table>

<h2>④ 相关CSV文件（阿敏自核）</h2>
<details open>
<summary>📂 点击展开文件清单与说明</summary>
<ul>
  <li><code>output/attribution_with_notes.csv</code> — 归因结果 + 人工备注合并版（主交付件）</li>
  <li><code>output/normalized_photos.csv</code> — 维修照片标准化后（两批字段名已合并，保留来源/状态）</li>
  <li><code>output/skew_trace.csv</code> — 偏差追溯表：每条归因对应"拖偏"的照片行号</li>
  <li><code>output/attribution_result.csv</code> — 归因结果原始版（无备注）</li>
  <li><code>data/temperature_sampling.csv</code> — 温度采样原始数据（可按配电柜+日期筛）</li>
  <li><code>data/spare_parts.csv</code> — 备件到货记录</li>
  <li><code>data/manual_notes.csv</code> — 人工备注源（重复导入不覆盖）</li>
</ul>
</details>

<hr/>
<p class="muted small">本报告所有数据均来自CSV，可审计。重复导入结果不翻倍，人工备注不被清除。
采样断档均已标记为"异常处理"，未静默放行。</p>

</body>
</html>"""
    
    with open(output_html, "w", encoding="utf-8") as f:
        f.write(html)
    return output_html

if __name__ == "__main__":
    html_path = generate_report(
        "output/attribution_with_notes.csv",
        "output/skew_trace.csv",
        "output/normalized_photos.csv",
        [], {},
        "output/report.html"
    )
    print(f"报告已生成: {html_path}")

"""report.py — 生成 HTML 报告。

设计要点（对应需求）：
- "参数版本、异常点和解释放在同一页"：每道题做成一张卡片，所有版本的版本号、
  异常点、截图说明都集中在同一张卡片内，不分散到多页。
- "从题目清单追到截图说明"：每张卡片顶部有"追溯链"，
  并有"追溯总览"表把 题目清单 → 截图说明 显式串起来。
- "除零边界别变成含糊警告，最好能追到题目清单的原始说法"：异常表与卡片内异常
  都带 trace 字段，指回 original_statement。
- "人工确认前后到底改了什么"：独立"确认前后差异"区块。
"""

import html
import math


def _esc(s):
    return html.escape(str(s) if s is not None else "—")


def _fmt(v):
    if v is None:
        return "—"
    try:
        v = float(v)
    except (TypeError, ValueError):
        return str(v)
    if math.isnan(v):
        return "NaN"
    if math.isinf(v):
        return "∞"
    if v == 0:
        return "0"
    if abs(v) >= 1000 or abs(v) < 0.001:
        return "%.4e" % v
    return "%.4g" % v


def _fmt_unc(v):
    if v is None:
        return "—"
    return _fmt(v)


_STATUS_STYLE = {
    "ok": ("正常", "#1a7f37"),
    "warning": ("注意", "#9a6700"),
    "exception": ("异常", "#cf222e"),
}


def _status_badge(status):
    label, color = _STATUS_STYLE.get(status, (status, "#57606a"))
    return '<span class="badge" style="background:%s">%s</span>' % (color, label)


def _result_line(r):
    if r["result_value"] is not None:
        return "%s ± %s %s" % (
            _fmt(r["result_value"]), _fmt(r["result_uncertainty"]),
            _esc(r["result_unit"]))
    if r["exceptions"]:
        return "—（见异常）"
    return "—"


def generate_report(results, versions, diffs, any_confirmed, meta, out_path):
    # 按题目分组，保持清单顺序
    order = []
    grouped = {}
    for r in results:
        qid = r["question_id"]
        if qid not in grouped:
            grouped[qid] = []
            order.append(qid)
        grouped[qid].append(r)

    total = len(results)
    n_ok = sum(1 for r in results if r["status"] == "ok")
    n_warn = sum(1 for r in results if r["status"] == "warning")
    n_exc = sum(1 for r in results if r["status"] == "exception")
    n_versions = len(versions)

    parts = []
    parts.append("<!DOCTYPE html><html lang='zh-CN'><head><meta charset='utf-8'>")
    parts.append("<meta name='viewport' content='width=device-width,initial-scale=1'>")
    parts.append("<title>误差传播参数回放报告</title>")
    parts.append(_css())
    parts.append("</head><body>")
    parts.append(_header(meta, total, n_ok, n_warn, n_exc, n_versions))
    parts.append(_traceability_overview(order, grouped))
    parts.append(_version_changelog(versions))
    parts.append("<h2 id='questions'>题目明细（参数版本·异常点·截图说明同页）</h2>")
    for qid in order:
        parts.append(_question_card(grouped[qid]))
    parts.append(_exception_table(results))
    parts.append(_diff_section(diffs, any_confirmed))
    parts.append("<footer>本报告由 误差传播参数回放 自动生成 · "
                 "终端摘要与截图说明分离输出，详见 report.html</footer>")
    parts.append("</body></html>")

    with open(out_path, "w", encoding="utf-8") as f:
        f.write("".join(parts))


def _css():
    return """<style>
body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
  margin:0;background:#f6f8fa;color:#1f2328;line-height:1.6}
.wrap{max-width:1080px;margin:0 auto;padding:24px}
h1{font-size:22px;margin:0 0 4px}
h2{font-size:18px;margin:28px 0 12px;border-left:4px solid #0969da;padding-left:8px}
h3{font-size:15px;margin:14px 0 6px}
.meta{color:#57606a;font-size:13px;margin-bottom:16px}
.stats{display:flex;gap:12px;flex-wrap:wrap;margin:12px 0}
.stat{background:#fff;border:1px solid #d0d7de;border-radius:8px;padding:10px 14px;min-width:120px}
.stat b{display:block;font-size:20px}
.stat span{color:#57606a;font-size:12px}
.badge{color:#fff;border-radius:10px;padding:1px 8px;font-size:12px;font-weight:600}
.card{background:#fff;border:1px solid #d0d7de;border-radius:10px;padding:16px 18px;margin:14px 0}
.card.boundary{border-left:4px solid #cf222e}
.chain{background:#ddf4ff;border:1px solid #54aeff;border-radius:8px;padding:8px 12px;font-size:13px;margin:8px 0 12px}
.orig{background:#fff8c5;border:1px solid #d4a72c;border-radius:6px;padding:8px 12px;font-size:13px;margin:8px 0}
.ver{border-top:1px dashed #d0d7de;padding-top:10px;margin-top:10px}
.ver:first-of-type{border-top:none;padding-top:0;margin-top:0}
table{border-collapse:collapse;width:100%;font-size:13px;margin:8px 0}
th,td{border:1px solid #d0d7de;padding:5px 8px;text-align:left;vertical-align:top}
th{background:#f6f8fa}
tr.exc td{background:#ffebe9}
tr.warn td{background:#fff8c5}
pre.expl{background:#f6f8fa;border:1px solid #d0d7de;border-radius:6px;padding:10px;white-space:pre-wrap;font-size:12.5px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
small{color:#57606a}
a{color:#0969da;text-decoration:none}
footer{color:#57606a;font-size:12px;margin-top:24px;border-top:1px solid #d0d7de;padding-top:10px}
.muted{color:#57606a}
.delta{color:#cf222e;font-weight:600}
</style>"""


def _header(meta, total, n_ok, n_warn, n_exc, n_versions):
    return """<div class='wrap'>
<h1>误差传播参数回放 · 复核报告</h1>
<div class='meta'>生成时间：%s ｜ 输入目录：%s ｜ 输出目录：%s ｜ 参数版本数：%d</div>
<div class='stats'>
  <div class='stat'><b>%d</b><span>计算条目（题目×版本）</span></div>
  <div class='stat'><b>%d</b><span>正常</span></div>
  <div class='stat'><b>%d</b><span>注意(零贡献等)</span></div>
  <div class='stat'><b>%d</b><span>异常(可追溯)</span></div>
</div>""" % (
        _esc(meta.get("time", "")), _esc(meta.get("input", "")),
        _esc(meta.get("output", "")), n_versions, total, n_ok, n_warn, n_exc)


def _traceability_overview(order, grouped):
    rows = []
    for qid in order:
        r0 = grouped[qid][0]
        has_exc = any(r["exceptions"] for r in grouped[qid])
        status = r0["status"]
        anchor = "q-%s" % qid
        rows.append(
            "<tr><td>%s</td><td>%s</td><td>%s</td><td>%s</td>"
            "<td><a href='#%s'>截图说明↗</a></td></tr>" % (
                _esc(qid), _esc(r0["title"]), _status_badge(status),
                "是" if has_exc else "否", anchor))
    return """<h2 id='trace'>追溯总览：题目清单 → 截图说明</h2>
<p class='muted'>老叶复核路径：从题目清单出发，逐题追到该题的公式、偏导、结果/异常与截图说明。</p>
<table><tr><th>题目ID</th><th>题目</th><th>状态</th><th>是否含异常</th><th>截图说明</th></tr>
%s</table>""" % "".join(rows)


def _version_changelog(versions):
    rows = []
    for v in versions:
        rows.append("<tr><td>%s</td><td>%s</td></tr>" % (
            _esc(v.get("version", "")), _esc(v.get("description", ""))))
    return """<h2>参数版本变更日志</h2>
<table><tr><th>版本</th><th>说明（人工确认前后改了什么）</th></tr>
%s</table>""" % "".join(rows)


def _question_card(rs):
    r0 = rs[0]
    qid = r0["question_id"]
    boundary = r0["category"] == "boundary"
    cls = "card boundary" if boundary else "card"
    chain = ("追溯链：题目清单(%s) → 公式 %s → 偏导数 → 结果/异常 → "
             "<a href='#expl-%s'>截图说明</a>") % (
        _esc(qid), _esc(r0["formula"]), qid)
    out = []
    out.append("<div class='%s' id='q-%s'>" % (cls, qid))
    out.append("<h3>%s 《%s》 %s %s</h3>" % (
        _esc(qid), _esc(r0["title"]),
        _status_badge(r0["status"]),
        ("<span class='badge' style='background:#8250df'>边界样本</span>" if boundary else "")))
    out.append("<div class='chain'>%s</div>" % chain)
    out.append("<div class='orig'><b>题目清单原始说法：</b>%s</div>" % _esc(r0["original_statement"]))
    for r in rs:
        out.append(_version_block(r, qid))
    out.append("<pre class='expl' id='expl-%s'>%s</pre>" % (qid, _esc(r0["explanation"])))
    out.append("</div>")
    return "".join(out)


def _version_block(r, qid):
    parts = ["<div class='ver'>"]
    parts.append("<b>%s</b> <small>%s</small> %s" % (
        _esc(r["version"]), _esc(r.get("version_desc", "")), _status_badge(r["status"])))
    # 输入表
    rows = []
    for inp in r["inputs"]:
        rows.append("<tr><td>%s</td><td>%s ± %s</td><td>%s</td>"
                    "<td>%s ± %s</td><td>%s</td></tr>" % (
            _esc(inp["name"]), _fmt(inp["value"]), _fmt(inp["uncertainty"]),
            _esc(inp["unit"]), _fmt(inp["value_si"]), _fmt(inp["uncertainty_si"]),
            _esc(inp["dim_name"])))
    parts.append("<table><tr><th>变量</th><th>值 ± 不确定度</th><th>单位</th>"
                 "<th>→SI 值 ± 不确定度</th><th>量纲</th></tr>%s</table>" % "".join(rows))
    # 偏导数
    deriv = "，".join("∂f/∂%s = %s%s" % (
        _esc(p["var"]), _esc(p["symbolic"]),
        (" (= %s)" % _fmt(p.get("value_si")) if p.get("value_si") is not None else ""))
        for p in r["partials"])
    parts.append("<p><b>偏导数：</b>%s</p>" % deriv)
    # 结果 / 异常
    if r["exceptions"]:
        parts.append("<p><b>结果：</b>—（异常）</p>")
        for e in r["exceptions"]:
            parts.append("<div class='orig' style='background:#ffebe9;border-color:#cf222e'>"
                         "<b>异常[%s]：</b>%s<br><small>追溯：%s</small></div>" % (
                _esc(e["type"]), _esc(e["message"]), _esc(e["trace"])))
    else:
        parts.append("<p><b>结果：</b>%s ｜ 量纲：%s = %s（%s）</p>" % (
            _esc(_result_line(r)), _esc(r["result_dim_name"]),
            _esc(r["result_unit_dim_name"]),
            "一致" if r["dim_match"] else "不一致"))
        for n in r["notes"]:
            parts.append("<p class='muted'><b>提示：</b>%s</p>" % _esc(n))
    parts.append("</div>")
    return "".join(parts)


def _exception_table(results):
    exc_rows = []
    for r in results:
        for e in r["exceptions"]:
            exc_rows.append("<tr class='exc'><td>%s</td><td>%s</td><td>%s</td>"
                            "<td>%s</td><td>%s</td></tr>" % (
                _esc(r["question_id"]), _esc(r["version"]),
                _esc(e["type"]), _esc(e["message"]),
                _esc(r["original_statement"])))
    if not exc_rows:
        exc_rows.append("<tr><td colspan='5' class='muted'>无异常</td></tr>")
    return """<h2 id='exceptions'>异常清单（可追溯到题目清单原始说法）</h2>
<table><tr><th>题目ID</th><th>版本</th><th>异常类型</th><th>说明</th><th>题目清单原始说法</th></tr>
%s</table>""" % "".join(exc_rows)


def _diff_section(diffs, any_confirmed):
    if not any_confirmed:
        return """<h2 id='diff'>人工确认前后差异</h2>
<p class='muted'>尚未发现已确认记录（确认记录 status 均为 pending 或文件未填写）。
请排班同事填写输出目录下的 <code>确认记录.json</code> 后重新运行，即可在此看到"确认前后到底改了什么"。</p>"""
    rows = []
    for d in diffs:
        qid = _esc(d["question_id"])
        ver = _esc(d["version"])
        title = _esc(d["title"])
        status = _esc(d["status"])
        note = _esc(d["确认说明"])
        who = _esc(d["确认人"])
        # 确认前
        before_v = _fmt(d["before_value"])
        before_u = _fmt(d["before_uncertainty"])
        # 确认后
        after_v = _fmt(d["after_value"])
        after_u = _fmt(d["after_uncertainty"])
        # 差值
        v_delta = _fmt(d["value_delta"])
        u_delta = _fmt(d["uncertainty_delta"])
        if d["changed"]:
            cls = "warn"
            status_badge = '<span class="badge" style="background:#9a6700">已调整</span>'
            v_delta_html = '<span class="delta">%s</span>' % v_delta
            u_delta_html = '<span class="delta">%s</span>' % u_delta
        else:
            cls = ""
            status_badge = '<span class="badge" style="background:#1a7f37">确认无误</span>'
            v_delta_html = v_delta
            u_delta_html = u_delta
        row = ("<tr class='%s'><td>%s<br><small>%s</small></td>"
               "<td>%s</td><td>%s</td>"
               "<td>%s ± %s</td>"
               "<td>%s ± %s</td>"
               "<td>Δ值 %s<br><small>Δ不确定度 %s</small></td>"
               "<td>%s</td><td>%s</td></tr>" % (
                   cls, qid, title, ver, status_badge,
                   before_v, before_u,
                   after_v, after_u,
                   v_delta_html, u_delta_html,
                   note, who))
        rows.append(row)
    return """<h2 id='diff'>人工确认前后差异</h2>
<p class='muted'>排班同事复盘：一表对照"计算前是什么、确认后是什么、改动幅度是多少、确认依据是什么"。
黄色高亮行表示人工调整过的条目，绿色为确认无误条目。</p>
<table>
<tr><th>题目</th><th>版本</th><th>状态</th>
<th>确认前（计算值）<br><small>值 ± 不确定度</small></th>
<th>确认后（人工值）<br><small>值 ± 不确定度</small></th>
<th>差值 Δ<br><small>（确认后 − 确认前）</small></th>
<th>确认说明</th><th>确认人</th></tr>
%s</table></div>""" % "".join(rows)

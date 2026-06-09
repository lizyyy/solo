from __future__ import annotations
from flask import Flask, render_template_string
from . import importer
from .config import ALERT_STATUSES, VACCINE_PHOTO_DIR, REPORT_DIR

app = Flask(__name__)

REPORT_TEMPLATE = """<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>异宠温控异常提醒 —— 报告</title>
<style>
  body{font-family:-apple-system,Segoe UI,"PingFang SC",sans-serif;
       margin:24px;color:#222;max-width:1100px}
  h1{font-size:20px;border-bottom:2px solid #333;padding-bottom:6px}
  h2{font-size:16px;margin-top:28px;color:#333}
  .alert{border:1px solid #ddd;border-radius:6px;padding:14px 18px;
         margin:12px 0;background:#fafafa}
  .status{display:inline-block;padding:2px 10px;border-radius:4px;
          font-size:12px;font-weight:600}
  .PENDING{background:#fff3cd;color:#856404}
  .CONFIRMED{background:#cce5ff;color:#004085}
  .RESOLVED{background:#d4edda;color:#155724}
  .PENDING_REVIEW{background:#f8d7da;color:#721c24;animation:pulse 1.5s infinite}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.65}}
  .meta{color:#666;font-size:13px;margin:4px 0}
  .reason{background:#fff5f5;border-left:3px solid #e74c3c;
          padding:6px 10px;margin:8px 0;font-size:13px;color:#721c24}
  ul.hist,ul.notes{font-size:13px;padding-left:20px;margin:6px 0}
  ul.hist li,ul.notes li{margin:3px 0}
  table{width:100%;border-collapse:collapse;font-size:13px;margin-top:8px}
  th,td{border:1px solid #e5e5e5;padding:6px 8px;text-align:left}
  th{background:#f0f0f0}
  .muted{color:#999}
</style></head><body>
<h1>🐾 异宠温控异常提醒报告</h1>
{% if pet_id %}<p class="muted">当前过滤：宠物ID = {{ pet_id }}</p>{% endif %}

<h2>📋 温控异常提醒清单</h2>
{% if alerts %}
  {% for a in alerts %}
  <div class="alert">
    <div>
      <span class="status {{ a.status }}">{{ status_label[a.status] }}</span>
      <strong>{{ a.pet_name or a.pet_id }}</strong>
      <span class="muted">({{ a.species or '未知' }} · ID: {{ a.pet_id }})</span>
      <span style="float:right">温度: <b>{{ "%.1f"|format(a.temperature_c) }}°C</b></span>
    </div>
    <div class="meta">提醒ID: {{ a.alert_id }} · 异常时间: {{ a.alert_time }}
      · 创建: {{ a.created_at }} · 更新: {{ a.updated_at }}</div>
    {% if a.conclusion %}
      <div class="meta"><b>结论:</b> {{ a.conclusion }}</div>{% endif %}
    {% if pending_reasons.get(a.alert_id) %}
      <div class="reason">⚠️ 待复核原因: {{ pending_reasons[a.alert_id] }}</div>
    {% endif %}
    {% if histories.get(a.alert_id) %}
      <h4 style="margin:10px 0 4px">📜 状态变更历史</h4>
      <ul class="hist">
      {% for h in histories[a.alert_id] %}
        <li><span class="muted">[{{ h.changed_at }}]</span>
          <b>{{ h.author }}</b> 修改：
          {{ h.old_status or '(初值)' }} → <b>{{ h.new_status }}</b>
          {% if h.reason %}· 原因：{{ h.reason }}{% endif %}</li>
      {% endfor %}
      </ul>
    {% endif %}
    {% if notes.get(a.alert_id) %}
      <h4 style="margin:10px 0 4px">🗒️ 人工备注</h4>
      <ul class="notes">
      {% for n in notes[a.alert_id] %}
        <li><span class="muted">[{{ n.created_at }}]</span>
          <b>{{ n.author }}</b>：{{ n.note_content }}</li>
      {% endfor %}
      </ul>
    {% endif %}
  </div>
  {% endfor %}
{% else %}
  <p class="muted">暂无温控异常提醒记录。</p>
{% endif %}

<h2>🔗 疫苗本照片 ↔ 用药记录 关联关系</h2>
{% if relations %}
<table>
  <tr><th>关系类型</th><th>批次</th><th>疫苗照片</th><th>上传时间</th>
      <th>药品</th><th>剂量</th><th>频次</th><th>建立时间</th></tr>
  {% for r in relations %}
  <tr>
    <td>{{ r.relation_type }}</td>
    <td>{{ r.batch or '' }}</td>
    <td>{{ r.photo_path or '(空)' }}</td>
    <td>{{ r.upload_time or '' }}</td>
    <td><b>{{ r.med_name or '(空)' }}</b></td>
    <td>{{ r.dosage or '' }}</td>
    <td>{{ r.frequency or '' }}</td>
    <td>{{ r.created_at }}</td>
  </tr>
  {% endfor %}
</table>
{% else %}
  <p class="muted">尚未建立关联。使用 <code>cli link</code> 命令建立关系。</p>
{% endif %}

<h2>📁 约定目录</h2>
<ul>
  <li>数据库: <code>{{ db_path }}</code></li>
  <li>疫苗照片归档: <code>{{ vaccine_dir }}</code>
    <span class="muted">（按宠物ID分子目录）</span></li>
  <li>报告输出: <code>{{ report_dir }}</code></li>
</ul>
</body></html>"""


def render_report(pet_id=None):
    with app.app_context():
        return _render_report(pet_id)


def _render_report(pet_id=None):
    alerts = importer.list_alerts(pet_id)
    histories = {a["alert_id"]: importer.get_alert_history(a["alert_id"])
                 for a in alerts}
    notes = {a["alert_id"]: importer.get_alert_notes(a["alert_id"])
             for a in alerts}
    pending_reasons = {a["alert_id"]: importer.get_pending_review_reason(
                       a["alert_id"]) for a in alerts}
    if pet_id:
        relations = importer.get_vaccine_medication_relations(pet_id)
    else:
        from .database import get_conn
        with get_conn() as conn:
            rows = conn.execute(
                "SELECT r.*, v.file_path AS photo_path, v.batch, "
                "v.upload_time, m.med_name, m.dosage, m.frequency "
                "FROM vaccine_medication_relations r "
                "LEFT JOIN vaccine_photos v ON r.photo_id = v.photo_id "
                "LEFT JOIN medications m ON r.med_id = m.med_id "
                "ORDER BY r.created_at DESC"
            ).fetchall()
            relations = [dict(r) for r in rows]
    from .config import DB_PATH
    return render_template_string(
        REPORT_TEMPLATE,
        alerts=alerts, histories=histories, notes=notes,
        pending_reasons=pending_reasons, status_label=ALERT_STATUSES,
        relations=relations, pet_id=pet_id,
        db_path=str(DB_PATH),
        vaccine_dir=str(VACCINE_PHOTO_DIR),
        report_dir=str(REPORT_DIR),
    )


@app.route("/")
@app.route("/pet/<pet_id>")
def index(pet_id=None):
    return render_report(pet_id)

import os
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from jinja2 import Template
from datetime import datetime
from .models import (
    SettlementRecord, SupplementaryRecord, HolidayNote,
    SettlementBatch, RecordStatus, NextOwner
)

STATUS_LABELS = {
    RecordStatus.PENDING_IMPORT: "待导入",
    RecordStatus.ABNEED_REVIEW: "异常待复核",
    RecordStatus.PENDING_FUND_ACCOUNTING: "待基金会计处理",
    RecordStatus.PENDING_REVIEW: "待财务复核",
    RecordStatus.REVIEWED: "已复核",
    RecordStatus.RESOLVED: "已完成",
}

OWNER_LABELS = {
    NextOwner.FUND_ACCOUNTING_LIN: "基金会计林姐",
    NextOwner.FINANCIAL_REVIEWER: "财务复核人",
    "已完成": "已完成",
}


def get_records_for_report(db: Session, batch_no: str = None) -> List[Dict[str, Any]]:
    query = db.query(SettlementRecord).join(SupplementaryRecord, isouter=True)

    if batch_no:
        query = query.join(SettlementBatch).filter(SettlementBatch.batch_no == batch_no)

    records = query.order_by(SettlementRecord.id).all()
    result = []

    for rec in records:
        supplementary = rec.supplementary
        holiday_note = rec.holiday_note
        batch = rec.batch

        result.append({
            "record_id": rec.id,
            "serial_no": rec.serial_no,
            "batch_no": batch.batch_no if batch else "",
            "org_name": rec.org_name,
            "org_name_expected": rec.org_name_expected,
            "org_name_consistent": rec.org_name_consistent,
            "card_no": rec.card_no,
            "amount": rec.amount,
            "settlement_date": rec.settlement_date,
            "status": rec.status,
            "status_label": STATUS_LABELS.get(rec.status, rec.status),
            "holiday_note": holiday_note.note if holiday_note else "",
            "reason_kept": supplementary.reason_kept if supplementary else "",
            "missing_materials": supplementary.missing_materials if supplementary else "",
            "next_owner": supplementary.next_owner if supplementary else "",
            "next_owner_label": OWNER_LABELS.get(
                supplementary.next_owner if supplementary else "",
                supplementary.next_owner if supplementary else ""
            ),
            "trace_info": supplementary.trace_info if supplementary else "",
            "source_batch_no": supplementary.source_batch_no if supplementary else "",
            "updated_by": supplementary.updated_by if supplementary else "",
            "updated_at": supplementary.updated_at.strftime("%Y-%m-%d %H:%M:%S") if supplementary and supplementary.updated_at else "",
        })

    return result


def generate_html_report(
    db: Session,
    output_path: str,
    batch_no: str = None,
    view_type: str = "table"
) -> str:
    records = get_records_for_report(db, batch_no)

    stats = {
        "total": len(records),
        "inconsistent": sum(1 for r in records if not r["org_name_consistent"]),
        "pending_review": sum(1 for r in records if r["status"] == RecordStatus.PENDING_REVIEW),
        "pending_fund": sum(1 for r in records if r["status"] == RecordStatus.PENDING_FUND_ACCOUNTING),
        "reviewed": sum(1 for r in records if r["status"] in [RecordStatus.REVIEWED, RecordStatus.RESOLVED]),
        "abnormal": sum(1 for r in records if r["status"] == RecordStatus.ABNEED_REVIEW),
    }

    template_str = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>信用卡分期提前结清核对报告</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif; background: #f5f7fa; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 24px; border-radius: 12px; margin-bottom: 20px; }
        .header h1 { font-size: 24px; margin-bottom: 8px; }
        .header p { opacity: 0.9; font-size: 14px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; margin-bottom: 24px; }
        .stat-card { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
        .stat-card .num { font-size: 32px; font-weight: bold; color: #333; }
        .stat-card .label { font-size: 13px; color: #888; margin-top: 4px; }
        .stat-card.inconsistent .num { color: #e74c3c; }
        .stat-card.pending .num { color: #f39c12; }
        .stat-card.reviewed .num { color: #27ae60; }
        .tabs { display: flex; gap: 8px; margin-bottom: 16px; }
        .tab-btn { padding: 10px 20px; border: none; background: #e0e0e0; border-radius: 8px; cursor: pointer; font-size: 14px; }
        .tab-btn.active { background: #667eea; color: white; }
        .section { background: white; border-radius: 10px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
        .section h2 { font-size: 18px; margin-bottom: 16px; color: #333; display: flex; align-items: center; gap: 8px; }
        .section h2 .badge { background: #e74c3c; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th, td { padding: 12px 8px; text-align: left; border-bottom: 1px solid #eee; }
        th { background: #fafafa; font-weight: 600; color: #555; }
        tr:hover { background: #f8f9ff; }
        .tag { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: 500; }
        .tag-red { background: #fde2e2; color: #c0392b; }
        .tag-orange { background: #fef3e2; color: #d68910; }
        .tag-green { background: #e8f8f5; color: #1e8449; }
        .tag-blue { background: #eaf2f8; color: #2471a3; }
        .tag-gray { background: #f2f3f5; color: #666; }
        .supplementary-box { background: #fff9e6; border-left: 3px solid #f39c12; padding: 12px; margin-top: 8px; border-radius: 4px; font-size: 12px; }
        .supplementary-box .field { margin-bottom: 6px; }
        .supplementary-box .field strong { color: #8b4513; display: inline-block; width: 80px; }
        .trace-info { background: #e8f6f3; border-left: 3px solid #16a085; padding: 8px 12px; margin-top: 6px; border-radius: 4px; font-size: 11px; color: #0e6251; }
        .holiday-note { background: #eaf2f8; border-left: 3px solid #2980b9; padding: 8px 12px; margin-top: 6px; border-radius: 4px; font-size: 11px; color: #1a5276; }
        .link-btn { background: none; border: none; color: #667eea; cursor: pointer; text-decoration: underline; font-size: 12px; padding: 0; }
        .detail-panel { display: none; background: #f8f9ff; padding: 16px; border-radius: 8px; margin-top: 8px; }
        .detail-panel.show { display: block; }
        .chart-container { padding: 20px; text-align: center; }
        .bar-chart { display: flex; align-items: flex-end; justify-content: center; gap: 30px; height: 200px; margin: 30px 0; }
        .bar { width: 60px; background: linear-gradient(to top, #667eea, #764ba2); border-radius: 6px 6px 0 0; position: relative; transition: all 0.3s; cursor: pointer; }
        .bar:hover { opacity: 0.8; transform: scale(1.05); }
        .bar-label { position: absolute; bottom: -24px; left: 50%; transform: translateX(-50%); font-size: 12px; color: #666; white-space: nowrap; }
        .bar-value { position: absolute; top: -20px; left: 50%; transform: translateX(-50%); font-size: 14px; font-weight: bold; color: #333; }
        .bar.danger { background: linear-gradient(to top, #e74c3c, #c0392b); }
        .bar.warning { background: linear-gradient(to top, #f39c12, #d68910); }
        .bar.success { background: linear-gradient(to top, #27ae60, #1e8449); }
        .bar-sublabel { display: block; font-size: 10px; color: #999; margin-top: 2px; }
        .trace-link { color: #667eea; cursor: pointer; text-decoration: underline; }
        .hidden { display: none; }
        .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; padding: 20px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>信用卡分期提前结清核对报告</h1>
        <p>生成时间：{{ now }} | 批次：{{ batch_no or '全部' }}</p>
    </div>

    <div class="stats">
        <div class="stat-card">
            <div class="num">{{ stats.total }}</div>
            <div class="label">总记录数</div>
        </div>
        <div class="stat-card inconsistent">
            <div class="num">{{ stats.inconsistent }}</div>
            <div class="label">机构简称不一致</div>
        </div>
        <div class="stat-card pending">
            <div class="num">{{ stats.abnormal }}</div>
            <div class="label">异常待处理</div>
        </div>
        <div class="stat-card pending">
            <div class="num">{{ stats.pending_review + stats.pending_fund }}</div>
            <div class="label">待复核/待处理</div>
        </div>
        <div class="stat-card reviewed">
            <div class="num">{{ stats.reviewed }}</div>
            <div class="label">已完成</div>
        </div>
    </div>

    <div class="tabs">
        <button class="tab-btn active" onclick="switchView('table')">表格视图</button>
        <button class="tab-btn" onclick="switchView('chart')">图表视图</button>
        <button class="tab-btn" onclick="switchView('supplementary')">仅看补录记录</button>
    </div>

    <div id="table-view">
        <div class="section">
            <h2>机构简称不一致记录 <span class="badge">{{ stats.inconsistent }}</span></h2>
            <table>
                <thead>
                    <tr>
                        <th>流水号</th>
                        <th>来源批次</th>
                        <th>当前机构简称</th>
                        <th>期望机构简称</th>
                        <th>状态</th>
                        <th>当前负责人</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
                    {% for r in records if not r.org_name_consistent %}
                    <tr>
                        <td><strong>{{ r.serial_no }}</strong></td>
                        <td><span class="tag tag-blue" onclick="locateBatch('{{ r.batch_no }}')">{{ r.batch_no }}</span></td>
                        <td><span class="tag tag-red">{{ r.org_name }}</span></td>
                        <td><span class="tag tag-green">{{ r.org_name_expected }}</span></td>
                        <td><span class="tag tag-orange">{{ r.status_label }}</span></td>
                        <td><span class="tag tag-gray">{{ r.next_owner_label }}</span></td>
                        <td><button class="link-btn" onclick="showDetail({{ r.record_id }})">查看详情/追溯</button></td>
                    </tr>
                    <tr>
                        <td colspan="7">
                            <div class="detail-panel" id="detail-{{ r.record_id }}">
                                <div class="supplementary-box">
                                    <div class="field"><strong>留下原因：</strong>{{ r.reason_kept }}</div>
                                    <div class="field"><strong>缺材料：</strong>{{ r.missing_materials }}</div>
                                    <div class="field"><strong>下一步：</strong>{{ r.next_owner_label }}</div>
                                    <div class="field"><strong>更新人：</strong>{{ r.updated_by }} | {{ r.updated_at }}</div>
                                </div>
                                {% if r.holiday_note %}
                                <div class="holiday-note">
                                    <strong>节假日顺延说明：</strong>{{ r.holiday_note }}
                                </div>
                                {% endif %}
                                <div class="trace-info">
                                    <strong>追溯路径：</strong>{{ r.trace_info }}
                                </div>
                                <div style="margin-top: 12px;">
                                    <span class="trace-link" onclick="locateBatch('{{ r.batch_no }}')">→ 回到清算批次号 {{ r.batch_no }}</span>
                                    {% if r.holiday_note %}
                                    <span style="margin-left: 16px;" class="trace-link" onclick="locateHoliday({{ r.record_id }})">→ 查看节假日顺延说明</span>
                                    {% endif %}
                                </div>
                            </div>
                        </td>
                    </tr>
                    {% endfor %}
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>全部记录</h2>
            <table>
                <thead>
                    <tr>
                        <th>流水号</th>
                        <th>来源批次</th>
                        <th>机构简称</th>
                        <th>一致性</th>
                        <th>卡号</th>
                        <th>金额</th>
                        <th>清算日期</th>
                        <th>状态</th>
                        <th>当前负责人</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
                    {% for r in records %}
                    <tr>
                        <td><strong>{{ r.serial_no }}</strong></td>
                        <td><span class="tag tag-blue">{{ r.batch_no }}</span></td>
                        <td>{{ r.org_name }}</td>
                        <td>
                            {% if r.org_name_consistent %}
                            <span class="tag tag-green">一致</span>
                            {% else %}
                            <span class="tag tag-red">不一致</span>
                            {% endif %}
                        </td>
                        <td>{{ r.card_no }}</td>
                        <td>{{ r.amount }}</td>
                        <td>{{ r.settlement_date }}</td>
                        <td>
                            {% set status_tag = {'pending_import': 'tag-gray', 'abnormal_need_review': 'tag-red', 'pending_fund_accounting': 'tag-orange', 'pending_review': 'tag-orange', 'reviewed': 'tag-green', 'resolved': 'tag-green'} %}
                            <span class="tag {{ status_tag.get(r.status, 'tag-gray') }}">{{ r.status_label }}</span>
                        </td>
                        <td><span class="tag tag-gray">{{ r.next_owner_label }}</span></td>
                        <td><button class="link-btn" onclick="showDetail({{ r.record_id }})">查看补录</button></td>
                    </tr>
                    <tr>
                        <td colspan="10">
                            <div class="detail-panel" id="detail-{{ r.record_id }}">
                                <div class="supplementary-box">
                                    <div class="field"><strong>留下原因：</strong>{{ r.reason_kept }}</div>
                                    <div class="field"><strong>缺材料：</strong>{{ r.missing_materials }}</div>
                                    <div class="field"><strong>下一步：</strong>{{ r.next_owner_label }}</div>
                                    <div class="field"><strong>更新人：</strong>{{ r.updated_by }} | {{ r.updated_at }}</div>
                                </div>
                                {% if r.holiday_note %}
                                <div class="holiday-note">
                                    <strong>节假日顺延说明：</strong>{{ r.holiday_note }}
                                </div>
                                {% endif %}
                                <div class="trace-info">
                                    <strong>追溯路径：</strong>{{ r.trace_info }}
                                </div>
                                <div style="margin-top: 12px;">
                                    <span class="trace-link" onclick="locateBatch('{{ r.batch_no }}')">→ 回到清算批次号 {{ r.batch_no }}</span>
                                </div>
                            </div>
                        </td>
                    </tr>
                    {% endfor %}
                </tbody>
            </table>
        </div>
    </div>

    <div id="chart-view" class="hidden">
        <div class="section">
            <h2>数据概览</h2>
            <div class="chart-container">
                <div class="bar-chart">
                    <div class="bar" style="height: {{ 100 if stats.total else 0 }}%" onclick="filterByStatus('all')">
                        <div class="bar-value">{{ stats.total }}</div>
                        <div class="bar-label">总记录数</div>
                    </div>
                    <div class="bar danger" style="height: {{ (stats.inconsistent / stats.total * 100) if stats.total else 0 }}%" onclick="filterByStatus('inconsistent')">
                        <div class="bar-value">{{ stats.inconsistent }}</div>
                        <div class="bar-label">
                            机构简称不一致
                            <span class="bar-sublabel">（点击查看明细）</span>
                        </div>
                    </div>
                    <div class="bar warning" style="height: {{ (stats.abnormal / stats.total * 100) if stats.total else 0 }}%">
                        <div class="bar-value">{{ stats.abnormal }}</div>
                        <div class="bar-label">异常待处理</div>
                    </div>
                    <div class="bar warning" style="height: {{ ((stats.pending_review + stats.pending_fund) / stats.total * 100) if stats.total else 0 }}%">
                        <div class="bar-value">{{ stats.pending_review + stats.pending_fund }}</div>
                        <div class="bar-label">待处理/待复核</div>
                    </div>
                    <div class="bar success" style="height: {{ (stats.reviewed / stats.total * 100) if stats.total else 0 }}%">
                        <div class="bar-value">{{ stats.reviewed }}</div>
                        <div class="bar-label">已完成</div>
                    </div>
                </div>
            </div>
            <p style="text-align: center; color: #999; font-size: 12px; margin-top: 40px;">点击"机构简称不一致"柱状图可快速定位到相关明细</p>
        </div>
    </div>

    <div id="supplementary-view" class="hidden">
        <div class="section">
            <h2>补录记录汇总（财务复核人快速查看）</h2>
            <table>
                <thead>
                    <tr>
                        <th>流水号</th>
                        <th>来源批次</th>
                        <th>留下原因</th>
                        <th>缺什么材料</th>
                        <th>下一步找谁</th>
                        <th>追溯路径</th>
                    </tr>
                </thead>
                <tbody>
                    {% for r in records %}
                    <tr>
                        <td><strong>{{ r.serial_no }}</strong></td>
                        <td><span class="tag tag-blue">{{ r.source_batch_no }}</span></td>
                        <td style="max-width: 300px;">{{ r.reason_kept }}</td>
                        <td style="color: #e74c3c;">{{ r.missing_materials or '无' }}</td>
                        <td><span class="tag tag-orange">{{ r.next_owner_label }}</span></td>
                        <td style="font-size: 11px; color: #666;">{{ r.trace_info }}</td>
                    </tr>
                    {% endfor %}
                </tbody>
            </table>
        </div>
    </div>

    <div class="footer">
        信用卡分期提前结清核对系统 v1.0 | 生成时间：{{ now }}
    </div>

    <script>
        function showDetail(id) {
            var panel = document.getElementById('detail-' + id);
            if (panel) {
                panel.classList.toggle('show');
            }
        }

        function switchView(view) {
            document.getElementById('table-view').classList.add('hidden');
            document.getElementById('chart-view').classList.add('hidden');
            document.getElementById('supplementary-view').classList.add('hidden');
            document.getElementById(view + '-view').classList.remove('hidden');

            document.querySelectorAll('.tab-btn').forEach(function(btn) {
                btn.classList.remove('active');
            });
            event.target.classList.add('active');
        }

        function filterByStatus(status) {
            switchView('table');
            if (status === 'inconsistent') {
                var firstInconsistent = document.querySelector('.tag-red');
                if (firstInconsistent) {
                    firstInconsistent.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    firstInconsistent.closest('tr').style.background = '#fff3cd';
                    setTimeout(function() {
                        firstInconsistent.closest('tr').style.background = '';
                    }, 2000);
                }
            }
        }

        function locateBatch(batchNo) {
            switchView('table');
            alert('正在定位到清算批次号：' + batchNo + '\\n\\n在实际系统中，这里会跳转到该批次的原始导入记录详情页面，\\n显示导入时间、导入人、原始文件等完整追溯信息。');
        }

        function locateHoliday(recordId) {
            switchView('table');
            var panel = document.getElementById('detail-' + recordId);
            if (panel) {
                panel.classList.add('show');
                panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
                var holidayNote = panel.querySelector('.holiday-note');
                if (holidayNote) {
                    holidayNote.style.background = '#d6eaf8';
                    setTimeout(function() {
                        holidayNote.style.background = '';
                    }, 2000);
                }
            }
        }
    </script>
</body>
</html>
    """

    template = Template(template_str)
    html = template.render(
        records=records,
        stats=stats,
        batch_no=batch_no,
        now=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        view_type=view_type,
    )

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html)

    return output_path


def generate_supplementary_csv(db: Session, output_path: str, batch_no: str = None) -> str:
    records = get_records_for_report(db, batch_no)

    import csv
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "流水号", "来源批次号", "机构简称", "机构简称一致性",
            "留下原因", "缺什么材料", "下一步找谁", "追溯路径", "更新人", "更新时间"
        ])

        for r in records:
            writer.writerow([
                r["serial_no"],
                r["source_batch_no"],
                r["org_name"],
                "一致" if r["org_name_consistent"] else "不一致",
                r["reason_kept"],
                r["missing_materials"],
                r["next_owner_label"],
                r["trace_info"],
                r["updated_by"],
                r["updated_at"],
            ])

    return output_path

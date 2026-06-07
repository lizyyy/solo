"""
文化遗产视廊控制系统 - 报告生成
"""
from typing import List, Optional
from datetime import datetime
from .models import (
    HeritageCorridorControl,
    ConflictItem,
    InspectionRecord,
    ConstructionNotice,
    NextAction,
    ConflictLevel,
    OpinionStatus
)


class ReportGenerator:
    """报告生成器"""

    def __init__(self, data: HeritageCorridorControl):
        self.data = data

    def generate_html_report(self, output_path: str):
        """生成HTML报告（含简易图表和可追溯链接）"""
        html = f"""
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>文化遗产视廊控制报告</title>
    <style>
        body {{ font-family: "Microsoft YaHei", sans-serif; margin: 20px; background: #f5f5f5; }}
        .container {{ max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
        h1 {{ color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }}
        h2 {{ color: #34495e; margin-top: 30px; }}
        .summary-card {{ display: flex; gap: 20px; margin: 20px 0; flex-wrap: wrap; }}
        .card {{ flex: 1; min-width: 150px; background: #ecf0f1; padding: 20px; border-radius: 8px; text-align: center; }}
        .card-number {{ font-size: 32px; font-weight: bold; color: #2c3e50; }}
        .card-label {{ color: #7f8c8d; margin-top: 5px; }}
        .card.high .card-number {{ color: #e74c3c; }}
        .card.medium .card-number {{ color: #f39c12; }}
        .card.low .card-number {{ color: #27ae60; }}
        table {{ width: 100%; border-collapse: collapse; margin: 15px 0; }}
        th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }}
        th {{ background: #3498db; color: white; }}
        tr:hover {{ background: #f8f9fa; }}
        .tag {{ display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 12px; }}
        .tag-high {{ background: #ffebee; color: #c62828; }}
        .tag-medium {{ background: #fff3e0; color: #e65100; }}
        .tag-low {{ background: #e8f5e9; color: #2e7d32; }}
        .tag-pending {{ background: #e3f2fd; color: #1565c0; }}
        .tag-done {{ background: #f1f8e9; color: #558b2f; }}
        .source-link {{ color: #2980b9; cursor: pointer; text-decoration: underline; }}
        .source-detail {{ display: none; background: #fafafa; padding: 10px; margin-top: 5px; border-left: 3px solid #3498db; }}
        .explanation {{ background: #e8f4fd; border-left: 4px solid #2980b9; padding: 15px; margin: 10px 0; }}
        .next-step {{ background: #fff8e1; border-left: 4px solid #ff8f00; padding: 15px; margin: 10px 0; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>🏛️ 文化遗产视廊控制报告</h1>
        <p style="color: #7f8c8d;">生成时间：{datetime.now().strftime('%Y年%m月%d日 %H:%M:%S')}</p>

        {self._summary_section()}
        {self._conflict_review_section()}
        {self._inspection_section()}
        {self._notice_section()}
    </div>
    <script>
        function toggleSource(id) {{
            const el = document.getElementById(id);
            el.style.display = el.style.display === 'none' ? 'block' : 'none';
        }}
    </script>
</body>
</html>
"""
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(html)

    def _summary_section(self) -> str:
        total_conflicts = len(self.data.conflicts)
        resolved = sum(1 for c in self.data.conflicts.values() if c.is_resolved)
        pending = total_conflicts - resolved
        high = sum(1 for c in self.data.conflicts.values() if c.conflict_level == ConflictLevel.HIGH and not c.is_resolved)
        medium = sum(1 for c in self.data.conflicts.values() if c.conflict_level == ConflictLevel.MEDIUM and not c.is_resolved)
        low = sum(1 for c in self.data.conflicts.values() if c.conflict_level == ConflictLevel.LOW and not c.is_resolved)

        return f"""
        <h2>📊 总体概览</h2>
        <div class="summary-card">
            <div class="card">
                <div class="card-number">{len(self.data.inspections)}</div>
                <div class="card-label">巡查表数量</div>
            </div>
            <div class="card">
                <div class="card-number">{len(self.data.notices)}</div>
                <div class="card-label">施工告示</div>
            </div>
            <div class="card high">
                <div class="card-number">{high}</div>
                <div class="card-label">高风险冲突</div>
            </div>
            <div class="card medium">
                <div class="card-number">{medium}</div>
                <div class="card-label">中风险冲突</div>
            </div>
            <div class="card low">
                <div class="card-number">{low}</div>
                <div class="card-label">低风险冲突</div>
            </div>
            <div class="card">
                <div class="card-number">{resolved}/{total_conflicts}</div>
                <div class="card-label">已复核/总数</div>
            </div>
        </div>
        """

    def _conflict_review_section(self) -> str:
        pending_conflicts = sorted(
            [c for c in self.data.conflicts.values() if not c.is_resolved],
            key=lambda x: (x.conflict_level.value, x.created_at)
        )

        rows = []
        for i, c in enumerate(pending_conflicts):
            level_tag = f'<span class="tag tag-{c.conflict_level.value}">{c.conflict_level.value}</span>'
            action_tag = f'<span class="tag tag-pending">{c.next_action.value}</span>'
            source_detail = self._get_source_detail_html(c.opinion_id, f"src-{i}")
            missing = "、".join(c.missing_materials) if c.missing_materials else "无"

            rows.append(f"""
            <tr>
                <td>{c.id}</td>
                <td>{c.location}</td>
                <td>{c.opinion_summary}</td>
                <td>{level_tag}</td>
                <td>{action_tag}</td>
                <td>
                    <div class="explanation">
                        <strong>为什么被留下：</strong>{c.conflict_reason}
                    </div>
                    <div class="next-step">
                        <strong>还缺材料：</strong>{missing}<br>
                        <strong>下一步：</strong>{c.next_action.value}
                    </div>
                    <div class="source-link" onclick="toggleSource('src-{i}')">🔗 追溯来源</div>
                    {source_detail}
                </td>
            </tr>
            """)

        return f"""
        <h2>⚠️ 冲突复核表（待处理）</h2>
        <p style="color: #7f8c8d;">以下冲突需要社区书记或交通协管老马处理，点击"追溯来源"可查看原始巡查表或施工告示</p>
        <table>
            <thead>
                <tr>
                    <th>冲突编号</th>
                    <th>位置</th>
                    <th>居民意见摘要</th>
                    <th>风险等级</th>
                    <th>当前状态</th>
                    <th>复核说明</th>
                </tr>
            </thead>
            <tbody>
                {''.join(rows)}
            </tbody>
        </table>
        """

    def _get_source_detail_html(self, opinion_id: str, detail_id: str) -> str:
        for inspection in self.data.inspections.values():
            for opinion in inspection.opinions:
                if opinion.id == opinion_id:
                    original = opinion.original_text or "（无原文，仅剩汇总）"
                    status_text = "有原文" if opinion.original_text else "只剩汇总无原文"
                    return f"""
                    <div id="{detail_id}" class="source-detail">
                        <strong>来源：</strong>网格员巡查表 [{inspection.id}]<br>
                        <strong>网格员：</strong>{inspection.inspector}<br>
                        <strong>巡查时间：</strong>{inspection.inspection_date.strftime('%Y-%m-%d')}<br>
                        <strong>意见状态：</strong>{status_text}<br>
                        <strong>原文：</strong>{original}
                    </div>
                    """
        for notice in self.data.notices.values():
            if opinion_id in notice.related_opinion_ids:
                return f"""
                <div id="{detail_id}" class="source-detail">
                    <strong>来源：</strong>施工告示 [{notice.id}]<br>
                    <strong>项目：</strong>{notice.project_name}<br>
                    <strong>施工方：</strong>{notice.publisher}<br>
                    <strong>工期：</strong>{notice.start_date.strftime('%Y-%m-%d')} 至 {notice.end_date.strftime('%Y-%m-%d')}<br>
                    <strong>遗产影响：</strong>{notice.impact_on_heritage}
                </div>
                """
        return f'<div id="{detail_id}" class="source-detail">未找到来源记录</div>'

    def _inspection_section(self) -> str:
        rows = []
        for insp in self.data.inspections.values():
            summary_only = sum(1 for o in insp.opinions if o.status == OpinionStatus.SUMMARY_ONLY)
            rows.append(f"""
            <tr>
                <td>{insp.id}</td>
                <td>{insp.inspector}</td>
                <td>{insp.inspection_date.strftime('%Y-%m-%d')}</td>
                <td>{insp.location}</td>
                <td>{insp.heritage_site}</td>
                <td>{len(insp.opinions)}</td>
                <td style="color: #e74c3c;">{summary_only} 条无原文</td>
            </tr>
            """)

        return f"""
        <h2>📋 网格员巡查记录</h2>
        <table>
            <thead>
                <tr>
                    <th>巡查编号</th>
                    <th>网格员</th>
                    <th>巡查日期</th>
                    <th>区域</th>
                    <th>涉及遗产点</th>
                    <th>意见总数</th>
                    <th>备注</th>
                </tr>
            </thead>
            <tbody>
                {''.join(rows)}
            </tbody>
        </table>
        """

    def _notice_section(self) -> str:
        rows = []
        for notice in self.data.notices.values():
            rows.append(f"""
            <tr>
                <td>{notice.id}</td>
                <td>{notice.project_name}</td>
                <td>{notice.location}</td>
                <td>{notice.start_date.strftime('%Y-%m-%d')} ~ {notice.end_date.strftime('%Y-%m-%d')}</td>
                <td>{notice.construction_type}</td>
                <td>{notice.impact_on_heritage}</td>
            </tr>
            """)

        return f"""
        <h2>🏗️ 施工告示记录</h2>
        <table>
            <thead>
                <tr>
                    <th>告示编号</th>
                    <th>项目名称</th>
                    <th>位置</th>
                    <th>工期</th>
                    <th>施工类型</th>
                    <th>遗产影响</th>
                </tr>
            </thead>
            <tbody>
                {''.join(rows)}
            </tbody>
        </table>
        """

    def generate_text_report(self) -> str:
        """生成纯文本报告（用于命令行输出）"""
        lines = []
        lines.append("=" * 60)
        lines.append("文化遗产视廊控制报告")
        lines.append(f"生成时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("=" * 60)
        lines.append("")

        total = len(self.data.conflicts)
        resolved = sum(1 for c in self.data.conflicts.values() if c.is_resolved)
        lines.append(f"【总体情况】")
        lines.append(f"  巡查表: {len(self.data.inspections)} 份")
        lines.append(f"  施工告示: {len(self.data.notices)} 份")
        lines.append(f"  冲突项: {resolved}/{total} 已处理")
        lines.append("")

        lines.append(f"【待处理冲突复核表】")
        pending = [c for c in self.data.conflicts.values() if not c.is_resolved]
        if not pending:
            lines.append("  （无待处理冲突）")
        else:
            for c in sorted(pending, key=lambda x: x.conflict_level.value):
                lines.append(f"  ── {c.id} [{c.conflict_level.value}] {c.location}")
                lines.append(f"     意见: {c.opinion_summary}")
                lines.append(f"     原因: {c.conflict_reason}")
                lines.append(f"     缺材料: {', '.join(c.missing_materials)}")
                lines.append(f"     下一步: {c.next_action.value}")
                lines.append("")

        return "\n".join(lines)

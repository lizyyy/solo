import pandas as pd
from pathlib import Path
from datetime import datetime
from typing import List, Dict
from .models import TrackRecord, BatchSummary, AnomalyType
from .conflict_detector import ConflictResult
from .note_manager import TrackDiff

class ReportGenerator:
    def __init__(self, output_dir: str):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
    
    def generate_full_report(self, 
                            tracks: List[TrackRecord],
                            summary: BatchSummary,
                            conflicts: Dict[str, ConflictResult] = None,
                            diffs: List[TrackDiff] = None,
                            report_name: str = None) -> Dict[str, str]:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        if report_name:
            base_name = f"{report_name}_{timestamp}"
        else:
            base_name = f"评分报告_{timestamp}"
        
        excel_path = self.output_dir / f"{base_name}_明细.xlsx"
        summary_path = self.output_dir / f"{base_name}_汇总.txt"
        html_path = self.output_dir / f"{base_name}_报告.html"
        
        self._generate_excel_detail(tracks, excel_path)
        self._generate_summary_text(tracks, summary, conflicts, diffs, summary_path)
        self._generate_html_report(tracks, summary, conflicts, diffs, html_path)
        
        return {
            "excel": str(excel_path),
            "summary": str(summary_path),
            "html": str(html_path)
        }
    
    def _generate_excel_detail(self, tracks: List[TrackRecord], output_path: Path):
        data = [track.to_dict() for track in tracks]
        df = pd.DataFrame(data)
        
        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name="曲目明细", index=False)
            
            anomaly_data = []
            for track in tracks:
                for i, anomaly in enumerate(track.anomalies):
                    anomaly_data.append({
                        "曲目编号": track.track_id,
                        "曲目名称": track.track_name,
                        "异常类型": anomaly.value,
                        "异常详情": track.anomaly_details[i] if i < len(track.anomaly_details) else ""
                    })
            
            if anomaly_data:
                df_anomaly = pd.DataFrame(anomaly_data)
                df_anomaly.to_excel(writer, sheet_name="异常清单", index=False)
    
    def _generate_summary_text(self,
                               tracks: List[TrackRecord],
                               summary: BatchSummary,
                               conflicts: Dict[str, ConflictResult],
                               diffs: List[TrackDiff],
                               output_path: Path):
        lines = []
        lines.append("=" * 60)
        lines.append("少儿打击乐课堂评分 - 处理汇总报告")
        lines.append("=" * 60)
        lines.append(f"处理时间: {summary.start_time.strftime('%Y-%m-%d %H:%M:%S') if summary.start_time else 'N/A'}")
        lines.append(f"完成时间: {summary.end_time.strftime('%Y-%m-%d %H:%M:%S') if summary.end_time else 'N/A'}")
        lines.append(f"处理耗时: {summary.process_time:.2f} 秒")
        lines.append("")
        lines.append("-" * 60)
        lines.append("曲目统计")
        lines.append("-" * 60)
        lines.append(f"总曲目数: {summary.total_tracks}")
        lines.append(f"  - 已匹配: {summary.matched_tracks}")
        lines.append(f"  - 未匹配: {summary.unmatched_tracks}")
        lines.append(f"  - 处理失败: {summary.error_tracks}")
        lines.append(f"  - 数据冲突: {summary.conflict_tracks}")
        lines.append("")
        lines.append("-" * 60)
        lines.append("异常统计")
        lines.append("-" * 60)
        lines.append(f"总异常数: {summary.total_anomalies}")
        
        for anomaly_type, count in sorted(summary.anomaly_counts.items(), key=lambda x: -x[1]):
            lines.append(f"  - {anomaly_type.value}: {count} 条")
        
        lines.append("")
        
        if conflicts:
            lines.append("-" * 60)
            lines.append("数据冲突详情")
            lines.append("-" * 60)
            for track_id, conflict in conflicts.items():
                lines.append(f"曲目 {track_id}:")
                for c in conflict.conflicts:
                    lines.append(f"  - {c.field_name}:")
                    lines.append(f"    Excel值: {c.excel_value}")
                    lines.append(f"    导入值: {c.import_value}")
                    lines.append(f"    建议: {c.suggestion}")
            lines.append("")
        
        if diffs:
            lines.append("-" * 60)
            lines.append("补录差异详情")
            lines.append("-" * 60)
            for diff in diffs:
                lines.append(f"曲目 {diff.track_id}:")
                for change in diff.changes:
                    lines.append(f"  [{change.change_type}] {change.field}:")
                    lines.append(f"    旧值: {change.old_value or '(空)'}")
                    lines.append(f"    新值: {change.new_value or '(空)'}")
            lines.append("")
        
        lines.append("-" * 60)
        lines.append("需要关注的曲目")
        lines.append("-" * 60)
        
        attention_tracks = [t for t in tracks if t.anomalies or t.status.value in ["待审核", "数据冲突", "处理失败"]]
        if attention_tracks:
            for track in attention_tracks:
                status_icon = "⚠️" if track.status.value == "待审核" else "❌" if track.status.value in ["处理失败", "数据冲突"] else "⚡"
                lines.append(f"{status_icon} {track.track_id} - {track.track_name} ({track.student_name})")
                lines.append(f"   状态: {track.status.value}")
                if track.anomaly_details:
                    for detail in track.anomaly_details:
                        lines.append(f"   - {detail}")
                lines.append("")
        else:
            lines.append("无需要特别关注的曲目")
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write("\n".join(lines))
    
    def _generate_html_report(self,
                               tracks: List[TrackRecord],
                               summary: BatchSummary,
                               conflicts: Dict[str, ConflictResult],
                               diffs: List[TrackDiff],
                               output_path: Path):
        html_content = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>少儿打击乐课堂评分报告</title>
    <style>
        body {{ font-family: 'Microsoft YaHei', sans-serif; margin: 20px; background: #f5f5f5; }}
        .container {{ max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
        h1 {{ color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }}
        h2 {{ color: #34495e; margin-top: 30px; }}
        .stats {{ display: flex; gap: 20px; margin: 20px 0; flex-wrap: wrap; }}
        .stat-card {{ flex: 1; min-width: 150px; background: #ecf0f1; padding: 15px; border-radius: 8px; text-align: center; }}
        .stat-card .number {{ font-size: 28px; font-weight: bold; color: #2c3e50; }}
        .stat-card .label {{ color: #7f8c8d; margin-top: 5px; }}
        .stat-card.success .number {{ color: #27ae60; }}
        .stat-card.warning .number {{ color: #f39c12; }}
        .stat-card.danger .number {{ color: #e74c3c; }}
        .stat-card.info .number {{ color: #3498db; }}
        table {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
        th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }}
        th {{ background: #3498db; color: white; }}
        tr:hover {{ background: #f8f9fa; }}
        .badge {{ display: inline-block; padding: 3px 8px; border-radius: 12px; font-size: 12px; margin-right: 5px; }}
        .badge-success {{ background: #27ae60; color: white; }}
        .badge-warning {{ background: #f39c12; color: white; }}
        .badge-danger {{ background: #e74c3c; color: white; }}
        .badge-info {{ background: #3498db; color: white; }}
        .conflict {{ background: #fdecea; border-left: 4px solid #e74c3c; padding: 15px; margin: 10px 0; border-radius: 4px; }}
        .diff {{ background: #e8f4fd; border-left: 4px solid #3498db; padding: 15px; margin: 10px 0; border-radius: 4px; }}
        .evidence {{ background: #fff; padding: 10px; margin: 8px 0; border-radius: 4px; border: 1px solid #ddd; }}
        .timestamp {{ color: #7f8c8d; font-size: 0.9em; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>🥁 少儿打击乐课堂评分报告</h1>
        <p class="timestamp">生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
        
        <h2>📊 处理概览</h2>
        <div class="stats">
            <div class="stat-card">
                <div class="number">{summary.total_tracks}</div>
                <div class="label">总曲目</div>
            </div>
            <div class="stat-card success">
                <div class="number">{summary.matched_tracks}</div>
                <div class="label">已匹配</div>
            </div>
            <div class="stat-card warning">
                <div class="number">{summary.unmatched_tracks}</div>
                <div class="label">未匹配</div>
            </div>
            <div class="stat-card danger">
                <div class="number">{summary.error_tracks}</div>
                <div class="label">处理失败</div>
            </div>
            <div class="stat-card info">
                <div class="number">{summary.total_anomalies}</div>
                <div class="label">异常数</div>
            </div>
        </div>
"""
        
        if summary.anomaly_counts:
            html_content += """
        <h2>⚠️ 异常分布</h2>
        <table>
            <tr><th>异常类型</th><th>数量</th></tr>
"""
            for anomaly_type, count in sorted(summary.anomaly_counts.items(), key=lambda x: -x[1]):
                html_content += f"<tr><td>{anomaly_type.value}</td><td>{count}</td></tr>\n"
            html_content += "</table>\n"
        
        if conflicts:
            html_content += "<h2>🔀 数据冲突（需人工确认）</h2>\n"
            for track_id, conflict in conflicts.items():
                track = next((t for t in tracks if t.track_id == track_id), None)
                track_name = track.track_name if track else "未知"
                html_content += f'<div class="conflict">\n'
                html_content += f"<h3>{track_id} - {track_name}</h3>\n"
                for c in conflict.conflicts:
                    html_content += f'<div class="evidence">\n'
                    html_content += f"<strong>{c.field_name}</strong><br>\n"
                    html_content += f"📋 Excel记录: <code>{c.excel_value}</code><br>\n"
                    html_content += f"📥 导入数据: <code>{c.import_value}</code><br>\n"
                    html_content += f"💡 建议: {c.suggestion}\n"
                    html_content += "</div>\n"
                html_content += "</div>\n"
        
        if diffs:
            html_content += "<h2>📝 补录差异</h2>\n"
            for diff in diffs:
                track = next((t for t in tracks if t.track_id == diff.track_id), None)
                track_name = track.track_name if track else "未知"
                html_content += f'<div class="diff">\n'
                html_content += f"<h3>{diff.track_id} - {track_name}</h3>\n"
                for change in diff.changes:
                    badge_class = "badge-success" if change.change_type == "新增" else "badge-danger" if change.change_type == "删除" else "badge-warning"
                    html_content += f'<span class="badge {badge_class}">{change.change_type}</span>\n'
                    html_content += f'<div class="evidence">\n'
                    html_content += f"<strong>{change.field}</strong><br>\n"
                    if change.old_value:
                        html_content += f"旧: {change.old_value}<br>\n"
                    if change.new_value:
                        html_content += f"新: {change.new_value}\n"
                    html_content += "</div>\n"
                html_content += "</div>\n"
        
        html_content += """
        <h2>📋 曲目明细</h2>
        <table>
            <tr><th>曲目编号</th><th>名称</th><th>学生</th><th>状态</th><th>异常</th></tr>
"""
        for track in tracks:
            status_badge = "badge-success" if track.status.value == "已匹配" else "badge-warning" if track.status.value == "待审核" else "badge-danger"
            anomaly_badges = "".join([f'<span class="badge badge-danger">{a.value}</span>' for a in track.anomalies])
            html_content += f"<tr><td>{track.track_id}</td><td>{track.track_name}</td><td>{track.student_name}</td><td><span class='badge {status_badge}'>{track.status.value}</span></td><td>{anomaly_badges}</td></tr>\n"
        
        html_content += """
        </table>
    </div>
</body>
</html>"""
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(html_content)

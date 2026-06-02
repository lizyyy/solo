import os
from datetime import datetime
from pathlib import Path
from typing import List, Dict
from collections import Counter

from .models import MatchResult, TrackStatus, Conflict, ExceptionType
from .audit_log import AuditLog


HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DJ曲库能量排序 - 处理报告</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background: #f5f5f7;
            color: #1d1d1f;
            line-height: 1.6;
            padding: 20px;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 12px;
            margin-bottom: 20px;
        }
        .header h1 { font-size: 28px; margin-bottom: 8px; }
        .header p { opacity: 0.9; }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: white;
            padding: 20px;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.06);
            text-align: center;
        }
        .stat-card .number { font-size: 36px; font-weight: bold; }
        .stat-card .label { color: #86868b; font-size: 14px; margin-top: 4px; }
        .stat-card.matched .number { color: #34c759; }
        .stat-card.exception .number { color: #ff9500; }
        .stat-card.conflict .number { color: #ff3b30; }
        .section {
            background: white;
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        .section h2 { 
            font-size: 20px; 
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 2px solid #e5e5ea;
        }
        .track-item {
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 12px;
            border-left: 4px solid #e5e5ea;
            background: #fafafa;
        }
        .track-item.matched { border-left-color: #34c759; }
        .track-item.duplicate { border-left-color: #ff9500; }
        .track-item.old-version { border-left-color: #ffcc00; }
        .track-item.missing-license { border-left-color: #ff3b30; }
        .track-item.renamed { border-left-color: #5856d6; }
        .track-item.unmatched { border-left-color: #8e8e93; }
        .track-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
        }
        .track-title { font-weight: 600; font-size: 16px; }
        .track-status {
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 500;
        }
        .status-matched { background: #d1fae5; color: #065f46; }
        .status-duplicate { background: #fed7aa; color: #92400e; }
        .status-old { background: #fef3c7; color: #92400e; }
        .status-license { background: #fee2e2; color: #991b1b; }
        .status-renamed { background: #ede9fe; color: #5b21b6; }
        .status-unmatched { background: #e5e5ea; color: #48484a; }
        .track-meta {
            display: flex;
            gap: 20px;
            font-size: 13px;
            color: #86868b;
            margin-bottom: 8px;
        }
        .exceptions-box {
            background: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 6px;
            padding: 12px;
            margin-top: 10px;
        }
        .exceptions-box h4 {
            color: #92400e;
            font-size: 13px;
            margin-bottom: 8px;
        }
        .exception-item {
            font-size: 13px;
            padding: 4px 0;
            border-bottom: 1px dashed #ffeaa7;
        }
        .exception-item:last-child { border-bottom: none; }
        .exception-label { font-weight: 600; color: #92400e; }
        .suggestion {
            color: #78350f;
            margin-top: 4px;
        }
        .conflict-box {
            background: #fee2e2;
            border: 1px solid #fca5a5;
            border-radius: 6px;
            padding: 12px;
            margin-top: 10px;
        }
        .conflict-box h4 {
            color: #991b1b;
            font-size: 13px;
            margin-bottom: 8px;
        }
        .conflict-row {
            display: grid;
            grid-template-columns: 1fr 1fr 2fr;
            gap: 12px;
            padding: 8px 0;
            font-size: 13px;
            border-bottom: 1px dashed #fca5a5;
        }
        .conflict-row:last-child { border-bottom: none; }
        .conflict-val { background: white; padding: 6px 10px; border-radius: 4px; }
        .conflict-val.excel { border-left: 3px solid #007aff; }
        .conflict-val.old { border-left: 3px solid #ff9500; }
        .audit-box {
            background: #f0f0f5;
            border-radius: 6px;
            padding: 12px;
            margin-top: 10px;
            font-size: 12px;
        }
        .audit-box h4 {
            color: #48484a;
            margin-bottom: 8px;
        }
        .audit-row {
            padding: 4px 0;
            color: #636366;
        }
        .footer {
            text-align: center;
            padding: 20px;
            color: #86868b;
            font-size: 13px;
        }
        .energy-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 11px;
            font-weight: 600;
            margin-left: 8px;
        }
        .energy-high { background: #fee2e2; color: #dc2626; }
        .energy-medium { background: #fef3c7; color: #d97706; }
        .energy-low { background: #dbeafe; color: #2563eb; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎧 DJ曲库能量排序</h1>
            <p>曲目匹配与异常检测报告 · 生成时间: {{generated_at}}</p>
        </div>
        
        <div class="summary">
            <div class="stat-card matched">
                <div class="number">{{stats.total}}</div>
                <div class="label">总曲目数</div>
            </div>
            <div class="stat-card matched">
                <div class="number">{{stats.matched}}</div>
                <div class="label">正常匹配</div>
            </div>
            <div class="stat-card exception">
                <div class="number">{{stats.exceptions}}</div>
                <div class="label">需关注</div>
            </div>
            <div class="stat-card conflict">
                <div class="number">{{stats.conflicts}}</div>
                <div class="label">数据冲突</div>
            </div>
        </div>
        
        <div class="section">
            <h2>📋 曲目清单</h2>
            {{track_list}}
        </div>
        
        {% if conflicts %}
        <div class="section">
            <h2>⚠️ 数据冲突</h2>
            <p style="color: #666; margin-bottom: 16px;">以下曲目Excel表数据与系统记录不一致，请人工核对确认</p>
            {{conflict_list}}
        </div>
        {% endif %}
        
        <div class="footer">
            <p>DJ曲库能量排序工具 · 本次处理由 {{operator}} 执行 · 报告编号: {{report_id}}</p>
            <p style="margin-top: 8px;">提示：点击曲目可查看详细处理历史，有疑问请联系音乐老师</p>
        </div>
    </div>
</body>
</html>
"""

TRACK_ITEM_TEMPLATE = """
<div class="track-item {{item_class}}">
    <div class="track-header">
        <div class="track-title">
            {{track_title}}
            {% if energy_level %}
            <span class="energy-badge {{energy_class}}">能量{{energy_level}}</span>
            {% endif %}
        </div>
        <span class="track-status {{status_class}}">{{status_text}}</span>
    </div>
    <div class="track-meta">
        <span>ID: {{track_id}}</span>
        <span>艺术家: {{artist}}</span>
        {% if duration %}<span>时长: {{duration}}</span>{% endif %}
        {% if bpm %}<span>BPM: {{bpm}}</span>{% endif %}
    </div>
    {% if audio_file %}
    <div class="track-meta">
        <span>文件: {{audio_file}}</span>
        <span>置信度: {{confidence}}%</span>
    </div>
    {% endif %}
    {% if exceptions %}
    <div class="exceptions-box">
        <h4>🔍 异常提醒</h4>
        {% for exc in exceptions %}
        <div class="exception-item">
            <span class="exception-label">{{exc.type}}:</span> {{exc.detail}}
            <div class="suggestion">💡 建议: {{exc.suggestion}}</div>
        </div>
        {% endfor %}
    </div>
    {% endif %}
    {% if audit_trail %}
    <div class="audit-box">
        <h4>📝 处理历史</h4>
        {% for entry in audit_trail %}
        <div class="audit-row">
            {{entry.time}} · {{entry.operator}} · {{entry.action}}
            {% if entry.reason %}<br>&nbsp;&nbsp;&nbsp;&nbsp;{{entry.reason}}{% endif %}
        </div>
        {% endfor %}
    </div>
    {% endif %}
</div>
"""


class ReportGenerator:
    def __init__(self, config: Dict, audit_log: AuditLog):
        self.config = config
        self.audit_log = audit_log
        
    def generate_html_report(self, results: List[MatchResult], 
                            conflicts: List[Conflict],
                            output_path: str,
                            operator: str = "系统") -> str:
        
        from jinja2 import Template
        
        stats = self._calculate_stats(results, conflicts)
        track_list_html = self._generate_track_list(results)
        conflict_list_html = self._generate_conflict_list(conflicts, results)
        
        template = Template(HTML_TEMPLATE)
        html = template.render(
            generated_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            stats=stats,
            track_list=track_list_html,
            conflict_list=conflict_list_html,
            conflicts=conflicts,
            operator=operator,
            report_id=self._generate_report_id()
        )
        
        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(html)
            
        self.audit_log.log(
            operator=operator,
            action="生成报告",
            reason=f"生成HTML报告: {output_path}",
            source=output_path
        )
            
        return output_path
    
    def _calculate_stats(self, results: List[MatchResult], 
                        conflicts: List[Conflict]) -> Dict:
        total = len(results)
        matched = sum(1 for r in results if r.status == TrackStatus.MATCHED)
        exceptions = total - matched
        unresolved_conflicts = sum(1 for c in conflicts if not c.resolved)
        
        return {
            'total': total,
            'matched': matched,
            'exceptions': exceptions,
            'conflicts': unresolved_conflicts
        }
    
    def _generate_track_list(self, results: List[MatchResult]) -> str:
        from jinja2 import Template
        
        track_template = Template(TRACK_ITEM_TEMPLATE)
        html_parts = []
        
        status_order = [
            TrackStatus.MISSING_LICENSE,
            TrackStatus.OLD_VERSION,
            TrackStatus.DUPLICATE,
            TrackStatus.RENAMED,
            TrackStatus.CONFLICT,
            TrackStatus.MATCHED,
            TrackStatus.UNMATCHED
        ]
        
        sorted_results = sorted(results, key=lambda r: status_order.index(r.status))
        
        for result in sorted_results:
            item_class = self._get_item_class(result.status)
            status_class = self._get_status_class(result.status)
            status_text = result.status.value
            
            energy_level = result.track.energy_level
            energy_class = self._get_energy_class(energy_level)
            
            exceptions = []
            for exc_type in result.exceptions:
                details = result.exception_details.get(exc_type.name.lower(), {})
                exceptions.append({
                    'type': exc_type.value,
                    'detail': self._get_exception_detail(exc_type, details),
                    'suggestion': details.get('suggestion', '请人工确认')
                })
            
            duration = ""
            if result.track.duration:
                mins = int(result.track.duration // 60)
                secs = int(result.track.duration % 60)
                duration = f"{mins}:{secs:02d}"
            
            audit_trail = self._get_audit_trail(result.track.track_id)
            
            html = track_template.render(
                item_class=item_class,
                track_title=result.track.title,
                energy_level=energy_level,
                energy_class=energy_class,
                status_class=status_class,
                status_text=status_text,
                track_id=result.track.track_id,
                artist=result.track.artist or "未知",
                duration=duration,
                bpm=result.track.bpm,
                audio_file=result.audio_file.file_name if result.audio_file else "",
                confidence=f"{result.match_confidence * 100:.0f}",
                exceptions=exceptions,
                audit_trail=audit_trail
            )
            html_parts.append(html)
            
        return "\n".join(html_parts)
    
    def _generate_conflict_list(self, conflicts: List[Conflict], 
                               results: List[MatchResult]) -> str:
        html_parts = []
        
        for conflict in conflicts:
            if conflict.resolved:
                continue
                
            result = next((r for r in results if r.track.track_id == conflict.track_id), None)
            track_title = result.track.title if result else conflict.track_id
            
            html = f'''
            <div class="conflict-box">
                <h4>🎵 曲目: {track_title} (ID: {conflict.track_id})</h4>
                <div class="conflict-row">
                    <div><strong>字段</strong></div>
                    <div><strong>Excel值</strong></div>
                    <div><strong>系统值</strong></div>
                </div>
                <div class="conflict-row">
                    <div>{conflict.field_name}</div>
                    <div class="conflict-val excel">{conflict.excel_value or "(空)"}</div>
                    <div class="conflict-val old">{conflict.import_value or "(空)"}</div>
                </div>
                <p style="margin-top: 10px; color: #991b1b;">💡 建议: {conflict.suggested_action}</p>
            </div>
            '''
            html_parts.append(html)
            
        return "\n".join(html_parts)
    
    def _get_item_class(self, status: TrackStatus) -> str:
        mapping = {
            TrackStatus.MATCHED: 'matched',
            TrackStatus.DUPLICATE: 'duplicate',
            TrackStatus.OLD_VERSION: 'old-version',
            TrackStatus.MISSING_LICENSE: 'missing-license',
            TrackStatus.RENAMED: 'renamed',
            TrackStatus.UNMATCHED: 'unmatched',
            TrackStatus.CONFLICT: 'conflict'
        }
        return mapping.get(status, '')
    
    def _get_status_class(self, status: TrackStatus) -> str:
        mapping = {
            TrackStatus.MATCHED: 'status-matched',
            TrackStatus.DUPLICATE: 'status-duplicate',
            TrackStatus.OLD_VERSION: 'status-old',
            TrackStatus.MISSING_LICENSE: 'status-license',
            TrackStatus.RENAMED: 'status-renamed',
            TrackStatus.UNMATCHED: 'status-unmatched',
            TrackStatus.CONFLICT: 'status-license'
        }
        return mapping.get(status, 'status-unmatched')
    
    def _get_energy_class(self, level) -> str:
        if not level:
            return ''
        if level >= 8:
            return 'energy-high'
        elif level >= 5:
            return 'energy-medium'
        else:
            return 'energy-low'
    
    def _get_exception_detail(self, exc_type: ExceptionType, details: Dict) -> str:
        if exc_type == ExceptionType.FILENAME_MISMATCH:
            return f"期望 '{details.get('expected', '')}'，实际 '{details.get('actual', '')}'"
        elif exc_type == ExceptionType.DUPLICATE:
            return f"发现 {details.get('duplicate_count', 0)} 条重复记录"
        elif exc_type == ExceptionType.OLD_VERSION:
            return f"存在更新版本: {details.get('newest_file', '未知')}"
        elif exc_type == ExceptionType.MISSING_LICENSE:
            return f"授权信息不完整，请确认版权状态"
        elif exc_type == ExceptionType.RENAMED:
            return f"模糊匹配，可能已人工改名"
        return str(details)
    
    def _get_audit_trail(self, track_id: str) -> List[Dict]:
        entries = self.audit_log.get_track_history(track_id)
        trail = []
        for entry in entries[:5]:
            trail.append({
                'time': entry.timestamp.strftime("%m-%d %H:%M"),
                'operator': entry.operator,
                'action': entry.action,
                'reason': entry.reason
            })
        return trail
    
    def _generate_report_id(self) -> str:
        return f"RPT-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    
    def generate_text_summary(self, results: List[MatchResult], 
                             conflicts: List[Conflict]) -> str:
        stats = self._calculate_stats(results, conflicts)
        summary = [
            "=" * 50,
            "DJ曲库能量排序 - 处理摘要",
            "=" * 50,
            f"总曲目数: {stats['total']}",
            f"正常匹配: {stats['matched']}",
            f"需关注: {stats['exceptions']}",
            f"数据冲突: {stats['conflicts']}",
            "",
            "异常分类:"
        ]
        
        counter = Counter(r.status.value for r in results)
        for status, count in counter.most_common():
            if status != "已匹配":
                summary.append(f"  - {status}: {count}")
                
        summary.extend([
            "",
            "=" * 50,
            "详细报告请查看 HTML 文件"
        ])
        
        return "\n".join(summary)

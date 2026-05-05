import json
from datetime import datetime, date
from pathlib import Path
from typing import Dict, Any, List, Optional

from .database import Database, ObservationPlan


class Exporter:
    def __init__(self, db: Database):
        self.db = db

    def export_markdown_handover(
        self, 
        output_path: str, 
        observation_date: Optional[date] = None,
        title: str = "观测交接单"
    ) -> str:
        if observation_date is None:
            observation_date = date.today()

        plans = self.db.get_plans_by_date(observation_date)
        scan_summary = self._get_scan_summary()
        dark_frames = self.db.get_all_dark_frames()

        md_content = self._generate_markdown(
            title, observation_date, plans, scan_summary, dark_frames
        )

        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        output_file.write_text(md_content, encoding='utf-8')

        return md_content

    def _generate_markdown(
        self, 
        title: str,
        observation_date: date,
        plans: List[Dict],
        scan_summary: Dict,
        dark_frames: List[Any]
    ) -> str:
        lines = []
        
        lines.append(f"# {title}")
        lines.append("")
        lines.append(f"**观测日期**: {observation_date.strftime('%Y年%m月%d日')}")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")

        lines.append("## 📊 扫描概览")
        lines.append("")
        lines.append(f"- **总目标数**: {scan_summary['total_targets']}")
        lines.append(f"- **可观测目标**: {scan_summary['targets_ok']}")
        lines.append(f"- **有问题目标**: {scan_summary['targets_with_issues']}")
        lines.append("")

        lines.append("### 问题分类")
        lines.append("")
        breakdown = scan_summary['conflict_breakdown']
        lines.append(f"- 🔧 维护冲突: {breakdown.get('maintenance_conflict', 0)}")
        lines.append(f"- 🌙 月亮角距过小: {breakdown.get('moon_angle_too_small', 0)}")
        lines.append(f"- ☁️ 云量超限: {breakdown.get('cloud_cover_exceeded', 0)}")
        lines.append(f"- 📷 缺少暗场: {breakdown.get('missing_dark_frame', 0)}")
        lines.append("")

        lines.append("## 📋 观测计划")
        lines.append("")

        if plans:
            lines.append("| 优先级 | 目标名称 | 预定时间 | 状态 | 备注 |")
            lines.append("|--------|----------|----------|------|------|")
            for plan in plans:
                status_emoji = {
                    'pending': '⏳',
                    'approved': '✅',
                    'rejected': '❌',
                    'completed': '✔️'
                }.get(plan['status'], '⏳')
                
                scheduled_time = plan['scheduled_time'].strftime('%H:%M') if plan['scheduled_time'] else '-'
                notes = plan.get('notes', '') or '-'
                lines.append(f"| {plan['priority']} | {plan['target_name']} | {scheduled_time} | {status_emoji} {plan['status']} | {notes} |")
        else:
            lines.append("*暂无观测计划*")
        lines.append("")

        lines.append("## ⚠️ 详细问题列表")
        lines.append("")

        issues = scan_summary.get('issues', [])
        if issues:
            for issue in issues:
                severity_badge = {
                    'high': '🔴 高',
                    'medium': '🟡 中',
                    'low': '🟢 低'
                }.get(issue['severity'], '⚪')
                
                conflict_name = {
                    'maintenance_conflict': '维护冲突',
                    'moon_angle_too_small': '月亮角距过小',
                    'cloud_cover_exceeded': '云量超限',
                    'missing_dark_frame': '缺少暗场帧'
                }.get(issue['conflict_type'], issue['conflict_type'])

                lines.append(f"### {severity_badge} - {conflict_name}")
                lines.append(f"")
                lines.append(f"- **目标**: {issue['target_name']}")
                lines.append(f"- **详情**: {issue['conflict_details']}")
                lines.append(f"- **扫描时间**: {issue['scan_time'].strftime('%Y-%m-%d %H:%M:%S') if issue.get('scan_time') else '-'}")
                lines.append("")
        else:
            lines.append("*暂无检测到的问题*")
        lines.append("")

        lines.append("## 📷 可用暗场帧")
        lines.append("")

        if dark_frames:
            lines.append("| 曝光时间(s) | Binning | 增益 | 数量 |")
            lines.append("|-------------|---------|------|------|")
            for dark in dark_frames:
                lines.append(f"| {dark.exposure} | {dark.binning}x | {dark.gain} | {dark.count} |")
        else:
            lines.append("*暂无暗场帧信息*")
        lines.append("")

        lines.append("---")
        lines.append("")
        lines.append("*此文档由 Observatory Tool 自动生成*")

        return "\n".join(lines)

    def export_json_audit(
        self, 
        output_path: str,
        observation_date: Optional[date] = None
    ) -> str:
        if observation_date is None:
            observation_date = date.today()

        audit_data = self._collect_audit_data(observation_date)

        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        json_content = json.dumps(audit_data, ensure_ascii=False, indent=2, default=str)
        output_file.write_text(json_content, encoding='utf-8')

        return json_content

    def _collect_audit_data(self, observation_date: date) -> Dict[str, Any]:
        plans = self.db.get_plans_by_date(observation_date)
        targets = self.db.get_all_targets()
        scan_results = self.db.get_all_scan_results()
        dark_frames = self.db.get_all_dark_frames()

        plans_serialized = []
        for plan in plans:
            plan_copy = dict(plan)
            for key, value in plan_copy.items():
                if isinstance(value, datetime):
                    plan_copy[key] = value.isoformat()
            plans_serialized.append(plan_copy)

        targets_serialized = []
        for target in targets:
            targets_serialized.append({
                'id': target.id,
                'target_name': target.target_name,
                'ra': target.ra,
                'dec': target.dec,
                'priority': target.priority,
                'min_moon_angle': target.min_moon_angle,
                'max_cloud_cover': target.max_cloud_cover,
                'required_exposure': target.required_exposure,
                'required_binning': target.required_binning,
                'required_gain': target.required_gain
            })

        scan_serialized = []
        for result in scan_results:
            result_copy = dict(result)
            for key, value in result_copy.items():
                if isinstance(value, datetime):
                    result_copy[key] = value.isoformat()
            scan_serialized.append(result_copy)

        dark_serialized = []
        for dark in dark_frames:
            dark_serialized.append({
                'exposure': dark.exposure,
                'binning': dark.binning,
                'gain': dark.gain,
                'count': dark.count,
                'file_path': dark.file_path
            })

        return {
            'audit_info': {
                'generated_at': datetime.now().isoformat(),
                'observation_date': observation_date.isoformat(),
                'tool_version': '0.1.0'
            },
            'observation_plans': plans_serialized,
            'targets': targets_serialized,
            'scan_results': scan_serialized,
            'dark_frames': dark_serialized,
            'statistics': self._calculate_statistics(targets, scan_results)
        }

    def _calculate_statistics(self, targets, scan_results) -> Dict[str, Any]:
        total_targets = len(targets)
        targets_with_issues = set(r['target_id'] for r in scan_results)
        
        conflict_types = {}
        for r in scan_results:
            ctype = r['conflict_type']
            conflict_types[ctype] = conflict_types.get(ctype, 0) + 1

        return {
            'total_targets': total_targets,
            'targets_ok': total_targets - len(targets_with_issues),
            'targets_with_issues': len(targets_with_issues),
            'conflict_types': conflict_types
        }

    def _get_scan_summary(self) -> Dict[str, Any]:
        from .scanner import ConflictScanner
        scanner = ConflictScanner(self.db)
        return scanner.get_scan_summary()

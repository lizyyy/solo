import pandas as pd
from typing import Dict, Any, List, Tuple
from datetime import datetime


class ConflictResolver:
    def __init__(self):
        self.conflicts: List[Dict[str, Any]] = []
        self.resolution_time = None

    def detect_conflicts(self, inspection_notes: List[str], anomaly_flags: pd.Series, data_source: str) -> List[Dict[str, Any]]:
        self.resolution_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.conflicts = []

        note_flags = set()
        for note in inspection_notes:
            note_lower = str(note).lower()
            if '正常' in note_lower or '无异常' in note_lower:
                note_flags.add('normal')
            if '异常' in note_lower or '问题' in note_lower:
                note_flags.add('abnormal')
            if '流速' in note_lower or '水流' in note_lower:
                note_flags.add('velocity_mentioned')
            if '大' in note_lower and ('物' in note_lower or '块' in note_lower):
                note_flags.add('large_object_mentioned')

        data_has_anomaly = (anomaly_flags != '正常').any()

        if 'normal' in note_flags and data_has_anomaly:
            self.conflicts.append({
                'conflict_type': '状态判定冲突',
                'severity': 'high',
                'inspection_evidence': '巡检备注标注"正常/无异常"',
                'detection_evidence': f'系统检测发现 {int((anomaly_flags != "正常").sum())} 条异常记录',
                'suggested_actions': [
                    '请核对巡检时间与数据采集时间是否一致',
                    '建议复核现场实际情况，确认是否漏检',
                    '如巡检记录有误，请更新巡检表备注'
                ],
                'responsible_party': '设备工程师何工'
            })

        if 'abnormal' in note_flags and not data_has_anomaly:
            self.conflicts.append({
                'conflict_type': '状态判定冲突',
                'severity': 'medium',
                'inspection_evidence': '巡检备注标注"异常/问题"',
                'detection_evidence': '系统检测未发现异常记录',
                'suggested_actions': [
                    '请核对人工判断依据是否充分',
                    '建议检查检测阈值设置是否合理',
                    '如确属漏检，可考虑调整检测参数'
                ],
                'responsible_party': '设备工程师何工'
            })

        if 'velocity_mentioned' in note_flags:
            self.conflicts.append({
                'conflict_type': '流速关注点',
                'severity': 'info',
                'inspection_evidence': '巡检记录中提到了流速相关情况',
                'detection_evidence': '建议结合系统流速数据分析验证',
                'suggested_actions': [
                    '请核对巡检描述与流速曲线趋势是否一致',
                    '如有汛期或放水情况，可考虑调整流速阈值'
                ],
                'responsible_party': '水文监测员'
            })

        return self.conflicts

    def generate_conflict_report(self) -> Dict[str, Any]:
        return {
            'report_time': self.resolution_time,
            'total_conflicts': len(self.conflicts),
            'high_severity': len([c for c in self.conflicts if c['severity'] == 'high']),
            'medium_severity': len([c for c in self.conflicts if c['severity'] == 'medium']),
            'info_severity': len([c for c in self.conflicts if c['severity'] == 'info']),
            'conflicts': self.conflicts,
            'disclaimer': '本报告仅列出可能存在的冲突点，最终判定请以人工核实为准。'
        }

    def format_conflict_display(self) -> str:
        if not self.conflicts:
            return "✅ 未检测到巡检表与推演结果的冲突"

        output = ["⚠️ 冲突检测报告\n" + "=" * 50]

        for i, conflict in enumerate(self.conflicts, 1):
            severity_marker = {'high': '🔴', 'medium': '🟡', 'info': '🔵'}.get(conflict['severity'], '⚪')
            output.append(f"\n{severity_marker} 冲突 #{i}: {conflict['conflict_type']}")
            output.append(f"   巡检表证据: {conflict['inspection_evidence']}")
            output.append(f"   系统检测证据: {conflict['detection_evidence']}")
            output.append(f"   建议动作:")
            for j, action in enumerate(conflict['suggested_actions'], 1):
                output.append(f"      {j}. {action}")
            output.append(f"   责任方: {conflict['responsible_party']}")

        output.append(f"\n{'=' * 50}")
        output.append("💡 提示：以上冲突点请结合实际情况核实，系统不自动替您拍板。")

        return '\n'.join(output)

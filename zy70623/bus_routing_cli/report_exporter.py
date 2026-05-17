import json
import csv
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any
from dataclasses import asdict

from .models import (
    ReroutePlan, ParentConfirmation, RecoveryCheck,
    ConfirmationStatus, RecoveryStatus, ConfirmationChannel, RerouteReason
)
from .rules_engine import RulesEngine
from .recovery_state_machine import RecoveryStateMachine


class ReportExporter:
    def __init__(self, rules_engine: RulesEngine, recovery_sm: RecoveryStateMachine):
        self.rules_engine = rules_engine
        self.recovery_sm = recovery_sm

    def generate_machine_readable_report(self, reroute: Dict, 
                                          confirmations: List[Dict],
                                          recovery_checks: List[Dict],
                                          output_path: str):
        unique_confs, duplicates = self.rules_engine.deduplicate_confirmations(
            [self._dict_to_conf(c) for c in confirmations]
        )
        
        report = {
            "generated_at": datetime.now().isoformat(),
            "reroute_info": reroute,
            "summary": {
                "total_confirmations": len(confirmations),
                "unique_confirmations": len(unique_confs),
                "duplicate_confirmations": len(duplicates),
                "confirmed_count": sum(1 for c in unique_confs if c.status == ConfirmationStatus.CONFIRMED),
                "pending_count": sum(1 for c in unique_confs if c.status == ConfirmationStatus.PENDING),
                "rejected_count": sum(1 for c in unique_confs if c.status == ConfirmationStatus.REJECTED),
                "late_confirmations": sum(1 for c in unique_confs if c.is_late),
                "stop_mismatches": sum(1 for c in unique_confs if c.original_stop_id and not c.new_stop_id)
            },
            "confirmations": [asdict(c) for c in unique_confs],
            "duplicates": [asdict(c) for c in duplicates],
            "recovery_checks": recovery_checks,
            "recovery_assessment": self.recovery_sm.assess_recovery_readiness(
                self._dict_to_reroute(reroute),
                [self._dict_to_conf(c) for c in confirmations]
            )
        }
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2, default=str)
        
        return report

    def generate_human_readable_report(self, reroute: Dict,
                                        confirmations: List[Dict],
                                        recovery_checks: List[Dict],
                                        output_path: str):
        unique_confs, duplicates = self.rules_engine.deduplicate_confirmations(
            [self._dict_to_conf(c) for c in confirmations]
        )
        
        assessment = self.recovery_sm.assess_recovery_readiness(
            self._dict_to_reroute(reroute),
            [self._dict_to_conf(c) for c in confirmations]
        )
        
        lines = []
        lines.append("=" * 80)
        lines.append("校车改线家长回执站点恢复排查报告")
        lines.append("=" * 80)
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        lines.append("--- 改线信息 ---")
        lines.append(f"改线ID: {reroute.get('reroute_id', 'N/A')}")
        lines.append(f"线路ID: {reroute.get('route_id', 'N/A')}")
        lines.append(f"改线原因: {reroute.get('reason', 'N/A')}")
        lines.append(f"原因详情: {reroute.get('reason_detail', 'N/A')}")
        lines.append(f"生效日期: {reroute.get('effective_date', 'N/A')}")
        lines.append("")
        
        lines.append("--- 回执统计 ---")
        lines.append(f"回执总数: {len(confirmations)}")
        lines.append(f"有效回执: {len(unique_confs)}")
        lines.append(f"重复回执: {len(duplicates)}")
        lines.append(f"已确认: {sum(1 for c in unique_confs if c.status == ConfirmationStatus.CONFIRMED)}")
        lines.append(f"待确认: {sum(1 for c in unique_confs if c.status == ConfirmationStatus.PENDING)}")
        lines.append(f"已拒绝: {sum(1 for c in unique_confs if c.status == ConfirmationStatus.REJECTED)}")
        lines.append(f"迟交回执: {sum(1 for c in unique_confs if c.is_late)}")
        lines.append(f"站点未匹配: {sum(1 for c in unique_confs if c.original_stop_id and not c.new_stop_id)}")
        lines.append("")
        
        lines.append("--- 恢复评估 ---")
        lines.append(f"恢复就绪分数: {assessment['readiness_score']}/100")
        lines.append(f"是否可恢复: {'是' if assessment['can_recover'] else '否'}")
        if assessment['issues']:
            lines.append("发现问题:")
            for issue in assessment['issues']:
                lines.append(f"  - {issue}")
        lines.append("")
        
        lines.append("--- 排查历史 ---")
        if recovery_checks:
            for check in sorted(recovery_checks, key=lambda x: x.get('checked_at', '')):
                lines.append(f"[{check.get('checked_at', 'N/A')}] {check.get('checked_by', 'N/A')}")
                lines.append(f"  状态: {check.get('status', 'N/A')}")
                if check.get('issues_found'):
                    lines.append(f"  发现问题: {', '.join(check['issues_found'])}")
                if check.get('resolution_notes'):
                    lines.append(f"  备注: {check['resolution_notes']}")
                lines.append("")
        else:
            lines.append("暂无排查记录")
            lines.append("")
        
        lines.append("--- 回执详情 ---")
        for conf in unique_confs:
            status_icon = "✓" if conf.status == ConfirmationStatus.CONFIRMED else "?" if conf.status == ConfirmationStatus.PENDING else "✗"
            late_marker = " [迟到]" if conf.is_late else ""
            lines.append(f"{status_icon} {conf.parent_name} (学生: {conf.student_id}){late_marker}")
            lines.append(f"  状态: {conf.status.value} | 渠道: {conf.channel.value}")
            if conf.original_stop_id:
                stop_info = f"原站点: {conf.original_stop_id}"
                if conf.new_stop_id:
                    stop_info += f" -> 新站点: {conf.new_stop_id}"
                lines.append(f"  {stop_info}")
            if conf.notes:
                lines.append(f"  备注: {conf.notes}")
            lines.append("")
        
        if duplicates:
            lines.append("--- 重复回执 (已过滤) ---")
            for dup in duplicates:
                lines.append(f"  - {dup.parent_name} (确认ID: {dup.confirmation_id})")
            lines.append("")
        
        lines.append("=" * 80)
        lines.append("报告结束")
        lines.append("=" * 80)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))
        
        return '\n'.join(lines)

    def export_csv_report(self, reroute: Dict, confirmations: List[Dict], output_path: str):
        unique_confs, _ = self.rules_engine.deduplicate_confirmations(
            [self._dict_to_conf(c) for c in confirmations]
        )
        
        with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                '确认ID', '学生ID', '改线ID', '家长姓名', '状态',
                '确认渠道', '确认时间', '是否迟到', '原站点ID', '新站点ID', '备注'
            ])
            
            for conf in unique_confs:
                writer.writerow([
                    conf.confirmation_id,
                    conf.student_id,
                    conf.reroute_id,
                    conf.parent_name,
                    conf.status.value,
                    conf.channel.value,
                    conf.confirmed_at.isoformat() if conf.confirmed_at else '',
                    '是' if conf.is_late else '否',
                    conf.original_stop_id or '',
                    conf.new_stop_id or '',
                    conf.notes
                ])

    def _dict_to_conf(self, data: Dict) -> ParentConfirmation:
        return ParentConfirmation(
            confirmation_id=data['confirmation_id'],
            student_id=data['student_id'],
            reroute_id=data['reroute_id'],
            status=ConfirmationStatus(data['status']) if isinstance(data['status'], str) else data['status'],
            channel=ConfirmationChannel(data['channel']) if isinstance(data['channel'], str) else data['channel'],
            confirmed_at=datetime.fromisoformat(data['confirmed_at']) if data.get('confirmed_at') else None,
            parent_name=data.get('parent_name', ''),
            notes=data.get('notes', ''),
            is_late=data.get('is_late', False),
            original_stop_id=data.get('original_stop_id'),
            new_stop_id=data.get('new_stop_id')
        )

    def _dict_to_reroute(self, data: Dict) -> ReroutePlan:
        return ReroutePlan(
            reroute_id=data['reroute_id'],
            route_id=data['route_id'],
            reason=RerouteReason(data['reason']),
            reason_detail=data['reason_detail'],
            effective_date=datetime.fromisoformat(data['effective_date']).date() if data.get('effective_date') else None,
            created_at=datetime.fromisoformat(data['created_at']) if data.get('created_at') else None,
            created_by=data.get('created_by', '')
        )

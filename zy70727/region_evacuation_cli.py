#!/usr/bin/env python3
import argparse
import json
import csv
import sys
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
import re


class BlockReason(Enum):
    LOCAL_RESOURCE_BOUND = "本地资源绑定"
    TRAFFIC_THRESHOLD_VIOLATION = "流量比例超限"
    INVALID_TENANT_STATUS = "租户状态异常"
    DEPENDENCY_CYCLE = "依赖循环"
    CROSS_REGION_SYNC_PENDING = "跨区同步未完成"
    UNKNOWN = "未知原因"


class StepStatus(Enum):
    PENDING = "待执行"
    EXECUTED = "已执行"
    SKIPPED_BLOCKED = "跳过-租户阻塞"
    SKIPPED_IDEMPOTENT = "跳过-已执行过"
    SKIPPED_INVALID = "跳过-校验失败"


@dataclass
class TenantBinding:
    tenant_id: str
    tenant_name: str
    local_resources: List[str]
    traffic_percent: float
    status: str
    cross_region_synced: bool


@dataclass
class EvacuationStep:
    step_id: str
    tenant_id: str
    target_percent: float
    status: str
    executed_at: Optional[str] = None
    skip_reason: Optional[str] = None


@dataclass
class BlockedTenant:
    tenant_id: str
    tenant_name: str
    block_reasons: List[BlockReason]
    local_resources: List[str]
    current_traffic_percent: float
    suggestion: str


@dataclass
class DataQualityIssue:
    level: str
    field: str
    value: str
    message: str


@dataclass
class ExecutionSummary:
    region: str
    total_tenants: int
    blocked_count: int
    cleared_count: int
    blocked_tenants: List[BlockedTenant]
    evacuation_plan: List[EvacuationStep]
    executed_steps: int
    skipped_steps: int
    plan_validation_issues: List[str]
    data_quality_issues: List[DataQualityIssue]
    check_only: bool
    executed_at: str
    success: bool


class DependencyChecker:
    def __init__(self):
        self.local_resource_patterns = [
            r'^local-',
            r'^region-.+-local',
            r'-local$'
        ]

    def is_local_resource(self, resource_id: str) -> bool:
        if not resource_id:
            return False
        for pattern in self.local_resource_patterns:
            if re.match(pattern, resource_id, re.IGNORECASE):
                return True
        return False

    def check_tenant_bindings(self, tenant: TenantBinding) -> List[BlockReason]:
        reasons = []
        local_bound = [r for r in tenant.local_resources if self.is_local_resource(r)]
        if local_bound:
            reasons.append(BlockReason.LOCAL_RESOURCE_BOUND)
        if tenant.status not in ['active', 'normal']:
            reasons.append(BlockReason.INVALID_TENANT_STATUS)
        if not tenant.cross_region_synced:
            reasons.append(BlockReason.CROSS_REGION_SYNC_PENDING)
        return reasons


class TrafficController:
    def __init__(self):
        self.max_step_percent = 30.0
        self.min_step_percent = 5.0
        self.execution_history: Dict[str, List[EvacuationStep]] = {}

    def validate_traffic_progression(self, current: float, target: float) -> bool:
        if target < 0 or target > 100:
            return False
        if target > current:
            return False
        delta = current - target
        return delta <= self.max_step_percent and delta >= self.min_step_percent

    def is_step_executed(self, step_id: str, tenant_id: str) -> bool:
        if tenant_id not in self.execution_history:
            return False
        return any(s.step_id == step_id for s in self.execution_history[tenant_id])

    def record_execution(self, step: EvacuationStep):
        if step.tenant_id not in self.execution_history:
            self.execution_history[step.tenant_id] = []
        step.executed_at = datetime.now().isoformat()
        self.execution_history[step.tenant_id].append(step)


class EvacuationOrchestrator:
    def __init__(self):
        self.dependency_checker = DependencyChecker()
        self.traffic_controller = TrafficController()
        self.execution_id = datetime.now().strftime("%Y%m%d%H%M%S")

    def _validate_tenant_data(self, item: Dict[str, Any]) -> Tuple[bool, List[DataQualityIssue]]:
        issues = []
        valid = True
        
        if not item.get('tenant_id') or str(item['tenant_id']).strip() == '':
            issues.append(DataQualityIssue(
                level='ERROR',
                field='tenant_id',
                value=str(item.get('tenant_id', '')),
                message='租户ID不能为空'
            ))
            valid = False
        
        try:
            traffic = float(item.get('traffic_percent', 0))
            if traffic < 0 or traffic > 100:
                issues.append(DataQualityIssue(
                    level='WARNING',
                    field='traffic_percent',
                    value=str(traffic),
                    message='流量比例应在0-100之间'
                ))
        except (ValueError, TypeError):
            issues.append(DataQualityIssue(
                level='ERROR',
                field='traffic_percent',
                value=str(item.get('traffic_percent', '')),
                message='流量比例必须是有效数字'
            ))
            valid = False
        
        synced = item.get('cross_region_synced')
        if not isinstance(synced, bool):
            if str(synced).lower() not in ['true', 'false', '1', '0']:
                issues.append(DataQualityIssue(
                    level='WARNING',
                    field='cross_region_synced',
                    value=str(synced),
                    message='跨区同步状态应为布尔值'
                ))
        
        if not item.get('local_resources'):
            item['local_resources'] = []
        elif isinstance(item['local_resources'], list):
            pass
        elif isinstance(item['local_resources'], str):
            try:
                item['local_resources'] = json.loads(item['local_resources'])
            except json.JSONDecodeError:
                item['local_resources'] = []
        
        return valid, issues

    def load_tenant_bindings(self, file_path: str) -> Tuple[List[TenantBinding], List[DataQualityIssue]]:
        tenants = []
        all_issues = []
        with open(file_path, 'r', encoding='utf-8') as f:
            if file_path.endswith('.json'):
                data = json.load(f)
                for idx, item in enumerate(data):
                    is_valid, issues = self._validate_tenant_data(item)
                    all_issues.extend(issues)
                    if is_valid:
                        try:
                            item['traffic_percent'] = float(item['traffic_percent'])
                            if isinstance(item['cross_region_synced'], str):
                                item['cross_region_synced'] = item['cross_region_synced'].lower() in ['true', '1']
                            tenants.append(TenantBinding(**item))
                        except Exception as e:
                            all_issues.append(DataQualityIssue(
                                level='ERROR',
                                field=f'row_{idx}',
                                value=str(item),
                                message=f'数据解析失败: {str(e)}'
                            ))
            elif file_path.endswith('.csv'):
                reader = csv.DictReader(f)
                for idx, row in enumerate(reader):
                    if row.get('local_resources') and isinstance(row['local_resources'], str):
                        row['local_resources'] = row['local_resources'].replace('""', '"')
                    is_valid, issues = self._validate_tenant_data(row)
                    all_issues.extend(issues)
                    if is_valid:
                        try:
                            row['traffic_percent'] = float(row['traffic_percent'])
                            row['cross_region_synced'] = str(row['cross_region_synced']).lower() in ['true', '1']
                            tenants.append(TenantBinding(**row))
                        except Exception as e:
                            all_issues.append(DataQualityIssue(
                                level='ERROR',
                                field=f'row_{idx}',
                                value=str(row),
                                message=f'数据解析失败: {str(e)}'
                            ))
        return tenants, all_issues

    def load_evacuation_plan(self, file_path: str) -> Tuple[List[EvacuationStep], List[DataQualityIssue]]:
        steps = []
        all_issues = []
        with open(file_path, 'r', encoding='utf-8') as f:
            if file_path.endswith('.json'):
                data = json.load(f)
                for item in data:
                    try:
                        item['target_percent'] = float(item['target_percent'])
                        steps.append(EvacuationStep(**item))
                    except Exception as e:
                            all_issues.append(DataQualityIssue(
                                level='ERROR',
                                field='step',
                                value=str(item),
                                message=f'步骤解析失败: {str(e)}'
                            ))
            elif file_path.endswith('.csv'):
                reader = csv.DictReader(f)
                for row in reader:
                    try:
                        row['target_percent'] = float(row['target_percent'])
                        steps.append(EvacuationStep(**row))
                    except Exception as e:
                        all_issues.append(DataQualityIssue(
                            level='ERROR',
                            field='step',
                            value=str(row),
                            message=f'步骤解析失败: {str(e)}'
                        ))
        return steps, all_issues

    def analyze_blockages(self, tenants: List[TenantBinding], region: str) -> List[BlockedTenant]:
        blocked = []
        for tenant in tenants:
            reasons = self.dependency_checker.check_tenant_bindings(tenant)
            if reasons:
                local_resources = [r for r in tenant.local_resources 
                                   if self.dependency_checker.is_local_resource(r)]
                suggestion = self._generate_suggestion(reasons, tenant)
                blocked.append(BlockedTenant(
                    tenant_id=tenant.tenant_id,
                    tenant_name=tenant.tenant_name,
                    block_reasons=reasons,
                    local_resources=local_resources,
                    current_traffic_percent=tenant.traffic_percent,
                    suggestion=suggestion
                ))
        return blocked

    def _generate_suggestion(self, reasons: List[BlockReason], tenant: TenantBinding) -> str:
        suggestions = []
        for reason in reasons:
            if reason == BlockReason.LOCAL_RESOURCE_BOUND:
                local_resources = [r for r in tenant.local_resources 
                                   if self.dependency_checker.is_local_resource(r)]
                suggestions.append(f"解绑本地资源: {', '.join(local_resources)}")
            elif reason == BlockReason.CROSS_REGION_SYNC_PENDING:
                suggestions.append("等待跨区域同步完成")
            elif reason == BlockReason.INVALID_TENANT_STATUS:
                suggestions.append(f"修复租户状态: 当前为 {tenant.status}")
        return "; ".join(suggestions)

    def validate_plan(self, plan: List[EvacuationStep], tenants: List[TenantBinding], 
                     blocked_tenant_ids: set) -> Dict[str, Any]:
        issues = []
        tenant_map = {t.tenant_id: t for t in tenants}
        for step in plan:
            if step.tenant_id not in tenant_map:
                issues.append(f"步骤 {step.step_id}: 租户 {step.tenant_id} 不存在")
                continue
            if step.tenant_id in blocked_tenant_ids:
                issues.append(f"步骤 {step.step_id}: 租户 {step.tenant_id} 被阻塞，无法执行")
                continue
            tenant = tenant_map[step.tenant_id]
            if not self.traffic_controller.validate_traffic_progression(
                tenant.traffic_percent, step.target_percent
            ):
                issues.append(
                    f"步骤 {step.step_id}: 租户 {step.tenant_id} 流量比例调整不合法: "
                    f"{tenant.traffic_percent}% -> {step.target_percent}%"
                )
            if self.traffic_controller.is_step_executed(step.step_id, step.tenant_id):
                issues.append(f"步骤 {step.step_id}: 已执行过，幂等跳过")
        return {"valid": len(issues) == 0, "issues": issues}

    def execute_evacuation(self, region: str, tenants_file: str, plan_file: str, 
                          check_only: bool = False) -> ExecutionSummary:
        data_quality_issues = []
        plan_issues = []
        executed_steps = 0
        skipped_steps = 0

        try:
            tenants, tenant_issues = self.load_tenant_bindings(tenants_file)
            data_quality_issues.extend(tenant_issues)
            plan = []
            if plan_file:
                plan, plan_data_issues = self.load_evacuation_plan(plan_file)
                data_quality_issues.extend(plan_data_issues)
        except Exception as e:
            data_quality_issues.append(DataQualityIssue(
                level='FATAL',
                field='file',
                value=tenants_file,
                message=f'文件加载失败: {str(e)}'
            ))
            return ExecutionSummary(
                region=region,
                total_tenants=0,
                blocked_count=0,
                cleared_count=0,
                blocked_tenants=[],
                evacuation_plan=[],
                executed_steps=0,
                skipped_steps=0,
                plan_validation_issues=[],
                data_quality_issues=data_quality_issues,
                check_only=check_only,
                executed_at=datetime.now().isoformat(),
                success=False
            )

        blocked_tenants = self.analyze_blockages(tenants, region)
        blocked_tenant_ids = {bt.tenant_id for bt in blocked_tenants}
        cleared_count = len(tenants) - len(blocked_tenants)

        if plan:
            validation = self.validate_plan(plan, tenants, blocked_tenant_ids)
            plan_issues = validation['issues']
            
            tenant_map = {t.tenant_id: t for t in tenants}
            for step in plan:
                if step.tenant_id in blocked_tenant_ids:
                    step.status = StepStatus.SKIPPED_BLOCKED.value
                    step.skip_reason = f"租户被阻塞: {blocked_tenant_ids}"
                    skipped_steps += 1
                elif self.traffic_controller.is_step_executed(step.step_id, step.tenant_id):
                    step.status = StepStatus.SKIPPED_IDEMPOTENT.value
                    step.skip_reason = "步骤已执行过(幂等保护)"
                    skipped_steps += 1
                elif step.tenant_id not in tenant_map:
                    step.status = StepStatus.SKIPPED_INVALID.value
                    step.skip_reason = "租户不存在"
                    skipped_steps += 1
                elif not self.traffic_controller.validate_traffic_progression(
                    tenant_map[step.tenant_id].traffic_percent, step.target_percent
                ):
                    step.status = StepStatus.SKIPPED_INVALID.value
                    step.skip_reason = "流量比例调整不合法"
                    skipped_steps += 1
                else:
                    if not check_only:
                        self.traffic_controller.record_execution(step)
                        step.status = StepStatus.EXECUTED.value
                        executed_steps += 1
                    else:
                        step.status = StepStatus.PENDING.value
                        step.skip_reason = "仅检查模式，未实际执行"

        has_errors = any(issue.level in ['ERROR', 'FATAL'] for issue in data_quality_issues)
        success = not has_errors

        return ExecutionSummary(
            region=region,
            total_tenants=len(tenants),
            blocked_count=len(blocked_tenants),
            cleared_count=cleared_count,
            blocked_tenants=blocked_tenants,
            evacuation_plan=plan,
            executed_steps=executed_steps,
            skipped_steps=skipped_steps,
            plan_validation_issues=plan_issues,
            data_quality_issues=data_quality_issues,
            check_only=check_only,
            executed_at=datetime.now().isoformat(),
            success=success
        )


class ReportExporter:
    @staticmethod
    def export_json(summary: ExecutionSummary, output_path: str):
        def serialize(obj):
            if isinstance(obj, BlockReason) or isinstance(obj, StepStatus):
                return obj.value
            if isinstance(obj, list):
                return [serialize(item) for item in obj]
            if isinstance(obj, dict):
                return {k: serialize(v) for k, v in obj.items()}
            if hasattr(obj, '__dataclass_fields__'):
                return {k: serialize(getattr(obj, k)) for k in obj.__dataclass_fields__}
            return obj

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(serialize(summary), f, ensure_ascii=False, indent=2)

    @staticmethod
    def export_human_readable(summary: ExecutionSummary, output_path: str):
        lines = []
        lines.append("=" * 80)
        lines.append("区域流量撤离本地依赖阻塞排查报告")
        lines.append("=" * 80)
        lines.append(f"执行时间: {summary.executed_at}")
        lines.append(f"区域名称: {summary.region}")
        lines.append(f"执行模式: {'仅检查(未执行)' if summary.check_only else '完整执行'}")
        lines.append(f"执行状态: {'成功' if summary.success else '失败'}")
        lines.append("")
        lines.append("-" * 80)
        lines.append("统计摘要")
        lines.append("-" * 80)
        lines.append(f"租户总数: {summary.total_tenants}")
        lines.append(f"阻塞租户数: {summary.blocked_count}")
        lines.append(f"可撤离租户数: {summary.cleared_count}")
        if summary.total_tenants > 0:
            lines.append(f"阻塞率: {summary.blocked_count / summary.total_tenants * 100:.1f}%")
        if summary.evacuation_plan:
            lines.append(f"撤离计划总步数: {len(summary.evacuation_plan)}")
            lines.append(f"已执行步数: {summary.executed_steps}")
            lines.append(f"跳过步数: {summary.skipped_steps}")
        if summary.data_quality_issues:
            error_count = sum(1 for i in summary.data_quality_issues if i.level in ['ERROR', 'FATAL'])
            warn_count = sum(1 for i in summary.data_quality_issues if i.level == 'WARNING')
            lines.append(f"数据质量问题: {error_count} 个错误, {warn_count} 个警告")
        lines.append("")
        lines.append("-" * 80)
        lines.append("阻塞租户详情")
        lines.append("-" * 80)
        for i, bt in enumerate(summary.blocked_tenants, 1):
            lines.append(f"\n[{i}] 租户: {bt.tenant_name} ({bt.tenant_id})")
            lines.append(f"    当前流量: {bt.current_traffic_percent}%")
            lines.append(f"    阻塞原因: {', '.join(r.value for r in bt.block_reasons)}")
            if bt.local_resources:
                lines.append(f"    本地资源: {', '.join(bt.local_resources)}")
            lines.append(f"    处理建议: {bt.suggestion}")
        if not summary.blocked_tenants:
            lines.append("\n无阻塞租户，所有租户可正常撤离")
        lines.append("")
        
        if summary.data_quality_issues:
            lines.append("-" * 80)
            lines.append("数据质量问题")
            lines.append("-" * 80)
            for issue in summary.data_quality_issues:
                lines.append(f"\n[{issue.level}] 字段: {issue.field}")
                lines.append(f"    值: {issue.value}")
                lines.append(f"    问题: {issue.message}")
            lines.append("")
        
        if summary.plan_validation_issues:
            lines.append("-" * 80)
            lines.append("计划校验问题")
            lines.append("-" * 80)
            for issue in summary.plan_validation_issues:
                lines.append(f"\n  - {issue}")
            lines.append("")
        
        lines.append("-" * 80)
        lines.append("撤离计划执行记录")
        lines.append("-" * 80)
        for i, step in enumerate(summary.evacuation_plan, 1):
            lines.append(f"\n[{i}] 步骤: {step.step_id}")
            lines.append(f"    租户: {step.tenant_id}")
            lines.append(f"    目标流量: {step.target_percent}%")
            lines.append(f"    状态: {step.status}")
            if step.skip_reason:
                lines.append(f"    说明: {step.skip_reason}")
        if not summary.evacuation_plan:
            lines.append("\n无撤离计划")
        lines.append("")
        lines.append("=" * 80)
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))

    @staticmethod
    def print_console(summary: ExecutionSummary):
        print(f"\n{'=' * 60}")
        print(f"区域: {summary.region} | 模式: {'仅检查' if summary.check_only else '执行'}")
        print(f"状态: {'✅ 成功' if summary.success else '❌ 失败'}")
        print(f"租户: {summary.total_tenants} | 阻塞: {summary.blocked_count} | 可撤离: {summary.cleared_count}")
        if summary.evacuation_plan:
            print(f"计划步数: {len(summary.evacuation_plan)} | 已执行: {summary.executed_steps} | 跳过: {summary.skipped_steps}")
        if summary.data_quality_issues:
            error_count = sum(1 for i in summary.data_quality_issues if i.level in ['ERROR', 'FATAL'])
            warn_count = sum(1 for i in summary.data_quality_issues if i.level == 'WARNING')
            print(f"数据问题: {error_count} 错误, {warn_count} 警告")
        
        if summary.blocked_tenants:
            print(f"\n阻塞租户列表:")
            for bt in summary.blocked_tenants[:5]:
                reasons = ', '.join(r.value for r in bt.block_reasons)
                print(f"  - {bt.tenant_name}: {reasons}")
            if len(summary.blocked_tenants) > 5:
                print(f"  ... 还有 {len(summary.blocked_tenants) - 5} 个")
        
        if summary.evacuation_plan and summary.skipped_steps > 0:
            print(f"\n跳过的步骤:")
            skipped = [s for s in summary.evacuation_plan if '跳过' in s.status]
            for s in skipped[:5]:
                print(f"  - {s.step_id}: {s.status} - {s.skip_reason}")
        
        print(f"{'=' * 60}\n")


def main():
    parser = argparse.ArgumentParser(
        description='区域流量撤离本地依赖阻塞排查CLI',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  %(prog)s --region beijing --tenants tenants.json --plan plan.json --json-out result.json --report-out report.txt
  %(prog)s --region shanghai --tenants tenants.csv --check-only
        """
    )
    parser.add_argument('--region', required=True, help='区域名称')
    parser.add_argument('--tenants', required=True, help='租户绑定数据文件 (JSON/CSV)')
    parser.add_argument('--plan', help='撤离计划文件 (JSON/CSV)')
    parser.add_argument('--check-only', action='store_true', help='仅检查依赖，不执行撤离')
    parser.add_argument('--json-out', help='机器可读JSON输出路径')
    parser.add_argument('--report-out', help='人可读报告输出路径')
    parser.add_argument('--verbose', '-v', action='store_true', help='显示详细信息')
    args = parser.parse_args()

    orchestrator = EvacuationOrchestrator()
    summary = orchestrator.execute_evacuation(args.region, args.tenants, args.plan, args.check_only)

    if args.verbose or not (args.json_out or args.report_out):
        ReportExporter.print_console(summary)

    if args.json_out:
        ReportExporter.export_json(summary, args.json_out)
        print(f"JSON输出已保存到: {args.json_out}")

    if args.report_out:
        ReportExporter.export_human_readable(summary, args.report_out)
        print(f"报告已保存到: {args.report_out}")

    return 0 if summary.success else 1


if __name__ == '__main__':
    sys.exit(main())

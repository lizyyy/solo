from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Set

from .config import ApprovalConfig, ExportResult, ExportTask, FieldConfig, StrategyConfig
from .data_reader import DataReader, DataWriter
from .masker import SensitiveMasker
from .storage import Storage


class ExportEngine:
    def __init__(self, storage: Storage):
        self.storage = storage
        self.masker = SensitiveMasker()
        self.reader = DataReader()
        self.writer = DataWriter()

    def preflight_check(
        self,
        data_file: str,
        strategy: StrategyConfig,
        approval: Optional[ApprovalConfig] = None
    ) -> Dict[str, Any]:
        issues = []
        warnings = []
        
        data_columns = self.reader.get_columns(data_file)
        strategy_field_names = {f.name for f in strategy.fields}
        
        missing_in_data = strategy_field_names - set(data_columns)
        if missing_in_data:
            issues.append(f"策略文件字段在数据中缺失: {', '.join(missing_in_data)}")
        
        extra_in_data = set(data_columns) - strategy_field_names
        if extra_in_data:
            warnings.append(f"数据中存在未在策略中定义的列: {', '.join(extra_in_data)}")
        
        approval_required_fields = [f.name for f in strategy.fields if f.approval_required]
        if approval_required_fields:
            if not approval:
                issues.append(f"部分字段需要审批但未提供审批号: {', '.join(approval_required_fields)}")
            else:
                if not approval.is_valid():
                    issues.append(f"审批号 {approval.approval_id} 已过期")
                if approval.tenant_id != strategy.tenant_id:
                    issues.append(f"审批租户 ({approval.tenant_id}) 与策略租户 ({strategy.tenant_id}) 不匹配")
                if approval.data_type != strategy.data_type:
                    issues.append(f"审批数据类型 ({approval.data_type}) 与策略数据类型 ({strategy.data_type}) 不匹配")
                
                missing_approval = set(approval_required_fields) - set(approval.approved_fields)
                if missing_approval:
                    issues.append(f"部分字段需要审批但审批中未包含: {', '.join(missing_approval)}")
        
        return {
            "valid": len(issues) == 0,
            "issues": issues,
            "warnings": warnings,
            "columns": data_columns,
            "strategy_fields": list(strategy_field_names)
        }

    def compare_strategies(
        self,
        current_strategy: StrategyConfig,
        previous_strategy: Optional[StrategyConfig]
    ) -> Optional[Dict[str, Any]]:
        if not previous_strategy:
            return None
        
        current_fields = {f.name: f for f in current_strategy.fields}
        previous_fields = {f.name: f for f in previous_strategy.fields}
        
        current_names = set(current_fields.keys())
        previous_names = set(previous_fields.keys())
        
        added = list(current_names - previous_names)
        removed = list(previous_names - current_names)
        modified = []
        
        for name in current_names & previous_names:
            current_field = current_fields[name]
            previous_field = previous_fields[name]
            
            changes = {}
            if current_field.mask_type != previous_field.mask_type:
                changes['mask_type'] = {
                    'from': previous_field.mask_type.value,
                    'to': current_field.mask_type.value
                }
            if current_field.data_category != previous_field.data_category:
                changes['data_category'] = {
                    'from': previous_field.data_category.value if previous_field.data_category else None,
                    'to': current_field.data_category.value if current_field.data_category else None
                }
            if current_field.approval_required != previous_field.approval_required:
                changes['approval_required'] = {
                    'from': previous_field.approval_required,
                    'to': current_field.approval_required
                }
            
            if changes:
                modified.append({
                    'field': name,
                    'changes': changes
                })
        
        if not added and not removed and not modified:
            return None
        
        return {
            'previous_version': previous_strategy.version,
            'current_version': current_strategy.version,
            'added_fields': added,
            'removed_fields': removed,
            'modified_fields': modified,
            'changed': True
        }

    def export(
        self,
        data_file: str,
        strategy: StrategyConfig,
        tenant_id: str,
        data_type: str,
        start_date: str,
        end_date: str,
        approval: Optional[ApprovalConfig] = None,
        output_format: str = 'csv',
        skip_duplicate_check: bool = False
    ) -> ExportResult:
        task_id = self.storage.generate_task_id(tenant_id, data_type, start_date, end_date)
        
        if not skip_duplicate_check and self.storage.check_duplicate_task(task_id):
            existing_task = self.storage.load_task(task_id)
            if existing_task and existing_task.status == 'completed':
                raise ValueError(
                    f"重复任务检测: 相同租户、数据类型和时间范围的导出任务已存在。"
                    f"任务ID: {task_id}, 输出路径: {existing_task.output_path}"
                )
        
        preflight = self.preflight_check(data_file, strategy, approval)
        if not preflight['valid']:
            raise ValueError(f"预检失败: {'; '.join(preflight['issues'])}")
        
        task = ExportTask(
            task_id=task_id,
            tenant_id=tenant_id,
            data_type=data_type,
            start_date=datetime.strptime(start_date, '%Y-%m-%d'),
            end_date=datetime.strptime(end_date, '%Y-%m-%d'),
            strategy_version=strategy.version,
            approval_id=approval.approval_id if approval else None,
            status='processing'
        )
        self.storage.save_task(task)
        
        try:
            raw_data = self.reader.read(data_file)
            
            approved_fields = approval.approved_fields if approval else None
            
            exported_data: List[Dict[str, Any]] = []
            masked_fields: Dict[str, int] = {}
            rejected_rows: List[Dict[str, Any]] = []
            approval_exceptions: List[Dict[str, Any]] = []
            
            total_records = len(raw_data)
            masked_count = 0
            rejected_count = 0
            
            for idx, row in enumerate(raw_data):
                masked_row, row_masked, rejected = self.masker.mask_row(
                    row,
                    strategy.fields,
                    approved_fields
                )
                
                for field_name, count in row_masked.items():
                    masked_fields[field_name] = masked_fields.get(field_name, 0) + count
                    masked_count += count
                
                if rejected:
                    rejected_count += 1
                    rejected_rows.append({
                        'row_index': idx,
                        'original_data': {k: str(v)[:100] for k, v in row.items()},
                        'reason': '包含需要审批但未获得批准的字段'
                    })
                else:
                    exported_data.append(masked_row)
            
            if approval:
                for field in strategy.fields:
                    if field.approval_required and approval.has_access(field.name):
                        approval_exceptions.append({
                            'field': field.name,
                            'reason': field.description or '审批例外字段',
                            'approval_id': approval.approval_id,
                            'approved_by': approval.approved_by
                        })
            
            output_file = self.storage.exports_dir / f"{task_id}_export.{output_format}"
            self.writer.write(str(output_file), exported_data, output_format)
            
            last_task = self.storage.get_last_task_for_tenant(tenant_id, data_type)
            strategy_comparison = None
            if last_task and last_task.strategy_version != strategy.version:
                previous_strategy = self.storage.load_strategy(tenant_id, data_type, last_task.strategy_version)
                strategy_comparison = self.compare_strategies(strategy, previous_strategy)
            
            task.status = 'completed'
            task.completed_at = datetime.now()
            task.output_path = str(output_file)
            task.total_records = total_records
            task.masked_records = masked_count
            task.rejected_records = rejected_count
            self.storage.save_task(task)
            
            result = ExportResult(
                task=task,
                masked_fields=masked_fields,
                rejected_rows=rejected_rows,
                approval_exceptions=approval_exceptions,
                strategy_comparison=strategy_comparison
            )
            
            self._save_security_report(result, strategy)
            
            return result
            
        except Exception as e:
            task.status = 'failed'
            task.error_message = str(e)
            self.storage.save_task(task)
            raise

    def _save_security_report(self, result: ExportResult, strategy: StrategyConfig) -> None:
        task = result.task
        
        report = {
            'task_id': task.task_id,
            'tenant_id': task.tenant_id,
            'data_type': task.data_type,
            'export_time': task.completed_at.isoformat() if task.completed_at else None,
            'summary': {
                'total_records': task.total_records,
                'exported_records': task.total_records - task.rejected_records,
                'masked_field_count': task.masked_records,
                'rejected_records': task.rejected_records
            },
            'masked_fields': [
                {
                    'field_name': field,
                    'mask_count': count,
                    'mask_strategy': next((f.mask_type.value for f in strategy.fields if f.name == field), None),
                    'data_category': next((f.data_category.value if f.data_category else None for f in strategy.fields if f.name == field), None)
                }
                for field, count in result.masked_fields.items()
            ],
            'rejected_rows': result.rejected_rows,
            'approval_exceptions': result.approval_exceptions,
            'strategy_comparison': result.strategy_comparison,
            'strategy_version': strategy.version
        }
        
        self.storage.save_audit_report(task.task_id, report)

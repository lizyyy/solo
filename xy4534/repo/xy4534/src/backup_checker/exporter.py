import json
from datetime import datetime
from typing import Dict, List, Any, Optional
from .models import Database


class Exporter:
    def __init__(self, db: Database):
        self.db = db
    
    def export_to_markdown(self, task_id: int) -> str:
        """导出为 Markdown 格式的演练结论"""
        task_data = self.db.get_full_task_data(task_id)
        if not task_data:
            return f"# 备份演练结论\n\n错误：未找到任务 ID {task_id}"
        
        task = task_data['task']
        check_results = task_data.get('check_results', [])
        
        # 统计检查结果
        passed = sum(1 for r in check_results if r['status'] == 'pass')
        failed = sum(1 for r in check_results if r['status'] == 'fail')
        warnings = sum(1 for r in check_results if r['status'] == 'warn')
        reviewed = sum(1 for r in check_results if r['reviewed'])
        
        # 风险统计
        high_risk = sum(1 for r in check_results if r['risk_level'] == 'high')
        medium_risk = sum(1 for r in check_results if r['risk_level'] == 'medium')
        low_risk = sum(1 for r in check_results if r['risk_level'] == 'low')
        
        # 生成 Markdown
        md_lines = []
        
        # 标题
        md_lines.append(f"# 备份演练结论")
        md_lines.append(f"")
        md_lines.append(f"## 基本信息")
        md_lines.append(f"")
        md_lines.append(f"- **任务名称**: {task['task_name']}")
        md_lines.append(f"- **任务 ID**: {task['id']}")
        md_lines.append(f"- **创建时间**: {task['created_at']}")
        md_lines.append(f"- **任务状态**: {self._status_to_chinese(task['status'])}")
        md_lines.append(f"")
        
        # 检查概览
        md_lines.append(f"## 检查概览")
        md_lines.append(f"")
        md_lines.append(f"### 执行结果统计")
        md_lines.append(f"")
        md_lines.append(f"| 状态 | 数量 |")
        md_lines.append(f"|------|------|")
        md_lines.append(f"| 通过 | {passed} |")
        md_lines.append(f"| 警告 | {warnings} |")
        md_lines.append(f"| 失败 | {failed} |")
        md_lines.append(f"| 已复核 | {reviewed}/{len(check_results)} |")
        md_lines.append(f"")
        
        md_lines.append(f"### 风险等级统计")
        md_lines.append(f"")
        md_lines.append(f"| 风险等级 | 数量 |")
        md_lines.append(f"|----------|------|")
        md_lines.append(f"| 高风险 | {high_risk} |")
        md_lines.append(f"| 中风险 | {medium_risk} |")
        md_lines.append(f"| 低风险 | {low_risk} |")
        md_lines.append(f"")
        
        # 详细检查结果
        md_lines.append(f"## 详细检查结果")
        md_lines.append(f"")
        
        # 按检查类型分组
        check_types = {}
        for result in check_results:
            check_type = result['check_type']
            if check_type not in check_types:
                check_types[check_type] = []
            check_types[check_type].append(result)
        
        for check_type, results in check_types.items():
            md_lines.append(f"### {self._check_type_to_chinese(check_type)}")
            md_lines.append(f"")
            
            for result in results:
                status_icon = self._status_to_icon(result['status'])
                risk_icon = self._risk_to_icon(result['risk_level'])
                reviewed_mark = "✓ 已复核" if result['reviewed'] else "○ 待复核"
                
                md_lines.append(f"#### {status_icon} {result['check_name']}")
                md_lines.append(f"")
                md_lines.append(f"- **状态**: {self._status_to_chinese(result['status'])}")
                md_lines.append(f"- **风险等级**: {risk_icon} {self._risk_to_chinese(result['risk_level'])}")
                md_lines.append(f"- **复核状态**: {reviewed_mark}")
                md_lines.append(f"- **检查时间**: {result['check_time']}")
                md_lines.append(f"- **信息**: {result['message']}")
                
                if result['review_note']:
                    md_lines.append(f"- **复核备注**: {result['review_note']}")
                
                md_lines.append(f"")
        
        # 值班备注
        duty_notes = task_data.get('duty_notes', [])
        if duty_notes:
            md_lines.append(f"## 值班备注")
            md_lines.append(f"")
            for note in duty_notes:
                md_lines.append(f"### {note['created_at']} - {note['created_by']}")
                md_lines.append(f"")
                md_lines.append(f"{note['note_text']}")
                md_lines.append(f"")
        
        # 详细数据
        pg_dump_logs = task_data.get('pg_dump_logs', [])
        manifests = task_data.get('object_storage_manifests', [])
        restore_results = task_data.get('restore_results', [])
        
        if pg_dump_logs or manifests or restore_results:
            md_lines.append(f"## 数据详情")
            md_lines.append(f"")
        
        if pg_dump_logs:
            md_lines.append(f"### pg_dump 日志")
            md_lines.append(f"")
            for log in pg_dump_logs:
                md_lines.append(f"- **数据库**: {log.get('database_name', '未知')}")
                md_lines.append(f"  - 表数量: {log.get('table_count', 0)}")
                md_lines.append(f"  - 大小: {self._format_size(log.get('total_size_bytes', 0))}")
                if log.get('dump_start_time') and log.get('dump_end_time'):
                    md_lines.append(f"  - 时间: {log['dump_start_time']} 至 {log['dump_end_time']}")
            md_lines.append(f"")
        
        if manifests:
            md_lines.append(f"### 对象存储 Manifest")
            md_lines.append(f"")
            for manifest in manifests:
                md_lines.append(f"- **Bucket**: {manifest.get('bucket_name', '未知')}")
                md_lines.append(f"  - 分片数量: {manifest.get('total_shards', 0)}")
                md_lines.append(f"  - 总大小: {self._format_size(manifest.get('total_size_bytes', 0))}")
                shards = manifest.get('shards', [])
                if shards:
                    md_lines.append(f"  - 分片列表:")
                    for shard in shards[:5]:  # 最多显示5个
                        md_lines.append(f"    - {shard.get('shard_name', '未知')}: {self._format_size(shard.get('shard_size_bytes', 0))}")
                    if len(shards) > 5:
                        md_lines.append(f"    - ... 还有 {len(shards) - 5} 个分片")
            md_lines.append(f"")
        
        if restore_results:
            md_lines.append(f"### 还原演练结果")
            md_lines.append(f"")
            for result in restore_results:
                md_lines.append(f"- **还原数据库**: {result.get('restored_database_name', '未知')}")
                md_lines.append(f"  - 版本: {result.get('restored_version', '未知')}")
                md_lines.append(f"  - 表数量: {result.get('table_count_restored', 0)}")
                md_lines.append(f"  - 行数: {result.get('row_count_restored', 0)}")
                
                spot_tables = result.get('spot_checked_tables', [])
                if spot_tables:
                    md_lines.append(f"  - 抽查的表:")
                    for table in spot_tables:
                        status = "✓" if table.get('checksum_match') else "✗"
                        md_lines.append(f"    - {status} {table.get('table_name', '未知')}: 期望 {table.get('expected_row_count', 0)} 行，实际 {table.get('actual_row_count', 0)} 行")
            md_lines.append(f"")
        
        # 结论
        md_lines.append(f"## 演练结论")
        md_lines.append(f"")
        
        if failed > 0 or high_risk > 0:
            md_lines.append(f"**结论**: ⚠️ 需要关注")
            md_lines.append(f"")
            md_lines.append(f"检查发现 {failed} 项失败和 {high_risk} 项高风险问题。")
            md_lines.append(f"建议在发布前解决这些问题。")
        elif warnings > 0 or medium_risk > 0:
            md_lines.append(f"**结论**: 🟡 有警告")
            md_lines.append(f"")
            md_lines.append(f"检查发现 {warnings} 项警告和 {medium_risk} 项中风险问题。")
            md_lines.append(f"建议复核这些问题并记录处理意见。")
        else:
            md_lines.append(f"**结论**: ✅ 通过")
            md_lines.append(f"")
            md_lines.append(f"所有 {passed} 项检查均已通过，风险等级均为低风险。")
            md_lines.append(f"备份演练状态良好，可以进行发布。")
        
        md_lines.append(f"")
        md_lines.append(f"---")
        md_lines.append(f"")
        md_lines.append(f"*报告生成时间: {datetime.now().isoformat()}*")
        
        return '\n'.join(md_lines)
    
    def export_to_json(self, task_id: int) -> str:
        """导出为 JSON 格式的审计包"""
        task_data = self.db.get_full_task_data(task_id)
        if not task_data:
            return json.dumps({'error': f'未找到任务 ID {task_id}'}, ensure_ascii=False, indent=2)
        
        # 解析 raw_content 字段
        for log in task_data.get('pg_dump_logs', []):
            if log.get('raw_content') and isinstance(log['raw_content'], str):
                try:
                    log['raw_content'] = json.loads(log['raw_content'])
                except:
                    pass
        
        for manifest in task_data.get('object_storage_manifests', []):
            if manifest.get('raw_content') and isinstance(manifest['raw_content'], str):
                try:
                    manifest['raw_content'] = json.loads(manifest['raw_content'])
                except:
                    pass
        
        for result in task_data.get('restore_results', []):
            if result.get('raw_content') and isinstance(result['raw_content'], str):
                try:
                    result['raw_content'] = json.loads(manifest['raw_content'])
                except:
                    pass
        
        # 解析检查结果的 details 字段
        for check in task_data.get('check_results', []):
            if check.get('details') and isinstance(check['details'], str):
                try:
                    check['details'] = json.loads(check['details'])
                except:
                    pass
        
        # 添加审计元数据
        audit_package = {
            'audit_metadata': {
                'export_time': datetime.now().isoformat(),
                'export_version': '1.0.0',
                'task_id': task_id
            },
            'task_data': task_data
        }
        
        return json.dumps(audit_package, ensure_ascii=False, indent=2)
    
    def _status_to_chinese(self, status: str) -> str:
        """状态转换为中文"""
        status_map = {
            'pending': '待处理',
            'running': '进行中',
            'passed': '通过',
            'failed': '失败',
            'pass': '通过',
            'fail': '失败',
            'warn': '警告'
        }
        return status_map.get(status, status)
    
    def _check_type_to_chinese(self, check_type: str) -> str:
        """检查类型转换为中文"""
        type_map = {
            'storage': '对象存储检查',
            'dump': '备份检查',
            'restore': '还原检查',
            'error': '错误检查'
        }
        return type_map.get(check_type, check_type)
    
    def _risk_to_chinese(self, risk_level: str) -> str:
        """风险等级转换为中文"""
        risk_map = {
            'low': '低风险',
            'medium': '中风险',
            'high': '高风险'
        }
        return risk_map.get(risk_level, risk_level)
    
    def _status_to_icon(self, status: str) -> str:
        """状态转换为图标"""
        icon_map = {
            'pass': '✅',
            'passed': '✅',
            'fail': '❌',
            'failed': '❌',
            'warn': '⚠️',
            'warning': '⚠️'
        }
        return icon_map.get(status, '○')
    
    def _risk_to_icon(self, risk_level: str) -> str:
        """风险等级转换为图标"""
        icon_map = {
            'low': '🟢',
            'medium': '🟡',
            'high': '🔴'
        }
        return icon_map.get(risk_level, '⚪')
    
    def _format_size(self, size_bytes: int) -> str:
        """格式化大小"""
        if size_bytes == 0:
            return '0 B'
        
        units = ['B', 'KB', 'MB', 'GB', 'TB']
        index = 0
        size = size_bytes
        
        while size >= 1024 and index < len(units) - 1:
            size /= 1024
            index += 1
        
        return f"{size:.2f} {units[index]}"

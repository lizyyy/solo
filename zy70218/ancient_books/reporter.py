from typing import Dict, List, Optional
from datetime import datetime
from pathlib import Path

from .data_access import DataAccess


class Reporter:
    def __init__(self, data_access: DataAccess):
        self.data_access = data_access
    
    def generate_markdown_report(self, check_run_id: int, output_path: str) -> str:
        check_runs = self.data_access.get_check_runs()
        target_run = None
        for run in check_runs:
            if run['id'] == check_run_id:
                target_run = run
                break
        
        if not target_run:
            raise ValueError(f"未找到检查运行记录: {check_run_id}")
        
        volumes = self.data_access.get_volumes(check_run_id)
        check_exceptions = self.data_access.get_exceptions(check_run_id=check_run_id)
        other_exceptions = self.data_access.get_exceptions(resolved=False)
        all_exceptions = check_exceptions + [e for e in other_exceptions if e['id'] not in [x['id'] for x in check_exceptions]]
        unresolved_exceptions = [e for e in all_exceptions if not e['resolved']]
        
        missing_pages = [e for e in unresolved_exceptions if e['exception_type'] == 'missing_page']
        missing_volumes = [e for e in unresolved_exceptions if e['exception_type'] == 'missing_volume']
        duplicate_pages = [e for e in unresolved_exceptions if e['exception_type'] == 'duplicate_page']
        parse_errors = [e for e in unresolved_exceptions if e['exception_type'] == 'parse_error']
        
        critical_count = sum(1 for e in unresolved_exceptions if e['severity'] == 'critical')
        error_count = sum(1 for e in unresolved_exceptions if e['severity'] == 'error')
        warning_count = sum(1 for e in unresolved_exceptions if e['severity'] == 'warning')
        
        revisions = self.data_access.get_revisions(limit=50)
        manual_fixes = self.data_access.get_manual_fixes()
        
        report_lines = []
        report_lines.append(f"# 古籍数字化页码校对报告")
        report_lines.append("")
        report_lines.append(f"**报告生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report_lines.append(f"**检查运行ID**: {check_run_id}")
        report_lines.append(f"**检查时间**: {target_run['run_time']}")
        if target_run['description']:
            report_lines.append(f"**描述**: {target_run['description']}")
        report_lines.append("")
        
        report_lines.append("## 一、执行摘要")
        report_lines.append("")
        report_lines.append("### 1.1 问题汇总")
        report_lines.append("")
        report_lines.append(f"| 严重程度 | 数量 |")
        report_lines.append(f"|----------|------|")
        report_lines.append(f"| 严重 (Critical) | {critical_count} |")
        report_lines.append(f"| 错误 (Error) | {error_count} |")
        report_lines.append(f"| 警告 (Warning) | {warning_count} |")
        report_lines.append(f"| **总计** | **{critical_count + error_count + warning_count}** |")
        report_lines.append("")
        
        report_lines.append("### 1.2 问题分类")
        report_lines.append("")
        report_lines.append(f"| 问题类型 | 数量 | 说明 |")
        report_lines.append(f"----------|------|------|")
        report_lines.append(f"| 缺页 | {len(missing_pages)} | 扫描文件中缺失的页码 |")
        report_lines.append(f"| 缺卷 | {len(missing_volumes)} | 缺少的卷次 |")
        report_lines.append(f"| 重复页码 | {len(duplicate_pages)} | 同一页码有多个扫描文件 |")
        report_lines.append(f"| 解析错误 | {len(parse_errors)} | 文件名无法解析出卷次/页码 |")
        report_lines.append("")
        
        report_lines.append("## 二、卷次详情")
        report_lines.append("")
        report_lines.append("| 卷次 | 起始页 | 结束页 | 实际页数 | 状态 |")
        report_lines.append("|------|--------|--------|----------|------|")
        for vol in volumes:
            status_map = {
                'ok': '正常',
                'has_missing': '有缺页',
                'has_issues': '有问题',
                'pending': '待检查'
            }
            status = status_map.get(vol['status'], vol['status'])
            report_lines.append(
                f"| {vol['volume_number']} | {vol['actual_start_page'] or '-'} | "
                f"{vol['actual_end_page'] or '-'} | {vol['actual_page_count'] or '-'} | {status} |"
            )
        report_lines.append("")
        
        if missing_volumes:
            report_lines.append("## 三、缺失卷次")
            report_lines.append("")
            for e in missing_volumes:
                vol_num = e['source_data'].get('missing_volume', '未知') if e['source_data'] else '未知'
                min_vol = e['source_data'].get('min_volume', '-') if e['source_data'] else '-'
                max_vol = e['source_data'].get('max_volume', '-') if e['source_data'] else '-'
                report_lines.append(f"- **卷 {vol_num}**: 在卷 {min_vol} 到 {max_vol} 之间缺失")
            report_lines.append("")
        
        if missing_pages:
            report_lines.append("## 四、缺失页码")
            report_lines.append("")
            
            missing_by_volume = {}
            for e in missing_pages:
                vol = e['source_data'].get('volume', '未知') if e['source_data'] else '未知'
                page = e['source_data'].get('page', '未知') if e['source_data'] else '未知'
                if vol not in missing_by_volume:
                    missing_by_volume[vol] = []
                missing_by_volume[vol].append(page)
            
            for vol in sorted(missing_by_volume.keys(), key=lambda x: str(x)):
                pages = sorted(missing_by_volume[vol])
                report_lines.append(f"- **卷 {vol}**: 缺失页码 {', '.join(map(str, pages))}")
            report_lines.append("")
        
        if duplicate_pages:
            report_lines.append("## 五、重复页码")
            report_lines.append("")
            for e in duplicate_pages:
                vol = e['source_data'].get('volume', '未知') if e['source_data'] else '未知'
                page = e['source_data'].get('page', '未知') if e['source_data'] else '未知'
                files = e['source_data'].get('files', []) if e['source_data'] else []
                report_lines.append(f"- **卷 {vol} 页 {page}**: 找到 {len(files)} 个文件")
                for f in files:
                    report_lines.append(f"  - {f}")
            report_lines.append("")
        
        if parse_errors:
            report_lines.append("## 六、解析错误")
            report_lines.append("")
            report_lines.append("| 文件 | 错误信息 |")
            report_lines.append("|------|----------|")
            for e in parse_errors:
                file_path = e['source_reference'] or '未知'
                error = e['description'] or '未知错误'
                report_lines.append(f"| {file_path} | {error} |")
            report_lines.append("")
        
        if revisions:
            report_lines.append("## 七、修订历史")
            report_lines.append("")
            report_lines.append("| 时间 | 操作 | 实体 | 变更原因 |")
            report_lines.append("|------|------|------|----------|")
            for rev in revisions[:20]:
                report_lines.append(
                    f"| {rev['changed_at']} | {rev['action']} | "
                    f"{rev['entity_type']}#{rev['entity_id']} | {rev['change_reason'] or '-'} |"
                )
            if len(revisions) > 20:
                report_lines.append(f"\n*... 共 {len(revisions)} 条修订记录，仅显示最近 20 条*")
            report_lines.append("")
        
        if manual_fixes:
            report_lines.append("## 八、手动修复记录")
            report_lines.append("")
            report_lines.append("| 文件 | 原卷-页 | 修复后卷-页 | 原因 |")
            report_lines.append("|------|---------|-------------|------|")
            for fix in manual_fixes:
                original = f"{fix['original_volume'] or '-'}-{fix['original_page'] or '-'}"
                corrected = f"{fix['corrected_volume'] or '-'}-{fix['corrected_page'] or '-'}"
                report_lines.append(
                    f"| {fix['file_path']} | {original} | {corrected} | {fix['fix_reason'] or '-'} |"
                )
            report_lines.append("")
        
        report_lines.append("## 九、校验规则说明")
        report_lines.append("")
        report_lines.append("本报告基于以下规则生成：")
        report_lines.append("")
        report_lines.append("### 9.1 页码识别规则")
        report_lines.append("")
        report_lines.append("文件名需符合以下格式之一：")
        report_lines.append("- `v{卷号}_p{页码}.{扩展名}` 或 `V{卷号}_P{页码}.{扩展名}`")
        report_lines.append("- `{卷号}-{页码}.{扩展名}` 或 `{卷号}_{页码}.{扩展名}`")
        report_lines.append("- `卷{卷号}-页{页码}.{扩展名}` 或 `卷{卷号}_页{页码}.{扩展名}`")
        report_lines.append("- `卷{卷号}第{页码}页.{扩展名}`")
        report_lines.append("")
        report_lines.append("### 9.2 卷次校验规则")
        report_lines.append("")
        report_lines.append("- 卷次号应从最小卷号开始连续递增")
        report_lines.append("- 若存在卷 1、3，则卷 2 被视为缺失")
        report_lines.append("- 每卷起始页码默认从 1 开始")
        report_lines.append("")
        report_lines.append("### 9.3 缺页检测规则")
        report_lines.append("")
        report_lines.append("- 每卷页码应从起始页到结束页连续")
        report_lines.append("- 若某卷包含页 1、2、4，则页 3 被视为缺失")
        report_lines.append("- 同一卷内同一页码出现多次视为重复页码")
        report_lines.append("")
        
        report_content = "\n".join(report_lines)
        
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(report_content)
        
        return str(output_path.absolute())
    
    def generate_text_report(self, check_run_id: int, output_path: str) -> str:
        return self.generate_markdown_report(check_run_id, output_path)

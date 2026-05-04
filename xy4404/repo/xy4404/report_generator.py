import os
from datetime import datetime, date
from typing import Dict, Any, List
from config import Config
from database import Database
from issue_detector import IssueDetector

class ReportGenerator:
    def __init__(self, db: Database = None, detector: IssueDetector = None):
        self.db = db or Database()
        self.detector = detector or IssueDetector(self.db)
        self._ensure_reports_folder()
    
    def _ensure_reports_folder(self):
        if not os.path.exists(Config.REPORTS_FOLDER):
            os.makedirs(Config.REPORTS_FOLDER)
    
    def generate_report(self, output_path: str = None) -> str:
        if output_path is None:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            output_path = os.path.join(Config.REPORTS_FOLDER, f'handoff_report_{timestamp}.md')
        
        performances = self.db.get_all_performances()
        open_issues = self.db.get_open_issues()
        expiring_licenses = self.detector.check_license_expiry()
        missing_files = self.detector.check_missing_files()
        
        stats = self._calculate_stats(performances)
        issue_summary = self.detector.get_issue_summary()
        
        markdown = self._build_markdown(
            stats=stats,
            performances=performances,
            open_issues=open_issues,
            expiring_licenses=expiring_licenses,
            missing_files=missing_files,
            issue_summary=issue_summary
        )
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(markdown)
        
        return output_path
    
    def _calculate_stats(self, performances: List[Dict[str, Any]]) -> Dict[str, Any]:
        complete = [p for p in performances if p['status'] == 'complete']
        partial = [p for p in performances if p['status'] == 'partial']
        incomplete = [p for p in performances if p['status'] == 'incomplete']
        public = [p for p in performances if p['is_public']]
        needs_takedown = [p for p in performances if p['needs_takedown']]
        
        return {
            'total': len(performances),
            'complete': len(complete),
            'partial': len(partial),
            'incomplete': len(incomplete),
            'public': len(public),
            'needs_takedown': len(needs_takedown),
            'complete_list': complete,
            'partial_list': partial,
            'incomplete_list': incomplete,
            'public_list': public,
            'needs_takedown_list': needs_takedown
        }
    
    def _build_markdown(self, stats: Dict[str, Any], performances: List[Dict[str, Any]],
                        open_issues: List[Dict[str, Any]], expiring_licenses: List[Dict[str, Any]],
                        missing_files: List[Dict[str, Any]], issue_summary: Dict[str, Any]) -> str:
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        today = date.today().isoformat()
        
        lines = [
            '# 社区剧场演出录音交接报告',
            '',
            f'**生成时间**: {now}',
            '',
            '---',
            '',
            '## 一、数据概览',
            '',
            '| 统计项 | 数量 |',
            '|--------|------|',
            f'| 总演出数 | {stats["total"]} |',
            f'| 材料完整 | {stats["complete"]} |',
            f'| 材料部分齐全 | {stats["partial"]} |',
            f'| 材料不全 | {stats["incomplete"]} |',
            f'| 已公开 | {stats["public"]} |',
            f'| 需下架 | {stats["needs_takedown"]} |',
            '',
            '---',
            '',
            '## 二、问题汇总',
            '',
        ]
        
        if issue_summary['total_open'] > 0:
            lines.extend([
                f'**当前未解决问题总数**: {issue_summary["total_open"]}',
                '',
                '### 按严重程度分布',
                '',
                '| 严重程度 | 数量 |',
                '|----------|------|',
            ])
            
            for severity, count in issue_summary['by_severity'].items():
                if count > 0:
                    severity_label = {
                        'critical': '🔴 严重',
                        'error': '🟠 错误',
                        'warning': '🟡 警告',
                        'info': '🔵 信息'
                    }.get(severity, severity)
                    lines.append(f'| {severity_label} | {count} |')
            
            lines.append('')
            
            if issue_summary['by_type']:
                lines.extend([
                    '### 按问题类型分布',
                    '',
                    '| 问题类型 | 数量 |',
                    '|----------|------|',
                ])
                
                type_labels = {
                    'license_expiry': '授权过期',
                    'missing_files': '缺失文件',
                    'filename_conflict': '文件名冲突',
                    'missing_pages': '转写稿缺页',
                    'public_with_expired_license': '已公开但授权过期'
                }
                
                for issue_type, count in issue_summary['by_type'].items():
                    label = type_labels.get(issue_type, issue_type)
                    lines.append(f'| {label} | {count} |')
                
                lines.append('')
        else:
            lines.append('✅ **当前无未解决问题**')
            lines.append('')
        
        lines.extend([
            '---',
            '',
            '## 三、即将过期的授权',
            '',
        ])
        
        if expiring_licenses:
            lines.extend([
                f'以下授权将在 {Config.LICENSE_EXPIRY_WARNING_DAYS} 天内过期:',
                '',
                '| 演出名称 | 授权文件 | 过期日期 | 剩余天数 | 状态 |',
                '|----------|----------|----------|----------|------|',
            ])
            
            for lic in expiring_licenses:
                status = []
                if lic.get('is_public'):
                    status.append('已公开')
                if lic.get('needs_takedown'):
                    status.append('需下架')
                
                status_str = ', '.join(status) if status else '-'
                
                severity_icon = '🔴' if lic['days_left'] <= 7 else '🟠' if lic['days_left'] <= 14 else '🟡'
                
                lines.append(
                    f"| {lic['performance_name']} | {lic['file_name']} | {lic['end_date']} | {lic['days_left']}天 {severity_icon} | {status_str} |"
                )
        else:
            lines.append('✅ **近期无即将过期的授权**')
        
        lines.extend([
            '',
            '---',
            '',
            '## 四、缺失材料的演出',
            '',
        ])
        
        if missing_files:
            lines.extend([
                '以下演出缺少部分材料:',
                '',
                '| 演出名称 | 当前状态 | 缺失材料 |',
                '|----------|----------|----------|',
            ])
            
            for item in missing_files:
                missing = ', '.join(item['missing_files'])
                lines.append(f"| {item['performance_name']} | {item['status']} | {missing} |")
        else:
            lines.append('✅ **所有演出材料齐全**')
        
        lines.extend([
            '',
            '---',
            '',
            '## 五、需下架的演出',
            '',
        ])
        
        if stats['needs_takedown_list']:
            lines.extend([
                '以下演出已标记为需下架:',
                '',
                '| 演出名称 | 演出日期 | 备注 |',
                '|----------|----------|------|',
            ])
            
            for perf in stats['needs_takedown_list']:
                perf_date = perf['performance_date'] or '-'
                notes = perf['notes'] or '-'
                lines.append(f"| {perf['performance_name']} | {perf_date} | {notes} |")
        else:
            lines.append('✅ **当前无需要下架的演出**')
        
        lines.extend([
            '',
            '---',
            '',
            '## 六、详细问题列表',
            '',
        ])
        
        if open_issues:
            critical_issues = [i for i in open_issues if i['severity'] == 'critical']
            error_issues = [i for i in open_issues if i['severity'] == 'error']
            warning_issues = [i for i in open_issues if i['severity'] == 'warning']
            
            for title, issues_list in [
                ('🔴 严重问题', critical_issues),
                ('🟠 错误问题', error_issues),
                ('🟡 警告问题', warning_issues)
            ]:
                if issues_list:
                    lines.extend([
                        f'### {title}',
                        '',
                    ])
                    
                    for issue in issues_list:
                        type_labels = {
                            'license_expiry': '授权过期',
                            'missing_files': '缺失文件',
                            'filename_conflict': '文件名冲突',
                            'missing_pages': '转写稿缺页',
                            'public_with_expired_license': '已公开但授权过期'
                        }
                        issue_type = type_labels.get(issue['issue_type'], issue['issue_type'])
                        file_name = issue.get('file_name') or '-'
                        
                        lines.extend([
                            f'- **演出**: {issue["performance_name"]}',
                            f'  - **问题类型**: {issue_type}',
                            f'  - **描述**: {issue["issue_description"]}',
                            f'  - **相关文件**: {file_name}',
                            f'  - **创建时间**: {issue["created_at"]}',
                            ''
                        ])
        else:
            lines.append('✅ **当前无未解决问题**')
        
        lines.extend([
            '',
            '---',
            '',
            '## 七、演出清单',
            '',
        ])
        
        for title, perf_list in [
            ('### 7.1 材料完整的演出', stats['complete_list']),
            ('### 7.2 材料部分齐全的演出', stats['partial_list']),
            ('### 7.3 材料不全的演出', stats['incomplete_list'])
        ]:
            if perf_list:
                lines.extend([
                    title,
                    '',
                    '| 演出名称 | 演出日期 | 状态 | 公开 | 备注 |',
                    '|----------|----------|------|------|------|',
                ])
                
                for perf in perf_list:
                    perf_date = perf['performance_date'] or '-'
                    is_public = '✅' if perf['is_public'] else '❌'
                    notes = perf['notes'] or '-'
                    lines.append(f"| {perf['performance_name']} | {perf_date} | {perf['status']} | {is_public} | {notes} |")
                
                lines.append('')
        
        lines.extend([
            '---',
            '',
            '## 八、操作建议',
            '',
        ])
        
        suggestions = []
        
        if expiring_licenses:
            suggestions.append('- ⏰ 及时联系相关人员更新即将过期的授权')
        
        if missing_files:
            suggestions.append('- 📁 尽快补充缺失的演出材料')
        
        if stats['needs_takedown_list']:
            suggestions.append('- 🚫 确认并处理标记为需下架的演出')
        
        if any(i['severity'] == 'critical' for i in open_issues):
            suggestions.append('- 🔴 优先处理严重问题')
        
        if suggestions:
            lines.extend(suggestions)
        else:
            lines.append('✅ 当前无紧急操作建议')
        
        lines.extend([
            '',
            '---',
            '',
            '## 九、API接口参考',
            '',
            '如需通过程序查询或更新数据，可使用以下本地HTTP接口:',
            '',
            '| 接口 | 方法 | 说明 |',
            '|------|------|------|',
            '| `/api/performances` | GET | 获取所有演出列表 |',
            '| `/api/performances/<id>` | GET/PUT | 获取/更新单个演出 |',
            '| `/api/performances/<id>/public` | POST | 标记是否可公开 |',
            '| `/api/performances/<id>/takedown` | POST | 标记是否需下架 |',
            '| `/api/missing` | GET | 查询缺失材料 |',
            '| `/api/issues` | GET | 查询问题列表 |',
            '| `/api/licenses/expiring` | GET | 查询即将过期的授权 |',
            '| `/api/scan` | POST | 扫描所有问题 |',
            '| `/api/stats` | GET | 获取统计信息 |',
            '',
            f'**API服务地址**: http://{Config.FLASK_HOST}:{Config.FLASK_PORT}',
            '',
            '---',
            '',
            f'*报告生成于 {now}*',
        ])
        
        return '\n'.join(lines)

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
日志目录体检核心模块
功能：完整体检，人性化错误提示，不给运维同事看技术堆栈
"""

import os
import json
from datetime import datetime

from .snapshot import DirectorySnapshot
from .config_parser import ConfigParser
from .log_parser import FailureLogParser
from .history import ChangeHistory


class LogDoctor:
    def __init__(self, base_path, config_path=None, output_dir=None):
        self.base_path = os.path.abspath(base_path)
        self.config_path = config_path
        self.output_dir = output_dir or os.path.join(os.getcwd(), 'output')
        os.makedirs(self.output_dir, exist_ok=True)
        
    def run_check(self):
        """执行完整体检"""
        report = {
            'check_time': datetime.now().isoformat(),
            'base_path': self.base_path,
            'overall_status': 'pass',
            'summary': {
                'total_checks': 0,
                'critical_issues': 0,
                'warnings': 0,
                'infos': 0
            },
            'checks': [],
            'space_path_issues': [],
            'log_issues': [],
            'config_issues': [],
            'recommendations': []
        }
        
        self._check_directory_exists(report)
        self._check_space_paths(report)
        self._check_log_files(report)
        self._check_config_files(report)
        self._check_manual_changes(report)
        self._generate_recommendations(report)
        
        report['summary']['total_checks'] = len(report['checks'])
        
        if report['summary']['critical_issues'] > 0:
            report['overall_status'] = 'fail'
        elif report['summary']['warnings'] > 0:
            report['overall_status'] = 'warning'
        
        return report
    
    def _check_directory_exists(self, report):
        """检查目录是否存在"""
        check = {
            'name': '目标目录检查',
            'status': 'pass',
            'message': '',
            'level': 'info'
        }
        
        if os.path.exists(self.base_path):
            if os.path.isdir(self.base_path):
                check['status'] = 'pass'
                check['message'] = f"目录存在，路径正确"
            else:
                check['status'] = 'fail'
                check['level'] = 'critical'
                check['message'] = f"这不是一个目录，而是一个文件"
                report['summary']['critical_issues'] += 1
        else:
            check['status'] = 'fail'
            check['level'] = 'critical'
            check['message'] = f"目录不存在，请检查路径是否拼写正确"
            report['summary']['critical_issues'] += 1
        
        report['checks'].append(check)
    
    def _check_space_paths(self, report):
        """检查空格路径问题"""
        snapshot = DirectorySnapshot(self.base_path)
        snapshot_result = snapshot.take()
        
        check = {
            'name': '路径空格检查',
            'status': 'pass',
            'message': '',
            'level': 'info'
        }
        
        snapshot_warnings = snapshot_result['space_path_warnings']
        
        config_parser = ConfigParser(self.base_path, self.config_path)
        config_result = config_parser.parse_all()
        config_warnings = config_result['space_path_warnings']
        
        all_warnings = snapshot_warnings + config_warnings
        
        if all_warnings:
            check['status'] = 'warning'
            check['message'] = f"发现 {len(all_warnings)} 个路径包含空格"
            check['level'] = 'warning'
            report['summary']['warnings'] += len(all_warnings)
            report['space_path_issues'] = all_warnings
        else:
            check['message'] = "所有路径命名规范，未发现空格问题"
        
        report['checks'].append(check)
    
    def _check_log_files(self, report):
        """检查日志文件情况"""
        check = {
            'name': '日志文件检查',
            'status': 'pass',
            'message': '',
            'level': 'info'
        }
        
        log_parser = FailureLogParser(self.base_path)
        log_result = log_parser.parse_all()
        
        if log_result['log_count'] == 0:
            check['status'] = 'warning'
            check['message'] = "未找到日志文件，请确认日志是否生成"
            check['level'] = 'warning'
            report['summary']['warnings'] += 1
        else:
            total_records = 0
            total_late = 0
            total_duplicates = 0
            total_manual = 0
            
            for res in log_result['results']:
                summary = res['summary']
                total_records += summary['total_records']
                total_late += summary['late_count']
                total_duplicates += summary['duplicate_count']
                total_manual += summary['manual_count']
            
            issues = []
            if total_late > 0:
                issues.append(f"{total_late} 条晚到附件")
            if total_duplicates > 0:
                issues.append(f"{total_duplicates} 条重复记录")
            
            if issues:
                check['status'] = 'warning'
                check['message'] = f"发现 {len(log_result['log_files'])} 个日志文件共 {total_records} 条记录，含: {', '.join(issues)}"
                check['level'] = 'warning'
                report['summary']['warnings'] += 1
            else:
                check['message'] = f"发现 {len(log_result['log_files'])} 个日志文件共 {total_records} 条记录，情况正常"
            
            report['log_issues'] = {
                'file_count': log_result['log_count'],
                'total_records': total_records,
                'late_attachments': total_late,
                'duplicates': total_duplicates,
                'manual_corrections': total_manual,
                'files': log_result['log_files']
            }
        
        report['checks'].append(check)
    
    def _check_config_files(self, report):
        """检查配置文件情况"""
        check = {
            'name': '配置文件检查',
            'status': 'pass',
            'message': '',
            'level': 'info'
        }
        
        config_parser = ConfigParser(self.base_path, self.config_path)
        config_result = config_parser.parse_all()
        
        if config_result['config_count'] == 0:
            check['status'] = 'info'
            check['message'] = "未找到配置文件"
            report['summary']['infos'] += 1
        else:
            check['message'] = f"发现 {config_result['config_count']} 个配置文件"
            report['config_issues'] = {
                'file_count': config_result['config_count'],
                'files': config_result['config_files']
            }
        
        report['checks'].append(check)
    
    def _check_manual_changes(self, report):
        """检查人工修改记录"""
        check = {
            'name': '人工修改检查',
            'status': 'pass',
            'message': '',
            'level': 'info'
        }
        
        try:
            history = ChangeHistory(self.base_path)
            changes = history.get_all_changes()
            
            manual_changes = [c for c in changes if c.get('change_type') == 'manual']
            
            if manual_changes:
                check['status'] = 'info'
                check['message'] = f"发现 {len(manual_changes)} 次人工修改记录，变更历史已留存"
                report['summary']['infos'] += 1
            else:
                check['message'] = "暂无人工修改记录"
        except Exception as e:
            check['message'] = f"历史记录检查异常: {str(e)}"
        
        report['checks'].append(check)
    
    def _generate_recommendations(self, report):
        """生成整改建议"""
        recommendations = []
        
        if report['space_path_issues']:
            for issue in report['space_path_issues']:
                recommendations.append({
                    'priority': 'high' if issue['type'] == 'config_path' else 'medium',
                    'category': '路径规范',
                    'item': issue['path'] if 'path' in issue else issue.get('key', '未知'),
                    'source': issue['source'],
                    'problem': issue['message'],
                    'action': issue['action']
                })
        
        if 'log_issues' in report and report['log_issues']:
            li = report['log_issues']
            if li.get('late_attachments', 0) > 0:
                recommendations.append({
                    'priority': 'medium',
                    'category': '日志质量',
                    'item': '晚到附件',
                    'source': '失败日志',
                    'problem': f"存在 {li['late_attachments']} 条晚到附件记录，可能影响数据完整性",
                    'action': "请检查上传链路是否通畅，定时任务是否准时执行"
                })
            if li.get('duplicates', 0) > 0:
                recommendations.append({
                    'priority': 'low',
                    'category': '日志质量',
                    'item': '重复记录',
                    'source': '失败日志',
                    'problem': f"存在 {li['duplicates']} 条重复记录",
                    'action': "可检查日志采集程序是否有重复上报逻辑"
                })
        
        report['recommendations'] = recommendations
    
    def print_report(self, report):
        """打印体检报告（人性化输出）"""
        print("\n" + "="*70)
        print("🔍 日志目录体检报告")
        print("="*70)
        print(f"体检时间: {report['check_time']}")
        print(f"目标路径: {report['base_path']}")
        
        status_icon = {
            'pass': '✅ 健康',
            'warning': '⚠️  有告警',
            'fail': '❌ 有严重问题'
        }
        print(f"整体状态: {status_icon.get(report['overall_status'], '❓ 未知')}")
        print("-" * 70)
        
        print("\n📋 检查项目:")
        for check in report['checks']:
            icon = '✅' if check['status'] == 'pass' else '⚠️ ' if check['status'] == 'warning' else '❌'
            print(f"  {icon} {check['name']}")
            print(f"     {check['message']}")
        
        if report['space_path_issues']:
            print("\n⚠️  空格路径问题详情:")
            for i, issue in enumerate(report['space_path_issues'], 1):
                print(f"\n  {i}. [{issue['source']}] {issue.get('path', issue.get('key', ''))}")
                print(f"     问题: {issue['message']}")
                print(f"     👉 建议: {issue['action']}")
        
        if report['recommendations']:
            print("\n💡 整改建议 (按优先级排序):")
            priority_order = {'high': 0, 'medium': 1, 'low': 2}
            sorted_recs = sorted(report['recommendations'], key=lambda x: priority_order.get(x['priority'], 99))
            
            for i, rec in enumerate(sorted_recs, 1):
                priority_icon = '🔴' if rec['priority'] == 'high' else '🟡' if rec['priority'] == 'medium' else '🟢'
                print(f"\n  {priority_icon} [{rec['category']}] {rec['item']}")
                print(f"     来源: {rec['source']}")
                print(f"     问题: {rec['problem']}")
                print(f"     👉 操作: {rec['action']}")
        
        print("\n" + "-" * 70)
        print(f"📊 统计: 共 {report['summary']['total_checks']} 项检查")
        print(f"   严重问题: {report['summary']['critical_issues']} 项")
        print(f"   警告: {report['summary']['warnings']} 项")
        print(f"   提示: {report['summary']['infos']} 项")
        print("=" * 70 + "\n")
    
    def save_report(self, report):
        """保存体检报告"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"check_report_{timestamp}.json"
        filepath = os.path.join(self.output_dir, filename)
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        
        print(f"💾 体检报告已保存到: {filepath}")
        
        text_file = os.path.join(self.output_dir, f"check_report_{timestamp}.txt")
        with open(text_file, 'w', encoding='utf-8') as f:
            f.write(f"日志目录体检报告\n")
            f.write(f"{'='*50}\n")
            f.write(f"体检时间: {report['check_time']}\n")
            f.write(f"目标路径: {report['base_path']}\n")
            f.write(f"整体状态: {report['overall_status']}\n\n")
            
            for check in report['checks']:
                f.write(f"[{check['status']}] {check['name']}: {check['message']}\n")
            
            if report['recommendations']:
                f.write(f"\n整改建议:\n")
                for rec in report['recommendations']:
                    f.write(f"  - [{rec['priority']}] {rec['item']}: {rec['action']}\n")
        
        print(f"💾 文本报告已保存到: {text_file}")

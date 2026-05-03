"""庭审证据时间线核对器 CLI"""
import os
import sys
from typing import List, Optional
import click

from .parsers import CSVParser, JSONParser, YAMLParser, TXTParser
from .rules import (
    EvidenceMissingRule, 
    TimeConflictRule, 
    UnmaskedRule, 
    DuplicateReferenceRule
)
from .masking import Masker
from .storage import DataStore
from .exporters import MDExporter, CSVExporter, JSONExporter


class EvidenceTimelineChecker:
    """庭审证据时间线核对器核心类"""
    
    def __init__(self, storage_path: Optional[str] = None):
        self.storage = DataStore(storage_path)
        self.parsers = {
            'csv': CSVParser(),
            'json': JSONParser(),
            'yaml': YAMLParser(),
            'yml': YAMLParser(),
            'txt': TXTParser()
        }
        self.rules = [
            EvidenceMissingRule(),
            TimeConflictRule(),
            UnmaskedRule(),
            DuplicateReferenceRule()
        ]
        self.masker = Masker()
    
    def import_file(self, file_path: str) -> int:
        """
        导入单个文件
        
        Args:
            file_path: 文件路径
            
        Returns:
            导入的数据条数
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"文件不存在: {file_path}")
        
        ext = os.path.splitext(file_path)[1].lower().lstrip('.')
        
        parser = self.parsers.get(ext)
        if not parser:
            raise ValueError(f"不支持的文件格式: {ext}")
        
        if not parser.supports_file(file_path):
            raise ValueError(f"解析器不支持该文件: {file_path}")
        
        data = parser.parse(file_path)
        
        if not data:
            return 0
        
        data_type = data[0].get('type', 'unknown')
        if data_type not in ['evidence', 'chat', 'memo', 'transcript']:
            data_type = 'transcript'
        
        self.storage.add_data(data_type, data)
        
        return len(data)
    
    def import_files(self, file_paths: List[str]) -> dict:
        """
        批量导入文件
        
        Args:
            file_paths: 文件路径列表
            
        Returns:
            导入统计信息
        """
        stats = {
            'total_files': len(file_paths),
            'success_files': 0,
            'failed_files': 0,
            'total_records': 0,
            'failures': []
        }
        
        for file_path in file_paths:
            try:
                count = self.import_file(file_path)
                stats['success_files'] += 1
                stats['total_records'] += count
            except Exception as e:
                stats['failed_files'] += 1
                stats['failures'].append({
                    'file': file_path,
                    'error': str(e)
                })
        
        return stats
    
    def run_checks(self) -> dict:
        """
        执行所有检查规则
        
        Returns:
            检查结果统计
        """
        all_data = self.storage.get_all_data()
        all_issues = []
        
        for rule in self.rules:
            issues = rule.check(all_data)
            issue_dicts = [issue.to_dict() for issue in issues]
            all_issues.extend(issue_dicts)
        
        self.storage.add_issues(all_issues)
        
        stats = {
            'total_issues': len(all_issues),
            'by_severity': self._count_by_severity(all_issues),
            'by_rule': self._count_by_rule(all_issues)
        }
        
        return stats
    
    def _count_by_severity(self, issues: list) -> dict:
        """按严重程度统计"""
        counts = {}
        for issue in issues:
            severity = issue.get('severity', 'unknown')
            counts[severity] = counts.get(severity, 0) + 1
        return counts
    
    def _count_by_rule(self, issues: list) -> dict:
        """按规则统计"""
        counts = {}
        for issue in issues:
            rule = issue.get('rule_name', 'unknown')
            counts[rule] = counts.get(rule, 0) + 1
        return counts
    
    def generate_timeline(self) -> dict:
        """
        生成时间线
        
        Returns:
            时间线统计信息
        """
        all_data = self.storage.get_all_data()
        
        events_with_timestamp = [
            item for item in all_data 
            if item.get('timestamp') is not None
        ]
        
        sorted_events = sorted(
            events_with_timestamp,
            key=lambda x: x.get('timestamp')
        )
        
        self.storage.set_timeline(sorted_events)
        
        timeline_by_role = self.storage.get_timeline_by_role()
        
        stats = {
            'total_events': len(sorted_events),
            'by_role': {role: len(events) for role, events in timeline_by_role.items()}
        }
        
        return stats
    
    def mask_data(self) -> dict:
        """
        对存储的数据进行脱敏处理
        
        Returns:
            脱敏统计信息
        """
        all_data = self.storage.get_all_data()
        masked_data = self.masker.mask_data(all_data)
        
        total_masked = 0
        for i, (original, masked) in enumerate(zip(all_data, masked_data)):
            if original != masked:
                total_masked += 1
        
        return {
            'total_items': len(all_data),
            'masked_items': total_masked
        }
    
    def export_report(
        self, 
        output_dir: str,
        formats: List[str] = None
    ) -> dict:
        """
        导出报告
        
        Args:
            output_dir: 输出目录
            formats: 导出格式列表（md, csv, json）
            
        Returns:
            导出统计信息
        """
        if formats is None:
            formats = ['md', 'csv', 'json']
        
        os.makedirs(output_dir, exist_ok=True)
        
        stats = {
            'output_dir': output_dir,
            'formats': formats,
            'files': []
        }
        
        statistics = self.storage.get_statistics()
        issues = self.storage.get_issues()
        timeline_by_role = self.storage.get_timeline_by_role()
        timeline = self.storage.get_timeline()
        
        if 'md' in formats:
            md_exporter = MDExporter()
            md_path = os.path.join(output_dir, 'report.md')
            md_exporter.export_to_file(
                md_path, statistics, issues, timeline_by_role
            )
            stats['files'].append(md_path)
        
        if 'csv' in formats:
            csv_exporter = CSVExporter()
            
            issues_csv_path = os.path.join(output_dir, 'issues.csv')
            csv_exporter.export_to_file(issues_csv_path, issues)
            stats['files'].append(issues_csv_path)
            
            if timeline_by_role:
                timeline_csv_path = os.path.join(output_dir, 'timeline.csv')
                csv_exporter.export_timeline_to_csv(timeline_by_role, timeline_csv_path)
                stats['files'].append(timeline_csv_path)
        
        if 'json' in formats:
            json_exporter = JSONExporter()
            
            data = {
                'evidence': self.storage.get_data('evidence'),
                'chat': self.storage.get_data('chat'),
                'memo': self.storage.get_data('memo'),
                'transcript': self.storage.get_data('transcript')
            }
            
            audit_path = os.path.join(output_dir, 'audit.json')
            json_exporter.export_audit_package_to_file(
                audit_path, statistics, issues, timeline, data
            )
            stats['files'].append(audit_path)
        
        return stats
    
    def get_statistics(self) -> dict:
        """获取统计信息"""
        return self.storage.get_statistics()
    
    def get_issues(self, severity: str = None) -> list:
        """获取问题列表"""
        return self.storage.get_issues(severity)
    
    def get_timeline(self) -> list:
        """获取时间线数据"""
        return self.storage.get_timeline()
    
    def get_timeline_by_role(self) -> dict:
        """获取按角色分组的时间线"""
        return self.storage.get_timeline_by_role()
    
    def save_state(self, path: str):
        """保存当前状态"""
        self.storage.save(path)
    
    def clear(self):
        """清空所有数据"""
        self.storage.clear()


@click.group()
@click.option('--storage', '-s', default=None, help='存储文件路径')
@click.pass_context
def cli(ctx, storage):
    """庭审证据时间线核对器"""
    ctx.ensure_object(dict)
    ctx.obj['checker'] = EvidenceTimelineChecker(storage)


@cli.command()
@click.argument('files', nargs=-1, type=click.Path(exists=True))
@click.pass_context
def import_cmd(ctx, files):
    """导入材料文件
    
    支持的格式：CSV（证据目录）、JSON（聊天记录）、YAML/YML（关键日期备忘）、TXT（庭审笔录）
    """
    checker = ctx.obj['checker']
    
    if not files:
        click.echo("请提供要导入的文件路径")
        return
    
    click.echo(f"正在导入 {len(files)} 个文件...")
    
    stats = checker.import_files(list(files))
    
    click.echo(f"\n导入完成：")
    click.echo(f"  - 成功文件: {stats['success_files']}/{stats['total_files']}")
    click.echo(f"  - 失败文件: {stats['failed_files']}")
    click.echo(f"  - 总记录数: {stats['total_records']}")
    
    if stats['failures']:
        click.echo(f"\n失败详情：")
        for failure in stats['failures']:
            click.echo(f"  - {failure['file']}: {failure['error']}")
    
    if click.confirm('\n是否查看当前统计信息？', default=True):
        stats = checker.get_statistics()
        click.echo(f"\n数据统计：")
        for data_type, count in stats['data'].items():
            labels = {
                'evidence': '证据目录',
                'chat': '聊天记录',
                'memo': '关键日期备忘',
                'transcript': '庭审笔录'
            }
            label = labels.get(data_type, data_type)
            click.echo(f"  - {label}: {count} 条")


@cli.command()
@click.pass_context
def check(ctx):
    """执行检查
    
    检查内容：
    - 证据缺失：庭审笔录中引用的证据是否在证据目录中存在
    - 时间冲突：事件时间是否存在前后矛盾
    - 未脱敏字段：是否存在未脱敏的敏感信息
    - 重复引用：证据是否被重复引用
    """
    checker = ctx.obj['checker']
    
    click.echo("正在执行检查...")
    
    stats = checker.run_checks()
    
    click.echo(f"\n检查完成：")
    click.echo(f"  - 总问题数: {stats['total_issues']}")
    
    if stats['total_issues'] == 0:
        click.echo("\n✅ 未发现任何问题！")
        return
    
    click.echo(f"\n按严重程度分布：")
    severity_labels = {
        'critical': '🔴 严重',
        'high': '🟠 高',
        'medium': '🟡 中',
        'low': '🟢 低',
        'info': 'ℹ️ 信息'
    }
    for severity, count in stats['by_severity'].items():
        label = severity_labels.get(severity, severity)
        click.echo(f"  {label}: {count} 个")
    
    click.echo(f"\n按规则分布：")
    for rule, count in stats['by_rule'].items():
        click.echo(f"  - {rule}: {count} 个")
    
    if click.confirm('\n是否列出所有问题详情？', default=False):
        issues = checker.get_issues()
        for i, issue in enumerate(issues, 1):
            severity = issue.get('severity', 'unknown')
            label = severity_labels.get(severity, severity)
            click.echo(f"\n{i}. [{label}] {issue.get('rule_name', '')}")
            click.echo(f"   描述: {issue.get('description', '')}")
            click.echo(f"   位置: {issue.get('location', '未知')}")


@cli.command()
@click.pass_context
def timeline(ctx):
    """生成时间线
    
    按角色分组展示事件时间轴
    """
    checker = ctx.obj['checker']
    
    click.echo("正在生成时间线...")
    
    stats = checker.generate_timeline()
    
    click.echo(f"\n时间线生成完成：")
    click.echo(f"  - 总事件数: {stats['total_events']}")
    
    if stats['total_events'] == 0:
        click.echo("\n⚠️ 没有找到有时间戳的事件")
        return
    
    click.echo(f"\n按角色分布：")
    for role, count in stats['by_role'].items():
        click.echo(f"  - {role}: {count} 个事件")
    
    if click.confirm('\n是否展示时间线详情？', default=True):
        timeline_by_role = checker.get_timeline_by_role()
        
        for role, events in timeline_by_role.items():
            click.echo(f"\n{'='*60}")
            click.echo(f"👤 {role}")
            click.echo(f"{'='*60}")
            
            sorted_events = sorted(
                events,
                key=lambda x: x.get('timestamp') if x.get('timestamp') else ''
            )
            
            for event in sorted_events:
                timestamp = event.get('timestamp', '')
                if timestamp:
                    if hasattr(timestamp, 'strftime'):
                        time_str = timestamp.strftime('%Y-%m-%d %H:%M:%S')
                    else:
                        time_str = str(timestamp)
                else:
                    time_str = '未知时间'
                
                content = event.get('content', '无内容')
                click.echo(f"\n  [{time_str}]")
                click.echo(f"  {content[:80]}{'...' if len(content) > 80 else ''}")


@cli.command()
@click.argument('output_dir', type=click.Path())
@click.option('--format', '-f', multiple=True, default=['md', 'csv', 'json'],
              help='导出格式（可多选：md, csv, json）')
@click.pass_context
def report(ctx, output_dir, format):
    """导出报告
    
    导出格式：
    - md: Markdown摘要报告
    - csv: CSV问题清单和时间线
    - json: JSON审计包
    """
    checker = ctx.obj['checker']
    
    click.echo(f"正在导出报告到: {output_dir}")
    
    stats = checker.export_report(output_dir, list(format))
    
    click.echo(f"\n导出完成：")
    click.echo(f"  - 输出目录: {stats['output_dir']}")
    click.echo(f"  - 导出格式: {', '.join(stats['formats'])}")
    click.echo(f"\n生成的文件：")
    for file_path in stats['files']:
        click.echo(f"  - {file_path}")


@cli.command()
@click.pass_context
def stats(ctx):
    """查看统计信息"""
    checker = ctx.obj['checker']
    
    stats = checker.get_statistics()
    
    click.echo("\n📊 统计概览")
    click.echo("="*60)
    
    click.echo("\n📁 数据导入情况：")
    data_labels = {
        'evidence': '证据目录',
        'chat': '聊天记录',
        'memo': '关键日期备忘',
        'transcript': '庭审笔录'
    }
    for data_type, count in stats['data'].items():
        label = data_labels.get(data_type, data_type)
        click.echo(f"  - {label}: {count} 条")
    
    click.echo("\n⚠️ 问题统计：")
    issue_stats = stats.get('issues', {})
    click.echo(f"  - 总问题数: {issue_stats.get('total', 0)}")
    
    severity_stats = issue_stats.get('by_severity', {})
    if severity_stats:
        click.echo(f"\n  按严重程度：")
        severity_labels = {
            'critical': '🔴 严重',
            'high': '🟠 高',
            'medium': '🟡 中',
            'low': '🟢 低',
            'info': 'ℹ️ 信息'
        }
        for severity, count in severity_stats.items():
            label = severity_labels.get(severity, severity)
            click.echo(f"    {label}: {count} 个")
    
    click.echo("\n📅 时间线统计：")
    timeline_stats = stats.get('timeline', {})
    click.echo(f"  - 总事件数: {timeline_stats.get('total_events', 0)}")
    
    role_stats = timeline_stats.get('by_role', {})
    if role_stats:
        click.echo(f"\n  按角色分组：")
        for role, count in role_stats.items():
            click.echo(f"    - {role}: {count} 个事件")


@cli.command()
@click.argument('path', type=click.Path())
@click.pass_context
def save(ctx, path):
    """保存当前状态到文件"""
    checker = ctx.obj['checker']
    
    checker.save_state(path)
    click.echo(f"状态已保存到: {path}")


@cli.command()
@click.pass_context
def clear(ctx):
    """清空所有数据"""
    if click.confirm('确定要清空所有数据吗？此操作不可撤销！', default=False):
        checker = ctx.obj['checker']
        checker.clear()
        click.echo("所有数据已清空")


def main():
    """主入口函数"""
    cli(obj={})


if __name__ == '__main__':
    main()

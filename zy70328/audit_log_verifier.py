#!/usr/bin/env python3
"""
本地审计日志验真CLI工具
"""
import os
import json
import hashlib
import csv
import re
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple, Union
import click
import jsonlines
import pandas as pd

class AuditLogEntry:
    """审计日志条目类"""
    def __init__(self, data: Dict[str, Any], file_path: str, line_number: int):
        self.data = data
        self.file_path = file_path
        self.line_number = line_number
        
        # 提取关键字段，支持不同的字段名
        self.seq = self._extract_seq()
        self.timestamp = self._extract_timestamp()
        self.operator = self._extract_operator()
        self.operation_type = self._extract_operation_type()
        self.prev_hash = self._extract_prev_hash()
        self.current_hash = self._extract_current_hash()
        self.content = self._extract_content()
    
    def _extract_seq(self) -> Optional[int]:
        """提取序号"""
        seq_fields = ['seq', 'sequence', '序号', 'id', '编号']
        for field in seq_fields:
            if field in self.data:
                try:
                    return int(self.data[field])
                except (ValueError, TypeError):
                    continue
        return None
    
    def _extract_timestamp(self) -> Optional[datetime]:
        """提取时间戳"""
        ts_fields = ['timestamp', 'time', '日期', '时间', 'datetime', 'create_time', 'created_at']
        for field in ts_fields:
            if field in self.data:
                ts = self.data[field]
                if isinstance(ts, str):
                    # 尝试多种时间格式
                    formats = [
                        '%Y-%m-%d %H:%M:%S',
                        '%Y-%m-%d %H:%M:%S.%f',
                        '%Y-%m-%dT%H:%M:%S',
                        '%Y-%m-%dT%H:%M:%S.%f',
                        '%Y-%m-%d',
                        '%Y%m%d%H%M%S'
                    ]
                    for fmt in formats:
                        try:
                            return datetime.strptime(ts, fmt)
                        except ValueError:
                            continue
                    # 尝试解析ISO格式
                    try:
                        from dateutil.parser import parse
                        return parse(ts)
                    except (ImportError, ValueError):
                        continue
                elif isinstance(ts, (int, float)):
                    # 假设是Unix时间戳
                    try:
                        return datetime.fromtimestamp(ts)
                    except (ValueError, OSError):
                        continue
        return None
    
    def _extract_operator(self) -> Optional[str]:
        """提取操作者"""
        op_fields = ['operator', 'user', '操作者', '操作人', 'username', 'user_id']
        for field in op_fields:
            if field in self.data:
                return str(self.data[field])
        return None
    
    def _extract_operation_type(self) -> Optional[str]:
        """提取操作类型"""
        type_fields = ['operation', 'action', '操作类型', '操作', 'event', '事件']
        for field in type_fields:
            if field in self.data:
                return str(self.data[field])
        return None
    
    def _extract_prev_hash(self) -> Optional[str]:
        """提取前一条哈希"""
        hash_fields = ['prev_hash', 'previous_hash', '前一条哈希', '前哈希']
        for field in hash_fields:
            if field in self.data:
                return str(self.data[field])
        return None
    
    def _extract_current_hash(self) -> Optional[str]:
        """提取当前哈希"""
        hash_fields = ['hash', 'current_hash', '哈希', '当前哈希']
        for field in hash_fields:
            if field in self.data:
                return str(self.data[field])
        return None
    
    def _extract_content(self) -> str:
        """提取用于计算哈希的内容"""
        # 排除哈希字段后，将其他字段排序后生成内容
        content_data = {}
        for k, v in self.data.items():
            if k not in ['hash', 'current_hash', 'prev_hash', 'previous_hash']:
                # 确保所有值都转换为一致的字符串表示
                content_data[k] = str(v) if v is not None else ''
        return json.dumps(content_data, sort_keys=True, ensure_ascii=False)
    
    def calculate_hash(self) -> str:
        """计算当前条目的哈希值"""
        return hashlib.sha256(self.content.encode('utf-8')).hexdigest()
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'seq': self.seq,
            'timestamp': self.timestamp,
            'operator': self.operator,
            'operation_type': self.operation_type,
            'prev_hash': self.prev_hash,
            'current_hash': self.current_hash,
            'file_path': self.file_path,
            'line_number': self.line_number
        }


class AuditLogVerifier:
    """审计日志验真器"""
    
    def __init__(self):
        self.entries: List[AuditLogEntry] = []
        self.issues: List[Dict[str, Any]] = []
        self.affected_users: set = set()
        self.affected_operations: set = set()
        
    def load_logs(self, paths: List[str]) -> None:
        """加载日志文件"""
        self.entries = []
        self.issues = []
        self.affected_users = set()
        self.affected_operations = set()
        
        for path in paths:
            path_obj = Path(path)
            if path_obj.is_file():
                self._load_file(path_obj)
            elif path_obj.is_dir():
                # 按日期顺序加载目录中的文件
                files = sorted(path_obj.glob('*.jsonl')) + sorted(path_obj.glob('*.csv'))
                for f in files:
                    self._load_file(f)
            else:
                self.issues.append({
                    'type': 'file_error',
                    'severity': 'warning',
                    'message': f'路径不存在: {path}',
                    'file_path': str(path_obj)
                })
    
    def _load_file(self, file_path: Path) -> None:
        """加载单个文件"""
        try:
            if file_path.suffix.lower() == '.jsonl':
                self._load_jsonl(file_path)
            elif file_path.suffix.lower() == '.csv':
                self._load_csv(file_path)
            else:
                self.issues.append({
                    'type': 'unsupported_format',
                    'severity': 'warning',
                    'message': f'不支持的文件格式: {file_path.suffix}',
                    'file_path': str(file_path)
                })
        except Exception as e:
            self.issues.append({
                'type': 'file_error',
                'severity': 'error',
                'message': f'读取文件失败: {str(e)}',
                'file_path': str(file_path)
            })
    
    def _load_jsonl(self, file_path: Path) -> None:
        """加载JSONL文件"""
        with jsonlines.open(file_path) as reader:
            for line_num, data in enumerate(reader, start=1):
                if isinstance(data, dict):
                    entry = AuditLogEntry(data, str(file_path), line_num)
                    self.entries.append(entry)
    
    def _load_csv(self, file_path: Path) -> None:
        """加载CSV文件"""
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for line_num, row in enumerate(reader, start=2):  # 跳过标题行
                entry = AuditLogEntry(dict(row), str(file_path), line_num)
                self.entries.append(entry)
    
    def verify(self) -> Dict[str, Any]:
        """执行完整验证"""
        self._verify_sequence()
        self._verify_timestamps()
        self._verify_hash_chain()
        self._verify_operator_consistency()
        
        return self._generate_report()
    
    def _verify_sequence(self) -> None:
        """验证序号连续性"""
        if not self.entries:
            return
        
        # 按序号排序的条目
        sorted_by_seq = [e for e in self.entries if e.seq is not None]
        sorted_by_seq.sort(key=lambda x: x.seq)
        
        if len(sorted_by_seq) < 2:
            return
        
        # 检查重复序号
        seen_seqs = {}
        for entry in sorted_by_seq:
            if entry.seq in seen_seqs:
                issue = {
                    'type': 'duplicate_seq',
                    'severity': 'high',
                    'message': f'重复序号: {entry.seq}',
                    'file_path': entry.file_path,
                    'line_number': entry.line_number,
                    'details': f'与 {seen_seqs[entry.seq][0]} 第 {seen_seqs[entry.seq][1]} 行重复',
                    'operator': entry.operator,
                    'operation_type': entry.operation_type
                }
                self.issues.append(issue)
                if entry.operator:
                    self.affected_users.add(entry.operator)
                if entry.operation_type:
                    self.affected_operations.add(entry.operation_type)
            else:
                seen_seqs[entry.seq] = (entry.file_path, entry.line_number)
        
        # 检查序号缺口
        expected_seq = sorted_by_seq[0].seq
        for i, entry in enumerate(sorted_by_seq):
            if i == 0:
                continue
            
            prev_entry = sorted_by_seq[i-1]
            if entry.seq != prev_entry.seq + 1:
                missing_range = f'{prev_entry.seq + 1} 到 {entry.seq - 1}' if entry.seq > prev_entry.seq + 2 else f'{prev_entry.seq + 1}'
                issue = {
                    'type': 'sequence_gap',
                    'severity': 'high',
                    'message': f'序号缺口: {missing_range}',
                    'file_path': entry.file_path,
                    'line_number': entry.line_number,
                    'details': f'前一条: {prev_entry.file_path} 第 {prev_entry.line_number} 行 (序号 {prev_entry.seq})',
                    'operator': entry.operator,
                    'operation_type': entry.operation_type
                }
                self.issues.append(issue)
                if entry.operator:
                    self.affected_users.add(entry.operator)
                if entry.operation_type:
                    self.affected_operations.add(entry.operation_type)
    
    def _verify_timestamps(self) -> None:
        """验证时间顺序"""
        if len(self.entries) < 2:
            return
        
        for i in range(1, len(self.entries)):
            prev = self.entries[i-1]
            curr = self.entries[i]
            
            if prev.timestamp and curr.timestamp and curr.timestamp < prev.timestamp:
                issue = {
                    'type': 'timestamp_out_of_order',
                    'severity': 'medium',
                    'message': '时间顺序异常',
                    'file_path': curr.file_path,
                    'line_number': curr.line_number,
                    'details': f'当前时间 {curr.timestamp} 早于前一条 {prev.timestamp} ({prev.file_path} 第 {prev.line_number} 行)',
                    'operator': curr.operator,
                    'operation_type': curr.operation_type
                }
                self.issues.append(issue)
                if curr.operator:
                    self.affected_users.add(curr.operator)
                if curr.operation_type:
                    self.affected_operations.add(curr.operation_type)
    
    def _verify_hash_chain(self) -> None:
        """验证摘要链"""
        if len(self.entries) < 2:
            return
        
        # 首先验证每个条目的存储哈希与计算哈希是否匹配（检测内容篡改）
        for entry in self.entries:
            if entry.current_hash:
                calculated_hash = entry.calculate_hash()
                if entry.current_hash != calculated_hash:
                    issue = {
                        'type': 'hash_mismatch',
                        'severity': 'critical',
                        'message': '内容哈希不匹配',
                        'file_path': entry.file_path,
                        'line_number': entry.line_number,
                        'details': f'存储的哈希为 {entry.current_hash[:16]}..., 计算的哈希为 {calculated_hash[:16]}...，内容可能被篡改',
                        'operator': entry.operator,
                        'operation_type': entry.operation_type
                    }
                    self.issues.append(issue)
                    if entry.operator:
                        self.affected_users.add(entry.operator)
                    if entry.operation_type:
                        self.affected_operations.add(entry.operation_type)
        
        # 按序号排序后验证摘要链
        sorted_by_seq = [e for e in self.entries if e.seq is not None]
        sorted_by_seq.sort(key=lambda x: x.seq)
        
        if len(sorted_by_seq) < 2:
            return
        
        for i in range(1, len(sorted_by_seq)):
            prev = sorted_by_seq[i-1]
            curr = sorted_by_seq[i]
            
            # 计算前一条的哈希
            prev_calculated = prev.calculate_hash()
            prev_stored = prev.current_hash or prev_calculated
            
            # 检查当前条目的prev_hash是否匹配
            if curr.prev_hash and curr.prev_hash != prev_stored:
                issue = {
                    'type': 'hash_chain_broken',
                    'severity': 'critical',
                    'message': '摘要链断裂',
                    'file_path': curr.file_path,
                    'line_number': curr.line_number,
                    'details': f'前一条 ({prev.file_path} 第 {prev.line_number} 行) 的哈希为 {prev_stored[:16]}..., 当前条目的prev_hash为 {curr.prev_hash[:16]}...',
                    'prev_entry': prev.to_dict(),
                    'current_entry': curr.to_dict(),
                    'operator': curr.operator,
                    'operation_type': curr.operation_type
                }
                self.issues.append(issue)
                if curr.operator:
                    self.affected_users.add(curr.operator)
                if curr.operation_type:
                    self.affected_operations.add(curr.operation_type)
    
    def _verify_operator_consistency(self) -> None:
        """验证操作者和操作字段完整性"""
        for entry in self.entries:
            if not entry.operator:
                self.issues.append({
                    'type': 'missing_operator',
                    'severity': 'low',
                    'message': '缺少操作者信息',
                    'file_path': entry.file_path,
                    'line_number': entry.line_number
                })
            
            if not entry.operation_type:
                self.issues.append({
                    'type': 'missing_operation_type',
                    'severity': 'low',
                    'message': '缺少操作类型信息',
                    'file_path': entry.file_path,
                    'line_number': entry.line_number
                })
    
    def _generate_report(self) -> Dict[str, Any]:
        """生成验证报告"""
        # 按严重程度排序问题
        severity_order = {'critical': 0, 'high': 1, 'medium': 2, 'low': 3, 'warning': 4}
        self.issues.sort(key=lambda x: severity_order.get(x.get('severity', 'warning'), 4))
        
        # 找出第一处可疑位置
        first_issue = self.issues[0] if self.issues else None
        
        # 判断是否可以作为审计证据
        can_be_evidence = True
        evidence_reason = '日志完整，可以作为审计证据'
        
        critical_issues = [i for i in self.issues if i.get('severity') == 'critical']
        high_issues = [i for i in self.issues if i.get('severity') == 'high']
        
        if critical_issues:
            can_be_evidence = False
            evidence_reason = '存在摘要链断裂，无法作为审计证据'
        elif high_issues:
            can_be_evidence = False
            evidence_reason = '存在严重问题，建议修复后再作为审计证据'
        elif self.issues:
            evidence_reason = '存在轻微问题，建议核实后作为审计证据'
        
        return {
            'total_entries': len(self.entries),
            'issues': self.issues,
            'issues_count': len(self.issues),
            'first_issue': first_issue,
            'affected_users': list(self.affected_users),
            'affected_operations': list(self.affected_operations),
            'can_be_evidence': can_be_evidence,
            'evidence_reason': evidence_reason
        }


def create_sample_logs(output_dir: str) -> None:
    """创建样例日志文件"""
    import random
    import hashlib
    import json
    
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    # 基础日志数据模板
    base_entries = [
        {'operator': 'admin', 'operation': 'login', 'content': '管理员登录系统'},
        {'operator': 'user1', 'operation': 'view', 'content': '查看用户列表'},
        {'operator': 'admin', 'operation': 'update', 'content': '修改系统配置'},
        {'operator': 'user2', 'operation': 'create', 'content': '创建新用户'},
        {'operator': 'admin', 'operation': 'delete', 'content': '删除过期数据'},
        {'operator': 'user1', 'operation': 'export', 'content': '导出报表数据'},
    ]
    
    def generate_entries(start_seq=1, start_time=None):
        entries = []
        base_time = start_time or datetime(2024, 1, 15, 9, 0, 0)
        prev_hash = None
        
        for i, base in enumerate(base_entries):
            entry = base.copy()
            entry['seq'] = start_seq + i
            entry['timestamp'] = (base_time.replace(minute=base_time.minute + i * 10)).strftime('%Y-%m-%d %H:%M:%S')
            
            # 计算内容哈希（不含哈希字段，所有值转字符串以确保一致性）
            content_data = {}
            for k, v in entry.items():
                if k not in ['hash', 'prev_hash']:
                    content_data[k] = str(v) if v is not None else ''
            content_for_hash = json.dumps(content_data, sort_keys=True, ensure_ascii=False)
            entry['hash'] = hashlib.sha256(content_for_hash.encode('utf-8')).hexdigest()
            entry['prev_hash'] = prev_hash or ''
            prev_hash = entry['hash']
            
            entries.append(entry)
        
        return entries
    
    # 1. 完整日志
    complete_entries = generate_entries()
    with open(output_path / 'complete_logs.jsonl', 'w') as f:
        for entry in complete_entries:
            f.write(json.dumps(entry, ensure_ascii=False) + '\n')
    
    # 2. 缺行日志（删除第3条）
    gap_entries = generate_entries()
    del gap_entries[2]  # 删除第3条（索引从0开始）
    with open(output_path / 'gap_logs.jsonl', 'w') as f:
        for entry in gap_entries:
            f.write(json.dumps(entry, ensure_ascii=False) + '\n')
    
    # 3. 乱序日志（交换第2和第4条）
    out_of_order_entries = generate_entries()
    out_of_order_entries[1], out_of_order_entries[3] = out_of_order_entries[3], out_of_order_entries[1]
    with open(output_path / 'out_of_order_logs.jsonl', 'w') as f:
        for entry in out_of_order_entries:
            f.write(json.dumps(entry, ensure_ascii=False) + '\n')
    
    # 4. 摘要被改的日志（修改第4条的content）
    tampered_entries = generate_entries()
    tampered_entries[3]['content'] = '创建新用户（被篡改）'
    with open(output_path / 'tampered_logs.jsonl', 'w') as f:
        for entry in tampered_entries:
            f.write(json.dumps(entry, ensure_ascii=False) + '\n')
    
    # 同时创建CSV版本
    def write_csv(filepath, entries):
        with open(filepath, 'w', newline='', encoding='utf-8') as f:
            if entries:
                writer = csv.DictWriter(f, fieldnames=entries[0].keys())
                writer.writeheader()
                for entry in entries:
                    writer.writerow(entry)
    
    write_csv(output_path / 'complete_logs.csv', complete_entries)
    write_csv(output_path / 'gap_logs.csv', gap_entries)
    write_csv(output_path / 'out_of_order_logs.csv', out_of_order_entries)
    write_csv(output_path / 'tampered_logs.csv', tampered_entries)
    
    print(f'样例日志已创建在: {output_path}')


def format_issue(issue: Dict[str, Any], show_details: bool = True) -> str:
    """格式化问题输出"""
    severity_colors = {
        'critical': click.style('严重', fg='red', bold=True),
        'high': click.style('高', fg='red'),
        'medium': click.style('中', fg='yellow'),
        'low': click.style('低', fg='cyan'),
        'warning': click.style('警告', fg='yellow')
    }
    
    severity = severity_colors.get(issue.get('severity', 'warning'), issue.get('severity', 'unknown'))
    result = f'[{severity}] {issue.get("type", "unknown")}: {issue.get("message", "")}'
    
    if issue.get("file_path"):
        result += f' ({issue["file_path"]}:{issue.get("line_number", "?")})'
    
    if show_details and issue.get("details"):
        result += f'\n  详情: {issue["details"]}'
    
    return result


def get_repair_hints(issues: List[Dict[str, Any]]) -> List[str]:
    """生成修复建议"""
    hints = []
    
    for issue in issues:
        issue_type = issue.get('type')
        
        if issue_type == 'sequence_gap':
            hints.append(f'序号缺口: 检查 {issue["file_path"]} 附近是否有缺失的日志文件或条目')
        elif issue_type == 'duplicate_seq':
            hints.append(f'重复序号: 检查 {issue["file_path"]} 中的重复条目，可能是重复导入')
        elif issue_type == 'timestamp_out_of_order':
            hints.append(f'时间乱序: 检查 {issue["file_path"]} 的时间戳，可能是日志拼接错误')
        elif issue_type == 'hash_chain_broken':
            hints.append(f'摘要链断裂: {issue["file_path"]} 附近的日志可能被篡改，需要核实原始数据')
        elif issue_type == 'hash_mismatch':
            hints.append(f'内容哈希不匹配: {issue["file_path"]}:{issue["line_number"]} 的日志内容被篡改，需要核实原始数据')
    
    return hints


@click.group()
def cli():
    """本地审计日志验真工具"""
    pass


@cli.command('init-sample')
@click.option('-o', '--output', default='sample_logs', help='样例日志输出目录')
def init_sample(output):
    """创建样例日志文件"""
    create_sample_logs(output)
    click.echo(click.style('✓', fg='green') + ' 样例日志创建完成')
    click.echo(f'  - complete_logs.jsonl/csv - 完整日志')
    click.echo(f'  - gap_logs.jsonl/csv - 缺行日志')
    click.echo(f'  - out_of_order_logs.jsonl/csv - 乱序日志')
    click.echo(f'  - tampered_logs.jsonl/csv - 摘要被改的日志')


@cli.command('verify')
@click.argument('paths', nargs=-1, required=True)
@click.option('-v', '--verbose', is_flag=True, help='显示详细信息')
def verify(paths, verbose):
    """验证审计日志的完整性和真实性"""
    verifier = AuditLogVerifier()
    verifier.load_logs(list(paths))
    report = verifier.verify()
    
    click.echo(f'共加载 {report["total_entries"]} 条日志记录')
    click.echo(f'发现 {report["issues_count"]} 个问题')
    
    for issue in report['issues']:
        click.echo(format_issue(issue, show_details=verbose))
    
    if report['issues_count'] == 0:
        click.echo(click.style('✓', fg='green') + ' 日志完整，未发现问题')
    else:
        status = click.style('✗', fg='red') if not report['can_be_evidence'] else click.style('⚠', fg='yellow')
        click.echo(f'{status} {report["evidence_reason"]}')


@cli.command('explain')
@click.argument('paths', nargs=-1, required=True)
def explain(paths):
    """解释发现的问题"""
    verifier = AuditLogVerifier()
    verifier.load_logs(list(paths))
    report = verifier.verify()
    
    click.echo(click.style('审计日志验证报告', bold=True))
    click.echo('=' * 50)
    
    if not report['issues']:
        click.echo(click.style('✓ 日志完整，未发现任何问题', fg='green'))
        return
    
    # 按问题类型分组
    issue_types = {}
    for issue in report['issues']:
        itype = issue['type']
        if itype not in issue_types:
            issue_types[itype] = []
        issue_types[itype].append(issue)
    
    click.echo(f'\n发现 {report["issues_count"]} 个问题，分为 {len(issue_types)} 类:\n')
    
    explanations = {
        'sequence_gap': '序号缺口：日志序号不连续，可能存在日志丢失或被删除的情况',
        'duplicate_seq': '重复序号：存在相同序号的日志条目，可能是重复导入或数据错误',
        'timestamp_out_of_order': '时间顺序异常：日志时间戳不按时间顺序排列，可能存在日志拼接问题',
        'hash_chain_broken': '摘要链断裂：前后日志的哈希值不匹配，日志内容可能被篡改',
        'hash_mismatch': '内容哈希不匹配：日志条目的存储哈希与重新计算的哈希不匹配，内容可能被篡改',
        'missing_operator': '缺少操作者信息：日志条目中缺少操作者信息',
        'missing_operation_type': '缺少操作类型：日志条目中缺少操作类型信息',
        'file_error': '文件错误：读取文件时发生错误',
        'unsupported_format': '不支持的格式：不支持的文件格式'
    }
    
    for itype, issues in issue_types.items():
        click.echo(click.style(f'【{itype}】', bold=True))
        click.echo(explanations.get(itype, '未知问题类型'))
        click.echo(f'数量: {len(issues)} 处')
        
        for i, issue in enumerate(issues, 1):
            click.echo(f'  {i}. {issue["file_path"]}:{issue["line_number"]}')
            if issue.get('operator'):
                click.echo(f'     操作者: {issue["operator"]}')
            if issue.get('operation_type'):
                click.echo(f'     操作类型: {issue["operation_type"]}')
            if issue.get('details'):
                click.echo(f'     详情: {issue["details"]}')
        click.echo()


@cli.command('repair-hint')
@click.argument('paths', nargs=-1, required=True)
def repair_hint(paths):
    """给出修复建议"""
    verifier = AuditLogVerifier()
    verifier.load_logs(list(paths))
    report = verifier.verify()
    
    if not report['issues']:
        click.echo(click.style('✓ 日志完整，无需修复', fg='green'))
        return
    
    hints = get_repair_hints(report['issues'])
    
    click.echo(click.style('修复建议:', bold=True))
    click.echo('=' * 50)
    
    for i, hint in enumerate(hints, 1):
        click.echo(f'{i}. {hint}')


@cli.command('report')
@click.argument('paths', nargs=-1, required=True)
@click.option('-f', '--format', 'output_format', default='text', 
              type=click.Choice(['text', 'json']),
              help='输出格式')
@click.option('-o', '--output', help='输出文件路径')
def report_command(paths, output_format, output):
    """生成完整的验证报告"""
    verifier = AuditLogVerifier()
    verifier.load_logs(list(paths))
    report = verifier.verify()
    
    if output_format == 'json':
        # 转换为可序列化的格式
        serializable_report = {
            'total_entries': report['total_entries'],
            'issues_count': report['issues_count'],
            'issues': report['issues'],
            'affected_users': report['affected_users'],
            'affected_operations': report['affected_operations'],
            'can_be_evidence': report['can_be_evidence'],
            'evidence_reason': report['evidence_reason']
        }
        
        # 转换datetime为字符串
        for issue in serializable_report['issues']:
            if 'prev_entry' in issue and issue['prev_entry']:
                if issue['prev_entry'].get('timestamp'):
                    issue['prev_entry']['timestamp'] = str(issue['prev_entry']['timestamp'])
            if 'current_entry' in issue and issue['current_entry']:
                if issue['current_entry'].get('timestamp'):
                    issue['current_entry']['timestamp'] = str(issue['current_entry']['timestamp'])
        
        result = json.dumps(serializable_report, ensure_ascii=False, indent=2)
        
        if output:
            with open(output, 'w', encoding='utf-8') as f:
                f.write(result)
            click.echo(f'报告已保存到: {output}')
        else:
            click.echo(result)
    else:
        # 文本格式报告
        lines = []
        lines.append('=' * 60)
        lines.append('审计日志验证报告')
        lines.append('=' * 60)
        lines.append('')
        lines.append(f'总日志条目数: {report["total_entries"]}')
        lines.append(f'发现问题数: {report["issues_count"]}')
        lines.append('')
        
        if report['first_issue']:
            lines.append('第一处可疑位置:')
            lines.append(f'  类型: {report["first_issue"]["type"]}')
            lines.append(f'  文件: {report["first_issue"]["file_path"]}')
            lines.append(f'  行号: {report["first_issue"]["line_number"]}')
            lines.append(f'  描述: {report["first_issue"]["message"]}')
            lines.append('')
        
        if report['affected_users']:
            lines.append('影响的用户:')
            for user in report['affected_users']:
                lines.append(f'  - {user}')
            lines.append('')
        
        if report['affected_operations']:
            lines.append('影响的操作类型:')
            for op in report['affected_operations']:
                lines.append(f'  - {op}')
            lines.append('')
        
        lines.append('问题详情:')
        for issue in report['issues']:
            lines.append(format_issue(issue))
        
        lines.append('')
        lines.append('=' * 60)
        status = '可以' if report['can_be_evidence'] else '不可以'
        lines.append(f'是否可作为审计证据: {status}')
        lines.append(f'原因: {report["evidence_reason"]}')
        lines.append('=' * 60)
        
        result = '\n'.join(lines)
        
        if output:
            with open(output, 'w', encoding='utf-8') as f:
                f.write(result)
            click.echo(f'报告已保存到: {output}')
        else:
            click.echo(result)


if __name__ == '__main__':
    cli()

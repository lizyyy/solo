#!/usr/bin/env python3
import argparse
import csv
import json
import os
import re
import random
import sys
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, Tuple, Any


@dataclass
class RecordingFile:
    file_path: str
    file_name: str
    parsed_ticket_id: Optional[str] = None
    parsed_agent_id: Optional[str] = None
    duration_seconds: Optional[int] = None
    parse_error: Optional[str] = None


@dataclass
class TicketRow:
    row_number: int
    ticket_id: str
    agent_id: str
    duration_str: str
    duration_seconds: Optional[int] = None
    has_recording: bool = False
    recording_file: Optional[str] = None
    missing_reason: Optional[str] = None
    parse_error: Optional[str] = None
    original_data: List[str] = field(default_factory=list)


@dataclass
class AuditResult:
    total_tickets: int = 0
    valid_tickets: int = 0
    tickets_with_recording: int = 0
    tickets_without_recording: int = 0
    recordings_found: int = 0
    recordings_unmatched: int = 0
    duration_mismatches: int = 0
    sampled_tickets: List[TicketRow] = field(default_factory=list)
    bad_rows: List[TicketRow] = field(default_factory=list)
    unmatched_recordings: List[RecordingFile] = field(default_factory=list)
    missing_categories: Dict[str, int] = field(default_factory=dict)


class RecordingAuditor:
    def __init__(self, 
                 recording_dir: str,
                 ticket_file: str,
                 output_dir: str,
                 sample_size: int = 20,
                 min_duration: int = 10,
                 duration_tolerance: int = 5):
        self.recording_dir = Path(recording_dir)
        self.ticket_file = Path(ticket_file)
        self.output_dir = Path(output_dir)
        self.sample_size = sample_size
        self.min_duration = min_duration
        self.duration_tolerance = duration_tolerance
        
        self.recordings: List[RecordingFile] = []
        self.tickets: List[TicketRow] = []
        self.result = AuditResult()

    @staticmethod
    def normalize_agent_id(agent_id: Optional[str]) -> Optional[str]:
        if not agent_id:
            return None
        normalized = agent_id.strip().upper()
        return normalized

    def validate_inputs(self) -> List[str]:
        errors = []
        
        if not self.recording_dir.exists():
            errors.append(f"录音目录不存在: {self.recording_dir}")
        elif not self.recording_dir.is_dir():
            errors.append(f"路径不是目录: {self.recording_dir}")
        
        if not self.ticket_file.exists():
            errors.append(f"工单文件不存在: {self.ticket_file}")
        elif not self.ticket_file.is_file():
            errors.append(f"路径不是文件: {self.ticket_file}")
        
        if self.sample_size <= 0:
            errors.append(f"抽样数量必须大于0: {self.sample_size}")
        
        if self.min_duration < 0:
            errors.append(f"最小时长不能为负: {self.min_duration}")
        
        if self.duration_tolerance < 0:
            errors.append(f"时长容差不能为负: {self.duration_tolerance}")
        
        return errors

    def scan_recordings(self) -> None:
        recording_extensions = {'.wav', '.mp3', '.m4a', '.flac', '.aac', '.ogg'}
        
        for file_path in self.recording_dir.rglob('*'):
            if file_path.is_file() and file_path.suffix.lower() in recording_extensions:
                recording = RecordingFile(
                    file_path=str(file_path),
                    file_name=file_path.name
                )
                self._parse_recording_filename(recording)
                self.recordings.append(recording)
        
        self.result.recordings_found = len(self.recordings)

    def _parse_recording_filename(self, recording: RecordingFile) -> None:
        filename = recording.file_name
        name_without_ext = Path(filename).stem
        
        patterns = [
            r'T(\d{6,12})[_-](A\d{3,8})',
            r'ticket[_-]?(\d{6,12})[_-]agent[_-]?([A]?\d{3,8})',
            r'(\d{6,12})[_-]([A]?\d{3,8})',
            r'^(\d{6,12})',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, name_without_ext, re.IGNORECASE)
            if match:
                groups = match.groups()
                recording.parsed_ticket_id = groups[0] if groups else None
                recording.parsed_agent_id = groups[1] if len(groups) > 1 else None
                break
        
        duration_match = re.search(r'_(\d+)s(?:[_$.]|$)', name_without_ext)
        if duration_match:
            try:
                recording.duration_seconds = int(duration_match.group(1))
            except ValueError:
                recording.parse_error = f"时长解析失败: {duration_match.group(1)}"

    def parse_ticket_table(self) -> None:
        with open(self.ticket_file, 'r', encoding='utf-8-sig', newline='') as f:
            content = f.read()
        
        dialect = csv.Sniffer().sniff(content)
        lines = content.splitlines()
        reader = csv.reader(lines, dialect)
        
        headers = next(reader, None)
        ticket_id_col = 0
        agent_id_col = 1
        duration_col = 2
        
        if headers:
            header_lower = [h.lower().strip() for h in headers]
            for i, h in enumerate(header_lower):
                if '工单号' in h or 'ticket' in h and 'id' in h:
                    ticket_id_col = i
                elif '坐席' in h or 'agent' in h:
                    agent_id_col = i
                elif '时长' in h or 'duration' in h:
                    duration_col = i
        
        for row_num, row in enumerate(reader, start=2):
            ticket = TicketRow(
                row_number=row_num,
                ticket_id='',
                agent_id='',
                duration_str='',
                original_data=row.copy()
            )
            
            try:
                ticket.ticket_id = str(row[ticket_id_col]).strip() if len(row) > ticket_id_col else ''
                ticket.agent_id = str(row[agent_id_col]).strip() if len(row) > agent_id_col else ''
                ticket.duration_str = str(row[duration_col]).strip() if len(row) > duration_col else ''
                
                if not ticket.ticket_id:
                    ticket.parse_error = "工单号为空"
                    self.result.bad_rows.append(ticket)
                    continue
                
                ticket.duration_seconds = self._parse_duration(ticket.duration_str)
                self.tickets.append(ticket)
                
            except IndexError:
                ticket.parse_error = f"列数不足: 期望至少{max(ticket_id_col, agent_id_col, duration_col)+1}列, 实际{len(row)}列"
                self.result.bad_rows.append(ticket)
            except Exception as e:
                ticket.parse_error = f"解析错误: {str(e)}"
                self.result.bad_rows.append(ticket)
        
        self.result.total_tickets = len(self.tickets) + len(self.result.bad_rows)
        self.result.valid_tickets = len(self.tickets)

    def _parse_duration(self, duration_str: str) -> Optional[int]:
        if not duration_str or duration_str.lower() in ['', 'null', 'none', '-']:
            return None
        
        match = re.match(r'^(\d+):(\d+)$', duration_str)
        if match:
            return int(match.group(1)) * 60 + int(match.group(2))
        
        match = re.match(r'^(\d+):(\d+):(\d+)$', duration_str)
        if match:
            return int(match.group(1)) * 3600 + int(match.group(2)) * 60 + int(match.group(3))
        
        match = re.match(r'^(\d+)\s*(s|sec|秒)?$', duration_str, re.IGNORECASE)
        if match:
            return int(match.group(1))
        
        return None

    def match_recordings(self) -> None:
        ticket_id_map: Dict[str, List[TicketRow]] = {}
        for ticket in self.tickets:
            tid = ticket.ticket_id
            if tid not in ticket_id_map:
                ticket_id_map[tid] = []
            ticket_id_map[tid].append(ticket)
        
        unmatched_recordings = []
        
        for recording in self.recordings:
            matched = False
            if recording.parsed_ticket_id:
                tid = recording.parsed_ticket_id
                if tid in ticket_id_map:
                    for ticket in ticket_id_map[tid]:
                        if not ticket.has_recording:
                            ticket.has_recording = True
                            ticket.recording_file = recording.file_path
                            
                            ticket_agent = self.normalize_agent_id(ticket.agent_id)
                            recording_agent = self.normalize_agent_id(recording.parsed_agent_id)
                            if ticket_agent and recording_agent and ticket_agent != recording_agent:
                                ticket.missing_reason = "坐席编号不匹配"
                                self._add_missing_category("坐席编号不匹配")
                            
                            if ticket.duration_seconds is not None and recording.duration_seconds is not None:
                                if abs(ticket.duration_seconds - recording.duration_seconds) > self.duration_tolerance:
                                    ticket.missing_reason = "时长差异过大"
                                    self.result.duration_mismatches += 1
                                    self._add_missing_category("时长差异过大")
                            
                            matched = True
                            self.result.tickets_with_recording += 1
                            break
            
            if not matched:
                unmatched_recordings.append(recording)
        
        self.result.recordings_unmatched = len(unmatched_recordings)
        self.result.unmatched_recordings = unmatched_recordings
        
        for ticket in self.tickets:
            if not ticket.has_recording:
                self.result.tickets_without_recording += 1
                self._determine_missing_reason(ticket)

    def _determine_missing_reason(self, ticket: TicketRow) -> None:
        if ticket.duration_seconds and ticket.duration_seconds < self.min_duration:
            ticket.missing_reason = "通话时长过短"
        elif not ticket.agent_id:
            ticket.missing_reason = "缺少坐席编号"
        else:
            ticket.missing_reason = "录音文件缺失"
        self._add_missing_category(ticket.missing_reason)

    def _add_missing_category(self, reason: Optional[str]) -> None:
        if reason:
            self.result.missing_categories[reason] = self.result.missing_categories.get(reason, 0) + 1

    def sample_tickets(self) -> None:
        candidates = [
            t for t in self.tickets
            if t.has_recording and (t.duration_seconds or 0) >= self.min_duration
        ]
        
        sample_count = min(self.sample_size, len(candidates))
        if sample_count > 0:
            self.result.sampled_tickets = random.sample(candidates, sample_count)

    def ensure_output_dir(self) -> None:
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def print_summary(self) -> None:
        print("\n" + "="*60)
        print("工单录音抽检 - 执行摘要")
        print("="*60)
        print(f"总工单数量: {self.result.total_tickets}")
        print(f"有效工单: {self.result.valid_tickets}")
        print(f"解析失败行: {len(self.result.bad_rows)}")
        print(f"\n录音文件总数: {self.result.recordings_found}")
        print(f"成功匹配工单: {self.result.tickets_with_recording}")
        print(f"未匹配录音: {self.result.recordings_unmatched}")
        print(f"\n无录音工单: {self.result.tickets_without_recording}")
        print(f"时长不匹配: {self.result.duration_mismatches}")
        print(f"\n抽样数量: {len(self.result.sampled_tickets)}")
        print("\n缺失原因分布:")
        for reason, count in sorted(self.result.missing_categories.items()):
            print(f"  - {reason}: {count}")
        print("="*60 + "\n")

    def export_machine_readable(self) -> str:
        output_file = self.output_dir / "audit_result.json"
        
        data = {
            "summary": {
                "total_tickets": self.result.total_tickets,
                "valid_tickets": self.result.valid_tickets,
                "tickets_with_recording": self.result.tickets_with_recording,
                "tickets_without_recording": self.result.tickets_without_recording,
                "recordings_found": self.result.recordings_found,
                "recordings_unmatched": self.result.recordings_unmatched,
                "duration_mismatches": self.result.duration_mismatches,
                "sample_count": len(self.result.sampled_tickets),
                "missing_categories": self.result.missing_categories
            },
            "bad_rows": [
                {
                    "row_number": t.row_number,
                    "error": t.parse_error,
                    "original_data": t.original_data
                }
                for t in self.result.bad_rows
            ],
            "sampled_tickets": [
                {
                    "row_number": t.row_number,
                    "ticket_id": t.ticket_id,
                    "agent_id": t.agent_id,
                    "duration_seconds": t.duration_seconds,
                    "recording_file": t.recording_file
                }
                for t in self.result.sampled_tickets
            ],
            "unmatched_recordings": [
                {
                    "file_path": r.file_path,
                    "parsed_ticket_id": r.parsed_ticket_id,
                    "parsed_agent_id": r.parsed_agent_id
                }
                for r in self.result.unmatched_recordings
            ]
        }
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        return str(output_file)

    def export_report(self) -> str:
        output_file = self.output_dir / "抽检报告.md"
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write("# 工单录音抽检报告\n\n")
            f.write(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
            
            f.write("## 一、执行摘要\n\n")
            f.write(f"- 总工单数量: **{self.result.total_tickets}**\n")
            f.write(f"- 有效工单: **{self.result.valid_tickets}**\n")
            f.write(f"- 解析失败行: **{len(self.result.bad_rows)}**\n")
            f.write(f"- 录音文件总数: **{self.result.recordings_found}**\n")
            f.write(f"- 成功匹配工单: **{self.result.tickets_with_recording}**\n")
            f.write(f"- 未匹配录音: **{self.result.recordings_unmatched}**\n")
            f.write(f"- 无录音工单: **{self.result.tickets_without_recording}**\n")
            f.write(f"- 时长不匹配: **{self.result.duration_mismatches}**\n\n")
            
            f.write("## 二、缺失原因分布\n\n")
            f.write("| 缺失原因 | 数量 |\n")
            f.write("|----------|------|\n")
            for reason, count in sorted(self.result.missing_categories.items()):
                f.write(f"| {reason} | {count} |\n")
            f.write("\n")
            
            f.write("## 三、抽样清单\n\n")
            if self.result.sampled_tickets:
                f.write("| 行号 | 工单号 | 坐席编号 | 通话时长(秒) | 录音文件 |\n")
                f.write("|------|--------|----------|--------------|----------|\n")
                for t in self.result.sampled_tickets:
                    duration = t.duration_seconds if t.duration_seconds else '-'
                    filename = Path(t.recording_file).name if t.recording_file else '-'
                    f.write(f"| {t.row_number} | {t.ticket_id} | {t.agent_id} | {duration} | {filename} |\n")
            else:
                f.write("*无符合条件的抽样工单*\n")
            f.write("\n")
            
            f.write("## 四、异常记录\n\n")
            f.write("### 解析失败行（保留原始位置）\n\n")
            if self.result.bad_rows:
                f.write("| 原始行号 | 错误信息 | 原始数据 |\n")
                f.write("|----------|----------|----------|\n")
                for t in self.result.bad_rows:
                    original = ' | '.join(t.original_data)
                    f.write(f"| {t.row_number} | {t.parse_error} | {original} |\n")
            else:
                f.write("*无解析失败行*\n")
            f.write("\n")
            
            f.write("### 未匹配的录音文件\n\n")
            if self.result.unmatched_recordings:
                f.write("| 文件名 | 解析出的工单号 | 解析出的坐席号 |\n")
                f.write("|--------|----------------|----------------|\n")
                for r in self.result.unmatched_recordings:
                    tid = r.parsed_ticket_id if r.parsed_ticket_id else '-'
                    aid = r.parsed_agent_id if r.parsed_agent_id else '-'
                    f.write(f"| {r.file_name} | {tid} | {aid} |\n")
            else:
                f.write("*所有录音均已匹配*\n")
        
        return str(output_file)

    def export_sampling_list(self) -> str:
        output_file = self.output_dir / "抽样清单.csv"
        
        with open(output_file, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['原始行号', '工单号', '坐席编号', '通话时长(秒)', '录音文件路径', '抽检状态'])
            for t in self.result.sampled_tickets:
                writer.writerow([
                    t.row_number,
                    t.ticket_id,
                    t.agent_id,
                    t.duration_seconds if t.duration_seconds else '',
                    t.recording_file,
                    '待抽检'
                ])
        
        return str(output_file)

    def run(self) -> int:
        self.ensure_output_dir()
        
        self.scan_recordings()
        self.parse_ticket_table()
        self.match_recordings()
        self.sample_tickets()
        
        self.print_summary()
        
        json_path = self.export_machine_readable()
        report_path = self.export_report()
        sample_path = self.export_sampling_list()
        
        print(f"\n输出文件:")
        print(f"  - 机器可读结果: {json_path}")
        print(f"  - 抽检报告: {report_path}")
        print(f"  - 抽样清单: {sample_path}\n")
        
        return 0


def run_self_test() -> int:
    print("\n" + "="*60)
    print("自检模式 - 生成测试数据并执行抽检")
    print("="*60 + "\n")
    
    test_dir = Path("test_data")
    test_dir.mkdir(exist_ok=True)
    
    recordings_dir = test_dir / "recordings"
    recordings_dir.mkdir(exist_ok=True)
    
    test_recordings = [
        "T20240100001_A1001_180s.wav",
        "T20240100002_A1002_245s.mp3",
        "T20240100003_A1001_95s.wav",
        "T20240100004_A9999_300s.m4a",
        "ticket-20240100005-agent-1003_60s.wav",
        "T20240100010_A1006_180s.wav",
        "UNKNOWN_001.wav",
    ]
    
    for fname in test_recordings:
        (recordings_dir / fname).touch()
    
    ticket_csv = test_dir / "tickets.csv"
    with open(ticket_csv, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['工单号', '坐席编号', '通话时长'])
        writer.writerow(['20240100001', 'A1001', '3:00'])
        writer.writerow(['20240100002', 'A1002', '4:05'])
        writer.writerow(['20240100003', 'A1001', '01:35'])
        writer.writerow(['20240100004', 'A1002', '5:00'])
        writer.writerow(['20240100005', 'A1003', '60秒'])
        writer.writerow(['20240100006', 'A1001', '0:05'])
        writer.writerow(['20240100010', 'A1006', '3:10'])
        writer.writerow(['', 'A1004', '2:30'])
        writer.writerow(['20240100008', '', '3:15'])
        writer.writerow(['20240100009', 'A1005', '无效时长'])
    
    output_dir = test_dir / "output"
    
    auditor = RecordingAuditor(
        recording_dir=str(recordings_dir),
        ticket_file=str(ticket_csv),
        output_dir=str(output_dir),
        sample_size=3,
        min_duration=10,
        duration_tolerance=5
    )
    
    errors = auditor.validate_inputs()
    if errors:
        print("输入校验失败:")
        for e in errors:
            print(f"  - {e}")
        return 1
    
    result = auditor.run()
    
    print("\n" + "="*60)
    print("边界条件验证:")
    print("="*60)
    
    rec1 = next((r for r in auditor.recordings if 'T20240100001' in r.file_name), None)
    rec10 = next((r for r in auditor.recordings if 'T20240100010' in r.file_name), None)
    
    test_cases = [
        ("文件扫描", auditor.result.recordings_found == len(test_recordings), f"找到{auditor.result.recordings_found}个录音"),
        ("工单号解析", any(r.parsed_ticket_id == '20240100005' for r in auditor.recordings), "支持多种命名格式"),
        ("录音时长解析", rec1 and rec1.duration_seconds == 180, f"正确解析文件名时长: T20240100001={rec1.duration_seconds if rec1 else 'None'}s"),
        ("坐席编号解析带A前缀", rec1 and rec1.parsed_agent_id == 'A1001', f"保留坐席编号前缀: {rec1.parsed_agent_id if rec1 else 'None'}"),
        ("坐席匹配正确", '20240100001' not in [t.ticket_id for t in auditor.tickets if t.missing_reason == '坐席编号不匹配'], "相同坐席不被误判"),
        ("坐席不匹配检测", "坐席编号不匹配" in auditor.result.missing_categories, "正确检测坐席差异(工单A1002 vs 录音A9999)"),
        ("时长差异检测", auditor.result.duration_mismatches >= 1, f"检测时长差异: {auditor.result.duration_mismatches}处(录音180s vs 工单190s)"),
        ("时长过短", "通话时长过短" in auditor.result.missing_categories, "过滤短通话"),
        ("坏行保留", len(auditor.result.bad_rows) >= 1, f"保留{len(auditor.result.bad_rows)}条异常行原始位置"),
        ("未匹配录音", auditor.result.recordings_unmatched >= 1, "记录无法匹配的录音"),
        ("抽样成功", len(auditor.result.sampled_tickets) == 3, "随机抽样功能正常"),
    ]
    
    all_passed = True
    for name, passed, desc in test_cases:
        status = "✓ PASS" if passed else "✗ FAIL"
        if not passed:
            all_passed = False
        print(f"{status} {name}: {desc}")
    
    print("="*60)
    
    if all_passed:
        print("\n✓ 所有自检通过！工具功能正常。")
        print(f"\n测试数据位置: {test_dir.absolute()}")
        return 0
    else:
        print("\n✗ 部分自检失败，请检查实现。")
        return 1


def main():
    parser = argparse.ArgumentParser(
        description="工单录音抽检 CLI - 匹配录音文件与工单记录，生成抽检清单",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  %(prog)s --recordings ./recordings --tickets tickets.csv --output ./audit
  %(prog)s --recordings ./recordings --tickets tickets.csv --sample-size 50
  %(prog)s --self-test
        """
    )
    
    parser.add_argument(
        '--recordings', '-r',
        dest='recording_dir',
        help='录音文件目录路径'
    )
    
    parser.add_argument(
        '--tickets', '-t',
        dest='ticket_file',
        help='工单表CSV文件路径'
    )
    
    parser.add_argument(
        '--output', '-o',
        dest='output_dir',
        default='./audit_output',
        help='输出目录路径 (默认: ./audit_output)'
    )
    
    parser.add_argument(
        '--sample-size', '-n',
        type=int,
        default=20,
        help='抽样数量 (默认: 20)'
    )
    
    parser.add_argument(
        '--min-duration',
        type=int,
        default=10,
        help='最小通话时长(秒)，低于此时长标记为过短 (默认: 10)'
    )
    
    parser.add_argument(
        '--duration-tolerance',
        type=int,
        default=5,
        help='时长容差(秒)，差异超过此值标记为不匹配 (默认: 5)'
    )
    
    parser.add_argument(
        '--self-test',
        action='store_true',
        help='运行自检模式，生成测试数据并验证功能'
    )
    
    args = parser.parse_args()
    
    if args.self_test:
        sys.exit(run_self_test())
    
    if not args.recording_dir or not args.ticket_file:
        parser.print_help()
        print("\n错误: 正常模式下必须指定 --recordings 和 --tickets 参数")
        sys.exit(1)
    
    auditor = RecordingAuditor(
        recording_dir=args.recording_dir,
        ticket_file=args.ticket_file,
        output_dir=args.output_dir,
        sample_size=args.sample_size,
        min_duration=args.min_duration,
        duration_tolerance=args.duration_tolerance
    )
    
    errors = auditor.validate_inputs()
    if errors:
        print("输入校验失败:")
        for e in errors:
            print(f"  - {e}")
        sys.exit(1)
    
    sys.exit(auditor.run())


if __name__ == '__main__':
    main()

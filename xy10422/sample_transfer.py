#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import json
import csv
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
from enum import Enum

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import box

console = Console()

DATA_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sample_data.json')
MAX_DELIVERY_HOURS = 2

class SampleStatus(Enum):
    IMPORTED = "已导入"
    COLLECTED = "已采集"
    TRANSFERRED = "已交接"
    RECEIVED = "已接收"
    ABNORMAL = "异常"

class AbnormalType(Enum):
    WRONG_TUBE = "错管"
    DAMAGED = "破损"
    TIMEOUT = "超时"
    PENDING_REVIEW = "待复核"

class Sample:
    def __init__(self, sample_id: str, patient_name: str, patient_id: str, 
                 test_item: str, is_supplement: bool = False):
        self.id = sample_id
        self.patient_name = patient_name
        self.patient_id = patient_id
        self.test_item = test_item
        self.status = SampleStatus.IMPORTED.value
        self.is_supplement = is_supplement
        
        self.collected_at: Optional[str] = None
        self.collected_by: Optional[str] = None
        
        self.transferred_at: Optional[str] = None
        self.courier: Optional[str] = None
        
        self.received_at: Optional[str] = None
        self.received_by: Optional[str] = None
        
        self.abnormal_type: Optional[str] = None
        self.abnormal_note: Optional[str] = None
        self.abnormal_at: Optional[str] = None
        
        self.history: List[Dict[str, Any]] = []
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "patient_name": self.patient_name,
            "patient_id": self.patient_id,
            "test_item": self.test_item,
            "status": self.status,
            "is_supplement": self.is_supplement,
            "collected_at": self.collected_at,
            "collected_by": self.collected_by,
            "transferred_at": self.transferred_at,
            "courier": self.courier,
            "received_at": self.received_at,
            "received_by": self.received_by,
            "abnormal_type": self.abnormal_type,
            "abnormal_note": self.abnormal_note,
            "abnormal_at": self.abnormal_at,
            "history": self.history
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Sample':
        sample = cls(
            sample_id=data["id"],
            patient_name=data["patient_name"],
            patient_id=data["patient_id"],
            test_item=data["test_item"],
            is_supplement=data.get("is_supplement", False)
        )
        sample.status = data["status"]
        sample.collected_at = data.get("collected_at")
        sample.collected_by = data.get("collected_by")
        sample.transferred_at = data.get("transferred_at")
        sample.courier = data.get("courier")
        sample.received_at = data.get("received_at")
        sample.received_by = data.get("received_by")
        sample.abnormal_type = data.get("abnormal_type")
        sample.abnormal_note = data.get("abnormal_note")
        sample.abnormal_at = data.get("abnormal_at")
        sample.history = data.get("history", [])
        return sample

class SampleManager:
    def __init__(self):
        self.samples: Dict[str, Sample] = {}
        self.load_data()
    
    def load_data(self):
        if os.path.exists(DATA_FILE):
            try:
                with open(DATA_FILE, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    for sample_id, sample_data in data.items():
                        self.samples[sample_id] = Sample.from_dict(sample_data)
            except Exception as e:
                console.print(f"[red]加载数据失败: {e}[/red]")
    
    def save_data(self):
        try:
            data = {sid: sample.to_dict() for sid, sample in self.samples.items()}
            with open(DATA_FILE, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            console.print(f"[red]保存数据失败: {e}[/red]")
    
    def add_sample(self, sample: Sample) -> bool:
        if sample.id in self.samples:
            return False
        self.samples[sample.id] = sample
        self.save_data()
        return True
    
    def get_sample(self, sample_id: str) -> Optional[Sample]:
        return self.samples.get(sample_id)
    
    def sample_exists(self, sample_id: str) -> bool:
        return sample_id in self.samples
    
    def can_collect(self, sample_id: str) -> tuple[bool, str]:
        sample = self.get_sample(sample_id)
        if not sample:
            return False, f"样本号 {sample_id} 不存在"
        if sample.status != SampleStatus.IMPORTED.value:
            return False, f"样本 {sample_id} 状态为 {sample.status}，无法再次采集"
        return True, ""
    
    def can_transfer(self, sample_id: str) -> tuple[bool, str]:
        sample = self.get_sample(sample_id)
        if not sample:
            return False, f"样本号 {sample_id} 不存在"
        if sample.status == SampleStatus.TRANSFERRED.value:
            return False, f"样本 {sample_id} 已交接，请勿重复交接"
        if sample.status == SampleStatus.RECEIVED.value:
            return False, f"样本 {sample_id} 已接收，无法再次交接"
        if sample.status != SampleStatus.COLLECTED.value:
            return False, f"样本 {sample_id} 状态为 {sample.status}，需先采集确认"
        return True, ""
    
    def can_receive(self, sample_id: str) -> tuple[bool, str]:
        sample = self.get_sample(sample_id)
        if not sample:
            return False, f"样本号 {sample_id} 不存在"
        if sample.status == SampleStatus.RECEIVED.value:
            return False, f"样本 {sample_id} 已接收，请勿重复接收"
        if sample.status != SampleStatus.TRANSFERRED.value:
            return False, f"样本 {sample_id} 状态为 {sample.status}，需先交接"
        return True, ""
    
    def check_timeout(self, sample: Sample, check_time: datetime = None) -> bool:
        if sample.collected_at is None:
            return False
        check_time = check_time or datetime.now()
        collected_time = datetime.fromisoformat(sample.collected_at)
        return (check_time - collected_time) > timedelta(hours=MAX_DELIVERY_HOURS)
    
    def mark_collected(self, sample_id: str, nurse: str) -> tuple[bool, str]:
        ok, msg = self.can_collect(sample_id)
        if not ok:
            return False, msg
        sample = self.samples[sample_id]
        now = datetime.now().isoformat()
        sample.collected_at = now
        sample.collected_by = nurse
        sample.status = SampleStatus.COLLECTED.value
        sample.history.append({
            "action": "采集确认",
            "time": now,
            "operator": nurse,
            "note": "护士采集确认"
        })
        self.save_data()
        return True, ""
    
    def mark_transferred(self, sample_id: str, courier: str) -> tuple[bool, str]:
        ok, msg = self.can_transfer(sample_id)
        if not ok:
            return False, msg
        sample = self.samples[sample_id]
        now = datetime.now().isoformat()
        
        if self.check_timeout(sample):
            sample.status = SampleStatus.ABNORMAL.value
            sample.abnormal_type = AbnormalType.TIMEOUT.value
            sample.abnormal_at = now
            sample.abnormal_note = "交接时发现超时"
            sample.history.append({
                "action": "异常标记",
                "time": now,
                "operator": courier,
                "note": "交接时发现超时（超过2小时）"
            })
            self.save_data()
            return False, f"样本 {sample_id} 超时！已标记为异常"
        
        sample.transferred_at = now
        sample.courier = courier
        sample.status = SampleStatus.TRANSFERRED.value
        sample.history.append({
            "action": "交接",
            "time": now,
            "operator": courier,
            "note": "交接给运输员"
        })
        self.save_data()
        return True, ""
    
    def mark_received(self, sample_id: str, receiver: str) -> tuple[bool, str]:
        ok, msg = self.can_receive(sample_id)
        if not ok:
            return False, msg
        sample = self.samples[sample_id]
        now = datetime.now().isoformat()
        
        if self.check_timeout(sample):
            sample.status = SampleStatus.ABNORMAL.value
            sample.abnormal_type = AbnormalType.TIMEOUT.value
            sample.abnormal_at = now
            sample.abnormal_note = "接收时发现超时"
            sample.history.append({
                "action": "异常标记",
                "time": now,
                "operator": receiver,
                "note": "接收时发现超时（超过2小时）"
            })
            self.save_data()
            return False, f"样本 {sample_id} 超时！已标记为异常"
        
        sample.received_at = now
        sample.received_by = receiver
        sample.status = SampleStatus.RECEIVED.value
        sample.history.append({
            "action": "接收",
            "time": now,
            "operator": receiver,
            "note": "实验室接收"
        })
        self.save_data()
        return True, ""
    
    def mark_abnormal(self, sample_id: str, abnormal_type: str, note: str, operator: str) -> tuple[bool, str]:
        sample = self.get_sample(sample_id)
        if not sample:
            return False, f"样本号 {sample_id} 不存在"
        now = datetime.now().isoformat()
        sample.status = SampleStatus.ABNORMAL.value
        sample.abnormal_type = abnormal_type
        sample.abnormal_note = note
        sample.abnormal_at = now
        sample.history.append({
            "action": "异常补录",
            "time": now,
            "operator": operator,
            "note": f"异常类型: {abnormal_type}, 备注: {note}"
        })
        self.save_data()
        return True, ""
    
    def get_statistics(self) -> Dict[str, int]:
        stats = {status.value: 0 for status in SampleStatus}
        stats["总数"] = len(self.samples)
        for sample in self.samples.values():
            if sample.status in stats:
                stats[sample.status] += 1
        return stats
    
    def get_samples_by_status(self, status: str) -> List[Sample]:
        return [s for s in self.samples.values() if s.status == status]
    
    def get_missing_samples(self) -> List[Sample]:
        return [s for s in self.samples.values() 
                if not s.is_supplement and s.status in [SampleStatus.IMPORTED.value, SampleStatus.COLLECTED.value, SampleStatus.TRANSFERRED.value]]
    
    def get_abnormal_samples(self) -> List[Sample]:
        return [s for s in self.samples.values() if s.status == SampleStatus.ABNORMAL.value]

manager = SampleManager()

def print_stats(title: str):
    stats = manager.get_statistics()
    table = Table(title=f"📊 {title}", box=box.ROUNDED)
    table.add_column("状态", style="cyan")
    table.add_column("数量", style="yellow", justify="center")
    
    for status in SampleStatus:
        table.add_row(status.value, str(stats.get(status.value, 0)))
    
    table.add_row("─" * 15, "─" * 5, style="dim")
    table.add_row("[bold]总数[/bold]", f"[bold]{stats['总数']}[/bold]")
    console.print(table)

def print_sample_details(sample: Sample):
    table = Table(title=f"📦 样本详情: {sample.id}", box=box.ROUNDED)
    table.add_column("字段", style="cyan")
    table.add_column("值", style="white")
    
    table.add_row("样本号", sample.id)
    table.add_row("患者姓名", sample.patient_name)
    table.add_row("患者ID", sample.patient_id)
    table.add_row("检验项目", sample.test_item)
    table.add_row("当前状态", sample.status)
    table.add_row("是否补录", "是" if sample.is_supplement else "否")
    
    if sample.collected_at:
        table.add_row("采集时间", sample.collected_at)
        table.add_row("采集护士", sample.collected_by or "-")
    if sample.transferred_at:
        table.add_row("交接时间", sample.transferred_at)
        table.add_row("运输员", sample.courier or "-")
    if sample.received_at:
        table.add_row("接收时间", sample.received_at)
        table.add_row("接收人", sample.received_by or "-")
    if sample.abnormal_type:
        table.add_row("异常类型", sample.abnormal_type)
        table.add_row("异常备注", sample.abnormal_note or "-")
        table.add_row("异常标记时间", sample.abnormal_at or "-")
    
    console.print(table)

@click.group()
@click.version_option(version='1.0.0', prog_name='门诊检验样本交接CLI')
def cli():
    """🏥 门诊检验样本交接管理系统
    
    支持: 导入清单、采集确认、交接运输、实验室接收、异常补录、生成报告
    """
    pass

@cli.command('import')
@click.argument('file_path', type=click.Path(exists=True))
def import_samples(file_path):
    """📥 导入采集清单 (CSV格式: sample_id,patient_name,patient_id,test_item)
    
    示例: python sample_transfer.py import samples.csv
    """
    count = 0
    skipped = 0
    
    try:
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            required_fields = ['sample_id', 'patient_name', 'patient_id', 'test_item']
            
            for field in required_fields:
                if field not in reader.fieldnames:
                    console.print(f"[red]CSV缺少必需字段: {field}[/red]")
                    return
            
            for row in reader:
                sample = Sample(
                    sample_id=row['sample_id'],
                    patient_name=row['patient_name'],
                    patient_id=row['patient_id'],
                    test_item=row['test_item']
                )
                if manager.add_sample(sample):
                    count += 1
                else:
                    skipped += 1
    except Exception as e:
        console.print(f"[red]导入失败: {e}[/red]")
        return
    
    console.print(Panel.fit(
        f"[green]✓ 成功导入 {count} 个样本[/green]\n"
        f"[yellow]⚠ 跳过 {skipped} 个已存在样本[/yellow]",
        title="📥 导入结果",
        border_style="green"
    ))
    print_stats("导入后统计")

@cli.command('collect')
@click.argument('sample_ids', nargs=-1, required=True)
@click.option('--nurse', '-n', required=True, help='采集护士姓名')
def collect(sample_ids, nurse):
    """✅ 采集确认
    
    示例: python sample_transfer.py collect S001 S002 --nurse "张护士"
    """
    success = 0
    failed = 0
    
    console.print(f"\n[bold cyan]👩‍⚕️ 护士 {nurse} 正在采集确认...[/bold cyan]")
    
    for sid in sample_ids:
        ok, msg = manager.mark_collected(sid, nurse)
        if ok:
            console.print(f"  [green]✓ 样本 {sid} 采集确认[/green]")
            success += 1
        else:
            console.print(f"  [red]✗ 样本 {sid}: {msg}[/red]")
            failed += 1
    
    console.print(Panel.fit(
        f"[green]✓ 成功采集 {success} 个[/green]\n"
        f"[red]✗ 失败 {failed} 个[/red]",
        title="✅ 采集确认结果",
        border_style="cyan"
    ))
    print_stats("采集后统计")

@cli.command('transfer')
@click.argument('sample_ids', nargs=-1, required=True)
@click.option('--courier', '-c', required=True, help='运输员姓名')
def transfer(sample_ids, courier):
    """🚚 交接给运输员
    
    示例: python sample_transfer.py transfer S001 S002 --courier "李运输"
    """
    success = 0
    failed = 0
    timeout = 0
    
    console.print(f"\n[bold yellow]🚚 运输员 {courier} 正在交接...[/bold yellow]")
    
    for sid in sample_ids:
        ok, msg = manager.mark_transferred(sid, courier)
        if ok:
            console.print(f"  [green]✓ 样本 {sid} 交接成功[/green]")
            success += 1
        else:
            if "超时" in msg:
                console.print(f"  [red]⏱ 样本 {sid}: {msg}[/red]")
                timeout += 1
            else:
                console.print(f"  [red]✗ 样本 {sid}: {msg}[/red]")
            failed += 1
    
    console.print(Panel.fit(
        f"[green]✓ 成功交接 {success} 个[/green]\n"
        f"[yellow]⏱ 超时样本 {timeout} 个（已标记异常）[/yellow]\n"
        f"[red]✗ 失败 {failed} 个[/red]",
        title="🚚 交接结果",
        border_style="yellow"
    ))
    print_stats("交接后统计")

@cli.command('receive')
@click.argument('sample_ids', nargs=-1, required=True)
@click.option('--receiver', '-r', required=True, help='接收人姓名')
def receive(sample_ids, receiver):
    """🧪 实验室接收
    
    示例: python sample_transfer.py receive S001 S002 --receiver "王检验"
    """
    success = 0
    failed = 0
    timeout = 0
    
    console.print(f"\n[bold magenta]🧪 检验师 {receiver} 正在接收...[/bold magenta]")
    
    for sid in sample_ids:
        ok, msg = manager.mark_received(sid, receiver)
        if ok:
            console.print(f"  [green]✓ 样本 {sid} 接收成功[/green]")
            success += 1
        else:
            if "超时" in msg:
                console.print(f"  [red]⏱ 样本 {sid}: {msg}[/red]")
                timeout += 1
            else:
                console.print(f"  [red]✗ 样本 {sid}: {msg}[/red]")
            failed += 1
    
    console.print(Panel.fit(
        f"[green]✓ 成功接收 {success} 个[/green]\n"
        f"[yellow]⏱ 超时样本 {timeout} 个（已标记异常）[/yellow]\n"
        f"[red]✗ 失败 {failed} 个[/red]",
        title="🧪 接收结果",
        border_style="magenta"
    ))
    print_stats("接收后统计")

@cli.command('abnormal')
@click.argument('sample_id', required=True)
@click.option('--type', '-t', required=True, 
              type=click.Choice([t.value for t in AbnormalType], case_sensitive=False),
              help='异常类型')
@click.option('--note', '-n', default='', help='异常备注')
@click.option('--operator', '-o', required=True, help='操作员姓名')
def mark_abnormal(sample_id, type, note, operator):
    """⚠️ 异常补录
    
    异常类型: 错管, 破损, 超时, 待复核
    
    示例: python sample_transfer.py abnormal S005 -t 破损 -n "管帽脱落" -o "赵护士"
    """
    ok, msg = manager.mark_abnormal(sample_id, type, note, operator)
    
    if ok:
        sample = manager.get_sample(sample_id)
        console.print(Panel.fit(
            f"[yellow]⚠ 样本 {sample_id} 已标记为异常[/yellow]\n"
            f"  异常类型: {type}\n"
            f"  备注: {note or '无'}\n"
            f"  操作员: {operator}",
            title="⚠️ 异常补录",
            border_style="yellow"
        ))
        print_sample_details(sample)
    else:
        console.print(f"[red]✗ {msg}[/red]")

@cli.command('status')
@click.argument('sample_id', required=False)
def show_status(sample_id):
    """📊 查看状态
    
    示例: 
      python sample_transfer.py status          # 查看所有统计
      python sample_transfer.py status S001     # 查看单个样本
    """
    if sample_id:
        sample = manager.get_sample(sample_id)
        if sample:
            print_sample_details(sample)
            
            if sample.history:
                console.print("\n[bold]📜 操作历史:[/bold]")
                for i, record in enumerate(sample.history, 1):
                    console.print(f"  {i}. [{record.get('time', '-')}] {record.get('action', '-')} - {record.get('operator', '-')}")
                    if record.get('note'):
                        console.print(f"     {record['note']}")
        else:
            console.print(f"[red]样本 {sample_id} 不存在[/red]")
    else:
        print_stats("当前统计")
        
        missing = manager.get_missing_samples()
        abnormal = manager.get_abnormal_samples()
        
        if missing:
            table = Table(title="⚠️ 未完成流程样本（疑似漏交）", box=box.ROUNDED)
            table.add_column("样本号", style="cyan")
            table.add_column("患者", style="white")
            table.add_column("项目", style="green")
            table.add_column("当前状态", style="yellow")
            for s in missing:
                table.add_row(s.id, s.patient_name, s.test_item, s.status)
            console.print(table)
        
        if abnormal:
            table = Table(title="🚨 异常样本", box=box.ROUNDED)
            table.add_column("样本号", style="cyan")
            table.add_column("患者", style="white")
            table.add_column("异常类型", style="red")
            table.add_column("备注", style="yellow")
            for s in abnormal:
                table.add_row(s.id, s.patient_name, s.abnormal_type or "-", s.abnormal_note or "-")
            console.print(table)

@cli.command('list')
@click.option('--status', '-s', type=click.Choice([t.value for t in SampleStatus], case_sensitive=False),
              help='按状态筛选')
@click.option('--supplement/--no-supplement', default=None, help='仅显示补录/原始记录')
def list_samples(status, supplement):
    """📋 列出所有样本"""
    samples = list(manager.samples.values())
    
    if status:
        samples = [s for s in samples if s.status == status]
    
    if supplement is not None:
        samples = [s for s in samples if s.is_supplement == supplement]
    
    if not samples:
        console.print("[yellow]没有符合条件的样本[/yellow]")
        return
    
    table = Table(title=f"📋 样本列表 (共 {len(samples)} 个)", box=box.ROUNDED)
    table.add_column("样本号", style="cyan")
    table.add_column("患者", style="white")
    table.add_column("项目", style="green")
    table.add_column("状态", style="yellow")
    table.add_column("补录", style="magenta", justify="center")
    
    for s in samples:
        supplement_mark = "[magenta]补[/magenta]" if s.is_supplement else ""
        table.add_row(s.id, s.patient_name, s.test_item, s.status, supplement_mark)
    
    console.print(table)

@cli.command('report')
@click.option('--output', '-o', default=None, help='输出报告文件路径 (JSON)')
def generate_report(output):
    """📄 生成交接报告"""
    stats = manager.get_statistics()
    missing = manager.get_missing_samples()
    abnormal = manager.get_abnormal_samples()
    
    original_samples = [s for s in manager.samples.values() if not s.is_supplement]
    supplement_samples = [s for s in manager.samples.values() if s.is_supplement]
    
    console.print("\n" + "=" * 60)
    console.print("[bold cyan]📄 门诊检验样本交接报告[/bold cyan]")
    console.print(f"[dim]生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}[/dim]")
    console.print("=" * 60)
    
    console.print("\n[bold]📊 总体统计:[/bold]")
    for status in SampleStatus:
        console.print(f"  {status.value}: {stats.get(status.value, 0)}")
    console.print(f"  [bold]总数: {stats['总数']}[/bold]")
    
    console.print("\n[bold]📦 原始扫描记录 ({len(original_samples)} 个):[/bold]")
    if original_samples:
        orig_table = Table(box=box.SIMPLE, show_header=True)
        orig_table.add_column("样本号", style="cyan")
        orig_table.add_column("患者", style="white")
        orig_table.add_column("项目", style="green")
        orig_table.add_column("状态", style="yellow")
        for s in original_samples:
            orig_table.add_row(s.id, s.patient_name, s.test_item, s.status)
        console.print(orig_table)
    else:
        console.print("  [dim]无原始记录[/dim]")
    
    console.print("\n[bold]➕ 补录记录 ({len(supplement_samples)} 个):[/bold]")
    if supplement_samples:
        sup_table = Table(box=box.SIMPLE, show_header=True)
        sup_table.add_column("样本号", style="magenta")
        sup_table.add_column("患者", style="white")
        sup_table.add_column("项目", style="green")
        sup_table.add_column("状态", style="yellow")
        sup_table.add_column("异常类型", style="red")
        for s in supplement_samples:
            sup_table.add_row(s.id, s.patient_name, s.test_item, s.status, s.abnormal_type or "-")
        console.print(sup_table)
    else:
        console.print("  [dim]无补录记录[/dim]")
    
    console.print("\n[bold]⚠️ 未完成流程（疑似漏交）:[/bold]")
    if missing:
        miss_table = Table(box=box.SIMPLE, show_header=True)
        miss_table.add_column("样本号", style="cyan")
        miss_table.add_column("患者", style="white")
        miss_table.add_column("项目", style="green")
        miss_table.add_column("当前状态", style="yellow")
        for s in missing:
            miss_table.add_row(s.id, s.patient_name, s.test_item, s.status)
        console.print(miss_table)
    else:
        console.print("  [green]✓ 全部完成[/green]")
    
    console.print("\n[bold]🚨 异常样本:[/bold]")
    if abnormal:
        abn_table = Table(box=box.SIMPLE, show_header=True)
        abn_table.add_column("样本号", style="cyan")
        abn_table.add_column("患者", style="white")
        abn_table.add_column("异常类型", style="red")
        abn_table.add_column("备注", style="yellow")
        for s in abnormal:
            abn_table.add_row(s.id, s.patient_name, s.abnormal_type or "-", s.abnormal_note or "-")
        console.print(abn_table)
    else:
        console.print("  [green]✓ 无异常[/green]")
    
    console.print("\n" + "=" * 60)
    
    if output:
        report_data = {
            "generated_at": datetime.now().isoformat(),
            "statistics": stats,
            "original_samples": [s.to_dict() for s in original_samples],
            "supplement_samples": [s.to_dict() for s in supplement_samples],
            "missing_samples": [s.to_dict() for s in missing],
            "abnormal_samples": [s.to_dict() for s in abnormal]
        }
        with open(output, 'w', encoding='utf-8') as f:
            json.dump(report_data, f, ensure_ascii=False, indent=2)
        console.print(f"[green]✓ 报告已保存到: {output}[/green]")

@cli.command('supplement')
@click.argument('sample_id', required=True)
@click.option('--patient-name', '-p', required=True, help='患者姓名')
@click.option('--patient-id', '-i', required=True, help='患者ID')
@click.option('--test-item', '-t', required=True, help='检验项目')
@click.option('--type', '-a', required=True,
              type=click.Choice([t.value for t in AbnormalType], case_sensitive=False),
              help='异常类型')
@click.option('--note', '-n', default='', help='备注')
@click.option('--operator', '-o', required=True, help='操作员')
def add_supplement(sample_id, patient_name, patient_id, test_item, type, note, operator):
    """➕ 异常补录（新增样本记录）
    
    用于发现漏交样本时补录记录
    
    示例: python sample_transfer.py supplement S008 -p "钱七" -i P008 -t "肝功能" -a 待复核 -n "监控发现漏交" -o "孙护士长"
    """
    sample = Sample(
        sample_id=sample_id,
        patient_name=patient_name,
        patient_id=patient_id,
        test_item=test_item,
        is_supplement=True
    )
    
    if manager.add_sample(sample):
        manager.mark_abnormal(sample_id, type, f"[补录] {note}", operator)
        console.print(Panel.fit(
            f"[magenta]➕ 补录记录已添加[/magenta]\n"
            f"  样本号: {sample_id}\n"
            f"  患者: {patient_name} ({patient_id})\n"
            f"  项目: {test_item}\n"
            f"  异常类型: {type}\n"
            f"  备注: {note or '无'}\n"
            f"  操作员: {operator}",
            title="➕ 异常补录",
            border_style="magenta"
        ))
        print_stats("补录后统计")
    else:
        console.print(f"[red]✗ 样本 {sample_id} 已存在[/red]")

@cli.command('clear')
@click.confirmation_option(prompt='确定要清空所有数据吗？')
def clear_data():
    """🗑️ 清空所有数据"""
    global manager
    if os.path.exists(DATA_FILE):
        os.remove(DATA_FILE)
    manager = SampleManager()
    console.print("[green]✓ 数据已清空[/green]")

@cli.command('demo')
def run_demo():
    """🎬 运行演示 - 展示完整流程"""
    import tempfile
    import os
    
    console.print(Panel.fit(
        "[bold cyan]🎬 门诊检验样本交接系统演示[/bold cyan]\n"
        "本演示将展示: 正常样本、漏交样本、重复扫描、超时样本",
        border_style="cyan"
    ))
    
    if os.path.exists(DATA_FILE):
        os.remove(DATA_FILE)
    
    global manager
    manager = SampleManager()
    
    console.print("\n" + "="*60)
    console.print("[bold]步骤 1: 导入采集清单[/bold]")
    console.print("="*60)
    
    demo_samples = [
        Sample("S001", "张三", "P001", "血常规"),
        Sample("S002", "李四", "P002", "生化全项"),
        Sample("S003", "王五", "P003", "肝功能"),
        Sample("S004", "赵六", "P004", "尿常规"),
        Sample("S005", "钱七", "P005", "血糖"),
    ]
    
    for s in demo_samples:
        manager.add_sample(s)
    
    console.print("[green]✓ 导入 5 个样本:[/green]")
    console.print("  S001: 张三 - 血常规")
    console.print("  S002: 李四 - 生化全项")
    console.print("  S003: 王五 - 肝功能")
    console.print("  S004: 赵六 - 尿常规")
    console.print("  S005: 钱七 - 血糖")
    
    print_stats("导入后")
    
    console.print("\n" + "="*60)
    console.print("[bold]步骤 2: 采集确认（护士采集）[/bold]")
    console.print("="*60)
    
    console.print("[cyan]👩‍⚕️ 护士张姐采集: S001, S002, S003, S004[/cyan]")
    for sid in ["S001", "S002", "S003", "S004"]:
        manager.mark_collected(sid, "张姐")
        console.print(f"  [green]✓ {sid} 采集确认[/green]")
    
    console.print("\n[yellow]⚠ 注意: S005 未采集（疑似漏采）[/yellow]")
    
    print_stats("采集后")
    
    console.print("\n" + "="*60)
    console.print("[bold]步骤 3: 交接给运输员[/bold]")
    console.print("="*60)
    
    console.print("[yellow]🚚 运输员小李交接: S001, S002, S003[/yellow]")
    for sid in ["S001", "S002", "S003"]:
        manager.mark_transferred(sid, "小李")
        console.print(f"  [green]✓ {sid} 交接成功[/green]")
    
    console.print("\n[yellow]⚠ 注意: S004 未交接（疑似漏交）[/yellow]")
    
    console.print("\n[red]🔁 尝试重复交接 S001:[/red]")
    ok, msg = manager.mark_transferred("S001", "小李")
    console.print(f"  [red]✗ {msg}[/red]")
    
    print_stats("交接后")
    
    console.print("\n" + "="*60)
    console.print("[bold]步骤 4: 实验室接收[/bold]")
    console.print("="*60)
    
    console.print("[magenta]🧪 检验师老王接收: S001, S002[/magenta]")
    for sid in ["S001", "S002"]:
        manager.mark_received(sid, "老王")
        console.print(f"  [green]✓ {sid} 接收成功[/green]")
    
    console.print("\n[yellow]⚠ 注意: S003 未接收（运输途中？）[/yellow]")
    
    console.print("\n[red]🔁 尝试重复接收 S001:[/red]")
    ok, msg = manager.mark_received("S001", "老王")
    console.print(f"  [red]✗ {msg}[/red]")
    
    print_stats("接收后")
    
    console.print("\n" + "="*60)
    console.print("[bold]步骤 5: 模拟超时样本[/bold]")
    console.print("="*60)
    
    sample_s003 = manager.get_sample("S003")
    if sample_s003:
        old_time = (datetime.now() - timedelta(hours=3)).isoformat()
        sample_s003.collected_at = old_time
        sample_s003.transferred_at = (datetime.now() - timedelta(hours=2, minutes=30)).isoformat()
        manager.save_data()
    
    console.print("[yellow]⏱ 模拟 S003 采集时间为 3 小时前[/yellow]")
    console.print("[magenta]🧪 尝试接收 S003:[/magenta]")
    ok, msg = manager.mark_received("S003", "老王")
    console.print(f"  [red]⏱ {msg}[/red]")
    
    print_stats("超时处理后")
    
    console.print("\n" + "="*60)
    console.print("[bold]步骤 6: 异常补录 - 发现漏交样本[/bold]")
    console.print("="*60)
    
    console.print("[magenta]➕ 翻监控发现 S006 漏交，补录记录:[/magenta]")
    supplement = Sample("S006", "孙八", "P006", "肾功能", is_supplement=True)
    manager.add_sample(supplement)
    manager.mark_abnormal("S006", "待复核", "监控发现漏采，患者已离开", "护士长")
    console.print("  [magenta]✓ S006: 孙八 - 肾功能 - 待复核[/magenta]")
    
    console.print("\n[magenta]➕ S004 管体破损，补录异常:[/magenta]")
    manager.mark_abnormal("S004", "破损", "接收时发现管体破损，样本溢出", "老王")
    console.print("  [red]✓ S004: 破损[/red]")
    
    print_stats("异常补录后")
    
    console.print("\n" + "="*60)
    console.print("[bold]步骤 7: 生成交接报告[/bold]")
    console.print("="*60)
    
    stats = manager.get_statistics()
    missing = manager.get_missing_samples()
    abnormal = manager.get_abnormal_samples()
    original = [s for s in manager.samples.values() if not s.is_supplement]
    supplement_samples = [s for s in manager.samples.values() if s.is_supplement]
    
    console.print("\n[bold]📦 原始扫描记录:[/bold]")
    for s in original:
        status_color = "green" if s.status == SampleStatus.RECEIVED.value else "yellow"
        console.print(f"  {s.id}: {s.patient_name} - {s.test_item} - [{status_color}]{s.status}[/{status_color}]")
    
    console.print("\n[bold]➕ 补录记录（分开显示）:[/bold]")
    for s in supplement_samples:
        console.print(f"  [magenta]{s.id}: {s.patient_name} - {s.test_item} - {s.abnormal_type}[/magenta]")
    
    console.print("\n[bold]⚠️ 疑似漏交样本:[/bold]")
    if missing:
        for s in missing:
            console.print(f"  [yellow]{s.id}: {s.patient_name} - 当前状态: {s.status}[/yellow]")
    else:
        console.print("  [green]✓ 无[/green]")
    
    console.print("\n[bold]🚨 异常样本汇总:[/bold]")
    for s in abnormal:
        console.print(f"  [red]{s.id}: {s.patient_name} - {s.abnormal_type} - {s.abnormal_note}[/red]")
    
    print_stats("最终统计")
    
    console.print("\n" + "="*60)
    console.print("[bold cyan]🎬 演示完成！[/bold cyan]")
    console.print("="*60)
    console.print("\n[dim]提示: 运行 'python sample_transfer.py report' 查看完整报告[/dim]")
    console.print("[dim]提示: 运行 'python sample_transfer.py list' 查看所有样本[/dim]")

if __name__ == '__main__':
    cli()

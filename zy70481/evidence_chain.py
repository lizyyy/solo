#!/usr/bin/env python3
import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from datetime import datetime
import json
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field
from enum import Enum
import os

console = Console()

class RecordType(str, Enum):
    NORMAL = "normal"
    ABNORMAL = "abnormal"
    MANUAL_CORRECTION = "manual_correction"

class SourceSystem(str, Enum):
    CUSTOMER_SERVICE = "customer_service"
    CLOUD_RESOURCE = "cloud_resource"
    VERSION_CONTROL = "version_control"
    APPROVAL_FLOW = "approval_flow"

class EvidenceRecord(BaseModel):
    record_id: str
    timestamp: datetime
    source_system: SourceSystem
    record_type: RecordType
    content: str
    operator: Optional[str] = None
    version_before: Optional[str] = None
    version_after: Optional[str] = None
    manual_remark: Optional[str] = None
    change_reason: Optional[str] = None

class WorkOrder(BaseModel):
    order_id: str
    title: str
    created_at: datetime
    status: str
    records: List[EvidenceRecord] = Field(default_factory=list)
    
    def add_record(self, record: EvidenceRecord):
        self.records.append(record)

class EvidenceChainTool:
    def __init__(self, data_dir: str = "./data"):
        self.data_dir = data_dir
        self.work_orders: Dict[str, WorkOrder] = {}
        os.makedirs(data_dir, exist_ok=True)
        self._load_data()
    
    def _load_data(self):
        work_order_file = os.path.join(self.data_dir, "work_orders.json")
        if os.path.exists(work_order_file):
            with open(work_order_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                for order_data in data:
                    records = [EvidenceRecord(**r) for r in order_data.pop('records', [])]
                    order = WorkOrder(**order_data)
                    order.records = records
                    self.work_orders[order.order_id] = order
    
    def _save_data(self):
        work_order_file = os.path.join(self.data_dir, "work_orders.json")
        data = []
        for order in self.work_orders.values():
            order_dict = order.model_dump()
            for r in order_dict['records']:
                r['timestamp'] = r['timestamp'].isoformat()
            order_dict['created_at'] = order_dict['created_at'].isoformat()
            data.append(order_dict)
        with open(work_order_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def create_work_order(self, order_id: str, title: str) -> WorkOrder:
        order = WorkOrder(
            order_id=order_id,
            title=title,
            created_at=datetime.now(),
            status="open"
        )
        self.work_orders[order_id] = order
        self._save_data()
        return order
    
    def add_evidence_record(self, order_id: str, record: EvidenceRecord):
        if order_id not in self.work_orders:
            raise ValueError(f"工单 {order_id} 不存在")
        self.work_orders[order_id].add_record(record)
        self._save_data()
    
    def query_work_order(self, order_id: str) -> Optional[WorkOrder]:
        return self.work_orders.get(order_id)
    
    def query_all_orders(self, status: Optional[str] = None) -> List[WorkOrder]:
        orders = list(self.work_orders.values())
        if status:
            orders = [o for o in orders if o.status == status]
        return orders
    
    def get_candidate_cleanup_list(self, days_old: int = 30) -> List[str]:
        cutoff = datetime.now().timestamp() - (days_old * 86400)
        candidates = []
        for order in self.work_orders.values():
            if order.created_at.timestamp() < cutoff:
                candidates.append(order.order_id)
        return candidates
    
    def batch_delete_orders(self, order_ids: List[str], preview: bool = True) -> Dict[str, Any]:
        result = {
            "preview": preview,
            "affected_count": len(order_ids),
            "orders": order_ids
        }
        if not preview:
            for order_id in order_ids:
                if order_id in self.work_orders:
                    del self.work_orders[order_id]
            self._save_data()
        return result

tool = EvidenceChainTool()

@click.group()
def cli():
    """证据链打包命令行工具"""
    pass

@cli.command()
@click.argument('order_id')
@click.argument('title')
def create_order(order_id, title):
    """创建新工单"""
    order = tool.create_work_order(order_id, title)
    console.print(f"[green]✓ 工单创建成功:[/green] {order.order_id} - {order.title}")

@cli.command()
@click.argument('order_id')
@click.argument('content')
@click.option('--source', '-s', default='customer_service', help='来源系统')
@click.option('--type', '-t', default='normal', help='记录类型')
@click.option('--operator', '-o', help='操作人')
@click.option('--version-before', help='变更前版本')
@click.option('--version-after', help='变更后版本')
@click.option('--remark', help='人工备注')
@click.option('--reason', help='变更理由')
def add_record(order_id, content, source, type, operator, version_before, version_after, remark, reason):
    """添加证据记录"""
    record = EvidenceRecord(
        record_id=f"REC{datetime.now().strftime('%Y%m%d%H%M%S')}",
        timestamp=datetime.now(),
        source_system=SourceSystem(source),
        record_type=RecordType(type),
        content=content,
        operator=operator,
        version_before=version_before,
        version_after=version_after,
        manual_remark=remark,
        change_reason=reason
    )
    tool.add_evidence_record(order_id, record)
    console.print(f"[green]✓ 记录添加成功[/green]")

@cli.command()
@click.argument('order_id', required=False)
@click.option('--status', help='按状态筛选')
@click.option('--show-abnormal/--no-show-abnormal', default=True, help='显示异常记录')
def query(order_id, status, show_abnormal):
    """查询工单和证据链"""
    if order_id:
        order = tool.query_work_order(order_id)
        if not order:
            console.print(f"[red]✗ 工单 {order_id} 不存在[/red]")
            return
        
        console.print(Panel(f"[bold blue]{order.order_id}[/bold blue] - {order.title}", 
                          subtitle=f"状态: {order.status} | 创建时间: {order.created_at.strftime('%Y-%m-%d %H:%M:%S')}"))
        
        table = Table(show_header=True, header_style="bold magenta")
        table.add_column("时间")
        table.add_column("来源系统")
        table.add_column("类型")
        table.add_column("内容")
        table.add_column("操作人")
        table.add_column("版本差异")
        table.add_column("备注/理由")
        
        for record in order.records:
            if not show_abnormal and record.record_type == RecordType.ABNORMAL:
                continue
                
            type_color = "green" if record.record_type == RecordType.NORMAL else "red" if record.record_type == RecordType.ABNORMAL else "yellow"
            
            version_diff = ""
            if record.version_before and record.version_after:
                version_diff = f"{record.version_before} → {record.version_after}"
            
            remark = record.manual_remark or record.change_reason or ""
            
            table.add_row(
                record.timestamp.strftime('%m-%d %H:%M'),
                record.source_system.value,
                f"[{type_color}]{record.record_type.value}[/{type_color}]",
                record.content,
                record.operator or "",
                version_diff,
                remark
            )
        
        console.print(table)
    else:
        orders = tool.query_all_orders(status)
        table = Table(show_header=True, header_style="bold magenta")
        table.add_column("工单ID")
        table.add_column("标题")
        table.add_column("状态")
        table.add_column("创建时间")
        table.add_column("记录数")
        
        for order in orders:
            table.add_row(
                order.order_id,
                order.title,
                order.status,
                order.created_at.strftime('%Y-%m-%d %H:%M'),
                str(len(order.records))
            )
        
        console.print(table)

@cli.command()
@click.option('--days', '-d', default=30, help='多少天以前的工单')
def cleanup_preview(days):
    """预览待清理的工单清单"""
    candidates = tool.get_candidate_cleanup_list(days)
    console.print(f"[yellow]⚠ 候选清理清单 ({len(candidates)} 个工单，超过 {days} 天):[/yellow]")
    for order_id in candidates:
        order = tool.query_work_order(order_id)
        console.print(f"  - {order_id}: {order.title} ({order.created_at.strftime('%Y-%m-%d')})")

@cli.command()
@click.argument('order_ids', nargs=-1)
@click.option('--preview/--no-preview', default=True, help='预览模式')
def batch_delete(order_ids, preview):
    """批量删除工单（默认预览模式）"""
    if not order_ids:
        console.print("[red]✗ 请指定要删除的工单ID[/red]")
        return
    
    result = tool.batch_delete_orders(list(order_ids), preview)
    
    if preview:
        console.print(f"[yellow]⚠ 预览模式 - 将删除以下 {result['affected_count']} 个工单:[/yellow]")
        for order_id in result['orders']:
            console.print(f"  - {order_id}")
        console.print("\n[yellow]确认删除请加上 --no-preview 参数[/yellow]")
    else:
        console.print(f"[green]✓ 已删除 {result['affected_count']} 个工单[/green]")

@cli.command()
def init_sample():
    """初始化样例数据 - 手写客服升级工单"""
    
    tool.create_work_order("CS-2024-001", "客服升级工单 - 服务版本不一致问题")
    
    records = [
        {
            "source": "customer_service",
            "type": "normal",
            "content": "用户提交升级申请，要求从标准版升级到企业版",
            "operator": "customer_001",
            "remark": None,
            "reason": None,
            "version_before": "v1.0-std",
            "version_after": None
        },
        {
            "source": "customer_service",
            "type": "normal", 
            "content": "客服人员审核用户资质通过",
            "operator": "agent_zhang",
            "remark": None,
            "reason": None,
            "version_before": None,
            "version_after": None
        },
        {
            "source": "version_control",
            "type": "abnormal",
            "content": "检测到服务版本不一致 - 生产环境版本与预发布版本不匹配",
            "operator": "system",
            "remark": None,
            "reason": None,
            "version_before": "v2.1.0-prod",
            "version_after": "v2.2.0-pre"
        },
        {
            "source": "approval_flow",
            "type": "manual_correction",
            "content": "人工修正：确认版本差异为预期的灰度发布，允许继续升级流程",
            "operator": "admin_li",
            "remark": "版本差异是因为灰度发布策略，生产环境正在逐步升级，不属于异常",
            "reason": None,
            "version_before": None,
            "version_after": None
        },
        {
            "source": "cloud_resource",
            "type": "normal",
            "content": "云资源申请单已批准",
            "operator": "cloud_admin",
            "remark": None,
            "reason": None,
            "version_before": None,
            "version_after": None
        },
        {
            "source": "cloud_resource",
            "type": "manual_correction",
            "content": "补充修改云资源申请单 - 增加CPU配额",
            "operator": "admin_wang",
            "remark": None,
            "reason": "用户业务量超出预期，原申请的4核CPU不足以支撑峰值流量，申请增加到8核",
            "version_before": "4CPU-16G",
            "version_after": "8CPU-32G"
        },
        {
            "source": "customer_service",
            "type": "normal",
            "content": "升级完成，通知用户",
            "operator": "agent_zhang",
            "remark": None,
            "reason": None,
            "version_before": None,
            "version_after": "v2.2.0-enterprise"
        }
    ]
    
    for i, r in enumerate(records):
        record = EvidenceRecord(
            record_id=f"REC-2024-00{i+1}",
            timestamp=datetime.now(),
            source_system=SourceSystem(r["source"]),
            record_type=RecordType(r["type"]),
            content=r["content"],
            operator=r["operator"],
            version_before=r["version_before"],
            version_after=r["version_after"],
            manual_remark=r["remark"],
            change_reason=r["reason"]
        )
        tool.add_evidence_record("CS-2024-001", record)
    
    console.print("[green]✓ 样例数据初始化完成[/green]")
    console.print("  工单ID: CS-2024-001")
    console.print("  包含: 正常记录、版本不一致异常、人工修正备注、云资源申请改动")

if __name__ == "__main__":
    cli()

import csv
from io import StringIO
from sqlalchemy.orm import Session
from models import Discrepancy, Order, CabinetEvent
from datetime import datetime


def export_discrepancies_csv(db: Session) -> str:
    output = StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        "discrepancy_id", "type", "order_id", "cabinet_id",
        "slot_id", "event_id", "description", "created_at"
    ])
    
    discrepancies = db.query(Discrepancy).order_by(Discrepancy.created_at).all()
    
    for d in discrepancies:
        writer.writerow([
            d.id, d.type, d.order_id, d.cabinet_id,
            d.slot_id, d.event_id, d.description, d.created_at.isoformat()
        ])
    
    return output.getvalue()


def export_reconciliation_markdown(db: Session, summary: dict) -> str:
    discrepancies = db.query(Discrepancy).order_by(Discrepancy.type, Discrepancy.created_at).all()
    
    md_content = f"# 共享充电宝对账报告\n\n"
    md_content += f"**生成时间**: {datetime.now().isoformat()}\n\n"
    
    md_content += "## 统计摘要\n\n"
    md_content += f"- 订单总数: {summary['total_orders']}\n"
    md_content += f"- 事件总数: {summary['total_events']}\n"
    md_content += f"- 差异总数: {summary['total_discrepancies']}\n\n"
    
    md_content += "### 差异分类\n\n"
    for dtype, count in summary['discrepancies_by_type'].items():
        md_content += f"- {dtype}: {count}\n"
    
    md_content += "\n---\n\n"
    md_content += "## 差异详情\n\n"
    
    current_type = None
    for d in discrepancies:
        if current_type != d.type:
            current_type = d.type
            md_content += f"### {current_type}\n\n"
        
        md_content += f"- **ID**: {d.id}\n"
        if d.order_id:
            md_content += f"  - 订单: {d.order_id}\n"
        md_content += f"  - 柜机: {d.cabinet_id}\n"
        if d.slot_id:
            md_content += f"  - 槽位: {d.slot_id}\n"
        if d.event_id:
            md_content += f"  - 事件: {d.event_id}\n"
        md_content += f"  - 描述: {d.description}\n"
        md_content += f"  - 发现时间: {d.created_at.isoformat()}\n\n"
    
    return md_content

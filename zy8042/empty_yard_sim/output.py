import csv
from datetime import datetime
from typing import List
from .models import Move, Risk, SimulationResult


def write_moves_csv(moves: List[Move], output_path: str):
    with open(output_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=[
            'move_id', 'from_yard', 'to_yard', 'container_type',
            'quantity', 'slot_id', 'time', 'reason'
        ])
        writer.writeheader()
        for m in moves:
            writer.writerow({
                'move_id': m.move_id,
                'from_yard': m.from_yard,
                'to_yard': m.to_yard,
                'container_type': m.container_type,
                'quantity': str(m.quantity),
                'slot_id': m.slot_id,
                'time': m.time.isoformat(),
                'reason': m.reason
            })


def write_summary_md(result: SimulationResult, output_path: str):
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("# 空箱调箱模拟结果摘要\n\n")
        
        f.write("## 调箱统计\n")
        f.write(f"- 总调箱次数: {len(result.moves)}\n")
        total_boxes = sum(m.quantity for m in result.moves)
        f.write(f"- 总调箱数: {total_boxes}\n\n")
        
        f.write("## 风险预警\n")
        if not result.risks:
            f.write("✅ 无风险\n\n")
        else:
            for r in result.risks:
                f.write(f"- **{r.risk_type.upper()}**: {r.description}\n")
            f.write("\n")
        
        f.write("## 最终库存\n")
        f.write("| 堆场 | 箱型 | 数量 |\n")
        f.write("|------|------|------|\n")
        for inv in result.final_inventory:
            f.write(f"| {inv.yard_id} | {inv.container_type} | {inv.quantity} |\n")

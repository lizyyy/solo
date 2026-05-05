import json
from typing import Dict, List, Any, Optional
from datetime import datetime
from sqlalchemy.orm import Session

from ..models.scheduling_batch import SchedulingBatch
from ..models.robot import Robot
from ..models.order import Order
from ..models.replay_frame import ReplayFrame
from ..models.collision_risk import CollisionRisk


class ReportExportService:
    def __init__(self, db: Session):
        self.db = db
    
    def generate_batch_report(
        self,
        batch_id: int,
        format: str = "markdown"
    ) -> str:
        batch = self.db.query(SchedulingBatch).filter(
            SchedulingBatch.id == batch_id
        ).first()
        
        if not batch:
            raise ValueError(f"Batch with id {batch_id} not found")
        
        metrics = json.loads(batch.metrics) if batch.metrics else {}
        
        robots = self.db.query(Robot).filter(
            Robot.warehouse_map_id == batch.warehouse_map_id
        ).all()
        
        orders = self.db.query(Order).filter(
            Order.warehouse_map_id == batch.warehouse_map_id
        ).all()
        
        frames_count = self.db.query(ReplayFrame).filter(
            ReplayFrame.batch_id == batch_id
        ).count()
        
        collision_risks = self.db.query(CollisionRisk).filter(
            CollisionRisk.batch_id == batch_id
        ).all()
        
        critical_risks = [r for r in collision_risks if r.risk_level.value == "critical"]
        high_risks = [r for r in collision_risks if r.risk_level.value == "high"]
        medium_risks = [r for r in collision_risks if r.risk_level.value == "medium"]
        
        if format == "json":
            return self._generate_json_report(
                batch, metrics, robots, orders, frames_count,
                collision_risks, critical_risks, high_risks, medium_risks
            )
        else:
            return self._generate_markdown_report(
                batch, metrics, robots, orders, frames_count,
                collision_risks, critical_risks, high_risks, medium_risks
            )
    
    def _generate_markdown_report(
        self,
        batch: SchedulingBatch,
        metrics: Dict,
        robots: List[Robot],
        orders: List[Order],
        frames_count: int,
        collision_risks: List[CollisionRisk],
        critical_risks: List,
        high_risks: List,
        medium_risks: List
    ) -> str:
        report = f"""# 调度批次报告

## 基本信息

| 项目 | 内容 |
|------|------|
| 批次ID | {batch.batch_id} |
| 批次名称 | {batch.name} |
| 调度算法 | {batch.algorithm.value} |
| 状态 | {batch.status.value} |
| 创建时间 | {batch.created_at.strftime('%Y-%m-%d %H:%M:%S') if batch.created_at else '-'} |
| 开始时间 | {batch.start_time.strftime('%Y-%m-%d %H:%M:%S') if batch.start_time else '-'} |
| 结束时间 | {batch.end_time.strftime('%Y-%m-%d %H:%M:%S') if batch.end_time else '-'} |

## 执行统计

| 指标 | 数值 |
|------|------|
| 参与机器人数量 | {batch.total_robots} |
| 总订单数量 | {batch.total_orders} |
| 总任务数量 | {batch.total_tasks} |
| 已完成订单 | {batch.completed_orders} |
| 已完成任务 | {batch.completed_tasks} |
| 回放帧数 | {frames_count} |
| 总行驶距离 | {metrics.get('total_distance', 0)}m |
| 平均电池消耗 | {metrics.get('avg_battery_usage', 0):.2f}% |

## 风险统计

| 风险等级 | 数量 |
|----------|------|
| 致命 (Critical) | {len(critical_risks)} |
| 高 (High) | {len(high_risks)} |
| 中 (Medium) | {len(medium_risks)} |
| **总计** | **{len(collision_risks)}** |

"""
        
        if collision_risks:
            report += """## 风险详情

"""
            for risk in collision_risks[:10]:
                report += f"""### 风险 ID: {risk.id}

- **风险类型**: {risk.risk_type.value}
- **风险等级**: {risk.risk_level.value}
- **涉及机器人**: {risk.robot_id} {f'与 {risk.other_robot_id}' if risk.other_robot_id else ''}
- **当前距离**: {risk.distance:.2f}m
- **预计碰撞时间**: {f'{risk.time_to_collision:.1f}s' if risk.time_to_collision else 'N/A'}
- **描述**: {risk.description or '无'}
- **已解决**: {'是' if risk.is_resolved else '否'}
- **发生时间**: {risk.created_at.strftime('%Y-%m-%d %H:%M:%S') if risk.created_at else '-'}

"""
        
        report += f"""## 机器人信息

| 机器人ID | 名称 | 状态 | 电池电量 | 当前位置 |
|----------|------|------|----------|----------|
"""
        for robot in robots:
            report += f"| {robot.robot_id} | {robot.name} | {robot.status.value} | {robot.battery_level:.1f}% | ({robot.current_x:.1f}, {robot.current_y:.1f}) |\n"
        
        report += f"""
## 订单信息

| 订单ID | 优先级 | 取货位置 | 送货位置 | 货物重量 | 状态 |
|--------|--------|----------|----------|----------|------|
"""
        for order in orders[:20]:
            pickup = f"({order.pickup_location_x:.1f}, {order.pickup_location_y:.1f})"
            dropoff = f"({order.dropoff_location_x:.1f}, {order.dropoff_location_y:.1f})"
            report += f"| {order.order_id} | {order.priority} | {pickup} | {dropoff} | {order.cargo_weight:.1f}kg | {order.status.value} |\n"
        
        if len(orders) > 20:
            report += f"\n... 还有 {len(orders) - 20} 个订单\n"
        
        report += f"""
---
*报告生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*
"""
        
        return report
    
    def _generate_json_report(
        self,
        batch: SchedulingBatch,
        metrics: Dict,
        robots: List[Robot],
        orders: List[Order],
        frames_count: int,
        collision_risks: List[CollisionRisk],
        critical_risks: List,
        high_risks: List,
        medium_risks: List
    ) -> str:
        report = {
            "report_type": "batch_report",
            "generated_at": datetime.now().isoformat(),
            "batch_info": {
                "id": batch.batch_id,
                "name": batch.name,
                "algorithm": batch.algorithm.value,
                "status": batch.status.value,
                "created_at": batch.created_at.isoformat() if batch.created_at else None,
                "start_time": batch.start_time.isoformat() if batch.start_time else None,
                "end_time": batch.end_time.isoformat() if batch.end_time else None
            },
            "statistics": {
                "total_robots": batch.total_robots,
                "total_orders": batch.total_orders,
                "total_tasks": batch.total_tasks,
                "completed_orders": batch.completed_orders,
                "completed_tasks": batch.completed_tasks,
                "replay_frames": frames_count,
                "total_distance": metrics.get("total_distance", 0),
                "avg_battery_usage": metrics.get("avg_battery_usage", 0)
            },
            "risks": {
                "summary": {
                    "critical": len(critical_risks),
                    "high": len(high_risks),
                    "medium": len(medium_risks),
                    "total": len(collision_risks)
                },
                "details": [
                    {
                        "id": r.id,
                        "risk_type": r.risk_type.value,
                        "risk_level": r.risk_level.value,
                        "robot_id": r.robot_id,
                        "other_robot_id": r.other_robot_id,
                        "distance": r.distance,
                        "time_to_collision": r.time_to_collision,
                        "description": r.description,
                        "is_resolved": r.is_resolved,
                        "created_at": r.created_at.isoformat() if r.created_at else None
                    }
                    for r in collision_risks
                ]
            },
            "robots": [
                {
                    "id": r.robot_id,
                    "name": r.name,
                    "status": r.status.value,
                    "battery_level": r.battery_level,
                    "position": {
                        "x": r.current_x,
                        "y": r.current_y,
                        "z": r.current_z
                    },
                    "orientation": r.orientation,
                    "max_speed": r.max_speed,
                    "payload_capacity": r.payload_capacity
                }
                for r in robots
            ],
            "orders": [
                {
                    "id": o.order_id,
                    "priority": o.priority,
                    "pickup_location": {
                        "x": o.pickup_location_x,
                        "y": o.pickup_location_y,
                        "name": o.pickup_location_name
                    },
                    "dropoff_location": {
                        "x": o.dropoff_location_x,
                        "y": o.dropoff_location_y,
                        "name": o.dropoff_location_name
                    },
                    "cargo": {
                        "type": o.cargo_type,
                        "weight": o.cargo_weight,
                        "volume": o.cargo_volume
                    },
                    "status": o.status.value,
                    "scheduled_start": o.scheduled_start_time.isoformat() if o.scheduled_start_time else None,
                    "actual_start": o.actual_start_time.isoformat() if o.actual_start_time else None,
                    "actual_end": o.actual_end_time.isoformat() if o.actual_end_time else None
                }
                for o in orders
            ]
        }
        
        return json.dumps(report, ensure_ascii=False, indent=2)
    
    def generate_comparison_report(
        self,
        batch_id1: int,
        batch_id2: int,
        format: str = "markdown"
    ) -> str:
        from ..services.scheduling_service import ReplayService
        
        replay_service = ReplayService(self.db)
        comparison = replay_service.compare_batches(batch_id1, batch_id2)
        
        if format == "json":
            return json.dumps({
                "report_type": "comparison_report",
                "generated_at": datetime.now().isoformat(),
                "comparison": comparison
            }, ensure_ascii=False, indent=2)
        
        b1 = comparison["batch1"]
        b2 = comparison["batch2"]
        comp = comparison["comparison"]
        
        report = f"""# 调度方案对比报告

## 方案A: {b1['name']}

| 项目 | 数值 |
|------|------|
| ID | {b1['id']} |
| 算法 | {b1['algorithm']} |
| 机器人数量 | {b1['total_robots']} |
| 订单数量 | {b1['total_orders']} |
| 回放帧数 | {b1['total_frames']} |
| 碰撞风险 | {b1['collision_risks']} |
| 开始时间 | {b1['start_time'] or '-'} |
| 结束时间 | {b1['end_time'] or '-'} |

## 方案B: {b2['name']}

| 项目 | 数值 |
|------|------|
| ID | {b2['id']} |
| 算法 | {b2['algorithm']} |
| 机器人数量 | {b2['total_robots']} |
| 订单数量 | {b2['total_orders']} |
| 回放帧数 | {b2['total_frames']} |
| 碰撞风险 | {b2['collision_risks']} |
| 开始时间 | {b2['start_time'] or '-'} |
| 结束时间 | {b2['end_time'] or '-'} |

## 对比分析

| 指标 | 方案A | 方案B | 差异 |
|------|-------|-------|------|
| 总帧数 | {b1['total_frames']} | {b2['total_frames']} | {comp['frames_difference']:+d} |
| 碰撞风险 | {b1['collision_risks']} | {b2['collision_risks']} | {comp['risks_difference']:+d} |

## 结论

**推荐方案**: {comp['better_batch']}

"""
        
        if comp['risks_difference'] < 0:
            report += "方案B的碰撞风险更少，更安全。\n"
        elif comp['risks_difference'] > 0:
            report += "方案A的碰撞风险更少，更安全。\n"
        else:
            report += "两个方案的碰撞风险相同。\n"
        
        report += f"""
---
*报告生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*
"""
        
        return report

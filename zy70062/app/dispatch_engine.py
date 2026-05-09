from typing import Dict, List, Optional, Any
from datetime import datetime
from app.state_machine import FAULT_LEVEL_DISPLAY


FAULT_LEVEL_PRIORITY = {
    "critical": 100,
    "urgent": 70,
    "normal": 40,
    "low": 10,
}


class DispatchRuleEngine:
    def __init__(self):
        self._category_specialty_map: Dict[str, List[str]] = {
            "projector": ["投影设备", "多媒体", "通用电子"],
            "access_control": ["门禁系统", "安防", "通用电子"],
            "aircon": ["空调制冷", "暖通", "通用机电"],
            "computer": ["计算机设备", "多媒体", "通用电子"],
            "lighting": ["照明电路", "电气", "通用机电"],
        }

    def calculate_priority(
        self,
        fault_level: str,
        category_weight: int,
        classroom_importance: str = "normal",
        same_classroom_concurrent: int = 0,
    ) -> Dict[str, Any]:
        level_score = FAULT_LEVEL_PRIORITY.get(fault_level, 40)
        category_score = category_weight * 10
        classroom_score = self._get_classroom_score(classroom_importance)
        concurrent_bonus = min(same_classroom_concurrent * 5, 30)

        total = level_score + category_score + classroom_score + concurrent_bonus
        clamped = max(1, min(10, int(total / 10)))

        level_name = FAULT_LEVEL_DISPLAY.get(fault_level, "普通")
        urgency_desc = self._get_urgency_description(clamped)

        return {
            "priority_value": clamped,
            "total_score": total,
            "level_score": level_score,
            "category_score": category_score,
            "classroom_score": classroom_score,
            "concurrent_bonus": concurrent_bonus,
            "fault_level_name": level_name,
            "urgency_description": urgency_desc,
        }

    def _get_classroom_score(self, importance: str) -> int:
        mapping = {
            "lecture_hall": 30,
            "lab": 20,
            "exam_room": 25,
            "normal": 0,
        }
        return mapping.get(importance, 0)

    def _get_urgency_description(self, priority: int) -> str:
        if priority >= 9:
            return "最高优先级 - 需立即响应"
        elif priority >= 7:
            return "高优先级 - 今日内处理"
        elif priority >= 5:
            return "中优先级 - 两个工作日内处理"
        else:
            return "常规优先级 - 按顺序处理"

    def select_best_worker(
        self,
        device_category_code: str,
        available_workers: List[Any],
    ) -> Dict[str, Any]:
        if not available_workers:
            return {
                "selected": None,
                "reason": "当前无可用维修人员",
                "candidates": [],
            }

        category_specialties = self._category_specialty_map.get(
            device_category_code, ["通用电子", "通用机电"]
        )

        scored_workers = []
        for worker in available_workers:
            specialty = getattr(worker, "specialty_category", "") or ""
            is_available = getattr(worker, "is_available", True)
            current_load = getattr(worker, "current_load", 0)

            if not is_available:
                continue

            match_score = 0
            for spec in category_specialties:
                if spec in specialty:
                    match_score = 50
                    break
                if specialty:
                    match_score = 20

            load_penalty = current_load * 5
            total_score = match_score - load_penalty

            scored_workers.append({
                "worker": worker,
                "match_score": match_score,
                "load_penalty": load_penalty,
                "total_score": total_score,
                "is_specialized": match_score >= 50,
            })

        if not scored_workers:
            return {
                "selected": None,
                "reason": "所有维修人员当前不可用",
                "candidates": [],
            }

        scored_workers.sort(key=lambda x: x["total_score"], reverse=True)

        best = scored_workers[0]
        reason_parts = []

        if best["is_specialized"]:
            reason_parts.append("匹配维修专业")
        else:
            reason_parts.append("无专业匹配人员，选择通用维修")

        if best["worker"].current_load == 0:
            reason_parts.append("当前无待处理任务")
        else:
            reason_parts.append(f"当前负载较低（{best['worker'].current_load} 项）")

        return {
            "selected": best["worker"],
            "reason": "、".join(reason_parts),
            "candidates": scored_workers[:3],
        }

    def analyze_concurrent_repairs(
        self,
        classroom: str,
        device_category_code: str,
        pending_orders: List[Any],
    ) -> Dict[str, Any]:
        same_classroom = [
            o for o in pending_orders
            if o.classroom == classroom
        ]
        same_category = [
            o for o in same_classroom
            if o.device_category_code == device_category_code
        ]

        device_list = []
        for o in same_classroom:
            device_list.append({
                "order_no": o.order_no,
                "device_category_code": o.device_category_code,
                "fault_description": o.fault_description[:30],
                "priority": o.priority,
            })

        should_combine = len(same_classroom) >= 2
        combine_advice = None

        if should_combine:
            combine_advice = (
                f"同一教室「{classroom}」存在 {len(same_classroom)} 项报修，"
                "建议派给同一维修人员一次性处理，减少往返成本"
            )

        return {
            "same_classroom_count": len(same_classroom),
            "same_category_count": len(same_category),
            "concurrent_devices": device_list,
            "should_combine": should_combine,
            "combine_advice": combine_advice,
        }

    def evaluate_dispatch_strategy(
        self,
        order: Any,
        category_weight: int,
        available_workers: List[Any],
        pending_orders: List[Any],
    ) -> Dict[str, Any]:
        priority_info = self.calculate_priority(
            fault_level=order.fault_level,
            category_weight=category_weight,
            same_classroom_concurrent=len([
                o for o in pending_orders if o.classroom == order.classroom
            ]) - 1,
        )

        worker_selection = self.select_best_worker(
            device_category_code=order.device_category_code,
            available_workers=available_workers,
        )

        concurrent_analysis = self.analyze_concurrent_repairs(
            classroom=order.classroom,
            device_category_code=order.device_category_code,
            pending_orders=pending_orders,
        )

        dispatch_advice = []
        if priority_info["priority_value"] >= 7:
            dispatch_advice.append("加急处理，优先派单")
        if worker_selection["selected"]:
            dispatch_advice.append(f"建议派单给：{worker_selection['selected'].name}")
        if concurrent_analysis["combine_advice"]:
            dispatch_advice.append(concurrent_analysis["combine_advice"])

        return {
            "priority_info": priority_info,
            "worker_selection": worker_selection,
            "concurrent_analysis": concurrent_analysis,
            "dispatch_advice": dispatch_advice,
        }

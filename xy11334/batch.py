import csv
import json
import os
from datetime import datetime
from typing import List, Dict, Any, Callable
from uuid import uuid4

from models import Patient, Escort, Task
from storage import Storage
from rules import TaskService


class BatchProcessor:
    def __init__(self, storage: Storage, task_service: TaskService):
        self.storage = storage
        self.task_service = task_service

    def process_batch(self, items: List[Dict], processor: Callable, operation_name: str) -> Dict:
        results = {
            "success": [],
            "failed": [],
            "total": len(items),
            "operation": operation_name,
            "started_at": datetime.now().isoformat()
        }
        for index, item in enumerate(items):
            try:
                result = processor(item)
                if result.get("success", False):
                    results["success"].append({
                        "index": index,
                        "item": self._desensitize_item(item),
                        "result": result
                    })
                else:
                    results["failed"].append({
                        "index": index,
                        "item": self._desensitize_item(item),
                        "error": result.get("error", "未知错误")
                    })
            except Exception as e:
                results["failed"].append({
                    "index": index,
                    "item": self._desensitize_item(item),
                    "error": str(e)
                })
        results["completed_at"] = datetime.now().isoformat()
        results["success_count"] = len(results["success"])
        results["failed_count"] = len(results["failed"])
        return results

    def _desensitize_item(self, item: Dict) -> Dict:
        result = item.copy()
        if "phone" in result:
            phone = result["phone"]
            if len(phone) >= 7:
                result["phone"] = phone[:3] + "****" + phone[-4:]
            else:
                result["phone"] = "*" * len(phone)
        if "id_card" in result:
            id_card = result["id_card"]
            if len(id_card) >= 8:
                result["id_card"] = id_card[:6] + "********" + id_card[-4:]
            else:
                result["id_card"] = "*" * len(id_card)
        if "name" in result and result["name"]:
            name = result["name"]
            if len(name) > 1:
                result["name"] = name[0] + "*" * (len(name) - 1)
        return result

    def batch_create_escorts(self, escorts_data: List[Dict], operator: str) -> Dict:
        def processor(data):
            try:
                escort = Escort(
                    id=str(uuid4()),
                    name=data["name"],
                    phone=data["phone"],
                    employee_id=data["employee_id"],
                    is_active=data.get("is_active", True)
                )
                self.storage.save_escort(escort)
                return {"success": True, "escort_id": escort.id}
            except Exception as e:
                return {"success": False, "error": str(e)}
        return self.process_batch(escorts_data, processor, "批量创建陪检员")

    def batch_create_tasks(self, tasks_data: List[Dict], operator: str) -> Dict:
        def processor(data):
            try:
                patient = Patient(
                    id=str(uuid4()),
                    name=data["name"],
                    phone=data["phone"],
                    id_card=data["id_card"],
                    department=data["department"],
                    is_emergency=data.get("is_emergency", False)
                )
                task, results = self.task_service.create_task(
                    patient,
                    is_emergency=data.get("is_emergency", False),
                    operator=operator
                )
                if all(r.passed for r in results):
                    return {"success": True, "task_id": task.id, "position": task.position}
                else:
                    return {"success": False, "error": "; ".join(r.reason for r in results if not r.passed)}
            except Exception as e:
                return {"success": False, "error": str(e)}
        return self.process_batch(tasks_data, processor, "批量创建任务")

    def retry_failed(self, failed_items: List[Dict], processor: Callable) -> Dict:
        items_to_retry = [
            {k: v for k, v in item["item"].items() if not k.startswith("_")}
            for item in failed_items
        ]
        return self.process_batch(items_to_retry, processor, "重试失败操作")


class Exporter:
    def __init__(self, storage: Storage, export_dir: str = "exports"):
        self.storage = storage
        self.export_dir = export_dir
        self._ensure_export_dir()

    def _ensure_export_dir(self):
        if not os.path.exists(self.export_dir):
            os.makedirs(self.export_dir)

    def export_tasks(self, desensitize: bool = True) -> str:
        tasks = self.storage.get_all_tasks()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"tasks_export_{timestamp}.json"
        filepath = os.path.join(self.export_dir, filename)
        data = [task.to_dict(desensitize=desensitize) for task in tasks]
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return filepath

    def export_tasks_csv(self, desensitize: bool = True) -> str:
        tasks = self.storage.get_all_tasks()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"tasks_export_{timestamp}.csv"
        filepath = os.path.join(self.export_dir, filename)
        with open(filepath, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                "任务ID", "患者姓名", "患者电话", "科室", "优先级",
                "状态", "排队位置", "创建时间", "接单时间", "完成时间",
                "陪检员姓名", "陪检员工号"
            ])
            for task in tasks:
                patient = task.patient
                if desensitize:
                    patient_name = Patient._desensitize_name(patient.name)
                    patient_phone = Patient._desensitize_phone(patient.phone)
                else:
                    patient_name = patient.name
                    patient_phone = patient.phone
                escort_name = task.escort.name if task.escort else ""
                escort_emp_id = task.escort.employee_id if task.escort else ""
                writer.writerow([
                    task.id,
                    patient_name,
                    patient_phone,
                    patient.department,
                    task.priority.value,
                    task.status.value,
                    task.position,
                    task.created_at.strftime("%Y-%m-%d %H:%M:%S") if task.created_at else "",
                    task.accepted_at.strftime("%Y-%m-%d %H:%M:%S") if task.accepted_at else "",
                    task.completed_at.strftime("%Y-%m-%d %H:%M:%S") if task.completed_at else "",
                    escort_name,
                    escort_emp_id
                ])
        return filepath

    def export_statistics(self) -> Dict[str, Any]:
        tasks = self.storage.get_all_tasks()
        escorts = self.storage.get_all_escorts()
        from collections import defaultdict
        status_counts = defaultdict(int)
        priority_counts = defaultdict(int)
        dept_counts = defaultdict(int)
        escort_counts = defaultdict(int)
        total_wait_time = 0
        wait_count = 0
        total_process_time = 0
        process_count = 0
        for task in tasks:
            status_counts[task.status.value] += 1
            priority_counts[task.priority.value] += 1
            dept_counts[task.patient.department] += 1
            if task.escort:
                escort_counts[task.escort.name] += 1
            if task.accepted_at and task.created_at:
                wait_seconds = (task.accepted_at - task.created_at).total_seconds()
                total_wait_time += wait_seconds
                wait_count += 1
            if task.completed_at and task.created_at:
                process_seconds = (task.completed_at - task.created_at).total_seconds()
                total_process_time += process_seconds
                process_count += 1
        stats = {
            "generated_at": datetime.now().isoformat(),
            "total_tasks": len(tasks),
            "total_escorts": len(escorts),
            "active_escorts": sum(1 for e in escorts if e.is_active),
            "by_status": dict(status_counts),
            "by_priority": dict(priority_counts),
            "by_department": dict(dept_counts),
            "escort_workload": dict(sorted(escort_counts.items(), key=lambda x: -x[1])),
            "avg_wait_minutes": round(total_wait_time / 60 / wait_count, 2) if wait_count else 0,
            "avg_process_minutes": round(total_process_time / 60 / process_count, 2) if process_count else 0
        }
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"statistics_{timestamp}.json"
        filepath = os.path.join(self.export_dir, filename)
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(stats, f, ensure_ascii=False, indent=2)
        return stats

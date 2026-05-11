#!/usr/bin/env python3
"""
宠物寄养用药 CLI 工具
用于管理宠物寄养期间的用药、喂食记录，以及异常观察和主人确认
"""

import json
import os
import sys
import argparse
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
PETS_FILE = os.path.join(DATA_DIR, "pets.json")
PLANS_FILE = os.path.join(DATA_DIR, "plans.json")
LOGS_FILE = os.path.join(DATA_DIR, "logs.json")
CONFIRMATIONS_FILE = os.path.join(DATA_DIR, "confirmations.json")


def ensure_data_dir():
    """确保数据目录存在"""
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)


def load_json(file_path: str, default: Any) -> Any:
    """加载 JSON 文件"""
    if not os.path.exists(file_path):
        return default
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(file_path: str, data: Any) -> None:
    """保存 JSON 文件"""
    ensure_data_dir()
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def get_current_time() -> str:
    """获取当前时间字符串"""
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def parse_date(date_str: str) -> date:
    """解析日期字符串"""
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        try:
            return datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S").date()
        except ValueError:
            raise ValueError(f"无法解析日期: {date_str}")


class PetManager:
    """宠物档案管理器"""

    def __init__(self):
        self.pets = load_json(PETS_FILE, [])

    def list_pets(self) -> None:
        """列出所有宠物"""
        if not self.pets:
            print("暂无宠物档案")
            return

        print("\n=== 宠物寄养档案 ===")
        for pet in self.pets:
            status = "寄养中" if pet.get("active", True) else "已离店"
            print(f"ID: {pet['id']}")
            print(f"  名字: {pet['name']}")
            print(f"  种类: {pet['species']}")
            print(f"  年龄: {pet['age']}")
            print(f"  主人: {pet['owner_name']}")
            print(f"  入住时间: {pet['check_in']}")
            print(f"  预计离店时间: {pet['check_out']}")
            print(f"  状态: {status}")
            if pet.get("medical_conditions"):
                print(f"  慢性病: {pet['medical_conditions']}")
            if pet.get("notes"):
                print(f"  备注: {pet['notes']}")
            print()

    def add_pet(
        self,
        name: str,
        species: str,
        age: str,
        owner_name: str,
        owner_phone: str,
        check_in: str,
        check_out: str,
        medical_conditions: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> None:
        """添加新宠物"""
        pet_id = len(self.pets) + 1
        new_pet = {
            "id": pet_id,
            "name": name,
            "species": species,
            "age": age,
            "owner_name": owner_name,
            "owner_phone": owner_phone,
            "check_in": check_in,
            "check_out": check_out,
            "medical_conditions": medical_conditions,
            "notes": notes,
            "active": True,
            "created_at": get_current_time(),
        }
        self.pets.append(new_pet)
        save_json(PETS_FILE, self.pets)
        print(f"已添加宠物档案: {name} (ID: {pet_id})")

    def get_pet(self, pet_id: int) -> Optional[Dict[str, Any]]:
        """获取宠物信息"""
        for pet in self.pets:
            if pet["id"] == pet_id:
                return pet
        return None

    def is_pet_active(self, pet_id: int) -> bool:
        """检查宠物是否仍在寄养中"""
        pet = self.get_pet(pet_id)
        if not pet:
            return False
        return pet.get("active", True)

    def check_out(self, pet_id: int) -> None:
        """宠物离店"""
        for pet in self.pets:
            if pet["id"] == pet_id:
                pet["active"] = False
                pet["actual_check_out"] = get_current_time()
                save_json(PETS_FILE, self.pets)
                print(f"宠物 {pet['name']} 已离店")
                return
        print(f"未找到宠物 ID: {pet_id}")


class PlanManager:
    """喂食和用药计划管理器"""

    def __init__(self, pet_manager: PetManager):
        self.plans = load_json(PLANS_FILE, [])
        self.pet_manager = pet_manager

    def list_plans(self, pet_id: Optional[int] = None) -> None:
        """列出喂食和用药计划"""
        filtered_plans = self.plans
        if pet_id:
            filtered_plans = [p for p in self.plans if p["pet_id"] == pet_id]

        if not filtered_plans:
            print("暂无计划")
            return

        print("\n=== 喂食和用药计划 ===")
        for plan in filtered_plans:
            pet = self.pet_manager.get_pet(plan["pet_id"])
            pet_name = pet["name"] if pet else "未知"
            plan_type = "用药" if plan["type"] == "medication" else "喂食"
            print(f"ID: {plan['id']}")
            print(f"  宠物: {pet_name} (ID: {plan['pet_id']})")
            print(f"  类型: {plan_type}")
            print(f"  项目: {plan['name']}")
            print(f"  剂量/份量: {plan['dosage']}")
            print(f"  频率: {plan['frequency']}")
            print(f"  开始时间: {plan['start_date']}")
            print(f"  结束时间: {plan['end_date']}")
            if plan.get("notes"):
                print(f"  备注: {plan['notes']}")
            print()

    def add_plan(
        self,
        pet_id: int,
        plan_type: str,
        name: str,
        dosage: str,
        frequency: str,
        start_date: str,
        end_date: str,
        notes: Optional[str] = None,
    ) -> None:
        """添加新计划"""
        if not self.pet_manager.get_pet(pet_id):
            print(f"未找到宠物 ID: {pet_id}")
            return

        plan_id = len(self.plans) + 1
        new_plan = {
            "id": plan_id,
            "pet_id": pet_id,
            "type": plan_type,
            "name": name,
            "dosage": dosage,
            "frequency": frequency,
            "start_date": start_date,
            "end_date": end_date,
            "notes": notes,
            "created_at": get_current_time(),
        }
        self.plans.append(new_plan)
        save_json(PLANS_FILE, self.plans)
        plan_type_str = "用药" if plan_type == "medication" else "喂食"
        print(f"已添加{plan_type_str}计划: {name} (ID: {plan_id})")

    def get_plan(self, plan_id: int) -> Optional[Dict[str, Any]]:
        """获取计划信息"""
        for plan in self.plans:
            if plan["id"] == plan_id:
                return plan
        return None

    def get_plans_for_pet(self, pet_id: int) -> List[Dict[str, Any]]:
        """获取指定宠物的所有计划"""
        return [p for p in self.plans if p["pet_id"] == pet_id]


class LogManager:
    """执行记录管理器"""

    def __init__(self, pet_manager: PetManager, plan_manager: PlanManager):
        self.logs = load_json(LOGS_FILE, [])
        self.pet_manager = pet_manager
        self.plan_manager = plan_manager

    def list_logs(self, pet_id: Optional[int] = None) -> None:
        """列出执行记录"""
        filtered_logs = self.logs
        if pet_id:
            filtered_logs = [l for l in self.logs if l["pet_id"] == pet_id]

        if not filtered_logs:
            print("暂无执行记录")
            return

        filtered_logs.sort(key=lambda x: x["timestamp"])

        print("\n=== 执行记录 ===")
        for log in filtered_logs:
            pet = self.pet_manager.get_pet(log["pet_id"])
            pet_name = pet["name"] if pet else "未知"

            print(f"ID: {log['id']}")
            print(f"  宠物: {pet_name} (ID: {log['pet_id']})")
            print(f"  时间: {log['timestamp']}")

            if log["type"] == "abnormal":
                print(f"  类型: 异常观察")
                print(f"  异常情况: {log.get('observation', '未记录')}")
                print(f"  记录人: {log['handler']}")
                if log.get("action_taken"):
                    print(f"  处理措施: {log['action_taken']}")
            else:
                plan_type = "用药" if log["type"] == "medication" else "喂食"
                status_str = {
                    "completed": "已完成",
                    "missed": "漏服",
                    "makeup": "补服",
                }.get(log.get("status", "completed"), log.get("status", "completed"))

                print(f"  类型: {plan_type}")
                print(f"  项目: {log['name']}")
                print(f"  剂量: {log.get('dosage', '未记录')}")
                print(f"  状态: {status_str}")
                print(f"  执行人: {log['handler']}")
                if log.get("notes"):
                    print(f"  备注: {log['notes']}")
            print()

    def _validate_log(
        self,
        pet_id: int,
        plan_id: int,
        log_date: date,
        check_active: bool = True,
    ) -> Optional[Dict[str, str]]:
        """验证打卡操作，返回错误信息"""
        pet = self.pet_manager.get_pet(pet_id)
        if not pet:
            return {"error": f"未找到宠物 ID: {pet_id}"}

        if check_active and not self.pet_manager.is_pet_active(pet_id):
            return {"error": f"宠物 {pet['name']} 已离店，无法继续修改记录"}

        plan = self.plan_manager.get_plan(plan_id)
        if not plan:
            return {"error": f"未找到计划 ID: {plan_id}"}

        if plan["pet_id"] != pet_id:
            return {"error": f"计划 ID {plan_id} 不属于宠物 ID {pet_id}"}

        return None

    def _check_duplicate_log(
        self, pet_id: int, plan_id: int, log_date: date
    ) -> bool:
        """检查是否已存在当天的打卡记录"""
        for log in self.logs:
            if (
                log["pet_id"] == pet_id
                and log["plan_id"] == plan_id
                and log.get("status") == "completed"
            ):
                existing_date = parse_date(log["timestamp"])
                if existing_date == log_date:
                    return True
        return False

    def add_log(
        self,
        pet_id: int,
        plan_id: int,
        dosage: str,
        handler: str,
        status: str = "completed",
        notes: Optional[str] = None,
    ) -> None:
        """添加执行记录（打卡）"""
        current_time = datetime.now()
        current_date = current_time.date()

        error = self._validate_log(pet_id, plan_id, current_date)
        if error:
            print(error["error"])
            return

        plan = self.plan_manager.get_plan(plan_id)
        pet = self.pet_manager.get_pet(pet_id)

        if status == "completed":
            if self._check_duplicate_log(pet_id, plan_id, current_date):
                print(f"警告: 宠物 {pet['name']} 今天已经为 {plan['name']} 打卡过了")
                return

            if dosage != plan["dosage"]:
                print(f"警告: 剂量不符。计划剂量: {plan['dosage']}, 实际剂量: {dosage}")

        log_id = len(self.logs) + 1
        new_log = {
            "id": log_id,
            "pet_id": pet_id,
            "plan_id": plan_id,
            "type": plan["type"],
            "name": plan["name"],
            "dosage": dosage,
            "status": status,
            "handler": handler,
            "timestamp": current_time.strftime("%Y-%m-%d %H:%M:%S"),
            "notes": notes,
        }
        self.logs.append(new_log)
        save_json(LOGS_FILE, self.logs)

        status_str = {
            "completed": "已完成打卡",
            "missed": "已记录漏服",
            "makeup": "已记录补服",
        }.get(status, status)
        print(f"{status_str}: {plan['name']} (ID: {log_id})")

    def add_missed_log(
        self,
        pet_id: int,
        plan_id: int,
        missed_date: str,
        handler: str,
        notes: Optional[str] = None,
    ) -> None:
        """记录漏服"""
        plan = self.plan_manager.get_plan(plan_id)
        if not plan:
            print(f"未找到计划 ID: {plan_id}")
            return

        log_id = len(self.logs) + 1
        new_log = {
            "id": log_id,
            "pet_id": pet_id,
            "plan_id": plan_id,
            "type": plan["type"],
            "name": plan["name"],
            "dosage": plan["dosage"],
            "status": "missed",
            "handler": handler,
            "timestamp": missed_date,
            "notes": notes if notes else "漏服",
        }
        self.logs.append(new_log)
        save_json(LOGS_FILE, self.logs)
        print(f"已记录漏服: {plan['name']} (ID: {log_id})")

    def add_makeup_log(
        self,
        pet_id: int,
        plan_id: int,
        dosage: str,
        handler: str,
        notes: Optional[str] = None,
    ) -> None:
        """记录补服"""
        plan = self.plan_manager.get_plan(plan_id)
        if not plan:
            print(f"未找到计划 ID: {plan_id}")
            return

        log_id = len(self.logs) + 1
        new_log = {
            "id": log_id,
            "pet_id": pet_id,
            "plan_id": plan_id,
            "type": plan["type"],
            "name": plan["name"],
            "dosage": dosage,
            "status": "makeup",
            "handler": handler,
            "timestamp": get_current_time(),
            "notes": notes if notes else "补服",
        }
        self.logs.append(new_log)
        save_json(LOGS_FILE, self.logs)
        print(f"已记录补服: {plan['name']} (ID: {log_id})")

    def add_abnormal_observation(
        self,
        pet_id: int,
        observation: str,
        handler: str,
        action_taken: Optional[str] = None,
    ) -> None:
        """添加异常观察记录"""
        if not self.pet_manager.is_pet_active(pet_id):
            pet = self.pet_manager.get_pet(pet_id)
            print(f"宠物 {pet['name'] if pet else pet_id} 已离店")
            return

        log_id = len(self.logs) + 1
        new_log = {
            "id": log_id,
            "pet_id": pet_id,
            "type": "abnormal",
            "name": "异常观察",
            "observation": observation,
            "handler": handler,
            "action_taken": action_taken,
            "timestamp": get_current_time(),
        }
        self.logs.append(new_log)
        save_json(LOGS_FILE, self.logs)
        print(f"已记录异常观察 (ID: {log_id})")

    def get_logs_for_pet(self, pet_id: int) -> List[Dict[str, Any]]:
        """获取指定宠物的所有记录"""
        return [l for l in self.logs if l["pet_id"] == pet_id]

    def check_missed_doses(self, pet_id: int) -> None:
        """检查漏服情况"""
        pet = self.pet_manager.get_pet(pet_id)
        if not pet:
            print(f"未找到宠物 ID: {pet_id}")
            return

        plans = self.plan_manager.get_plans_for_pet(pet_id)
        logs = self.get_logs_for_pet(pet_id)

        check_in_date = parse_date(pet["check_in"])
        check_out_date = parse_date(pet["check_out"])
        today = date.today()
        end_date = min(check_out_date, today)

        print(f"\n=== 宠物 {pet['name']} 的用药检查 ===")

        for plan in plans:
            if plan["type"] != "medication":
                continue

            start_date = max(check_in_date, parse_date(plan["start_date"]))
            plan_end_date = min(end_date, parse_date(plan["end_date"]))

            current_date = start_date
            while current_date <= plan_end_date:
                date_str = current_date.strftime("%Y-%m-%d")

                has_log = False
                for log in logs:
                    if log["plan_id"] == plan["id"]:
                        log_date = parse_date(log["timestamp"])
                        if log_date == current_date:
                            has_log = True
                            break

                if not has_log:
                    print(f"  警告: {date_str} 未记录 {plan['name']} 的用药")

                current_date += timedelta(days=1)


class ConfirmationManager:
    """主人确认管理器"""

    def __init__(self, pet_manager: PetManager):
        self.confirmations = load_json(CONFIRMATIONS_FILE, [])
        self.pet_manager = pet_manager

    def list_confirmations(self, pet_id: Optional[int] = None) -> None:
        """列出主人确认记录"""
        filtered = self.confirmations
        if pet_id:
            filtered = [c for c in self.confirmations if c["pet_id"] == pet_id]

        if not filtered:
            print("暂无主人确认记录")
            return

        print("\n=== 主人确认记录 ===")
        for conf in filtered:
            pet = self.pet_manager.get_pet(conf["pet_id"])
            pet_name = pet["name"] if pet else "未知"
            print(f"ID: {conf['id']}")
            print(f"  宠物: {pet_name} (ID: {conf['pet_id']})")
            print(f"  确认内容: {conf['content']}")
            print(f"  确认时间: {conf['timestamp']}")
            if conf.get("notes"):
                print(f"  备注: {conf['notes']}")
            print()

    def add_confirmation(
        self,
        pet_id: int,
        content: str,
        notes: Optional[str] = None,
    ) -> None:
        """添加主人确认"""
        conf_id = len(self.confirmations) + 1
        new_conf = {
            "id": conf_id,
            "pet_id": pet_id,
            "content": content,
            "timestamp": get_current_time(),
            "notes": notes,
        }
        self.confirmations.append(new_conf)
        save_json(CONFIRMATIONS_FILE, self.confirmations)
        print(f"已记录主人确认 (ID: {conf_id})")

    def get_confirmations_for_pet(self, pet_id: int) -> List[Dict[str, Any]]:
        """获取指定宠物的所有确认记录"""
        return [c for c in self.confirmations if c["pet_id"] == pet_id]


class ReportGenerator:
    """寄养报告生成器"""

    def __init__(
        self,
        pet_manager: PetManager,
        plan_manager: PlanManager,
        log_manager: LogManager,
        confirmation_manager: ConfirmationManager,
    ):
        self.pet_manager = pet_manager
        self.plan_manager = plan_manager
        self.log_manager = log_manager
        self.confirmation_manager = confirmation_manager

    def generate_report(self, pet_id: int, output_file: Optional[str] = None) -> None:
        """生成寄养报告"""
        pet = self.pet_manager.get_pet(pet_id)
        if not pet:
            print(f"未找到宠物 ID: {pet_id}")
            return

        plans = self.plan_manager.get_plans_for_pet(pet_id)
        logs = self.log_manager.get_logs_for_pet(pet_id)
        confirmations = self.confirmation_manager.get_confirmations_for_pet(pet_id)

        logs.sort(key=lambda x: x["timestamp"])
        confirmations.sort(key=lambda x: x["timestamp"])

        report_lines = []
        report_lines.append("=" * 60)
        report_lines.append("           宠物寄养报告")
        report_lines.append("=" * 60)
        report_lines.append("")

        report_lines.append("一、宠物基本信息")
        report_lines.append("-" * 60)
        report_lines.append(f"宠物名字: {pet['name']}")
        report_lines.append(f"宠物种类: {pet['species']}")
        report_lines.append(f"宠物年龄: {pet['age']}")
        report_lines.append(f"主人姓名: {pet['owner_name']}")
        report_lines.append(f"联系电话: {pet['owner_phone']}")
        report_lines.append(f"入住时间: {pet['check_in']}")
        report_lines.append(f"预计离店时间: {pet['check_out']}")
        if pet.get("actual_check_out"):
            report_lines.append(f"实际离店时间: {pet['actual_check_out']}")
        if pet.get("medical_conditions"):
            report_lines.append(f"慢性病情况: {pet['medical_conditions']}")
        if pet.get("notes"):
            report_lines.append(f"特殊备注: {pet['notes']}")
        report_lines.append("")

        report_lines.append("二、寄养计划")
        report_lines.append("-" * 60)

        if plans:
            med_plans = [p for p in plans if p["type"] == "medication"]
            feed_plans = [p for p in plans if p["type"] == "feeding"]

            if med_plans:
                report_lines.append("【用药计划】")
                for plan in med_plans:
                    report_lines.append(f"  药物名称: {plan['name']}")
                    report_lines.append(f"  每次用量: {plan['dosage']}")
                    report_lines.append(f"  使用频率: {plan['frequency']}")
                    report_lines.append(f"  开始日期: {plan['start_date']}")
                    report_lines.append(f"  结束日期: {plan['end_date']}")
                    if plan.get("notes"):
                        report_lines.append(f"  注意事项: {plan['notes']}")
                    report_lines.append("")

            if feed_plans:
                report_lines.append("【喂食计划】")
                for plan in feed_plans:
                    report_lines.append(f"  食物名称: {plan['name']}")
                    report_lines.append(f"  每次份量: {plan['dosage']}")
                    report_lines.append(f"  喂食频率: {plan['frequency']}")
                    report_lines.append(f"  开始日期: {plan['start_date']}")
                    report_lines.append(f"  结束日期: {plan['end_date']}")
                    if plan.get("notes"):
                        report_lines.append(f"  注意事项: {plan['notes']}")
                    report_lines.append("")
        else:
            report_lines.append("暂无计划")
            report_lines.append("")

        report_lines.append("三、每日执行记录")
        report_lines.append("-" * 60)

        completed_logs = [l for l in logs if l.get("type") in ["medication", "feeding"]]

        if completed_logs:
            for log in completed_logs:
                status_str = {
                    "completed": "正常执行",
                    "missed": "漏服",
                    "makeup": "补服",
                }.get(log.get("status"), log.get("status", ""))

                type_str = "用药" if log["type"] == "medication" else "喂食"

                report_lines.append(f"时间: {log['timestamp']}")
                report_lines.append(f"  类型: {type_str}")
                report_lines.append(f"  项目: {log['name']}")
                report_lines.append(f"  剂量: {log['dosage']}")
                report_lines.append(f"  状态: {status_str}")
                report_lines.append(f"  执行人: {log['handler']}")
                if log.get("notes"):
                    report_lines.append(f"  备注: {log['notes']}")
                report_lines.append("")
        else:
            report_lines.append("暂无执行记录")
            report_lines.append("")

        report_lines.append("四、异常观察记录")
        report_lines.append("-" * 60)

        abnormal_logs = [l for l in logs if l.get("type") == "abnormal"]

        if abnormal_logs:
            for log in abnormal_logs:
                report_lines.append(f"时间: {log['timestamp']}")
                report_lines.append(f"  异常情况: {log['observation']}")
                report_lines.append(f"  处理人员: {log['handler']}")
                if log.get("action_taken"):
                    report_lines.append(f"  处理措施: {log['action_taken']}")
                report_lines.append("")
        else:
            report_lines.append("无异常观察记录")
            report_lines.append("")

        report_lines.append("五、主人确认记录")
        report_lines.append("-" * 60)

        if confirmations:
            for conf in confirmations:
                report_lines.append(f"确认时间: {conf['timestamp']}")
                report_lines.append(f"确认内容: {conf['content']}")
                if conf.get("notes"):
                    report_lines.append(f"备注: {conf['notes']}")
                report_lines.append("")
        else:
            report_lines.append("暂无主人确认记录")
            report_lines.append("")

        report_lines.append("=" * 60)
        report_lines.append("           报告结束")
        report_lines.append("=" * 60)

        report = "\n".join(report_lines)

        if output_file:
            with open(output_file, "w", encoding="utf-8") as f:
                f.write(report)
            print(f"报告已保存到: {output_file}")
        else:
            print(report)


class SampleDataLoader:
    """样例数据加载器"""

    def __init__(
        self,
        pet_manager: PetManager,
        plan_manager: PlanManager,
        log_manager: LogManager,
        confirmation_manager: ConfirmationManager,
    ):
        self.pet_manager = pet_manager
        self.plan_manager = plan_manager
        self.log_manager = log_manager
        self.confirmation_manager = confirmation_manager

    def load_sample_data(self) -> None:
        """加载样例数据"""
        print("正在加载样例数据...")

        if self.pet_manager.pets:
            print("数据已存在，跳过加载")
            return

        self.pet_manager.add_pet(
            name="小橘",
            species="猫",
            age="3岁",
            owner_name="张三",
            owner_phone="13800138001",
            check_in="2026-05-01 09:00:00",
            check_out="2026-05-07 18:00:00",
            notes="正常健康猫咪，性格温顺",
        )

        self.pet_manager.add_pet(
            name="旺财",
            species="狗",
            age="5岁",
            owner_name="李四",
            owner_phone="13900139002",
            check_in="2026-05-01 10:00:00",
            check_out="2026-05-05 17:00:00",
            medical_conditions="心脏病，需要每日服药",
            notes="有心脏病史，需密切观察精神状态",
        )

        self.plan_manager.add_plan(
            pet_id=1,
            plan_type="feeding",
            name="幼猫猫粮",
            dosage="50g",
            frequency="每日2次（早晚各一次）",
            start_date="2026-05-01",
            end_date="2026-05-07",
            notes="温水泡软后喂食",
        )

        self.plan_manager.add_plan(
            pet_id=2,
            plan_type="medication",
            name="心脏病药物A",
            dosage="1片",
            frequency="每日1次",
            start_date="2026-05-01",
            end_date="2026-05-05",
            notes="饭后服用",
        )

        self.plan_manager.add_plan(
            pet_id=2,
            plan_type="medication",
            name="心脏病药物B",
            dosage="半片",
            frequency="每日2次",
            start_date="2026-05-01",
            end_date="2026-05-05",
            notes="早晚各一次",
        )

        self.plan_manager.add_plan(
            pet_id=2,
            plan_type="feeding",
            name="处方狗粮",
            dosage="100g",
            frequency="每日3次",
            start_date="2026-05-01",
            end_date="2026-05-05",
            notes="少量多餐",
        )

        self._add_sample_logs()
        self._add_sample_confirmations()

        print("样例数据加载完成！")

    def _add_sample_logs(self) -> None:
        """添加样例执行记录"""
        sample_logs = [
            {
                "pet_id": 1,
                "plan_id": 1,
                "type": "feeding",
                "name": "幼猫猫粮",
                "dosage": "50g",
                "status": "completed",
                "handler": "店员小王",
                "timestamp": "2026-05-01 08:30:00",
                "notes": "食欲良好",
            },
            {
                "pet_id": 1,
                "plan_id": 1,
                "type": "feeding",
                "name": "幼猫猫粮",
                "dosage": "50g",
                "status": "completed",
                "handler": "店员小李",
                "timestamp": "2026-05-01 18:30:00",
                "notes": "",
            },
            {
                "pet_id": 2,
                "plan_id": 2,
                "type": "medication",
                "name": "心脏病药物A",
                "dosage": "1片",
                "status": "completed",
                "handler": "店员小王",
                "timestamp": "2026-05-01 09:30:00",
                "notes": "饭后服用，无异常",
            },
            {
                "pet_id": 2,
                "plan_id": 3,
                "type": "medication",
                "name": "心脏病药物B",
                "dosage": "半片",
                "status": "completed",
                "handler": "店员小王",
                "timestamp": "2026-05-01 09:30:00",
                "notes": "",
            },
            {
                "pet_id": 2,
                "plan_id": 4,
                "type": "feeding",
                "name": "处方狗粮",
                "dosage": "100g",
                "status": "completed",
                "handler": "店员小王",
                "timestamp": "2026-05-01 09:00:00",
                "notes": "食欲正常",
            },
            {
                "pet_id": 2,
                "plan_id": 3,
                "type": "medication",
                "name": "心脏病药物B",
                "dosage": "半片",
                "status": "completed",
                "handler": "店员小李",
                "timestamp": "2026-05-01 19:30:00",
                "notes": "",
            },
            {
                "pet_id": 2,
                "plan_id": 2,
                "type": "medication",
                "name": "心脏病药物A",
                "dosage": "1片",
                "status": "missed",
                "handler": "店员小李",
                "timestamp": "2026-05-02",
                "notes": "当日忙碌忘记给药",
            },
            {
                "pet_id": 2,
                "plan_id": 2,
                "type": "medication",
                "name": "心脏病药物A",
                "dosage": "1片",
                "status": "makeup",
                "handler": "店员小张",
                "timestamp": "2026-05-03 09:00:00",
                "notes": "5月2日漏服，今日补服",
            },
            {
                "pet_id": 2,
                "plan_id": 2,
                "type": "medication",
                "name": "心脏病药物A",
                "dosage": "1片",
                "status": "completed",
                "handler": "店员小张",
                "timestamp": "2026-05-03 09:30:00",
                "notes": "今日正常剂量",
            },
            {
                "pet_id": 1,
                "type": "abnormal",
                "name": "异常观察",
                "observation": "轻微软便",
                "handler": "店员小王",
                "action_taken": "减少食量，密切观察",
                "timestamp": "2026-05-04 10:00:00",
            },
            {
                "pet_id": 2,
                "plan_id": 2,
                "type": "medication",
                "name": "心脏病药物A",
                "dosage": "1片",
                "status": "completed",
                "handler": "店员小张",
                "timestamp": "2026-05-04 09:30:00",
                "notes": "",
            },
            {
                "pet_id": 2,
                "plan_id": 2,
                "type": "medication",
                "name": "心脏病药物A",
                "dosage": "1片",
                "status": "completed",
                "handler": "店员小李",
                "timestamp": "2026-05-05 09:30:00",
                "notes": "最后一天用药",
            },
        ]

        for log_data in sample_logs:
            log_id = len(self.log_manager.logs) + 1
            log_data["id"] = log_id
            if "plan_id" not in log_data:
                log_data["plan_id"] = None
            if "dosage" not in log_data:
                log_data["dosage"] = None
            if "status" not in log_data:
                log_data["status"] = "completed"
            self.log_manager.logs.append(log_data)

        save_json(LOGS_FILE, self.log_manager.logs)

    def _add_sample_confirmations(self) -> None:
        """添加样例主人确认"""
        confirmations = [
            {
                "id": 1,
                "pet_id": 2,
                "content": "已知晓旺财5月2日漏服药物A，已及时补服，无异常",
                "timestamp": "2026-05-03 14:00:00",
                "notes": "电话确认",
            },
            {
                "id": 2,
                "pet_id": 1,
                "content": "已知晓小橘5月4日轻微软便情况，已了解处理措施",
                "timestamp": "2026-05-04 15:30:00",
                "notes": "微信确认",
            },
        ]

        self.confirmation_manager.confirmations.extend(confirmations)
        save_json(CONFIRMATIONS_FILE, self.confirmation_manager.confirmations)


def main():
    ensure_data_dir()

    pet_manager = PetManager()
    plan_manager = PlanManager(pet_manager)
    log_manager = LogManager(pet_manager, plan_manager)
    confirmation_manager = ConfirmationManager(pet_manager)
    report_generator = ReportGenerator(
        pet_manager, plan_manager, log_manager, confirmation_manager
    )
    sample_loader = SampleDataLoader(
        pet_manager, plan_manager, log_manager, confirmation_manager
    )

    parser = argparse.ArgumentParser(
        description="宠物寄养用药 CLI 工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例:
  # 加载样例数据
  python pet_boarding_meds.py load-sample

  # 宠物管理
  python pet_boarding_meds.py pet list
  python pet_boarding_meds.py pet add --name "小白" --species "猫" --age "2岁" --owner "王五" --phone "13700137003" --check-in "2026-05-10" --check-out "2026-05-15"

  # 计划管理
  python pet_boarding_meds.py plan list
  python pet_boarding_meds.py plan add --pet-id 1 --type medication --name "阿莫西林" --dosage "1片" --frequency "每日2次" --start "2026-05-10" --end "2026-05-15"

  # 打卡执行
  python pet_boarding_meds.py log list
  python pet_boarding_meds.py log add --pet-id 1 --plan-id 1 --dosage "1片" --handler "小王"
  python pet_boarding_meds.py log missed --pet-id 1 --plan-id 1 --date "2026-05-11" --handler "小王"
  python pet_boarding_meds.py log makeup --pet-id 1 --plan-id 1 --dosage "1片" --handler "小张"

  # 异常观察
  python pet_boarding_meds.py log abnormal --pet-id 1 --observation "食欲不振" --handler "小王" --action "减少食量，观察"

  # 主人确认
  python pet_boarding_meds.py confirmation list
  python pet_boarding_meds.py confirmation add --pet-id 1 --content "已知晓用药情况"

  # 检查漏服
  python pet_boarding_meds.py check-missed --pet-id 1

  # 生成报告
  python pet_boarding_meds.py report --pet-id 1
  python pet_boarding_meds.py report --pet-id 1 --output "report.txt"

  # 宠物离店
  python pet_boarding_meds.py pet check-out --pet-id 1
        """,
    )

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    subparsers.add_parser("load-sample", help="加载样例数据")

    pet_parser = subparsers.add_parser("pet", help="宠物档案管理")
    pet_subparsers = pet_parser.add_subparsers(dest="pet_command")
    pet_subparsers.add_parser("list", help="列出所有宠物")

    pet_add_parser = pet_subparsers.add_parser("add", help="添加新宠物")
    pet_add_parser.add_argument("--name", required=True, help="宠物名字")
    pet_add_parser.add_argument("--species", required=True, help="宠物种类")
    pet_add_parser.add_argument("--age", required=True, help="宠物年龄")
    pet_add_parser.add_argument("--owner", required=True, help="主人姓名")
    pet_add_parser.add_argument("--phone", required=True, help="联系电话")
    pet_add_parser.add_argument("--check-in", required=True, help="入住时间 (YYYY-MM-DD)")
    pet_add_parser.add_argument("--check-out", required=True, help="预计离店时间 (YYYY-MM-DD)")
    pet_add_parser.add_argument("--medical", help="慢性病情况")
    pet_add_parser.add_argument("--notes", help="备注")

    pet_checkout_parser = pet_subparsers.add_parser("check-out", help="宠物离店")
    pet_checkout_parser.add_argument("--pet-id", type=int, required=True, help="宠物ID")

    plan_parser = subparsers.add_parser("plan", help="喂食和用药计划管理")
    plan_subparsers = plan_parser.add_subparsers(dest="plan_command")
    plan_list_parser = plan_subparsers.add_parser("list", help="列出所有计划")
    plan_list_parser.add_argument("--pet-id", type=int, help="按宠物ID筛选")

    plan_add_parser = plan_subparsers.add_parser("add", help="添加新计划")
    plan_add_parser.add_argument("--pet-id", type=int, required=True, help="宠物ID")
    plan_add_parser.add_argument(
        "--type", required=True, choices=["medication", "feeding"], help="计划类型"
    )
    plan_add_parser.add_argument("--name", required=True, help="项目名称")
    plan_add_parser.add_argument("--dosage", required=True, help="剂量/份量")
    plan_add_parser.add_argument("--frequency", required=True, help="使用频率")
    plan_add_parser.add_argument("--start", required=True, help="开始日期")
    plan_add_parser.add_argument("--end", required=True, help="结束日期")
    plan_add_parser.add_argument("--notes", help="备注")

    log_parser = subparsers.add_parser("log", help="执行记录管理")
    log_subparsers = log_parser.add_subparsers(dest="log_command")
    log_list_parser = log_subparsers.add_parser("list", help="列出所有记录")
    log_list_parser.add_argument("--pet-id", type=int, help="按宠物ID筛选")

    log_add_parser = log_subparsers.add_parser("add", help="打卡执行")
    log_add_parser.add_argument("--pet-id", type=int, required=True, help="宠物ID")
    log_add_parser.add_argument("--plan-id", type=int, required=True, help="计划ID")
    log_add_parser.add_argument("--dosage", required=True, help="实际剂量")
    log_add_parser.add_argument("--handler", required=True, help="执行人")
    log_add_parser.add_argument("--notes", help="备注")

    log_missed_parser = log_subparsers.add_parser("missed", help="记录漏服")
    log_missed_parser.add_argument("--pet-id", type=int, required=True, help="宠物ID")
    log_missed_parser.add_argument("--plan-id", type=int, required=True, help="计划ID")
    log_missed_parser.add_argument("--date", required=True, help="漏服日期")
    log_missed_parser.add_argument("--handler", required=True, help="记录人")
    log_missed_parser.add_argument("--notes", help="备注")

    log_makeup_parser = log_subparsers.add_parser("makeup", help="记录补服")
    log_makeup_parser.add_argument("--pet-id", type=int, required=True, help="宠物ID")
    log_makeup_parser.add_argument("--plan-id", type=int, required=True, help="计划ID")
    log_makeup_parser.add_argument("--dosage", required=True, help="补服剂量")
    log_makeup_parser.add_argument("--handler", required=True, help="执行人")
    log_makeup_parser.add_argument("--notes", help="备注")

    log_abnormal_parser = log_subparsers.add_parser("abnormal", help="记录异常观察")
    log_abnormal_parser.add_argument("--pet-id", type=int, required=True, help="宠物ID")
    log_abnormal_parser.add_argument("--observation", required=True, help="异常情况描述")
    log_abnormal_parser.add_argument("--handler", required=True, help="记录人")
    log_abnormal_parser.add_argument("--action", help="采取的措施")

    conf_parser = subparsers.add_parser("confirmation", help="主人确认管理")
    conf_subparsers = conf_parser.add_subparsers(dest="confirmation_command")
    conf_list_parser = conf_subparsers.add_parser("list", help="列出所有确认记录")
    conf_list_parser.add_argument("--pet-id", type=int, help="按宠物ID筛选")

    conf_add_parser = conf_subparsers.add_parser("add", help="添加主人确认")
    conf_add_parser.add_argument("--pet-id", type=int, required=True, help="宠物ID")
    conf_add_parser.add_argument("--content", required=True, help="确认内容")
    conf_add_parser.add_argument("--notes", help="备注")

    check_missed_parser = subparsers.add_parser("check-missed", help="检查漏服情况")
    check_missed_parser.add_argument("--pet-id", type=int, required=True, help="宠物ID")

    report_parser = subparsers.add_parser("report", help="生成寄养报告")
    report_parser.add_argument("--pet-id", type=int, required=True, help="宠物ID")
    report_parser.add_argument("--output", help="输出文件路径（可选，不指定则打印到终端）")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    if args.command == "load-sample":
        sample_loader.load_sample_data()

    elif args.command == "pet":
        if args.pet_command == "list":
            pet_manager.list_pets()
        elif args.pet_command == "add":
            pet_manager.add_pet(
                name=args.name,
                species=args.species,
                age=args.age,
                owner_name=args.owner,
                owner_phone=args.phone,
                check_in=args.check_in,
                check_out=args.check_out,
                medical_conditions=args.medical,
                notes=args.notes,
            )
        elif args.pet_command == "check-out":
            pet_manager.check_out(args.pet_id)

    elif args.command == "plan":
        if args.plan_command == "list":
            plan_manager.list_plans(args.pet_id)
        elif args.plan_command == "add":
            plan_manager.add_plan(
                pet_id=args.pet_id,
                plan_type=args.type,
                name=args.name,
                dosage=args.dosage,
                frequency=args.frequency,
                start_date=args.start,
                end_date=args.end,
                notes=args.notes,
            )

    elif args.command == "log":
        if args.log_command == "list":
            log_manager.list_logs(args.pet_id)
        elif args.log_command == "add":
            log_manager.add_log(
                pet_id=args.pet_id,
                plan_id=args.plan_id,
                dosage=args.dosage,
                handler=args.handler,
                notes=args.notes,
            )
        elif args.log_command == "missed":
            log_manager.add_missed_log(
                pet_id=args.pet_id,
                plan_id=args.plan_id,
                missed_date=args.date,
                handler=args.handler,
                notes=args.notes,
            )
        elif args.log_command == "makeup":
            log_manager.add_makeup_log(
                pet_id=args.pet_id,
                plan_id=args.plan_id,
                dosage=args.dosage,
                handler=args.handler,
                notes=args.notes,
            )
        elif args.log_command == "abnormal":
            log_manager.add_abnormal_observation(
                pet_id=args.pet_id,
                observation=args.observation,
                handler=args.handler,
                action_taken=args.action,
            )

    elif args.command == "confirmation":
        if args.confirmation_command == "list":
            confirmation_manager.list_confirmations(args.pet_id)
        elif args.confirmation_command == "add":
            confirmation_manager.add_confirmation(
                pet_id=args.pet_id,
                content=args.content,
                notes=args.notes,
            )

    elif args.command == "check-missed":
        log_manager.check_missed_doses(args.pet_id)

    elif args.command == "report":
        report_generator.generate_report(
            pet_id=args.pet_id,
            output_file=args.output,
        )


if __name__ == "__main__":
    main()

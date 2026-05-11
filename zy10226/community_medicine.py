#!/usr/bin/env python3
"""社区药箱补货 CLI - 社区药品库存管理系统"""

import argparse
import json
import csv
import os
import sys
import uuid
from datetime import datetime, date, timedelta
from collections import defaultdict
from typing import Dict, List, Any, Optional


DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
DATA_FILE = os.path.join(DATA_DIR, "medicine_data.json")


class MedicineStore:
    """药品数据存储管理"""

    def __init__(self):
        self._ensure_data_dir()
        self.data = self._load_data()

    def _ensure_data_dir(self):
        if not os.path.exists(DATA_DIR):
            os.makedirs(DATA_DIR)

    def _load_data(self) -> Dict:
        if not os.path.exists(DATA_FILE):
            return {
                "medicines": {},
                "inventory": [],
                "usage_records": [],
                "replenish_records": [],
                "offline_records": [],
                "operations": []
            }
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)

    def save(self):
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(self.data, f, ensure_ascii=False, indent=2)

    def _generate_id(self) -> str:
        return uuid.uuid4().hex[:12]

    def _record_operation(self, op_type: str, details: Dict, operator: str = "system"):
        self.data["operations"].append({
            "id": self._generate_id(),
            "type": op_type,
            "timestamp": datetime.now().isoformat(),
            "operator": operator,
            "details": details
        })


class MedicineValidator:
    """业务逻辑验证器"""

    def __init__(self, store: MedicineStore, today: Optional[date] = None):
        self.store = store
        self.today = today or date.today()

    def check_batch_duplicate(self, medicine_id: str, batch_no: str, source: str) -> Dict:
        """检查同批号重复入库"""
        existing = [
            item for item in self.store.data["inventory"]
            if item["medicine_id"] == medicine_id
            and item["batch_no"] == batch_no
            and item["source"] == source
            and item["status"] != "removed"
        ]
        return {
            "has_duplicate": len(existing) > 0,
            "existing_items": existing,
            "total_qty": sum(item["quantity"] for item in existing)
        }

    def check_expired_usable(self, inventory_item: Dict, allow_expired_days: int = 0) -> Dict:
        """检查过期药是否仍可领用"""
        exp_date = datetime.strptime(inventory_item["expiry_date"], "%Y-%m-%d").date()
        days_to_expire = (exp_date - self.today).days
        is_expired = days_to_expire < 0
        can_use = days_to_expire >= -allow_expired_days
        return {
            "is_expired": is_expired,
            "days_to_expire": days_to_expire,
            "can_use": can_use,
            "grace_period_used": max(0, -days_to_expire) if is_expired else 0
        }

    def check_usage_quantity(self, inventory_item: Dict, usage_qty: int) -> Dict:
        """检查领用量是否超过库存"""
        available_qty = inventory_item["quantity"]
        return {
            "available": available_qty,
            "requested": usage_qty,
            "exceeds": usage_qty > available_qty,
            "deficit": max(0, usage_qty - available_qty)
        }

    def check_offline_replenish(self, inventory_item: Dict) -> Dict:
        """检查下架后是否被补回"""
        item_id = inventory_item["id"]
        offline_records = [
            rec for rec in self.store.data["offline_records"]
            if rec["inventory_id"] == item_id
        ]
        replenish_records = [
            rec for rec in self.store.data["replenish_records"]
            if rec["inventory_id"] == item_id
        ]
        return {
            "has_been_offline": len(offline_records) > 0,
            "offline_count": len(offline_records),
            "replenish_after_offline": len(replenish_records) > len(offline_records)
        }

    def check_duplicate_operation(self, op_type: str, signature: str) -> bool:
        """检查重复操作"""
        for op in self.store.data["operations"]:
            if op["type"] == op_type and op["details"].get("signature") == signature:
                return True
        return False


class MedicineService:
    """核心业务逻辑服务"""

    def __init__(self, store: MedicineStore, validator: MedicineValidator):
        self.store = store
        self.validator = validator

    def add_medicine(self, name: str, unit: str, min_stock: int, category: str = "") -> Dict:
        """添加药品信息"""
        medicine_id = self.store._generate_id()
        signature = f"medicine_{name}_{unit}"
        if self.validator.check_duplicate_operation("add_medicine", signature):
            return {"success": False, "reason": "重复操作：该药品已存在"}
        
        medicine = {
            "id": medicine_id,
            "name": name,
            "unit": unit,
            "min_stock": min_stock,
            "category": category,
            "created_at": datetime.now().isoformat()
        }
        self.store.data["medicines"][medicine_id] = medicine
        self.store._record_operation("add_medicine", {
            "signature": signature,
            "medicine": medicine
        })
        return {"success": True, "medicine": medicine}

    def replenish(self, medicine_id: str, batch_no: str, expiry_date: str,
                  quantity: int, source: str, volunteer: str,
                  allow_expired_days: int = 0) -> Dict:
        """补货入库"""
        if medicine_id not in self.store.data["medicines"]:
            return {"success": False, "reason": "药品不存在"}

        check_result = self.validator.check_batch_duplicate(medicine_id, batch_no, source)
        if check_result["has_duplicate"]:
            return {
                "success": False,
                "reason": f"同批号同来源已存在，现有数量: {check_result['total_qty']}",
                "duplicate_check": check_result
            }

        signature = f"replenish_{medicine_id}_{batch_no}_{source}_{quantity}_{volunteer}"
        if self.validator.check_duplicate_operation("replenish", signature):
            return {"success": False, "reason": "重复操作：该批次已入库"}

        inventory_item = {
            "id": self.store._generate_id(),
            "medicine_id": medicine_id,
            "batch_no": batch_no,
            "expiry_date": expiry_date,
            "quantity": quantity,
            "source": source,
            "status": "active",
            "created_at": datetime.now().isoformat()
        }
        
        self.store.data["inventory"].append(inventory_item)
        
        replenish_record = {
            "id": self.store._generate_id(),
            "inventory_id": inventory_item["id"],
            "medicine_id": medicine_id,
            "quantity": quantity,
            "source": source,
            "volunteer": volunteer,
            "timestamp": datetime.now().isoformat()
        }
        self.store.data["replenish_records"].append(replenish_record)
        
        self.store._record_operation("replenish", {
            "signature": signature,
            "inventory_item": inventory_item,
            "duplicate_check": check_result
        })
        
        return {
            "success": True,
            "inventory_item": inventory_item,
            "duplicate_check": check_result
        }

    def use_medicine(self, inventory_id: str, quantity: int,
                     resident: str, allow_expired_days: int = 0) -> Dict:
        """居民领用"""
        inventory_item = next(
            (item for item in self.store.data["inventory"] if item["id"] == inventory_id),
            None
        )
        if not inventory_item:
            return {"success": False, "reason": "库存记录不存在"}
        if inventory_item["status"] != "active":
            return {"success": False, "reason": "该批次已下架或已移除"}

        exp_check = self.validator.check_expired_usable(inventory_item, allow_expired_days)
        if not exp_check["can_use"]:
            return {
                "success": False,
                "reason": f"药品已过期{exp_check['grace_period_used']}天，超过宽限期",
                "expiry_check": exp_check
            }

        qty_check = self.validator.check_usage_quantity(inventory_item, quantity)
        if qty_check["exceeds"]:
            return {
                "success": False,
                "reason": f"领用量超过库存，库存{qty_check['available']}，申请{qty_check['requested']}",
                "quantity_check": qty_check
            }

        signature = f"use_{inventory_id}_{quantity}_{resident}_{datetime.now().strftime('%Y%m%d')}"
        if self.validator.check_duplicate_operation("use", signature):
            return {"success": False, "reason": "重复操作：该领用已记录"}

        inventory_item["quantity"] -= quantity
        
        usage_record = {
            "id": self.store._generate_id(),
            "inventory_id": inventory_id,
            "medicine_id": inventory_item["medicine_id"],
            "quantity": quantity,
            "resident": resident,
            "expiry_check": exp_check,
            "timestamp": datetime.now().isoformat()
        }
        self.store.data["usage_records"].append(usage_record)
        
        self.store._record_operation("use", {
            "signature": signature,
            "usage_record": usage_record
        })
        
        return {
            "success": True,
            "usage_record": usage_record,
            "remaining_quantity": inventory_item["quantity"]
        }

    def offline(self, inventory_id: str, reason: str, operator: str) -> Dict:
        """下架药品"""
        inventory_item = next(
            (item for item in self.store.data["inventory"] if item["id"] == inventory_id),
            None
        )
        if not inventory_item:
            return {"success": False, "reason": "库存记录不存在"}
        if inventory_item["status"] == "offline":
            return {"success": False, "reason": "该批次已下架"}
        if inventory_item["status"] == "removed":
            return {"success": False, "reason": "该批次已移除"}

        signature = f"offline_{inventory_id}_{reason}_{datetime.now().strftime('%Y%m%d')}"
        if self.validator.check_duplicate_operation("offline", signature):
            return {"success": False, "reason": "重复操作：该下架已记录"}

        inventory_item["status"] = "offline"
        
        offline_record = {
            "id": self.store._generate_id(),
            "inventory_id": inventory_id,
            "medicine_id": inventory_item["medicine_id"],
            "reason": reason,
            "operator": operator,
            "timestamp": datetime.now().isoformat()
        }
        self.store.data["offline_records"].append(offline_record)
        
        self.store._record_operation("offline", {
            "signature": signature,
            "offline_record": offline_record
        })
        
        return {"success": True, "offline_record": offline_record}

    def replenish_offline(self, inventory_id: str, quantity: int,
                          volunteer: str) -> Dict:
        """下架后补回"""
        inventory_item = next(
            (item for item in self.store.data["inventory"] if item["id"] == inventory_id),
            None
        )
        if not inventory_item:
            return {"success": False, "reason": "库存记录不存在"}
        if inventory_item["status"] != "offline":
            return {"success": False, "reason": "该批次不在下架状态"}

        signature = f"replenish_offline_{inventory_id}_{quantity}_{volunteer}"
        if self.validator.check_duplicate_operation("replenish_offline", signature):
            return {"success": False, "reason": "重复操作：该补回已记录"}

        inventory_item["status"] = "active"
        inventory_item["quantity"] += quantity
        
        replenish_record = {
            "id": self.store._generate_id(),
            "inventory_id": inventory_id,
            "medicine_id": inventory_item["medicine_id"],
            "quantity": quantity,
            "source": "补回",
            "volunteer": volunteer,
            "timestamp": datetime.now().isoformat()
        }
        self.store.data["replenish_records"].append(replenish_record)
        
        self.store._record_operation("replenish_offline", {
            "signature": signature,
            "replenish_record": replenish_record
        })
        
        return {"success": True, "replenish_record": replenish_record}

    def get_inventory_status(self, warning_days: int = 30) -> Dict:
        """获取库存状态报告"""
        medicines = self.store.data["medicines"]
        inventory = self.store.data["inventory"]
        
        available_stock = defaultdict(lambda: {"total": 0, "batches": [], "expired_batches": []})
        expiring_soon = []
        need_replenish = []
        handover_diff = []
        
        today = self.validator.today
        
        for item in inventory:
            if item["status"] != "active":
                continue
            
            medicine = medicines.get(item["medicine_id"], {})
            medicine_name = medicine.get("name", "未知药品")
            
            exp_date = datetime.strptime(item["expiry_date"], "%Y-%m-%d").date()
            days_to_expire = (exp_date - today).days
            
            is_expired = days_to_expire < 0
            batch_info = {
                "id": item["id"],
                "batch_no": item["batch_no"],
                "quantity": item["quantity"],
                "expiry_date": item["expiry_date"],
                "days_to_expire": days_to_expire,
                "source": item["source"]
            }
            
            if is_expired:
                available_stock[item["medicine_id"]]["expired_batches"].append(batch_info)
            else:
                available_stock[item["medicine_id"]]["total"] += item["quantity"]
                available_stock[item["medicine_id"]]["batches"].append(batch_info)
                
                if days_to_expire <= warning_days:
                    expiring_soon.append({
                        "medicine_id": item["medicine_id"],
                        "medicine_name": medicine_name,
                        "batch_no": item["batch_no"],
                        "expiry_date": item["expiry_date"],
                        "days_to_expire": days_to_expire,
                        "quantity": item["quantity"]
                    })
        
        for med_id, info in available_stock.items():
            medicine = medicines.get(med_id, {})
            min_stock = medicine.get("min_stock", 0)
            total_qty = info["total"]
            if total_qty < min_stock:
                need_replenish.append({
                    "medicine_id": med_id,
                    "medicine_name": medicine.get("name", "未知"),
                    "current_stock": total_qty,
                    "min_stock": min_stock,
                    "deficit": min_stock - total_qty
                })
        
        inventory_ids_with_offline = set()
        for rec in self.store.data["offline_records"]:
            inventory_ids_with_offline.add(rec["inventory_id"])
        
        for inv_id in inventory_ids_with_offline:
            item = next((i for i in inventory if i["id"] == inv_id), None)
            if not item:
                continue
            medicine = medicines.get(item["medicine_id"], {})
            offline_check = self.validator.check_offline_replenish(item)
            handover_diff.append({
                "inventory_id": item["id"],
                "medicine_id": item["medicine_id"],
                "medicine_name": medicine.get("name", "未知"),
                "batch_no": item["batch_no"],
                "quantity": item["quantity"],
                "current_status": item["status"],
                "offline_count": offline_check["offline_count"],
                "replenish_after_offline": offline_check["replenish_after_offline"]
            })
        
        return {
            "available_stock": dict(available_stock),
            "expiring_soon": sorted(expiring_soon, key=lambda x: x["days_to_expire"]),
            "need_replenish": sorted(need_replenish, key=lambda x: x["deficit"], reverse=True),
            "handover_diff": handover_diff
        }

    def export_data(self, data_type: str, file_path: str, fmt: str = "json"):
        """导出数据"""
        data = {
            "medicines": self.store.data["medicines"],
            "inventory": self.store.data["inventory"],
            "usage": self.store.data["usage_records"],
            "replenish": self.store.data["replenish_records"],
            "offline": self.store.data["offline_records"],
            "operations": self.store.data["operations"]
        }.get(data_type, [])
        
        if fmt == "json":
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
        elif fmt == "csv":
            if isinstance(data, dict):
                rows = list(data.values())
            else:
                rows = data
            if rows:
                with open(file_path, "w", encoding="utf-8-sig", newline="") as f:
                    writer = csv.DictWriter(f, fieldnames=rows[0].keys())
                    writer.writeheader()
                    writer.writerows(rows)


class SampleDataLoader:
    """样例数据加载器"""

    def __init__(self, service: MedicineService):
        self.service = service

    def load_sample_data(self):
        store = self.service.store
        validator = self.service.validator
        today = validator.today
        
        medicines = [
            {"name": "布洛芬缓释胶囊", "unit": "盒", "min_stock": 10, "category": "解热镇痛"},
            {"name": "复方氨酚烷胺片", "unit": "盒", "min_stock": 8, "category": "感冒用药"},
            {"name": "碘伏消毒液", "unit": "瓶", "min_stock": 15, "category": "消毒用品"},
            {"name": "创可贴", "unit": "盒", "min_stock": 20, "category": "外伤处理"},
            {"name": "蒙脱石散", "unit": "盒", "min_stock": 5, "category": "肠胃用药"},
        ]
        
        med_ids = {}
        for med in medicines:
            result = self.service.add_medicine(
                name=med["name"],
                unit=med["unit"],
                min_stock=med["min_stock"],
                category=med["category"]
            )
            if result["success"]:
                med_ids[med["name"]] = result["medicine"]["id"]
        
        expiry_30_days = (today + timedelta(days=30)).strftime("%Y-%m-%d")
        expiry_7_days = (today + timedelta(days=7)).strftime("%Y-%m-%d")
        expired_5_days = (today - timedelta(days=5)).strftime("%Y-%m-%d")
        expired_60_days = (today - timedelta(days=60)).strftime("%Y-%m-%d")
        expiry_1_year = (today + timedelta(days=365)).strftime("%Y-%m-%d")
        
        replenish_tasks = [
            ("布洛芬缓释胶囊", "20250101", expiry_30_days, 5, "社区医院捐赠", "张志愿者"),
            ("布洛芬缓释胶囊", "20250301", expiry_1_year, 8, "居民李XX捐赠", "王志愿者"),
            ("布洛芬缓释胶囊", "20250301", expiry_1_year, 3, "居民李XX捐赠", "王志愿者"),
            ("复方氨酚烷胺片", "20250201", expiry_7_days, 2, "药店捐赠", "李志愿者"),
            ("复方氨酚烷胺片", "20250401", expiry_1_year, 6, "社区医院捐赠", "张志愿者"),
            ("碘伏消毒液", "20250115", expired_5_days, 4, "居民王XX捐赠", "赵志愿者"),
            ("碘伏消毒液", "20250315", expiry_1_year, 2, "药店捐赠", "王志愿者"),
            ("创可贴", "20241201", expired_60_days, 3, "居民刘XX捐赠", "张志愿者"),
            ("创可贴", "20250301", expiry_1_year, 18, "社区医院捐赠", "李志愿者"),
            ("蒙脱石散", "20250201", expiry_30_days, 3, "药店捐赠", "赵志愿者"),
        ]
        
        inventory_ids = {}
        for med_name, batch_no, exp_date, qty, source, volunteer in replenish_tasks:
            med_id = med_ids.get(med_name)
            if med_id:
                result = self.service.replenish(
                    medicine_id=med_id,
                    batch_no=batch_no,
                    expiry_date=exp_date,
                    quantity=qty,
                    source=source,
                    volunteer=volunteer
                )
                if result["success"]:
                    key = f"{med_name}_{batch_no}_{source}"
                    if key not in inventory_ids:
                        inventory_ids[key] = result["inventory_item"]["id"]
        
        self.service.use_medicine(
            inventory_id=inventory_ids.get("布洛芬缓释胶囊_20250101_社区医院捐赠"),
            quantity=2,
            resident="居民张XX",
            allow_expired_days=0
        )
        
        self.service.use_medicine(
            inventory_id=inventory_ids.get("碘伏消毒液_20250115_居民王XX捐赠"),
            quantity=1,
            resident="居民李XX",
            allow_expired_days=7
        )
        
        offline_id = inventory_ids.get("创可贴_20241201_居民刘XX捐赠")
        if offline_id:
            self.service.offline(
                inventory_id=offline_id,
                reason="过期下架",
                operator="王志愿者"
            )
        
        store.save()


class CLIController:
    """CLI 控制器"""

    def __init__(self):
        self.store = MedicineStore()
        self.validator = MedicineValidator(self.store)
        self.service = MedicineService(self.store, self.validator)
        self.sample_loader = SampleDataLoader(self.service)

    def cmd_status(self, args):
        print("\n" + "=" * 60)
        print("社区药箱库存状态报告")
        print("=" * 60)
        
        status = self.service.get_inventory_status(warning_days=args.warning_days)
        medicines = self.store.data["medicines"]
        
        print(f"\n【可用库存】共 {len(status['available_stock'])} 种药品")
        for med_id, info in status["available_stock"].items():
            med = medicines.get(med_id, {})
            print(f"\n  {med.get('name', '未知')} (ID: {med_id})")
            print(f"    有效库存: {info['total']} {med.get('unit', '')}")
            print(f"    最低库存要求: {med.get('min_stock', 0)} {med.get('unit', '')}")
            if info["batches"]:
                print(f"    有效批次:")
                for batch in info["batches"]:
                    expire_status = f"即将过期({batch['days_to_expire']}天)" if batch["days_to_expire"] <= 30 else "正常"
                    print(f"      - 批号: {batch['batch_no']} | 数量: {batch['quantity']} | "
                          f"有效期: {batch['expiry_date']} | {expire_status} | 来源: {batch['source']}")
            if info.get("expired_batches"):
                print(f"    ⚠️  已过期批次（不计入可用库存）:")
                for batch in info["expired_batches"]:
                    print(f"      - 批号: {batch['batch_no']} | 数量: {batch['quantity']} | "
                          f"有效期: {batch['expiry_date']} | 已过期({-batch['days_to_expire']}天) | 来源: {batch['source']}")
        
        print(f"\n【即将过期】共 {len(status['expiring_soon'])} 个批次")
        for item in status["expiring_soon"]:
            print(f"  - {item['medicine_name']} | 批号: {item['batch_no']} | "
                  f"剩余{item['days_to_expire']}天过期 | 数量: {item['quantity']}")
        
        print(f"\n【需要补货】共 {len(status['need_replenish'])} 种药品")
        for item in status["need_replenish"]:
            print(f"  - {item['medicine_name']} | 有效库存: {item['current_stock']} | "
                  f"最低: {item['min_stock']} | 缺口: {item['deficit']}")
        
        print(f"\n【交接差异】共 {len(status['handover_diff'])} 个批次（含历史下架记录）")
        for item in status["handover_diff"]:
            status_str = "下架中" if item["current_status"] == "offline" else "已补回(active)"
            replenish_flag = "✓ 已补回" if item["replenish_after_offline"] else "✗ 未补回"
            print(f"  - {item['medicine_name']} | 批号: {item['batch_no']} | "
                  f"下架次数: {item['offline_count']} | 当前状态: {status_str} | {replenish_flag}")
        
        print("\n" + "=" * 60)

    def cmd_check_replenish(self, args):
        print("\n" + "=" * 60)
        print("补货预检查")
        print("=" * 60)
        
        if args.medicine_id not in self.store.data["medicines"]:
            print(f"错误: 药品 {args.medicine_id} 不存在")
            return
        
        medicine = self.store.data["medicines"][args.medicine_id]
        
        batch_check = self.validator.check_batch_duplicate(
            args.medicine_id, args.batch_no, args.source
        )
        
        exp_date = datetime.strptime(args.expiry_date, "%Y-%m-%d").date()
        days_to_expire = (exp_date - self.validator.today).days
        
        print(f"\n药品: {medicine['name']}")
        print(f"批号: {args.batch_no}")
        print(f"有效期: {args.expiry_date} (剩余{days_to_expire}天)")
        print(f"数量: {args.quantity} {medicine['unit']}")
        print(f"来源: {args.source}")
        print(f"志愿者: {args.volunteer}")
        
        if batch_check["has_duplicate"]:
            print(f"\n✗ 错误: 发现同批号同来源的现有库存，不能重复入库")
            print(f"   现有数量: {batch_check['total_qty']}")
            print(f"   请核对后使用不同批号或来源，或使用补回功能")
            return
        else:
            print(f"\n✓ 批号检查通过：无重复批次")
        
        if days_to_expire < 0:
            print(f"⚠️  警告: 该批次已过期 {-days_to_expire} 天")
        elif days_to_expire <= 30:
            print(f"⚠️  注意: 该批次 {days_to_expire} 天后过期")
        
        print("\n确认执行补货？(yes/no): ", end="")
        confirm = input().strip().lower()
        if confirm in ("yes", "y"):
            result = self.service.replenish(
                medicine_id=args.medicine_id,
                batch_no=args.batch_no,
                expiry_date=args.expiry_date,
                quantity=args.quantity,
                source=args.source,
                volunteer=args.volunteer,
                allow_expired_days=args.allow_expired_days
            )
            if result["success"]:
                self.store.save()
                print(f"\n✓ 补货成功！库存ID: {result['inventory_item']['id']}")
            else:
                print(f"\n✗ 补货失败: {result['reason']}")
        else:
            print("\n已取消")

    def cmd_check_use(self, args):
        print("\n" + "=" * 60)
        print("领用预检查")
        print("=" * 60)
        
        inventory_item = next(
            (item for item in self.store.data["inventory"] if item["id"] == args.inventory_id),
            None
        )
        if not inventory_item:
            print(f"错误: 库存记录 {args.inventory_id} 不存在")
            return
        
        medicine = self.store.data["medicines"].get(inventory_item["medicine_id"], {})
        
        exp_check = self.validator.check_expired_usable(inventory_item, args.allow_expired_days)
        qty_check = self.validator.check_usage_quantity(inventory_item, args.quantity)
        
        print(f"\n药品: {medicine.get('name', '未知')}")
        print(f"库存ID: {args.inventory_id}")
        print(f"批号: {inventory_item['batch_no']}")
        print(f"有效期: {inventory_item['expiry_date']}")
        print(f"申请数量: {args.quantity}")
        print(f"居民: {args.resident}")
        
        print(f"\n过期检查:")
        if exp_check["is_expired"]:
            print(f"  ⚠️  已过期 {-exp_check['days_to_expire']} 天")
            if exp_check["can_use"]:
                print(f"  ✓ 在宽限期内（{args.allow_expired_days}天），可领用")
            else:
                print(f"  ✗ 超出宽限期，不可领用")
        else:
            print(f"  ✓ 正常，剩余 {exp_check['days_to_expire']} 天")
        
        print(f"\n库存检查:")
        print(f"  可用库存: {qty_check['available']}")
        if qty_check["exceeds"]:
            print(f"  ✗ 超出库存 {qty_check['deficit']}")
        else:
            print(f"  ✓ 库存充足")
        
        can_proceed = exp_check["can_use"] and not qty_check["exceeds"]
        
        if not can_proceed:
            print(f"\n✗ 检查未通过，无法执行领用")
            return
        
        print("\n确认执行领用？(yes/no): ", end="")
        confirm = input().strip().lower()
        if confirm in ("yes", "y"):
            result = self.service.use_medicine(
                inventory_id=args.inventory_id,
                quantity=args.quantity,
                resident=args.resident,
                allow_expired_days=args.allow_expired_days
            )
            if result["success"]:
                self.store.save()
                print(f"\n✓ 领用成功！剩余库存: {result['remaining_quantity']}")
            else:
                print(f"\n✗ 领用失败: {result['reason']}")
        else:
            print("\n已取消")

    def cmd_check_offline(self, args):
        print("\n" + "=" * 60)
        print("下架预检查")
        print("=" * 60)
        
        inventory_item = next(
            (item for item in self.store.data["inventory"] if item["id"] == args.inventory_id),
            None
        )
        if not inventory_item:
            print(f"错误: 库存记录 {args.inventory_id} 不存在")
            return
        
        medicine = self.store.data["medicines"].get(inventory_item["medicine_id"], {})
        offline_check = self.validator.check_offline_replenish(inventory_item)
        
        print(f"\n药品: {medicine.get('name', '未知')}")
        print(f"库存ID: {args.inventory_id}")
        print(f"批号: {inventory_item['batch_no']}")
        print(f"当前状态: {inventory_item['status']}")
        print(f"下架原因: {args.reason}")
        print(f"操作人: {args.operator}")
        
        if offline_check["has_been_offline"]:
            print(f"\n⚠️  历史记录: 曾下架 {offline_check['offline_count']} 次")
        
        if inventory_item["status"] == "offline":
            print(f"\n✗ 该批次已下架")
            return
        if inventory_item["status"] == "removed":
            print(f"\n✗ 该批次已移除")
            return
        
        print("\n确认执行下架？(yes/no): ", end="")
        confirm = input().strip().lower()
        if confirm in ("yes", "y"):
            result = self.service.offline(
                inventory_id=args.inventory_id,
                reason=args.reason,
                operator=args.operator
            )
            if result["success"]:
                self.store.save()
                print(f"\n✓ 下架成功！")
            else:
                print(f"\n✗ 下架失败: {result['reason']}")
        else:
            print("\n已取消")

    def cmd_check_replenish_offline(self, args):
        print("\n" + "=" * 60)
        print("下架补回预检查")
        print("=" * 60)
        
        inventory_item = next(
            (item for item in self.store.data["inventory"] if item["id"] == args.inventory_id),
            None
        )
        if not inventory_item:
            print(f"错误: 库存记录 {args.inventory_id} 不存在")
            return
        
        medicine = self.store.data["medicines"].get(inventory_item["medicine_id"], {})
        offline_check = self.validator.check_offline_replenish(inventory_item)
        
        print(f"\n药品: {medicine.get('name', '未知')}")
        print(f"库存ID: {args.inventory_id}")
        print(f"批号: {inventory_item['batch_no']}")
        print(f"当前状态: {inventory_item['status']}")
        print(f"补回数量: {args.quantity}")
        print(f"志愿者: {args.volunteer}")
        
        print(f"\n历史记录:")
        print(f"  下架次数: {offline_check['offline_count']}")
        print(f"  已补回: {'是' if offline_check['replenish_after_offline'] else '否'}")
        
        if inventory_item["status"] != "offline":
            print(f"\n✗ 该批次不在下架状态")
            return
        
        print("\n确认执行补回？(yes/no): ", end="")
        confirm = input().strip().lower()
        if confirm in ("yes", "y"):
            result = self.service.replenish_offline(
                inventory_id=args.inventory_id,
                quantity=args.quantity,
                volunteer=args.volunteer
            )
            if result["success"]:
                self.store.save()
                print(f"\n✓ 补回成功！")
            else:
                print(f"\n✗ 补回失败: {result['reason']}")
        else:
            print("\n已取消")

    def cmd_history(self, args):
        print("\n" + "=" * 60)
        print("操作历史记录")
        print("=" * 60)
        
        ops = self.store.data["operations"]
        if args.type:
            ops = [op for op in ops if op["type"] == args.type]
        
        ops = sorted(ops, key=lambda x: x["timestamp"], reverse=True)
        
        if args.limit:
            ops = ops[:args.limit]
        
        for op in ops:
            print(f"\n[{op['timestamp']}] {op['type']}")
            print(f"  ID: {op['id']}")
            print(f"  操作人: {op.get('operator', 'system')}")
            details = op["details"]
            if "medicine" in details:
                med = details["medicine"]
                print(f"  药品: {med['name']}")
            if "inventory_item" in details:
                inv = details["inventory_item"]
                print(f"  库存ID: {inv['id']}")
                print(f"  批号: {inv['batch_no']}")
            if "usage_record" in details:
                usage = details["usage_record"]
                print(f"  库存ID: {usage['inventory_id']}")
                print(f"  数量: {usage['quantity']}")
                print(f"  居民: {usage['resident']}")
            if "offline_record" in details:
                offline = details["offline_record"]
                print(f"  库存ID: {offline['inventory_id']}")
                print(f"  原因: {offline['reason']}")
        
        print(f"\n共 {len(ops)} 条记录")

    def cmd_export(self, args):
        print(f"\n导出 {args.data_type} 数据到 {args.output} (格式: {args.format})")
        self.service.export_data(args.data_type, args.output, args.format)
        print("✓ 导出完成")

    def cmd_list_medicines(self, args):
        print("\n" + "=" * 60)
        print("药品列表")
        print("=" * 60)
        
        for med_id, med in self.store.data["medicines"].items():
            print(f"\nID: {med_id}")
            print(f"  名称: {med['name']}")
            print(f"  单位: {med['unit']}")
            print(f"  最低库存: {med['min_stock']}")
            if med.get("category"):
                print(f"  分类: {med['category']}")

    def cmd_list_inventory(self, args):
        print("\n" + "=" * 60)
        print("库存列表")
        print("=" * 60)
        
        medicines = self.store.data["medicines"]
        for item in self.store.data["inventory"]:
            med = medicines.get(item["medicine_id"], {})
            print(f"\n库存ID: {item['id']}")
            print(f"  药品: {med.get('name', '未知')}")
            print(f"  批号: {item['batch_no']}")
            print(f"  有效期: {item['expiry_date']}")
            print(f"  数量: {item['quantity']}")
            print(f"  来源: {item['source']}")
            print(f"  状态: {item['status']}")

    def cmd_add_medicine(self, args):
        print("\n" + "=" * 60)
        print("添加药品")
        print("=" * 60)
        print(f"\n名称: {args.name}")
        print(f"单位: {args.unit}")
        print(f"最低库存: {args.min_stock}")
        print(f"分类: {args.category or '未指定'}")
        
        print("\n确认添加？(yes/no): ", end="")
        confirm = input().strip().lower()
        if confirm in ("yes", "y"):
            result = self.service.add_medicine(
                name=args.name,
                unit=args.unit,
                min_stock=args.min_stock,
                category=args.category
            )
            if result["success"]:
                self.store.save()
                print(f"\n✓ 添加成功！药品ID: {result['medicine']['id']}")
            else:
                print(f"\n✗ 添加失败: {result['reason']}")
        else:
            print("\n已取消")

    def cmd_load_sample(self, args):
        print("\n" + "=" * 60)
        print("加载样例数据")
        print("=" * 60)
        print("\n此操作将添加样例药品、库存和操作记录。")
        print("确认加载？(yes/no): ", end="")
        confirm = input().strip().lower()
        if confirm in ("yes", "y"):
            self.sample_loader.load_sample_data()
            print("\n✓ 样例数据加载完成！")
            print("\n运行 'python community_medicine.py status' 查看库存状态")
        else:
            print("\n已取消")


def main():
    controller = CLIController()
    
    parser = argparse.ArgumentParser(
        description="社区药箱补货 CLI - 社区药品库存管理系统",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例:
  python community_medicine.py load-sample          # 加载样例数据
  python community_medicine.py status               # 查看库存状态
  python community_medicine.py list-medicines       # 列出所有药品
  python community_medicine.py list-inventory       # 列出所有库存
  
  # 补货（分步骤）
  python community_medicine.py check-replenish --medicine-id <id> --batch-no 20250101 \\
      --expiry-date 2025-12-31 --quantity 10 --source "社区医院" --volunteer "张志愿者"
  
  # 领用（分步骤）
  python community_medicine.py check-use --inventory-id <id> --quantity 2 \\
      --resident "居民李XX" --allow-expired-days 7
  
  # 下架（分步骤）
  python community_medicine.py check-offline --inventory-id <id> \\
      --reason "过期" --operator "王志愿者"
  
  # 补回下架药品
  python community_medicine.py check-replenish-offline --inventory-id <id> \\
      --quantity 5 --volunteer "李志愿者"
  
  # 查看历史
  python community_medicine.py history --type replenish --limit 10
  
  # 导出数据
  python community_medicine.py export --data-type usage --output usage.json --format json
        """
    )
    
    subparsers = parser.add_subparsers(dest="command", required=True)
    
    subparsers.add_parser("load-sample", help="加载样例数据")
    
    status_parser = subparsers.add_parser("status", help="查看库存状态")
    status_parser.add_argument("--warning-days", type=int, default=30, help="即将过期警告天数")
    status_parser.set_defaults(func=controller.cmd_status)
    
    subparsers.add_parser("list-medicines", help="列出药品").set_defaults(
        func=controller.cmd_list_medicines
    )
    subparsers.add_parser("list-inventory", help="列出库存").set_defaults(
        func=controller.cmd_list_inventory
    )
    
    add_med_parser = subparsers.add_parser("add-medicine", help="添加药品")
    add_med_parser.add_argument("--name", required=True, help="药品名称")
    add_med_parser.add_argument("--unit", required=True, help="单位")
    add_med_parser.add_argument("--min-stock", type=int, required=True, help="最低库存")
    add_med_parser.add_argument("--category", default="", help="分类")
    add_med_parser.set_defaults(func=controller.cmd_add_medicine)
    
    replenish_parser = subparsers.add_parser("check-replenish", help="补货预检查并确认")
    replenish_parser.add_argument("--medicine-id", required=True, help="药品ID")
    replenish_parser.add_argument("--batch-no", required=True, help="批号")
    replenish_parser.add_argument("--expiry-date", required=True, help="有效期 YYYY-MM-DD")
    replenish_parser.add_argument("--quantity", type=int, required=True, help="数量")
    replenish_parser.add_argument("--source", required=True, help="捐赠来源")
    replenish_parser.add_argument("--volunteer", required=True, help="志愿者")
    replenish_parser.add_argument("--allow-expired-days", type=int, default=0, help="过期宽限天数")
    replenish_parser.set_defaults(func=controller.cmd_check_replenish)
    
    use_parser = subparsers.add_parser("check-use", help="领用预检查并确认")
    use_parser.add_argument("--inventory-id", required=True, help="库存ID")
    use_parser.add_argument("--quantity", type=int, required=True, help="数量")
    use_parser.add_argument("--resident", required=True, help="居民")
    use_parser.add_argument("--allow-expired-days", type=int, default=0, help="过期宽限天数")
    use_parser.set_defaults(func=controller.cmd_check_use)
    
    offline_parser = subparsers.add_parser("check-offline", help="下架预检查并确认")
    offline_parser.add_argument("--inventory-id", required=True, help="库存ID")
    offline_parser.add_argument("--reason", required=True, help="下架原因")
    offline_parser.add_argument("--operator", required=True, help="操作人")
    offline_parser.set_defaults(func=controller.cmd_check_offline)
    
    replenish_offline_parser = subparsers.add_parser("check-replenish-offline", help="下架补回预检查并确认")
    replenish_offline_parser.add_argument("--inventory-id", required=True, help="库存ID")
    replenish_offline_parser.add_argument("--quantity", type=int, required=True, help="数量")
    replenish_offline_parser.add_argument("--volunteer", required=True, help="志愿者")
    replenish_offline_parser.set_defaults(func=controller.cmd_check_replenish_offline)
    
    history_parser = subparsers.add_parser("history", help="查看操作历史")
    history_parser.add_argument("--type", help="操作类型筛选")
    history_parser.add_argument("--limit", type=int, help="限制条数")
    history_parser.set_defaults(func=controller.cmd_history)
    
    export_parser = subparsers.add_parser("export", help="导出数据")
    export_parser.add_argument("--data-type", required=True,
                               choices=["medicines", "inventory", "usage", "replenish", "offline", "operations"],
                               help="数据类型")
    export_parser.add_argument("--output", required=True, help="输出文件路径")
    export_parser.add_argument("--format", default="json", choices=["json", "csv"], help="输出格式")
    export_parser.set_defaults(func=controller.cmd_export)
    
    args = parser.parse_args()
    
    if args.command == "load-sample":
        controller.cmd_load_sample(args)
    elif hasattr(args, "func"):
        args.func(args)


if __name__ == "__main__":
    main()

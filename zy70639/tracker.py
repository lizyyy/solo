#!/usr/bin/env python3
"""
数据存储和核心业务逻辑
"""

import json
import os
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path
from models import (
    DonationBatch, ClothingItem, DisinfectRecord, DonationRecord,
    EliminateRecord, Organization, SortReport,
    ClothingStatus, ClothingCategory, DisinfectMethod, EliminateReason
)


class DataStore:
    """数据存储类"""
    
    def __init__(self, data_dir: str = "./data"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(exist_ok=True)
        
        self.batches_file = self.data_dir / "batches.json"
        self.items_file = self.data_dir / "items.json"
        self.disinfect_file = self.data_dir / "disinfect_records.json"
        self.donate_file = self.data_dir / "donate_records.json"
        self.eliminate_file = self.data_dir / "eliminate_records.json"
        self.orgs_file = self.data_dir / "organizations.json"
        
        self._init_files()
    
    def _init_files(self):
        """初始化数据文件"""
        for file_path in [
            self.batches_file, self.items_file, self.disinfect_file,
            self.donate_file, self.eliminate_file, self.orgs_file
        ]:
            if not file_path.exists():
                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump([], f, ensure_ascii=False, indent=2)
    
    def _load_json(self, file_path: Path) -> List[Dict]:
        """加载JSON文件"""
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    
    def _save_json(self, file_path: Path, data: List[Dict]):
        """保存JSON文件"""
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    
    def add_batch(self, batch: DonationBatch) -> bool:
        """添加捐赠批次"""
        batches = self._load_json(self.batches_file)
        batch_dict = {
            "batch_id": batch.batch_id,
            "donor_name": batch.donor_name,
            "donor_contact": batch.donor_contact,
            "receive_date": batch.receive_date,
            "total_count": batch.total_count,
            "received_count": batch.received_count,
            "description": batch.description,
            "created_at": batch.created_at
        }
        batches.append(batch_dict)
        self._save_json(self.batches_file, batches)
        return True
    
    def get_batch(self, batch_id: str) -> Optional[Dict]:
        """获取捐赠批次"""
        batches = self._load_json(self.batches_file)
        for b in batches:
            if b["batch_id"] == batch_id:
                return b
        return None
    
    def list_batches(self) -> List[Dict]:
        """列出所有批次"""
        return self._load_json(self.batches_file)
    
    def add_item(self, item: ClothingItem) -> bool:
        """添加衣物"""
        items = self._load_json(self.items_file)
        item_dict = {
            "item_id": item.item_id,
            "batch_id": item.batch_id,
            "category": item.category.value,
            "description": item.description,
            "brand": item.brand,
            "size": item.size,
            "color": item.color,
            "status": item.status.value,
            "sort_time": item.sort_time,
            "sort_operator": item.sort_operator,
            "sort_notes": item.sort_notes,
            "created_at": item.created_at
        }
        items.append(item_dict)
        self._save_json(self.items_file, items)
        
        batch = self.get_batch(item.batch_id)
        if batch:
            self._update_batch_received_count(item.batch_id)
        return True
    
    def _update_batch_received_count(self, batch_id: str):
        """更新批次已接收数量"""
        batches = self._load_json(self.batches_file)
        items = self._load_json(self.items_file)
        count = sum(1 for i in items if i["batch_id"] == batch_id)
        
        for b in batches:
            if b["batch_id"] == batch_id:
                b["received_count"] = count
                break
        self._save_json(self.batches_file, batches)
    
    def get_item(self, item_id: str) -> Optional[Dict]:
        """获取衣物"""
        items = self._load_json(self.items_file)
        for i in items:
            if i["item_id"] == item_id:
                return i
        return None
    
    def update_item_status(self, item_id: str, status: ClothingStatus) -> bool:
        """更新衣物状态"""
        items = self._load_json(self.items_file)
        for i in items:
            if i["item_id"] == item_id:
                i["status"] = status.value
                self._save_json(self.items_file, items)
                return True
        return False
    
    def list_items(self, batch_id: Optional[str] = None,
                   status: Optional[ClothingStatus] = None) -> List[Dict]:
        """列出衣物"""
        items = self._load_json(self.items_file)
        if batch_id:
            items = [i for i in items if i["batch_id"] == batch_id]
        if status:
            items = [i for i in items if i["status"] == status.value]
        return items
    
    def add_disinfect(self, record: DisinfectRecord) -> bool:
        """添加消毒记录"""
        records = self._load_json(self.disinfect_file)
        record_dict = {
            "record_id": record.record_id,
            "item_id": record.item_id,
            "batch_id": record.batch_id,
            "method": record.method.value,
            "operator": record.operator,
            "disinfect_time": record.disinfect_time,
            "duration_minutes": record.duration_minutes,
            "temperature": record.temperature,
            "notes": record.notes,
            "created_at": record.created_at
        }
        records.append(record_dict)
        self._save_json(self.disinfect_file, records)
        return True
    
    def get_disinfect_records(self, item_id: Optional[str] = None,
                              batch_id: Optional[str] = None) -> List[Dict]:
        """获取消毒记录"""
        records = self._load_json(self.disinfect_file)
        if item_id:
            records = [r for r in records if r["item_id"] == item_id]
        if batch_id:
            records = [r for r in records if r["batch_id"] == batch_id]
        return records
    
    def add_donate(self, record: DonationRecord) -> bool:
        """添加转赠记录"""
        records = self._load_json(self.donate_file)
        record_dict = {
            "record_id": record.record_id,
            "item_id": record.item_id,
            "batch_id": record.batch_id,
            "organization_id": record.organization_id,
            "organization_name": record.organization_name,
            "operator": record.operator,
            "donate_time": record.donate_time,
            "receiver": record.receiver,
            "notes": record.notes,
            "created_at": record.created_at
        }
        records.append(record_dict)
        self._save_json(self.donate_file, records)
        return True
    
    def get_donate_records(self, item_id: Optional[str] = None,
                            batch_id: Optional[str] = None) -> List[Dict]:
        """获取转赠记录"""
        records = self._load_json(self.donate_file)
        if item_id:
            records = [r for r in records if r["item_id"] == item_id]
        if batch_id:
            records = [r for r in records if r["batch_id"] == batch_id]
        return records
    
    def add_eliminate(self, record: EliminateRecord) -> bool:
        """添加淘汰记录"""
        records = self._load_json(self.eliminate_file)
        record_dict = {
            "record_id": record.record_id,
            "item_id": record.item_id,
            "batch_id": record.batch_id,
            "reason": record.reason.value,
            "operator": record.operator,
            "eliminate_time": record.eliminate_time,
            "notes": record.notes,
            "created_at": record.created_at
        }
        records.append(record_dict)
        self._save_json(self.eliminate_file, records)
        return True
    
    def get_eliminate_records(self, item_id: Optional[str] = None,
                                batch_id: Optional[str] = None) -> List[Dict]:
        """获取淘汰记录"""
        records = self._load_json(self.eliminate_file)
        if item_id:
            records = [r for r in records if r["item_id"] == item_id]
        if batch_id:
            records = [r for r in records if r["batch_id"] == batch_id]
        return records
    
    def add_organization(self, org: Organization) -> bool:
        """添加转赠机构"""
        orgs = self._load_json(self.orgs_file)
        org_dict = {
            "org_id": org.org_id,
            "name": org.name,
            "contact": org.contact,
            "phone": org.phone,
            "address": org.address,
            "description": org.description,
            "is_active": org.is_active,
            "created_at": org.created_at
        }
        orgs.append(org_dict)
        self._save_json(self.orgs_file, orgs)
        return True
    
    def list_organizations(self) -> List[Dict]:
        """列出所有转赠机构"""
        return self._load_json(self.orgs_file)
    
    def get_organization(self, org_id: str) -> Optional[Dict]:
        """获取转赠机构"""
        orgs = self._load_json(self.orgs_file)
        for o in orgs:
            if o["org_id"] == org_id:
                return o
        return None


class ClothingTracker:
    """衣物追踪核心业务逻辑"""
    
    def __init__(self, data_store: DataStore):
        self.store = data_store
    
    def sort_item(self, item_id: str, operator: str, notes: str = "") -> bool:
        """分拣衣物"""
        item = self.store.get_item(item_id)
        if not item:
            return False
        
        items = self.store._load_json(self.store.items_file)
        for i in items:
            if i["item_id"] == item_id:
                i["status"] = ClothingStatus.SORTED.value
                i["sort_time"] = datetime.now().isoformat()
                i["sort_operator"] = operator
                i["sort_notes"] = notes
                self.store._save_json(self.store.items_file, items)
                return True
        return False
    
    def mark_for_disinfect(self, item_id: str) -> bool:
        """标记待消毒"""
        return self.store.update_item_status(item_id, ClothingStatus.WAITING_DISINFECT)
    
    def disinfect_item(self, item_id: str, method: DisinfectMethod,
                        operator: str, duration_minutes: int = 0,
                        temperature: Optional[float] = None,
                        notes: str = "") -> bool:
        """消毒衣物"""
        item = self.store.get_item(item_id)
        if not item:
            return False
        
        batch_id = item["batch_id"]
        
        record = DisinfectRecord(
            record_id="",
            item_id=item_id,
            batch_id=batch_id,
            method=method,
            operator=operator,
            disinfect_time=datetime.now().isoformat(),
            duration_minutes=duration_minutes,
            temperature=temperature,
            notes=notes
        )
        
        self.store.add_disinfect(record)
        self.store.update_item_status(item_id, ClothingStatus.DISINFECTED)
        return True
    
    def mark_for_donate(self, item_id: str) -> bool:
        """标记待转赠"""
        return self.store.update_item_status(item_id, ClothingStatus.WAITING_DONATE)
    
    def donate_item(self, item_id: str, org_id: str, operator: str,
                    receiver: str = "", notes: str = "") -> bool:
        """转赠衣物"""
        item = self.store.get_item(item_id)
        if not item:
            return False
        
        org = self.store.get_organization(org_id)
        if not org:
            return False
        
        batch_id = item["batch_id"]
        
        record = DonationRecord(
            record_id="",
            item_id=item_id,
            batch_id=batch_id,
            organization_id=org_id,
            organization_name=org["name"],
            operator=operator,
            donate_time=datetime.now().isoformat(),
            receiver=receiver,
            notes=notes
        )
        
        self.store.add_donate(record)
        self.store.update_item_status(item_id, ClothingStatus.DONATED)
        return True
    
    def eliminate_item(self, item_id: str, reason: EliminateReason,
                       operator: str, notes: str = "") -> bool:
        """淘汰衣物"""
        item = self.store.get_item(item_id)
        if not item:
            return False
        
        batch_id = item["batch_id"]
        
        record = EliminateRecord(
            record_id="",
            item_id=item_id,
            batch_id=batch_id,
            reason=reason,
            operator=operator,
            eliminate_time=datetime.now().isoformat(),
            notes=notes
        )
        
        self.store.add_eliminate(record)
        self.store.update_item_status(item_id, ClothingStatus.ELIMINATED)
        return True
    
    def generate_sort_report(self, batch_id: str) -> SortReport:
        """生成分拣报告"""
        report = SortReport(batch_id)
        
        items = self.store.list_items(batch_id=batch_id)
        report.total_items = len(items)
        
        for item in items:
            status = item["status"]
            category = item["category"]
            
            report.status_stats[status] = report.status_stats.get(status, 0) + 1
            report.category_stats[category] = report.category_stats.get(category, 0) + 1
            
            if status == ClothingStatus.SORTED.value:
                report.sorted_items += 1
            elif status == ClothingStatus.DISINFECTED.value:
                report.sorted_items += 1
                report.disinfected_items += 1
            elif status == ClothingStatus.DONATED.value:
                report.sorted_items += 1
                report.disinfected_items += 1
                report.donated_items += 1
            elif status == ClothingStatus.ELIMINATED.value:
                report.eliminated_items += 1
        
        eliminate_records = self.store.get_eliminate_records(batch_id=batch_id)
        for rec in eliminate_records:
            reason = rec["reason"]
            report.eliminate_reason_stats[reason] = report.eliminate_reason_stats.get(reason, 0) + 1
        
        return report
    
    def get_item_full_history(self, item_id: str) -> Dict[str, Any]:
        """获取衣物完整历史"""
        item = self.store.get_item(item_id)
        if not item:
            return {}
        
        return {
            "item": item,
            "disinfect_records": self.store.get_disinfect_records(item_id=item_id),
            "donate_records": self.store.get_donate_records(item_id=item_id),
            "eliminate_records": self.store.get_eliminate_records(item_id=item_id)
        }
    
    def validate_batch_consistency(self, batch_id: str) -> Dict[str, Any]:
        """验证批次一致性"""
        batch = self.store.get_batch(batch_id)
        if not batch:
            return {"valid": False, "error": "批次不存在"}
        
        items = self.store.list_items(batch_id=batch_id)
        disinfect_records = self.store.get_disinfect_records(batch_id=batch_id)
        donate_records = self.store.get_donate_records(batch_id=batch_id)
        eliminate_records = self.store.get_eliminate_records(batch_id=batch_id)
        
        issues = []
        
        if len(items) != batch["received_count"]:
            issues.append(f"衣物数量不匹配：记录{len(items)}件，批次显示{batch['received_count']}件")
        
        disinfect_item_ids = set(r["item_id"] for r in disinfect_records)
        donate_item_ids = set(r["item_id"] for r in donate_records)
        eliminate_item_ids = set(r["item_id"] for r in eliminate_records)
        
        for item in items:
            item_id = item["item_id"]
            status = item["status"]
            
            if status == ClothingStatus.DISINFECTED.value and item_id not in disinfect_item_ids:
                issues.append(f"衣物{item_id}状态为已消毒但无消毒记录")
            
            if status == ClothingStatus.DONATED.value:
                if item_id not in disinfect_item_ids:
                    issues.append(f"衣物{item_id}已转赠但无消毒记录")
                if item_id not in donate_item_ids:
                    issues.append(f"衣物{item_id}状态为已转赠但无转赠记录")
            
            if status == ClothingStatus.ELIMINATED.value and item_id not in eliminate_item_ids:
                issues.append(f"衣物{item_id}状态为已淘汰但无淘汰记录")
        
        return {
            "valid": len(issues) == 0,
            "batch": batch,
            "item_count": len(items),
            "disinfect_count": len(disinfect_records),
            "donate_count": len(donate_records),
            "eliminate_count": len(eliminate_records),
            "issues": issues
        }

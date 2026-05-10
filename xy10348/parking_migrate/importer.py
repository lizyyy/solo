import csv
import json
from pathlib import Path
from typing import List, Dict, Any, Callable, Optional
from datetime import datetime

from .db import Database
from .core import ParkingService, OperationResult


class DataImporter:
    def __init__(self, db: Database, service: ParkingService):
        self.db = db
        self.service = service

    def _read_csv(self, file_path: Path) -> List[Dict[str, str]]:
        rows = []
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                rows.append({k.strip(): (v.strip() if v else '') for k, v in row.items()})
        return rows

    def _parse_date(self, date_str: str) -> Optional[str]:
        if not date_str:
            return None
        for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y%m%d", "%Y-%m-%d %H:%M:%S"):
            try:
                return datetime.strptime(date_str, fmt).strftime("%Y-%m-%d")
            except ValueError:
                continue
        return None

    def import_cards(
        self,
        file_path: Path,
        operator: str = "import",
        source: str = "batch_import"
    ) -> Dict[str, Any]:
        rows = self._read_csv(file_path)
        results = {"total": len(rows), "success": 0, "failed": 0, "details": []}
        
        for i, row in enumerate(rows, 1):
            card_no = row.get("月卡号", row.get("card_no", ""))
            owner_name = row.get("车主", row.get("owner_name", ""))
            phone = row.get("电话", row.get("phone", ""))
            plate = row.get("车牌", row.get("plate_number", ""))
            space = row.get("车位", row.get("space_no", ""))
            
            if not card_no:
                results["failed"] += 1
                results["details"].append({"行": i, "error": "缺少月卡号"})
                continue
            
            result = self.service.create_card(
                card_no=card_no,
                owner_name=owner_name,
                phone=phone,
                plate_number=plate,
                space_no=space,
                operator=operator
            )
            
            if result.success:
                results["success"] += 1
            else:
                results["failed"] += 1
            results["details"].append({
                "行": i,
                "月卡号": card_no,
                "成功": result.success,
                "消息": result.message,
                "需复核": result.requires_review
            })
        
        return results

    def import_payments(
        self,
        file_path: Path,
        operator: str = "import",
        source: str = "batch_import"
    ) -> Dict[str, Any]:
        rows = self._read_csv(file_path)
        results = {"total": len(rows), "success": 0, "failed": 0, "details": []}
        
        for i, row in enumerate(rows, 1):
            card_no = row.get("月卡号", row.get("card_no", ""))
            payment_no = row.get("支付流水号", row.get("payment_no", ""))
            payment_date = self._parse_date(row.get("支付日期", row.get("payment_date", "")))
            amount = float(row.get("金额", row.get("amount", 0)) or 0)
            duration = int(row.get("天数", row.get("duration_days", 30)) or 30)
            start_date = self._parse_date(row.get("起始日期", row.get("start_date", "")) or payment_date)
            
            if not card_no or not payment_no:
                results["failed"] += 1
                results["details"].append({"行": i, "error": "缺少月卡号或支付流水号"})
                continue
            
            if not payment_date:
                payment_date = datetime.now().strftime("%Y-%m-%d")
            if not start_date:
                start_date = payment_date
            
            result = self.service.process_payment(
                card_no=card_no,
                payment_no=payment_no,
                payment_date=payment_date,
                amount=amount,
                duration_days=duration,
                start_date=start_date,
                source=source,
                operator=operator
            )
            
            if result.success:
                results["success"] += 1
            else:
                results["failed"] += 1
            results["details"].append({
                "行": i,
                "月卡号": card_no,
                "支付流水": payment_no,
                "成功": result.success,
                "消息": result.message,
                "需复核": result.requires_review
            })
        
        return results

    def import_plate_changes(
        self,
        file_path: Path,
        operator: str = "import",
        source: str = "batch_import"
    ) -> Dict[str, Any]:
        rows = self._read_csv(file_path)
        results = {"total": len(rows), "success": 0, "failed": 0, "details": []}
        
        for i, row in enumerate(rows, 1):
            card_no = row.get("月卡号", row.get("card_no", ""))
            new_plate = row.get("新车牌", row.get("new_plate", ""))
            reason = row.get("原因", row.get("reason", "批量导入车牌变更"))
            effective_date = self._parse_date(row.get("生效日期", row.get("effective_date", "")))
            
            if not card_no or not new_plate:
                results["failed"] += 1
                results["details"].append({"行": i, "error": "缺少月卡号或新车牌"})
                continue
            
            result = self.service.change_plate(
                card_no=card_no,
                new_plate=new_plate,
                reason=reason,
                effective_date=effective_date,
                source=source,
                operator=operator
            )
            
            if result.success:
                results["success"] += 1
            else:
                results["failed"] += 1
            results["details"].append({
                "行": i,
                "月卡号": card_no,
                "新车牌": new_plate,
                "成功": result.success,
                "消息": result.message,
                "需复核": result.requires_review
            })
        
        return results

    def import_space_changes(
        self,
        file_path: Path,
        operator: str = "import",
        source: str = "batch_import",
        force: bool = False
    ) -> Dict[str, Any]:
        rows = self._read_csv(file_path)
        results = {"total": len(rows), "success": 0, "failed": 0, "details": []}
        
        for i, row in enumerate(rows, 1):
            card_no = row.get("月卡号", row.get("card_no", ""))
            new_space = row.get("新车位", row.get("new_space", ""))
            reason = row.get("原因", row.get("reason", "批量导入车位变更"))
            effective_date = self._parse_date(row.get("生效日期", row.get("effective_date", "")))
            
            if not card_no or not new_space:
                results["failed"] += 1
                results["details"].append({"行": i, "error": "缺少月卡号或新车位"})
                continue
            
            result = self.service.change_space(
                card_no=card_no,
                new_space=new_space,
                reason=reason,
                effective_date=effective_date,
                source=source,
                operator=operator,
                force=force
            )
            
            if result.success:
                results["success"] += 1
            else:
                results["failed"] += 1
            results["details"].append({
                "行": i,
                "月卡号": card_no,
                "新车位": new_space,
                "成功": result.success,
                "消息": result.message,
                "需复核": result.requires_review
            })
        
        return results


class DataExporter:
    def __init__(self, db: Database, service: ParkingService):
        self.db = db
        self.service = service

    def export_reconciliation(self, file_path: Path) -> int:
        report = self.service.generate_reconciliation_report()
        if not report:
            return 0
        
        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=report[0].keys())
            writer.writeheader()
            writer.writerows(report)
        
        return len(report)

    def export_history(
        self,
        file_path: Path,
        card_no: Optional[str] = None,
        limit: int = 1000
    ) -> int:
        card_id = None
        if card_no:
            card = self.db.get_card_by_no(card_no)
            if card:
                card_id = card["id"]
            else:
                return 0
        
        history = self.db.get_history(card_id=card_id, limit=limit)
        if not history:
            return 0
        
        rows = []
        for h in history:
            card_no_val = ""
            if h["card_id"]:
                card = self.db.query_one(
                    "SELECT card_no FROM monthly_cards WHERE id = ?",
                    (h["card_id"],)
                )
                if card:
                    card_no_val = card["card_no"]
            
            rows.append({
                "操作ID": h["id"],
                "月卡号": card_no_val,
                "操作类型": h["operation_type"],
                "操作描述": h["operation_desc"],
                "原值": h["old_value"] or "",
                "新值": h["new_value"] or "",
                "原因": h["reason"] or "",
                "来源": h["source"] or "",
                "操作人": h["operator"] or "",
                "操作时间": h["created_at"],
                "需复核": "是" if h["requires_review"] else "否",
                "复核备注": h["review_notes"] or ""
            })
        
        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows(rows)
        
        return len(rows)

    def export_pending_review(self, file_path: Path) -> int:
        records = self.db.get_pending_review()
        if not records:
            return 0
        
        rows = []
        for h in records:
            card_no_val = ""
            if h["card_id"]:
                card = self.db.query_one(
                    "SELECT card_no FROM monthly_cards WHERE id = ?",
                    (h["card_id"],)
                )
                if card:
                    card_no_val = card["card_no"]
            
            rows.append({
                "操作ID": h["id"],
                "月卡号": card_no_val,
                "操作类型": h["operation_type"],
                "操作描述": h["operation_desc"],
                "原值": h["old_value"] or "",
                "新值": h["new_value"] or "",
                "原因": h["reason"] or "",
                "来源": h["source"] or "",
                "操作人": h["operator"] or "",
                "操作时间": h["created_at"],
                "复核备注": h["review_notes"] or ""
            })
        
        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows(rows)
        
        return len(rows)

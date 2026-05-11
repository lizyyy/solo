#!/usr/bin/env python3
import json
import argparse
import os
import uuid
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
from collections import defaultdict

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "laundry_data")

FILES = {
    "receipts": os.path.join(DATA_DIR, "receipts.json"),
    "garments": os.path.join(DATA_DIR, "garments.json"),
    "batches": os.path.join(DATA_DIR, "batches.json"),
    "complaints": os.path.join(DATA_DIR, "complaints.json"),
    "compensations": os.path.join(DATA_DIR, "compensations.json"),
    "rules": os.path.join(DATA_DIR, "rules.json"),
}


def load_json(file_path: str) -> Dict[str, Any]:
    if not os.path.exists(file_path):
        return {}
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(file_path: str, data: Dict[str, Any]) -> None:
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def now() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def generate_id(prefix: str) -> str:
    return f"{prefix}-{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6]}"


class LaundryClaimCLI:
    def __init__(self):
        self.receipts = load_json(FILES["receipts"])
        self.garments = load_json(FILES["garments"])
        self.batches = load_json(FILES["batches"])
        self.complaints = load_json(FILES["complaints"])
        self.compensations = load_json(FILES["compensations"])
        self.rules = load_json(FILES["rules"])

    def save_all(self):
        save_json(FILES["receipts"], self.receipts)
        save_json(FILES["garments"], self.garments)
        save_json(FILES["batches"], self.batches)
        save_json(FILES["complaints"], self.complaints)
        save_json(FILES["compensations"], self.compensations)
        save_json(FILES["rules"], self.rules)

    def import_data(self, file_type: str, data: Dict[str, Any]) -> Tuple[int, int, List[str]]:
        imported = 0
        duplicates = 0
        warnings = []
        
        target = {
            "receipts": self.receipts,
            "garments": self.garments,
            "batches": self.batches,
            "complaints": self.complaints,
        }.get(file_type)
        
        if target is None:
            raise ValueError(f"Unknown file type: {file_type}")
        
        if file_type == "receipts":
            for receipt_id, receipt in data.items():
                if receipt_id in self.receipts:
                    duplicates += 1
                    warnings.append(f"收衣单 {receipt_id} 已存在，跳过")
                else:
                    receipt["created_at"] = now()
                    receipt.setdefault("status", "active")
                    target[receipt_id] = receipt
                    imported += 1
        elif file_type == "garments":
            for garment_id, garment in data.items():
                if garment_id in self.garments:
                    duplicates += 1
                    warnings.append(f"衣物 {garment_id} 已存在，跳过")
                else:
                    if garment.get("receipt_id") and garment["receipt_id"] not in self.receipts:
                        warnings.append(f"衣物 {garment_id} 引用的收衣单 {garment['receipt_id']} 不存在")
                    garment["created_at"] = now()
                    garment.setdefault("status", "waiting")
                    target[garment_id] = garment
                    imported += 1
        elif file_type == "batches":
            for batch_id, batch in data.items():
                if batch_id in self.batches:
                    duplicates += 1
                    warnings.append(f"批次 {batch_id} 已存在，跳过")
                else:
                    for gid in batch.get("garment_ids", []):
                        if gid not in self.garments:
                            warnings.append(f"批次 {batch_id} 引用的衣物 {gid} 不存在")
                    batch["created_at"] = now()
                    batch.setdefault("status", "pending")
                    target[batch_id] = batch
                    imported += 1
        elif file_type == "complaints":
            for complaint_id, complaint in data.items():
                if complaint_id in self.complaints:
                    duplicates += 1
                    warnings.append(f"投诉 {complaint_id} 已存在，跳过")
                else:
                    if complaint.get("garment_id") and complaint["garment_id"] not in self.garments:
                        warnings.append(f"投诉 {complaint_id} 引用的衣物 {complaint['garment_id']} 不存在")
                    complaint["created_at"] = now()
                    complaint.setdefault("status", "open")
                    target[complaint_id] = complaint
                    imported += 1
        
        self.save_all()
        return imported, duplicates, warnings

    def check_anomalies(self) -> Dict[str, List[Dict[str, Any]]]:
        anomalies = defaultdict(list)
        
        for garment_id, garment in self.garments.items():
            if not garment.get("tag_number"):
                anomalies["missing_tag"].append({
                    "garment_id": garment_id,
                    "receipt_id": garment.get("receipt_id"),
                    "customer_name": self._get_customer_name(garment.get("receipt_id")),
                    "garment_type": garment.get("garment_type"),
                    "color": garment.get("color"),
                })
        
        garment_complaints = defaultdict(list)
        for complaint_id, complaint in self.complaints.items():
            gid = complaint.get("garment_id")
            if gid and complaint.get("status") not in ["closed", "rejected"]:
                garment_complaints[gid].append(complaint_id)
        
        for gid, cids in garment_complaints.items():
            if len(cids) > 1:
                garment = self.garments.get(gid, {})
                complaints_info = []
                for cid in cids:
                    c = self.complaints.get(cid, {})
                    complaints_info.append({
                        "complaint_id": cid,
                        "customer_name": c.get("customer_name"),
                        "description": c.get("description"),
                    })
                anomalies["multiple_claims"].append({
                    "garment_id": gid,
                    "garment_type": garment.get("garment_type"),
                    "color": garment.get("color"),
                    "brand": garment.get("brand"),
                    "complaints": complaints_info,
                })
        
        for comp_id, comp in self.compensations.items():
            if comp.get("status") in ["pending", "approved"]:
                max_amount = self.rules.get("max_amount_per_garment", 500)
                max_coupon = self.rules.get("max_coupon_per_garment", 300)
                issues = []
                if comp.get("amount", 0) > max_amount:
                    issues.append(f"赔付金额 {comp.get('amount')} 超过上限 {max_amount}")
                if comp.get("coupon_amount", 0) > max_coupon:
                    issues.append(f"补偿券 {comp.get('coupon_amount')} 超过上限 {max_coupon}")
                if issues:
                    anomalies["exceeds_limit"].append({
                        "compensation_id": comp_id,
                        "complaint_id": comp.get("complaint_id"),
                        "customer_name": self._get_complaint_customer(comp.get("complaint_id")),
                        "amount": comp.get("amount"),
                        "coupon_amount": comp.get("coupon_amount"),
                        "issues": issues,
                    })
        
        for comp_id, comp in self.compensations.items():
            cid = comp.get("complaint_id")
            if cid:
                complaint = self.complaints.get(cid, {})
                if complaint.get("status") == "closed":
                    existing_comps = [
                        ccid for ccid, cc in self.compensations.items()
                        if cc.get("complaint_id") == cid and ccid != comp_id
                    ]
                    if existing_comps:
                        anomalies["closed_duplicate_comp"].append({
                            "compensation_id": comp_id,
                            "complaint_id": cid,
                            "customer_name": self._get_complaint_customer(cid),
                            "existing_compensations": existing_comps,
                            "complaint_status": "closed",
                        })
        
        return dict(anomalies)

    def find_suspected_matches(self, complaint_id: str) -> List[Dict[str, Any]]:
        complaint = self.complaints.get(complaint_id)
        if not complaint:
            return []
        
        receipt_id = complaint.get("receipt_id")
        customer_complaints = [
            cid for cid, c in self.complaints.items()
            if c.get("receipt_id") == receipt_id and cid != complaint_id
        ]
        
        matches = []
        for garment_id, garment in self.garments.items():
            if garment.get("status") in ["missing", "in_dispute"]:
                continue
            
            score = 0
            reasons = []
            
            if complaint.get("garment_id") == garment_id:
                score = 100
                reasons.append("投诉中明确指定")
            
            if receipt_id and garment.get("receipt_id") == receipt_id:
                score += 40
                reasons.append("同收衣单")
            
            desc = (complaint.get("description") or "").lower()
            garment_type = (garment.get("garment_type") or "").lower()
            color = (garment.get("color") or "").lower()
            brand = (garment.get("brand") or "").lower()
            features = (garment.get("features") or "").lower()
            
            if garment_type and garment_type in desc:
                score += 25
                reasons.append(f"类型匹配: {garment.get('garment_type')}")
            if color and color in desc:
                score += 20
                reasons.append(f"颜色匹配: {garment.get('color')}")
            if brand and brand in desc:
                score += 15
                reasons.append(f"品牌匹配: {garment.get('brand')}")
            if features and features in desc:
                score += 30
                reasons.append(f"特征匹配: {garment.get('features')}")
            
            if score >= 30:
                matches.append({
                    "garment_id": garment_id,
                    "score": score,
                    "reasons": reasons,
                    "garment_type": garment.get("garment_type"),
                    "color": garment.get("color"),
                    "brand": garment.get("brand"),
                    "features": garment.get("features"),
                    "receipt_id": garment.get("receipt_id"),
                    "original_customer": self._get_customer_name(garment.get("receipt_id")),
                })
        
        matches.sort(key=lambda x: x["score"], reverse=True)
        return matches

    def calculate_compensation(self, garment_id: str, base_amount: Optional[float] = None) -> Dict[str, Any]:
        max_amount = self.rules.get("max_amount_per_garment", 500)
        max_coupon = self.rules.get("max_coupon_per_garment", 300)
        
        garment = self.garments.get(garment_id, {})
        garment_type = garment.get("garment_type", "")
        
        base_rules = {
            "外套": 300,
            "大衣": 500,
            "西装": 400,
            "衬衫": 150,
            "裤子": 100,
            "裙子": 120,
            "毛衣": 200,
        }
        
        base = base_amount if base_amount is not None else base_rules.get(garment_type, 200)
        
        amount = min(base, max_amount)
        coupon = min(base * 0.3, max_coupon)
        
        return {
            "calculated_amount": round(amount, 2),
            "calculated_coupon": round(coupon, 2),
            "max_amount": max_amount,
            "max_coupon": max_coupon,
            "garment_type": garment_type,
            "within_limit": amount <= max_amount and coupon <= max_coupon,
        }

    def resolve_garment_dispute(self, garment_id: str, winning_complaint_id: str, processed_by: str) -> Dict[str, Any]:
        garment = self.garments.get(garment_id)
        if not garment:
            return {"success": False, "message": f"衣物 {garment_id} 不存在"}
        
        disputes = [
            cid for cid, c in self.complaints.items()
            if c.get("garment_id") == garment_id and c.get("status") not in ["closed", "rejected"]
        ]
        
        if winning_complaint_id not in disputes:
            return {"success": False, "message": f"投诉 {winning_complaint_id} 不是当前争议中的投诉"}
        
        results = []
        
        for cid in disputes:
            complaint = self.complaints[cid]
            if cid == winning_complaint_id:
                complaint["status"] = "closed"
                complaint["resolution_notes"] = f"在衣物 {garment_id} 争议中胜出。"
                complaint["updated_at"] = now()
                results.append({"complaint_id": cid, "action": "胜诉", "status": "closed"})
            else:
                complaint["status"] = "rejected"
                complaint["resolution_notes"] = f"在衣物 {garment_id} 争议中败诉，衣物已判给投诉 {winning_complaint_id}。"
                complaint["updated_at"] = now()
                results.append({"complaint_id": cid, "action": "败诉", "status": "rejected"})
        
        garment["status"] = "resolved"
        garment["updated_at"] = now()
        
        self.save_all()
        
        return {
            "success": True,
            "garment_id": garment_id,
            "winner": winning_complaint_id,
            "results": results,
            "processed_by": processed_by,
            "process_time": now(),
        }

    def create_compensation(self, complaint_id: str, amount: float, coupon_amount: float, 
                            reason: str, processed_by: str) -> Dict[str, Any]:
        complaint = self.complaints.get(complaint_id)
        if not complaint:
            return {"success": False, "message": f"投诉 {complaint_id} 不存在"}
        
        if complaint.get("status") == "rejected":
            return {"success": False, "message": f"投诉 {complaint_id} 已被拒绝，无法赔付"}
        
        if complaint.get("status") == "closed":
            existing_comps = [
                cid for cid, c in self.compensations.items()
                if c.get("complaint_id") == complaint_id
            ]
            if existing_comps:
                return {
                    "success": False, 
                    "message": f"投诉 {complaint_id} 已关闭，已有赔付记录: {existing_comps}"
                }
        
        existing_pending = [
            cid for cid, c in self.compensations.items()
            if c.get("complaint_id") == complaint_id and c.get("status") == "pending"
        ]
        if existing_pending:
            return {
                "success": False, 
                "message": f"投诉 {complaint_id} 已有待处理的赔付: {existing_pending}"
            }
        
        existing_confirmed = [
            cid for cid, c in self.compensations.items()
            if c.get("complaint_id") == complaint_id and c.get("status") == "confirmed"
        ]
        if existing_confirmed:
            return {
                "success": False, 
                "message": f"投诉 {complaint_id} 已有已确认的赔付: {existing_confirmed}"
            }
        
        max_amount = self.rules.get("max_amount_per_garment", 500)
        max_coupon = self.rules.get("max_coupon_per_garment", 300)
        
        warnings = []
        if amount > max_amount:
            warnings.append(f"赔付金额 {amount} 超过规则上限 {max_amount}")
        if coupon_amount > max_coupon:
            warnings.append(f"补偿券 {coupon_amount} 超过规则上限 {max_coupon}")
        
        comp_id = generate_id("P")
        compensation = {
            "compensation_id": comp_id,
            "complaint_id": complaint_id,
            "amount": round(float(amount), 2),
            "coupon_amount": round(float(coupon_amount), 2),
            "reason": reason,
            "processed_by": processed_by,
            "process_time": now(),
            "status": "pending",
            "created_at": now(),
        }
        
        self.compensations[comp_id] = compensation
        self.save_all()
        
        return {
            "success": True,
            "compensation_id": comp_id,
            "complaint_id": complaint_id,
            "amount": amount,
            "coupon_amount": coupon_amount,
            "status": "pending",
            "warnings": warnings,
        }

    def confirm_compensation(self, compensation_id: str, processed_by: str) -> Dict[str, Any]:
        comp = self.compensations.get(compensation_id)
        if not comp:
            return {"success": False, "message": f"赔付 {compensation_id} 不存在"}
        
        if comp.get("status") != "pending":
            return {"success": False, "message": f"赔付 {compensation_id} 状态为 {comp.get('status')}，无法确认"}
        
        comp["status"] = "confirmed"
        comp["confirmed_by"] = processed_by
        comp["confirmed_at"] = now()
        
        complaint_id = comp.get("complaint_id")
        if complaint_id and complaint_id in self.complaints:
            complaint = self.complaints[complaint_id]
            existing_notes = complaint.get("resolution_notes", "")
            new_notes = f"已赔付 {comp.get('amount')} 元，补偿券 {comp.get('coupon_amount')} 元。"
            complaint["resolution_notes"] = f"{existing_notes} {new_notes}".strip()
            complaint["status"] = "closed"
            complaint["updated_at"] = now()
        
        self.save_all()
        
        return {
            "success": True,
            "compensation_id": compensation_id,
            "complaint_id": complaint_id,
            "status": "confirmed",
            "confirmed_by": processed_by,
            "confirmed_at": comp["confirmed_at"],
        }

    def reject_compensation(self, compensation_id: str, reason: str, processed_by: str) -> Dict[str, Any]:
        comp = self.compensations.get(compensation_id)
        if not comp:
            return {"success": False, "message": f"赔付 {compensation_id} 不存在"}
        
        if comp.get("status") != "pending":
            return {"success": False, "message": f"赔付 {compensation_id} 状态为 {comp.get('status')}，无法拒绝"}
        
        comp["status"] = "rejected"
        comp["rejection_reason"] = reason
        comp["rejected_by"] = processed_by
        comp["rejected_at"] = now()
        
        self.save_all()
        
        return {
            "success": True,
            "compensation_id": compensation_id,
            "status": "rejected",
            "rejection_reason": reason,
            "rejected_by": processed_by,
        }

    def generate_report(self, report_type: str = "summary") -> Dict[str, Any]:
        if report_type == "summary":
            return self._generate_summary_report()
        elif report_type == "disputes":
            return self._generate_disputes_report()
        elif report_type == "compensations":
            return self._generate_compensations_report()
        else:
            return {"error": f"Unknown report type: {report_type}"}

    def _generate_summary_report(self) -> Dict[str, Any]:
        open_complaints = [
            c for c in self.complaints.values()
            if c.get("status") not in ["closed", "rejected"]
        ]
        pending_comps = [
            c for c in self.compensations.values()
            if c.get("status") == "pending"
        ]
        confirmed_comps = [
            c for c in self.compensations.values()
            if c.get("status") == "confirmed"
        ]
        
        garment_complaints = defaultdict(list)
        for cid, c in self.complaints.items():
            gid = c.get("garment_id")
            if gid and c.get("status") not in ["closed", "rejected"]:
                garment_complaints[gid].append(cid)
        
        disputed_garments = sum(1 for cids in garment_complaints.values() if len(cids) > 1)
        
        missing_tags = sum(
            1 for g in self.garments.values()
            if not g.get("tag_number")
        )
        
        return {
            "report_type": "summary",
            "generated_at": now(),
            "statistics": {
                "total_receipts": len(self.receipts),
                "total_garments": len(self.garments),
                "total_batches": len(self.batches),
                "total_complaints": len(self.complaints),
                "open_complaints": len(open_complaints),
                "total_compensations": len(self.compensations),
                "pending_compensations": len(pending_comps),
                "confirmed_compensations": len(confirmed_comps),
                "total_amount": round(sum(c.get("amount", 0) for c in confirmed_comps), 2),
                "total_coupons": round(sum(c.get("coupon_amount", 0) for c in confirmed_comps), 2),
            },
            "anomalies": {
                "disputed_garments": disputed_garments,
                "missing_tags": missing_tags,
            }
        }

    def _generate_disputes_report(self) -> Dict[str, Any]:
        garment_complaints = defaultdict(list)
        for cid, c in self.complaints.items():
            gid = c.get("garment_id")
            if gid:
                garment_complaints[gid].append({
                    "complaint_id": cid,
                    **c
                })
        
        disputes = []
        for gid, complaints in garment_complaints.items():
            if len(complaints) > 1:
                garment = self.garments.get(gid, {})
                disputes.append({
                    "garment_id": gid,
                    "garment_info": {
                        "type": garment.get("garment_type"),
                        "color": garment.get("color"),
                        "brand": garment.get("brand"),
                        "tag_number": garment.get("tag_number"),
                    },
                    "complaints": complaints,
                })
        
        return {
            "report_type": "disputes",
            "generated_at": now(),
            "total_disputed_garments": len(disputes),
            "disputes": disputes,
        }

    def _generate_compensations_report(self) -> Dict[str, Any]:
        comps_by_status = defaultdict(list)
        for comp_id, comp in self.compensations.items():
            comps_by_status[comp.get("status", "unknown")].append({
                "compensation_id": comp_id,
                **comp,
                "complaint": self.complaints.get(comp.get("complaint_id"), {}),
            })
        
        return {
            "report_type": "compensations",
            "generated_at": now(),
            "by_status": dict(comps_by_status),
            "summary": {
                status: {
                    "count": len(comps),
                    "total_amount": round(sum(c.get("amount", 0) for c in comps), 2),
                    "total_coupons": round(sum(c.get("coupon_amount", 0) for c in comps), 2),
                }
                for status, comps in comps_by_status.items()
            }
        }

    def _get_customer_name(self, receipt_id: str) -> str:
        if not receipt_id:
            return ""
        receipt = self.receipts.get(receipt_id, {})
        return receipt.get("customer_name", "")

    def _get_complaint_customer(self, complaint_id: str) -> str:
        if not complaint_id:
            return ""
        complaint = self.complaints.get(complaint_id, {})
        return complaint.get("customer_name", "")


def print_table(headers: List[str], rows: List[List[Any]]):
    if not rows:
        print("  (无数据)")
        return
    
    col_widths = [len(h) for h in headers]
    for row in rows:
        for i, cell in enumerate(row):
            col_widths[i] = max(col_widths[i], len(str(cell)))
    
    header_row = "  " + "  ".join(f"{h:<{w}}" for h, w in zip(headers, col_widths))
    print(header_row)
    print("  " + "-" * len(header_row))
    
    for row in rows:
        print("  " + "  ".join(f"{str(cell):<{w}}" for cell, w in zip(row, col_widths)))


def cmd_import(args):
    cli = LaundryClaimCLI()
    
    print(f"\n=== 导入数据 ===")
    print(f"文件类型: {args.type}")
    print(f"源文件: {args.file}")
    
    with open(args.file, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    imported, duplicates, warnings = cli.import_data(args.type, data)
    
    print(f"\n导入结果:")
    print(f"  成功导入: {imported} 条")
    print(f"  重复跳过: {duplicates} 条")
    
    if warnings:
        print(f"\n警告信息:")
        for w in warnings:
            print(f"  ! {w}")


def cmd_check(args):
    cli = LaundryClaimCLI()
    
    print(f"\n=== 异常检查 ===")
    
    anomalies = cli.check_anomalies()
    
    if not anomalies:
        print("\n✓ 未发现异常")
        return
    
    print(f"\n发现 {sum(len(v) for v in anomalies.values())} 个异常:")
    
    if "missing_tag" in anomalies:
        print(f"\n1. 标签缺失 ({len(anomalies['missing_tag'])} 件):")
        print_table(
            ["衣物ID", "收衣单", "顾客", "类型", "颜色"],
            [[g["garment_id"], g["receipt_id"], g["customer_name"], g["garment_type"], g["color"]]
             for g in anomalies["missing_tag"]]
        )
    
    if "multiple_claims" in anomalies:
        print(f"\n2. 多人认领争议 ({len(anomalies['multiple_claims'])} 件):")
        for d in anomalies["multiple_claims"]:
            print(f"\n  衣物 {d['garment_id']}: {d['garment_type']} {d['color']} {d['brand'] or ''}")
            print_table(
                ["投诉ID", "顾客", "描述"],
                [[c["complaint_id"], c["customer_name"], c["description"][:30] + "..." if len(c["description"]) > 30 else c["description"]]
                 for c in d["complaints"]]
            )
    
    if "exceeds_limit" in anomalies:
        print(f"\n3. 赔付超过规则上限 ({len(anomalies['exceeds_limit'])} 笔):")
        for e in anomalies["exceeds_limit"]:
            print(f"\n  赔付 {e['compensation_id']} (投诉 {e['complaint_id']}, {e['customer_name']}):")
            print(f"    金额: {e['amount']} 元, 补偿券: {e['coupon_amount']} 元")
            for issue in e["issues"]:
                print(f"      ! {issue}")
    
    if "closed_duplicate_comp" in anomalies:
        print(f"\n4. 已关闭投诉再次补偿 ({len(anomalies['closed_duplicate_comp'])} 笔):")
        print_table(
            ["赔付ID", "投诉ID", "顾客", "已有赔付"],
            [[d["compensation_id"], d["complaint_id"], d["customer_name"], ", ".join(d["existing_compensations"])]
             for d in anomalies["closed_duplicate_comp"]]
        )


def cmd_match(args):
    cli = LaundryClaimCLI()
    
    print(f"\n=== 疑似匹配 ===")
    print(f"投诉ID: {args.complaint_id}")
    
    complaint = cli.complaints.get(args.complaint_id)
    if not complaint:
        print(f"\n✗ 投诉 {args.complaint_id} 不存在")
        return
    
    print(f"  顾客: {complaint.get('customer_name')}")
    print(f"  描述: {complaint.get('description')}")
    
    matches = cli.find_suspected_matches(args.complaint_id)
    
    if not matches:
        print(f"\n  未找到疑似匹配的衣物")
        return
    
    print(f"\n找到 {len(matches)} 个疑似匹配:")
    for m in matches:
        print(f"\n  匹配度: {m['score']} - 衣物 {m['garment_id']}")
        print(f"    类型: {m['garment_type']}, 颜色: {m['color']}, 品牌: {m['brand'] or '-'}, 特征: {m['features'] or '-'}")
        print(f"    原收衣单: {m['receipt_id']}, 原顾客: {m['original_customer'] or '-'}")
        print(f"    匹配原因: {', '.join(m['reasons'])}")


def cmd_calc(args):
    cli = LaundryClaimCLI()
    
    print(f"\n=== 赔付计算 ===")
    print(f"衣物ID: {args.garment_id}")
    
    if args.base_amount:
        print(f"基准金额: {args.base_amount} 元")
    
    result = cli.calculate_compensation(args.garment_id, args.base_amount)
    
    print(f"\n计算结果:")
    print(f"  衣物类型: {result['garment_type'] or '未知'}")
    print(f"  建议赔付金额: {result['calculated_amount']} 元")
    print(f"  建议补偿券: {result['calculated_coupon']} 元")
    print(f"  规则上限: 金额 {result['max_amount']} 元, 补偿券 {result['max_coupon']} 元")
    print(f"  在限额内: {'是' if result['within_limit'] else '否'}")


def cmd_resolve(args):
    cli = LaundryClaimCLI()
    
    print(f"\n=== 争议解决 ===")
    print(f"衣物ID: {args.garment_id}")
    print(f"胜诉投诉: {args.winning_complaint}")
    print(f"处理人: {args.processed_by}")
    
    result = cli.resolve_garment_dispute(args.garment_id, args.winning_complaint, args.processed_by)
    
    if not result["success"]:
        print(f"\n✗ {result['message']}")
        return
    
    print(f"\n✓ 争议已解决")
    print(f"  处理时间: {result['process_time']}")
    print(f"  结果:")
    for r in result["results"]:
        print(f"    投诉 {r['complaint_id']}: {r['action']} -> 状态: {r['status']}")


def cmd_compensate(args):
    cli = LaundryClaimCLI()
    
    print(f"\n=== 创建赔付 ===")
    print(f"投诉ID: {args.complaint_id}")
    print(f"赔付金额: {args.amount} 元")
    print(f"补偿券: {args.coupon} 元")
    print(f"原因: {args.reason}")
    print(f"处理人: {args.processed_by}")
    
    result = cli.create_compensation(
        args.complaint_id, 
        args.amount, 
        args.coupon, 
        args.reason, 
        args.processed_by
    )
    
    if not result["success"]:
        print(f"\n✗ {result['message']}")
        return
    
    print(f"\n✓ 赔付已创建，状态: pending")
    print(f"  赔付ID: {result['compensation_id']}")
    
    if result.get("warnings"):
        print(f"\n  警告:")
        for w in result["warnings"]:
            print(f"    ! {w}")


def cmd_confirm(args):
    cli = LaundryClaimCLI()
    
    print(f"\n=== 确认赔付 ===")
    print(f"赔付ID: {args.compensation_id}")
    print(f"确认人: {args.processed_by}")
    
    result = cli.confirm_compensation(args.compensation_id, args.processed_by)
    
    if not result["success"]:
        print(f"\n✗ {result['message']}")
        return
    
    print(f"\n✓ 赔付已确认")
    print(f"  投诉ID: {result['complaint_id']}")
    print(f"  确认时间: {result['confirmed_at']}")
    print(f"  状态: {result['status']}")


def cmd_reject_comp(args):
    cli = LaundryClaimCLI()
    
    print(f"\n=== 拒绝赔付 ===")
    print(f"赔付ID: {args.compensation_id}")
    print(f"原因: {args.reason}")
    print(f"处理人: {args.processed_by}")
    
    result = cli.reject_compensation(args.compensation_id, args.reason, args.processed_by)
    
    if not result["success"]:
        print(f"\n✗ {result['message']}")
        return
    
    print(f"\n✓ 赔付已拒绝")


def cmd_report(args):
    cli = LaundryClaimCLI()
    
    print(f"\n=== 报表输出 ===")
    print(f"报表类型: {args.type}")
    
    report = cli.generate_report(args.type)
    
    if "error" in report:
        print(f"\n✗ {report['error']}")
        return
    
    print(f"\n生成时间: {report['generated_at']}")
    
    if args.type == "summary":
        stats = report["statistics"]
        anomalies = report["anomalies"]
        print(f"\n统计数据:")
        print(f"  收衣单总数: {stats['total_receipts']}")
        print(f"  衣物总数: {stats['total_garments']}")
        print(f"  批次总数: {stats['total_batches']}")
        print(f"  投诉总数: {stats['total_complaints']} (待处理: {stats['open_complaints']})")
        print(f"  赔付总数: {stats['total_compensations']}")
        print(f"    - 待确认: {stats['pending_compensations']}")
        print(f"    - 已确认: {stats['confirmed_compensations']}")
        print(f"    - 已赔付金额: {stats['total_amount']} 元")
        print(f"    - 已发补偿券: {stats['total_coupons']} 元")
        
        print(f"\n异常统计:")
        print(f"  争议衣物: {anomalies['disputed_garments']} 件")
        print(f"  标签缺失: {anomalies['missing_tags']} 件")
    
    elif args.type == "disputes":
        print(f"\n争议衣物总数: {report['total_disputed_garments']}")
        for d in report["disputes"]:
            print(f"\n  衣物 {d['garment_id']}:")
            print(f"    信息: {d['garment_info']['type']} {d['garment_info']['color']} {d['garment_info']['brand'] or ''}")
            print(f"    标签: {d['garment_info']['tag_number'] or '(缺失)'}")
            print(f"    相关投诉:")
            for c in d["complaints"]:
                print(f"      - {c['complaint_id']}: {c['customer_name']} - {c['complaint_type']} ({c['status']})")
                print(f"        {c.get('description', '')[:50]}")
    
    elif args.type == "compensations":
        print(f"\n赔付汇总:")
        for status, data in report["summary"].items():
            print(f"  {status}: {data['count']} 笔, 金额 {data['total_amount']} 元, 券 {data['total_coupons']} 元")
        
        if args.verbose:
            for status, comps in report["by_status"].items():
                print(f"\n[{status}]")
                for c in comps:
                    print(f"\n  赔付: {c['compensation_id']}")
                    print(f"    投诉: {c['complaint_id']} ({c['complaint'].get('customer_name', '')})")
                    print(f"    金额: {c['amount']} 元, 券: {c['coupon_amount']} 元")
                    print(f"    原因: {c.get('reason', '')}")
                    print(f"    处理人: {c.get('processed_by', '')}")


def cmd_list(args):
    cli = LaundryClaimCLI()
    
    print(f"\n=== 列表查询 ===")
    
    if args.item == "complaints":
        print(f"\n投诉列表 ({len(cli.complaints)} 条):")
        rows = []
        for cid, c in cli.complaints.items():
            rows.append([
                cid,
                c.get("customer_name"),
                c.get("garment_id") or "-",
                c.get("complaint_type"),
                c.get("status"),
                c.get("claim_time") or "-",
            ])
        print_table(["ID", "顾客", "衣物", "类型", "状态", "投诉时间"], rows)
    
    elif args.item == "compensations":
        print(f"\n赔付列表 ({len(cli.compensations)} 条):")
        rows = []
        for cid, c in cli.compensations.items():
            rows.append([
                cid,
                c.get("complaint_id"),
                c.get("amount"),
                c.get("coupon_amount"),
                c.get("status"),
                c.get("process_time") or "-",
            ])
        print_table(["ID", "投诉ID", "金额", "券", "状态", "处理时间"], rows)
    
    elif args.item == "garments":
        print(f"\n衣物列表 ({len(cli.garments)} 条):")
        rows = []
        for gid, g in cli.garments.items():
            rows.append([
                gid,
                g.get("garment_type"),
                g.get("color"),
                g.get("brand") or "-",
                g.get("tag_number") or "(缺失)",
                g.get("status"),
            ])
        print_table(["ID", "类型", "颜色", "品牌", "标签", "状态"], rows)


def main():
    parser = argparse.ArgumentParser(
        description="洗衣店错件赔付 CLI - 管理收衣单、衣物、投诉和赔付",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 导入数据
  python laundry_claim_cli.py import --type receipts --file new_receipts.json
  
  # 检查异常
  python laundry_claim_cli.py check
  
  # 查找疑似匹配
  python laundry_claim_cli.py match --complaint-id C-001
  
  # 计算赔付
  python laundry_claim_cli.py calc --garment-id G-001
  
  # 解决争议
  python laundry_claim_cli.py resolve --garment-id G-002 --winning-complaint C-002 --processed-by 张店长
  
  # 创建赔付
  python laundry_claim_cli.py compensate --complaint-id C-002 --amount 300 --coupon 100 --reason "外套纠纷和解" --processed-by 张店长
  
  # 确认赔付
  python laundry_claim_cli.py confirm --compensation-id P-xxx --processed-by 张店长
  
  # 生成报表
  python laundry_claim_cli.py report --type summary
        """
    )
    
    subparsers = parser.add_subparsers(dest="command", help="可用命令")
    
    import_parser = subparsers.add_parser("import", help="导入数据")
    import_parser.add_argument("--type", required=True, choices=["receipts", "garments", "batches", "complaints"], help="数据类型")
    import_parser.add_argument("--file", required=True, help="导入文件路径")
    import_parser.set_defaults(func=cmd_import)
    
    check_parser = subparsers.add_parser("check", help="异常检查")
    check_parser.set_defaults(func=cmd_check)
    
    match_parser = subparsers.add_parser("match", help="查找疑似匹配")
    match_parser.add_argument("--complaint-id", required=True, help="投诉ID")
    match_parser.set_defaults(func=cmd_match)
    
    calc_parser = subparsers.add_parser("calc", help="计算赔付金额")
    calc_parser.add_argument("--garment-id", required=True, help="衣物ID")
    calc_parser.add_argument("--base-amount", type=float, help="基准金额（可选，将按衣物类型推断）")
    calc_parser.set_defaults(func=cmd_calc)
    
    resolve_parser = subparsers.add_parser("resolve", help="解决衣物争议（人工修正）")
    resolve_parser.add_argument("--garment-id", required=True, help="衣物ID")
    resolve_parser.add_argument("--winning-complaint", required=True, help="胜诉投诉ID")
    resolve_parser.add_argument("--processed-by", required=True, help="处理人")
    resolve_parser.set_defaults(func=cmd_resolve)
    
    comp_parser = subparsers.add_parser("compensate", help="创建赔付记录")
    comp_parser.add_argument("--complaint-id", required=True, help="投诉ID")
    comp_parser.add_argument("--amount", type=float, required=True, help="赔付金额")
    comp_parser.add_argument("--coupon", type=float, default=0, help="补偿券金额")
    comp_parser.add_argument("--reason", required=True, help="赔付原因")
    comp_parser.add_argument("--processed-by", required=True, help="处理人")
    comp_parser.set_defaults(func=cmd_compensate)
    
    confirm_parser = subparsers.add_parser("confirm", help="最终确认赔付")
    confirm_parser.add_argument("--compensation-id", required=True, help="赔付ID")
    confirm_parser.add_argument("--processed-by", required=True, help="确认人")
    confirm_parser.set_defaults(func=cmd_confirm)
    
    reject_parser = subparsers.add_parser("reject", help="拒绝赔付")
    reject_parser.add_argument("--compensation-id", required=True, help="赔付ID")
    reject_parser.add_argument("--reason", required=True, help="拒绝原因")
    reject_parser.add_argument("--processed-by", required=True, help="处理人")
    reject_parser.set_defaults(func=cmd_reject_comp)
    
    report_parser = subparsers.add_parser("report", help="报表输出")
    report_parser.add_argument("--type", default="summary", choices=["summary", "disputes", "compensations"], help="报表类型")
    report_parser.add_argument("--verbose", action="store_true", help="详细输出")
    report_parser.set_defaults(func=cmd_report)
    
    list_parser = subparsers.add_parser("list", help="列表查询")
    list_parser.add_argument("--item", required=True, choices=["complaints", "compensations", "garments"], help="查询项")
    list_parser.set_defaults(func=cmd_list)
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    args.func(args)


if __name__ == "__main__":
    main()

from datetime import date, timedelta
from typing import Dict, List, Any, Optional, Tuple
from .storage import (
    load_dept_limits, save_dept_limits,
    load_inventory, save_inventory,
    load_requests, save_requests,
    load_emergency_borrows, save_emergency_borrows,
    today_str, parse_date
)

def get_available_inventory(supply_id: str) -> List[Dict[str, Any]]:
    inventory = load_inventory()
    today = date.today()
    available = []
    for item in inventory:
        if item["supply_id"] != supply_id:
            continue
        expiry = parse_date(item["expiry_date"])
        if expiry < today:
            continue
        if item["quantity"] <= 0:
            continue
        available.append(item)
    available.sort(key=lambda x: parse_date(x["expiry_date"]))
    return available

def get_total_available(supply_id: str) -> int:
    return sum(item["quantity"] for item in get_available_inventory(supply_id))

def get_dept_limit(dept_id: str, supply_id: str) -> Dict[str, Any]:
    limits = load_dept_limits()
    dept_limits = limits.get(dept_id, {})
    limit = dept_limits.get(supply_id, {
        "supply_id": supply_id,
        "supply_name": "",
        "monthly_limit": 0,
        "used_amount": 0
    })
    return limit

def check_limit_overage(dept_id: str, supply_id: str, request_qty: int) -> Tuple[bool, int, int]:
    limit_info = get_dept_limit(dept_id, supply_id)
    limit = limit_info["monthly_limit"]
    used = limit_info["used_amount"]
    remaining = limit - used
    overage = (used + request_qty) > limit
    return overage, remaining, limit

def check_duplicate_request(dept_id: str, supply_id: str, qty: int) -> Optional[Dict[str, Any]]:
    requests = load_requests()
    today = today_str()
    for req in requests:
        if (req["department_id"] == dept_id and
            req["supply_id"] == supply_id and
            req["quantity"] == qty and
            req["created_at"] == today and
            req["status"] not in ["rejected"]):
            return req
    return None

def check_pending_emergency_borrows(dept_id: str, supply_id: str = None) -> List[Dict[str, Any]]:
    borrows = load_emergency_borrows()
    pending = []
    for b in borrows:
        if b["department_id"] != dept_id:
            continue
        if supply_id and b["supply_id"] != supply_id:
            continue
        if b["status"] == "borrowed" and not b.get("is_replenished", False):
            pending.append(b)
    return pending

def check_expiring_warning(days: int = 30) -> List[Dict[str, Any]]:
    inventory = load_inventory()
    today = date.today()
    warning_date = today + timedelta(days=days)
    warnings = []
    for item in inventory:
        if item["quantity"] <= 0:
            continue
        expiry = parse_date(item["expiry_date"])
        if expiry < today:
            warnings.append({**item, "warning_level": "expired", "days_left": (expiry - today).days})
        elif expiry <= warning_date:
            warnings.append({**item, "warning_level": "expiring_soon", "days_left": (expiry - today).days})
    warnings.sort(key=lambda x: parse_date(x["expiry_date"]))
    return warnings

def submit_request(dept_id: str, dept_name: str, supply_id: str, supply_name: str, qty: int, unit: str = "个") -> Dict[str, Any]:
    duplicate = check_duplicate_request(dept_id, supply_id, qty)
    if duplicate:
        return {
            "success": False,
            "error": f"今日重复申领，已有相同申领单: {duplicate['request_id']}",
            "duplicate_request": duplicate
        }
    
    pending_borrows = check_pending_emergency_borrows(dept_id, supply_id)
    overage, remaining, limit = check_limit_overage(dept_id, supply_id, qty)
    total_available = get_total_available(supply_id)
    
    needs_approval = False
    approval_reasons = []
    
    if overage:
        needs_approval = True
        approval_reasons.append(f"超限额: 限额{limit}，已用{limit - remaining}，申领{qty}")
    
    if pending_borrows:
        needs_approval = True
        approval_reasons.append(f"存在{len(pending_borrows)}条急诊借用未补单")
    
    if total_available < qty:
        needs_approval = True
        approval_reasons.append(f"库存不足: 可用{total_available}，需{qty}")
    
    requests = load_requests()
    req_id = f"REQ{date.today().strftime('%Y%m%d')}{str(len(requests) + 1).zfill(4)}"
    
    new_request = {
        "request_id": req_id,
        "department_id": dept_id,
        "department_name": dept_name,
        "supply_id": supply_id,
        "supply_name": supply_name,
        "quantity": qty,
        "unit": unit,
        "status": "pending_approval" if needs_approval else "approved",
        "created_at": today_str(),
        "approved_at": None if needs_approval else today_str(),
        "approved_by": None if needs_approval else "system",
        "issued_at": None,
        "issued_by": None,
        "issued_batches": [],
        "approval_reasons": approval_reasons if needs_approval else []
    }
    
    requests.append(new_request)
    save_requests(requests)
    
    result = {
        "success": True,
        "request": new_request,
        "requires_approval": needs_approval,
        "approval_reasons": approval_reasons,
        "pending_emergency_borrows": pending_borrows
    }
    
    if not needs_approval:
        result["message"] = "申领已自动审批通过"
    else:
        result["message"] = f"申领需审批: {'; '.join(approval_reasons)}"
    
    return result

def approve_request(request_id: str, approver: str = "admin", approved: bool = True) -> Dict[str, Any]:
    requests = load_requests()
    for req in requests:
        if req["request_id"] == request_id:
            if req["status"] == "approved":
                return {"success": False, "error": "申领单已审批通过，重复审批", "request": req}
            if req["status"] == "rejected":
                return {"success": False, "error": "申领单已被拒绝", "request": req}
            if req["status"] not in ["pending_approval", "submitted"]:
                return {"success": False, "error": f"申领单状态{req['status']}不允许审批", "request": req}
            
            req["status"] = "approved" if approved else "rejected"
            req["approved_at"] = today_str()
            req["approved_by"] = approver
            save_requests(requests)
            return {
                "success": True,
                "request": req,
                "message": "审批通过" if approved else "已拒绝"
            }
    return {"success": False, "error": f"未找到申领单: {request_id}"}

def issue_request(request_id: str, issuer: str = "admin") -> Dict[str, Any]:
    requests = load_requests()
    inventory = load_inventory()
    limits = load_dept_limits()
    
    for req in requests:
        if req["request_id"] == request_id:
            if req["status"] == "issued":
                return {"success": False, "error": "申领单已发放，重复扣库存", "request": req}
            if req["status"] != "approved":
                return {"success": False, "error": f"申领单状态{req['status']}不允许发放", "request": req}
            
            supply_id = req["supply_id"]
            dept_id = req["department_id"]
            qty_needed = req["quantity"]
            qty_issued = 0
            
            available = get_available_inventory(supply_id)
            issued_batches = []
            batch_issues = []
            
            for batch in available:
                if qty_issued >= qty_needed:
                    break
                batch_id = batch["batch_id"]
                take = min(batch["quantity"], qty_needed - qty_issued)
                
                for inv in inventory:
                    if inv["batch_id"] == batch_id:
                        inv["quantity"] -= take
                        break
                
                batch_issues.append({"batch_id": batch_id, "quantity_issued": take, "expiry_date": batch["expiry_date"]})
                qty_issued += take
            
            if qty_issued == 0:
                return {"success": False, "error": "无可用库存", "request": req}
            
            req["status"] = "issued" if qty_issued >= qty_needed else "partial"
            req["issued_at"] = today_str()
            req["issued_by"] = issuer
            req["issued_batches"] = batch_issues
            req["actual_issued"] = qty_issued
            
            if dept_id not in limits:
                limits[dept_id] = {}
            if supply_id not in limits[dept_id]:
                limits[dept_id][supply_id] = {
                    "supply_id": supply_id,
                    "supply_name": req["supply_name"],
                    "monthly_limit": 0,
                    "used_amount": 0
                }
            limits[dept_id][supply_id]["used_amount"] += qty_issued
            
            save_requests(requests)
            save_inventory(inventory)
            save_dept_limits(limits)
            
            remaining_stock = get_total_available(supply_id)
            
            return {
                "success": True,
                "request": req,
                "issued_batches": batch_issues,
                "quantity_issued": qty_issued,
                "quantity_remaining": qty_needed - qty_issued,
                "remaining_stock": remaining_stock,
                "message": f"发放{qty_issued}{req['unit']}，剩余库存{remaining_stock}"
            }
    
    return {"success": False, "error": f"未找到申领单: {request_id}"}

def list_requests(status: str = None, dept_id: str = None) -> List[Dict[str, Any]]:
    requests = load_requests()
    filtered = requests
    if status:
        filtered = [r for r in filtered if r["status"] == status]
    if dept_id:
        filtered = [r for r in filtered if r["department_id"] == dept_id]
    return filtered

def import_dept_limits(data: List[Dict[str, Any]]) -> Dict[str, Any]:
    limits = {}
    for item in data:
        dept_id = item["department_id"]
        supply_id = item["supply_id"]
        if dept_id not in limits:
            limits[dept_id] = {}
        limits[dept_id][supply_id] = {
            "supply_id": supply_id,
            "supply_name": item.get("supply_name", ""),
            "monthly_limit": item["monthly_limit"],
            "used_amount": item.get("used_amount", 0)
        }
    save_dept_limits(limits)
    return {"success": True, "imported": len(data)}

def import_inventory(data: List[Dict[str, Any]]) -> Dict[str, Any]:
    existing = load_inventory()
    by_batch = {item["batch_id"]: item for item in existing}
    for item in data:
        by_batch[item["batch_id"]] = item
    save_inventory(list(by_batch.values()))
    return {"success": True, "imported": len(data)}

def import_requests(data: List[Dict[str, Any]]) -> Dict[str, Any]:
    save_requests(data)
    return {"success": True, "imported": len(data)}

def import_emergency_borrows(data: List[Dict[str, Any]]) -> Dict[str, Any]:
    save_emergency_borrows(data)
    return {"success": True, "imported": len(data)}

def replenish_emergency_borrow(borrow_id: str) -> Dict[str, Any]:
    borrows = load_emergency_borrows()
    for b in borrows:
        if b["borrow_id"] == borrow_id:
            if b.get("is_replenished"):
                return {"success": False, "error": "已补单", "borrow": b}
            b["is_replenished"] = True
            b["replenished_at"] = today_str()
            b["status"] = "replenished"
            save_emergency_borrows(borrows)
            return {"success": True, "borrow": b}
    return {"success": False, "error": f"未找到借用记录: {borrow_id}"}

def export_monthly_report(year: int, month: int) -> Dict[str, Any]:
    requests = load_requests()
    borrows = load_emergency_borrows()
    limits = load_dept_limits()
    inventory = load_inventory()
    
    month_start = date(year, month, 1)
    if month == 12:
        next_month = date(year + 1, 1, 1)
    else:
        next_month = date(year, month + 1, 1)
    
    issued_requests = []
    for req in requests:
        if req["status"] in ["issued", "partial"] and req.get("issued_at"):
            issued_at = parse_date(req["issued_at"])
            if month_start <= issued_at < next_month:
                issued_requests.append(req)
    
    dept_summary = {}
    for req in issued_requests:
        dept_id = req["department_id"]
        if dept_id not in dept_summary:
            dept_summary[dept_id] = {
                "department_id": dept_id,
                "department_name": req["department_name"],
                "supplies": {},
                "total_issued": 0
            }
        sid = req["supply_id"]
        if sid not in dept_summary[dept_id]["supplies"]:
            dept_summary[dept_id]["supplies"][sid] = {
                "supply_id": sid,
                "supply_name": req["supply_name"],
                "quantity": 0,
                "monthly_limit": limits.get(dept_id, {}).get(sid, {}).get("monthly_limit", 0),
                "used_amount": limits.get(dept_id, {}).get(sid, {}).get("used_amount", 0)
            }
        dept_summary[dept_id]["supplies"][sid]["quantity"] += req.get("actual_issued", req["quantity"])
        dept_summary[dept_id]["total_issued"] += req.get("actual_issued", req["quantity"])
    
    for dept_id in dept_summary:
        dept_summary[dept_id]["supplies"] = list(dept_summary[dept_id]["supplies"].values())
    
    pending_borrows = [b for b in borrows if b["status"] == "borrowed" and not b.get("is_replenished", False)]
    expiring_items = check_expiring_warning(30)
    
    return {
        "period": f"{year}年{month}月",
        "issued_requests": issued_requests,
        "department_summary": list(dept_summary.values()),
        "pending_emergency_borrows": pending_borrows,
        "expiring_warnings": expiring_items,
        "inventory_snapshot": [i for i in inventory if i["quantity"] > 0]
    }

def get_pending_approval_requests() -> List[Dict[str, Any]]:
    return list_requests(status="pending_approval")

def get_approved_not_issued() -> List[Dict[str, Any]]:
    return list_requests(status="approved")

import uuid
from datetime import datetime
from collections import defaultdict
from .database import get_connection

DECISION_APPROVE = "APPROVE"
DECISION_REJECT = "REJECT"
DECISION_MANUAL = "MANUAL"

REASON_NO_ORDER = "订单不存在"
REASON_ALREADY_PROCESSED = "申请已处理过，跳过"
REASON_ALREADY_APPROVED = "该订单已批准过补发，重复申请"
REASON_AMOUNT_INSUFFICIENT = "退款后金额不足，不满足赠品条件"
REASON_NO_MATCHING_RULE = "未找到匹配的赠品规则"
REASON_MULTIPLE_REQUESTS = "同一订单存在多次申请"
REASON_INSUFFICIENT_STOCK = "赠品库存不足"
REASON_RULE_CONFLICT = "存在多条冲突规则，需要人工确认"
REASON_SESSION_RULE_CONFLICT = "订单与全局规则冲突"

def generate_batch_id():
    return f"BATCH_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"

def get_order_applicable_rules(order_id):
    with get_connection() as conn:
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM orders WHERE order_id = ?", (order_id,))
        order_row = cursor.fetchone()
        if not order_row:
            return []
        order = dict(order_row)
        
        cursor.execute("SELECT DISTINCT product_sku FROM order_items WHERE order_id = ?", (order_id,))
        order_product_skus = set([row["product_sku"] for row in cursor.fetchall()])
        
        session_id = order["session_id"]
        final_amount = order["final_amount"]
        
        cursor.execute("""
            SELECT * FROM gift_rules 
            WHERE active = 1 
            AND min_amount <= ?
            AND (session_id IS NULL OR session_id = ?)
            ORDER BY priority DESC, min_amount DESC
        """, (final_amount, session_id))
        
        rules = []
        for rule in cursor.fetchall():
            rule_dict = dict(rule)
            if rule_dict.get("product_sku"):
                if rule_dict["product_sku"] in order_product_skus:
                    rules.append(rule_dict)
            else:
                rules.append(rule_dict)
        
        return rules

def get_order_processed_history(order_id):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT ph.*, pr.final_decision
            FROM process_history ph
            LEFT JOIN processed_requests pr ON ph.request_id = pr.request_id
            WHERE ph.order_id = ?
            ORDER BY ph.processed_at DESC
        """, (order_id,))
        return [dict(row) for row in cursor.fetchall()]

def get_inventory_quantity(sku):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT available_qty, reserved_qty FROM inventory WHERE sku = ?", (sku,))
        row = cursor.fetchone()
        if row:
            return row["available_qty"] - row["reserved_qty"]
        return 0

def check_already_processed(request_id):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM processed_requests WHERE request_id = ?", (request_id,))
        return cursor.fetchone() is not None

def check_already_approved(order_id):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT COUNT(*) as cnt 
            FROM processed_requests pr
            JOIN replacement_requests rq ON pr.request_id = rq.request_id
            WHERE rq.order_id = ? AND pr.final_decision = ?
        """, (order_id, DECISION_APPROVE))
        return cursor.fetchone()["cnt"] > 0

def check_multiple_requests_for_order(order_id):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT COUNT(*) as cnt 
            FROM replacement_requests 
            WHERE order_id = ?
        """, (order_id,))
        return cursor.fetchone()["cnt"] > 1

def validate_request(request_id):
    with get_connection() as conn:
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM replacement_requests WHERE request_id = ?", (request_id,))
        request = cursor.fetchone()
        if not request:
            return {
                "request_id": request_id,
                "decision": DECISION_REJECT,
                "reason": "申请不存在",
                "gift_sku": None,
                "gift_quantity": 0
            }
        
        order_id = request["order_id"]
        
        cursor.execute("SELECT * FROM orders WHERE order_id = ?", (order_id,))
        order_row = cursor.fetchone()
        if not order_row:
            return {
                "request_id": request_id,
                "order_id": order_id,
                "decision": DECISION_REJECT,
                "reason": REASON_NO_ORDER,
                "gift_sku": None,
                "gift_quantity": 0
            }
        order = dict(order_row)
        
        if check_already_processed(request_id):
            return {
                "request_id": request_id,
                "order_id": order_id,
                "decision": DECISION_REJECT,
                "reason": REASON_ALREADY_PROCESSED,
                "gift_sku": None,
                "gift_quantity": 0
            }
        
        if check_already_approved(order_id):
            return {
                "request_id": request_id,
                "order_id": order_id,
                "decision": DECISION_REJECT,
                "reason": REASON_ALREADY_APPROVED,
                "gift_sku": None,
                "gift_quantity": 0
            }
        
        if order["final_amount"] <= 0:
            return {
                "request_id": request_id,
                "order_id": order_id,
                "decision": DECISION_REJECT,
                "reason": REASON_AMOUNT_INSUFFICIENT,
                "gift_sku": None,
                "gift_quantity": 0
            }
        
        rules = get_order_applicable_rules(order_id)
        
        if not rules:
            return {
                "request_id": request_id,
                "order_id": order_id,
                "decision": DECISION_REJECT,
                "reason": REASON_NO_MATCHING_RULE,
                "gift_sku": None,
                "gift_quantity": 0
            }
        
        has_multiple_requests = check_multiple_requests_for_order(order_id)
        
        distinct_gifts = set()
        for r in rules:
            distinct_gifts.add((r["gift_sku"], r["gift_quantity"]))
        
        session_rules = [r for r in rules if r.get("session_id") and r["session_id"] == order.get("session_id")]
        global_rules = [r for r in rules if not r.get("session_id")]
        
        has_rule_conflict = False
        if session_rules and global_rules:
            session_gifts = set((r["gift_sku"], r["gift_quantity"]) for r in session_rules)
            global_gifts = set((r["gift_sku"], r["gift_quantity"]) for r in global_rules)
            if session_gifts != global_gifts:
                has_rule_conflict = True
        
        if len(distinct_gifts) > 1:
            return {
                "request_id": request_id,
                "order_id": order_id,
                "decision": DECISION_MANUAL,
                "reason": REASON_RULE_CONFLICT,
                "gift_sku": None,
                "gift_quantity": 0,
                "candidate_rules": rules
            }
        
        if has_rule_conflict:
            return {
                "request_id": request_id,
                "order_id": order_id,
                "decision": DECISION_MANUAL,
                "reason": REASON_SESSION_RULE_CONFLICT,
                "gift_sku": None,
                "gift_quantity": 0,
                "candidate_rules": rules
            }
        
        selected_rule = rules[0]
        gift_sku = selected_rule["gift_sku"]
        gift_qty = selected_rule["gift_quantity"]
        
        stock_available = get_inventory_quantity(gift_sku)
        if stock_available < gift_qty:
            return {
                "request_id": request_id,
                "order_id": order_id,
                "decision": DECISION_MANUAL,
                "reason": REASON_INSUFFICIENT_STOCK,
                "gift_sku": gift_sku,
                "gift_quantity": gift_qty,
                "available_stock": stock_available
            }
        
        if has_multiple_requests:
            return {
                "request_id": request_id,
                "order_id": order_id,
                "decision": DECISION_MANUAL,
                "reason": REASON_MULTIPLE_REQUESTS,
                "gift_sku": gift_sku,
                "gift_quantity": gift_qty
            }
        
        return {
            "request_id": request_id,
            "order_id": order_id,
            "decision": DECISION_APPROVE,
            "reason": "符合所有条件",
            "gift_sku": gift_sku,
            "gift_quantity": gift_qty
        }

def process_pending_requests(batch_id=None):
    if not batch_id:
        batch_id = generate_batch_id()
    
    with get_connection() as conn:
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT rq.request_id, rq.order_id, o.customer_name, o.customer_phone,
                   o.session_id, o.total_amount, o.refund_amount, o.final_amount
            FROM replacement_requests rq
            JOIN orders o ON rq.order_id = o.order_id
            WHERE rq.request_id NOT IN (SELECT request_id FROM processed_requests)
            ORDER BY rq.created_at ASC
        """)
        pending_requests = [dict(row) for row in cursor.fetchall()]
        
        results = {
            "batch_id": batch_id,
            "processed_at": datetime.now().isoformat(),
            "total": len(pending_requests),
            "approve": [],
            "reject": [],
            "manual": []
        }
        
        inventory_reservations = defaultdict(int)
        
        for req in pending_requests:
            request_id = req["request_id"]
            validation = validate_request(request_id)
            
            decision = validation["decision"]
            gift_sku = validation.get("gift_sku")
            gift_qty = validation.get("gift_quantity", 0)
            
            if decision == DECISION_APPROVE and gift_sku:
                current_stock = get_inventory_quantity(gift_sku)
                already_reserved = inventory_reservations[gift_sku]
                if (current_stock - already_reserved) >= gift_qty:
                    inventory_reservations[gift_sku] += gift_qty
                else:
                    validation = {
                        **validation,
                        "decision": DECISION_MANUAL,
                        "reason": f"库存不足（批次内）: 可分配 {current_stock - already_reserved}"
                    }
                    decision = DECISION_MANUAL
            
            if validation.get("reason") == REASON_ALREADY_PROCESSED:
                continue
            
            record = {
                **req,
                **validation
            }
            
            if decision == DECISION_APPROVE:
                results["approve"].append(record)
            elif decision == DECISION_REJECT:
                results["reject"].append(record)
            else:
                results["manual"].append(record)
            
            cursor.execute("""
                INSERT INTO process_history 
                (batch_id, request_id, order_id, action, gift_sku, gift_quantity, decision, reason)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                batch_id,
                request_id,
                req["order_id"],
                "VALIDATE",
                gift_sku,
                gift_qty,
                decision,
                validation.get("reason", "")
            ))
        
        return results

def confirm_requests(batch_id, request_ids, decision, override_reason=None):
    with get_connection() as conn:
        cursor = conn.cursor()
        
        results = {"confirmed": 0, "failed": []}
        
        for request_id in request_ids:
            try:
                if check_already_processed(request_id):
                    results["failed"].append(f"{request_id}: 已处理")
                    continue
                
                cursor.execute("""
                    SELECT * FROM process_history 
                    WHERE request_id = ? AND batch_id = ?
                    ORDER BY processed_at DESC
                    LIMIT 1
                """, (request_id, batch_id))
                history = cursor.fetchone()
                
                if not history:
                    results["failed"].append(f"{request_id}: 批次中无记录")
                    continue
                
                final_decision = decision if decision else history["decision"]
                reason = override_reason if override_reason else history["reason"]
                
                cursor.execute("""
                    INSERT INTO processed_requests (request_id, batch_id, final_decision)
                    VALUES (?, ?, ?)
                """, (request_id, batch_id, final_decision))
                
                cursor.execute("""
                    UPDATE replacement_requests 
                    SET status = ? 
                    WHERE request_id = ?
                """, (final_decision, request_id))
                
                cursor.execute("""
                    INSERT INTO process_history 
                    (batch_id, request_id, order_id, action, gift_sku, gift_quantity, decision, reason)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    batch_id,
                    request_id,
                    history["order_id"],
                    "CONFIRM",
                    history["gift_sku"],
                    history["gift_quantity"],
                    final_decision,
                    reason
                ))
                
                if final_decision == DECISION_APPROVE and history["gift_sku"] and history["gift_quantity"]:
                    cursor.execute("""
                        UPDATE inventory 
                        SET reserved_qty = reserved_qty + ?,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE sku = ?
                    """, (history["gift_quantity"], history["gift_sku"]))
                
                results["confirmed"] += 1
                
            except Exception as e:
                results["failed"].append(f"{request_id}: {str(e)}")
        
        return results

def get_history(order_id=None, batch_id=None, limit=100):
    with get_connection() as conn:
        cursor = conn.cursor()
        
        sql = """
            SELECT ph.*, pr.final_decision, pr.finalized_at,
                   o.customer_name, o.session_id
            FROM process_history ph
            LEFT JOIN processed_requests pr ON ph.request_id = pr.request_id
            LEFT JOIN orders o ON ph.order_id = o.order_id
            WHERE 1=1
        """
        params = []
        
        if order_id:
            sql += " AND ph.order_id = ?"
            params.append(order_id)
        if batch_id:
            sql += " AND ph.batch_id = ?"
            params.append(batch_id)
        
        sql += " ORDER BY ph.processed_at DESC LIMIT ?"
        params.append(limit)
        
        cursor.execute(sql, params)
        return [dict(row) for row in cursor.fetchall()]

def get_batches(limit=50):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                batch_id,
                MIN(processed_at) as started_at,
                MAX(processed_at) as ended_at,
                COUNT(*) as total_records
            FROM process_history
            GROUP BY batch_id
            ORDER BY started_at DESC
            LIMIT ?
        """, (limit,))
        return [dict(row) for row in cursor.fetchall()]

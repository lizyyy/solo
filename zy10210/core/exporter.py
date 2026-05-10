import csv
from datetime import datetime
from .database import get_connection
from .engine import get_history

def export_to_csv(records, file_path, fieldnames=None):
    if not records:
        return False
    
    if not fieldnames:
        fieldnames = list(records[0].keys())
    
    with open(file_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for record in records:
            row = {}
            for k in fieldnames:
                v = record.get(k, "")
                if isinstance(v, (list, dict)):
                    v = str(v)
                row[k] = v
            writer.writerow(row)
    
    return True

def export_process_results(results, output_prefix):
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    files = {}
    
    common_fields = [
        "request_id", "order_id", "customer_name", "customer_phone",
        "session_id", "total_amount", "refund_amount", "final_amount",
        "gift_sku", "gift_quantity", "reason"
    ]
    
    if results.get("approve"):
        approve_file = f"{output_prefix}_approve_{timestamp}.csv"
        export_to_csv(results["approve"], approve_file, common_fields)
        files["approve"] = approve_file
    
    if results.get("reject"):
        reject_file = f"{output_prefix}_reject_{timestamp}.csv"
        export_to_csv(results["reject"], reject_file, common_fields)
        files["reject"] = reject_file
    
    if results.get("manual"):
        manual_file = f"{output_prefix}_manual_{timestamp}.csv"
        export_to_csv(results["manual"], manual_file, common_fields + ["available_stock"])
        files["manual"] = manual_file
    
    return files

def export_history(order_id=None, batch_id=None, output_path=None):
    history = get_history(order_id=order_id, batch_id=batch_id, limit=10000)
    
    if not output_path:
        if order_id:
            output_path = f"history_order_{order_id}.csv"
        elif batch_id:
            output_path = f"history_batch_{batch_id}.csv"
        else:
            output_path = f"history_all_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    fieldnames = [
        "batch_id", "request_id", "order_id", "customer_name", "session_id",
        "action", "gift_sku", "gift_quantity", "decision", "final_decision",
        "reason", "processed_at", "finalized_at"
    ]
    
    export_to_csv(history, output_path, fieldnames)
    return output_path

def get_batches_for_export():
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                batch_id,
                MIN(processed_at) as started_at,
                MAX(processed_at) as ended_at,
                SUM(CASE WHEN decision = 'APPROVE' THEN 1 ELSE 0 END) as approve_count,
                SUM(CASE WHEN decision = 'REJECT' THEN 1 ELSE 0 END) as reject_count,
                SUM(CASE WHEN decision = 'MANUAL' THEN 1 ELSE 0 END) as manual_count,
                COUNT(*) as total
            FROM process_history
            GROUP BY batch_id
            ORDER BY started_at DESC
        """)
        return [dict(row) for row in cursor.fetchall()]

def get_pending_requests():
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT rq.*, o.customer_name, o.customer_phone,
                   o.session_id, o.total_amount, o.refund_amount, o.final_amount
            FROM replacement_requests rq
            JOIN orders o ON rq.order_id = o.order_id
            WHERE rq.request_id NOT IN (SELECT request_id FROM processed_requests)
            ORDER BY rq.created_at ASC
        """)
        return [dict(row) for row in cursor.fetchall()]

def get_processed_requests(limit=100):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT pr.*, rq.order_id, o.customer_name, o.session_id
            FROM processed_requests pr
            JOIN replacement_requests rq ON pr.request_id = rq.request_id
            JOIN orders o ON rq.order_id = o.order_id
            ORDER BY pr.finalized_at DESC
            LIMIT ?
        """, (limit,))
        return [dict(row) for row in cursor.fetchall()]

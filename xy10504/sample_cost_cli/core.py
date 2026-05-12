import json
import hashlib
import uuid
from datetime import datetime, date
from typing import List, Dict, Any, Optional, Tuple
from .database import get_connection

RECORD_TYPES = ["sample", "promotion_gift", "loss"]

def generate_record_hash(record: Dict[str, Any]) -> str:
    sorted_keys = sorted(record.keys())
    record_str = json.dumps({k: record[k] for k in sorted_keys}, sort_keys=True, default=str)
    return hashlib.sha256(record_str.encode()).hexdigest()

def validate_record(record: Dict[str, Any], conn) -> Tuple[bool, List[Dict[str, Any]]]:
    errors = []
    valid = True
    
    record_type = record.get("record_type")
    if record_type not in RECORD_TYPES:
        valid = False
        errors.append({
            "type": "INVALID_TYPE",
            "message": f"无效的记录类型: {record_type}，有效类型: {RECORD_TYPES}"
        })
    
    store_id = record.get("store_id")
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM stores WHERE id = ?", (store_id,))
    if not cursor.fetchone():
        valid = False
        errors.append({
            "type": "STORE_NOT_FOUND",
            "message": f"门店不存在: {store_id}"
        })
    
    batch_id = record.get("batch_id")
    cursor.execute("SELECT quantity, product_id, expiry_date FROM batches WHERE id = ? AND store_id = ?", 
                   (batch_id, store_id))
    batch = cursor.fetchone()
    if not batch:
        valid = False
        errors.append({
            "type": "BATCH_NOT_FOUND",
            "message": f"批次不存在或不属于该门店: {batch_id}"
        })
    else:
        record_quantity = float(record.get("quantity", 0))
        batch_quantity = float(batch["quantity"])
        
        cursor.execute("""
            SELECT COALESCE(SUM(quantity), 0) as used 
            FROM sample_records 
            WHERE batch_id = ? AND status = 'valid'
        """, (batch_id,))
        used = float(cursor.fetchone()["used"])
        remaining = batch_quantity - used
        
        if record_quantity > remaining:
            valid = False
            errors.append({
                "type": "QUANTITY_EXCEEDS",
                "message": f"数量超过批次余量: 批次剩余 {remaining}, 申请 {record_quantity}"
            })
    
    promotion_id = record.get("promotion_id")
    record_date = record.get("record_date")
    
    if promotion_id:
        cursor.execute("""
            SELECT start_date, end_date, status 
            FROM promotions 
            WHERE id = ? AND store_id = ?
        """, (promotion_id, store_id))
        promo = cursor.fetchone()
        
        if not promo:
            valid = False
            errors.append({
                "type": "PROMOTION_NOT_FOUND",
                "message": f"促销活动不存在: {promotion_id}"
            })
        else:
            record_date_obj = datetime.strptime(record_date, "%Y-%m-%d").date()
            start_date = datetime.strptime(promo["start_date"], "%Y-%m-%d").date()
            end_date = datetime.strptime(promo["end_date"], "%Y-%m-%d").date()
            
            if record_date_obj < start_date or record_date_obj > end_date:
                valid = False
                errors.append({
                    "type": "PROMOTION_EXPIRED",
                    "message": f"记录日期 {record_date} 不在活动有效期内 ({start_date} ~ {end_date})"
                })
            
            if promo["status"] != "active":
                valid = False
                errors.append({
                    "type": "PROMOTION_INACTIVE",
                    "message": f"促销活动已结束或未激活: {promotion_id}"
                })
    
    if record_type == "sample" and not promotion_id:
        valid = False
        errors.append({
            "type": "SAMPLE_WITHOUT_PROMOTION",
            "message": "试吃记录必须关联促销活动"
        })
    
    return valid, errors

def import_records(records: List[Dict[str, Any]], source_file: str, operator: str = "system") -> Dict[str, Any]:
    result = {
        "success": True,
        "import_batch_id": str(uuid.uuid4()),
        "total": len(records),
        "imported": 0,
        "skipped": 0,
        "failed": 0,
        "duplicates": 0,
        "history": [],
        "errors": []
    }
    
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            INSERT INTO import_batches (id, source_file, record_count, status, operator)
            VALUES (?, ?, ?, 'processing', ?)
        """, (result["import_batch_id"], source_file, len(records), operator))
        conn.commit()
        
        for idx, record in enumerate(records):
            record_hash = generate_record_hash(record)
            record_id = f"REC_{result['import_batch_id']}_{idx}"
            
            try:
                cursor.execute("SELECT id FROM sample_records WHERE id = ?", (record_id,))
                if cursor.fetchone():
                    result["duplicates"] += 1
                    result["skipped"] += 1
                    result["history"].append({
                        "timestamp": datetime.now().isoformat(),
                        "action": "SKIP",
                        "record_id": record_id,
                        "reason": "重复导入（幂等性保护）"
                    })
                    continue
                
                is_valid, validation_errors = validate_record(record, conn)
                
                try:
                    cursor.execute("""
                        INSERT INTO sample_records 
                        (id, store_id, batch_id, quantity, record_type, record_date, 
                         promotion_id, reason, operator, status, import_batch_id)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        record_id,
                        record.get("store_id"),
                        record.get("batch_id"),
                        record.get("quantity"),
                        record.get("record_type"),
                        record.get("record_date"),
                        record.get("promotion_id"),
                        record.get("reason"),
                        operator,
                        "valid" if is_valid else "error",
                        result["import_batch_id"]
                    ))
                    
                    for err in validation_errors:
                        cursor.execute("""
                            INSERT INTO validation_errors 
                            (sample_record_id, error_type, error_message)
                            VALUES (?, ?, ?)
                        """, (record_id, err["type"], err["message"]))
                    
                    cursor.execute("""
                        INSERT INTO audit_logs 
                        (entity_type, entity_id, action, after_data, operator, reason)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, (
                        "sample_record",
                        record_id,
                        "CREATE",
                        json.dumps(record, default=str),
                        operator,
                        "数据导入"
                    ))
                    
                    conn.commit()
                    
                    if is_valid:
                        result["imported"] += 1
                    else:
                        result["failed"] += 1
                        result["errors"].append({
                            "record_id": record_id,
                            "record": record,
                            "validation_errors": validation_errors
                        })
                    
                    result["history"].append({
                        "timestamp": datetime.now().isoformat(),
                        "action": "IMPORT",
                        "record_id": record_id,
                        "status": "success" if is_valid else "error"
                    })
                    
                except Exception as inner_e:
                    conn.rollback()
                    result["failed"] += 1
                    result["errors"].append({
                        "record_id": record_id,
                        "record": record,
                        "exception": str(inner_e)
                    })
                    result["history"].append({
                        "timestamp": datetime.now().isoformat(),
                        "action": "IMPORT_FAILED",
                        "record_id": record_id,
                        "status": "failed",
                        "reason": str(inner_e)
                    })
                    
            except Exception as outer_e:
                result["history"].append({
                    "timestamp": datetime.now().isoformat(),
                    "action": "ERROR",
                    "record_id": record_id,
                    "reason": str(outer_e)
                })
        
        cursor.execute("""
            UPDATE import_batches 
            SET status = 'completed', completed_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        """, (result["import_batch_id"],))
        conn.commit()
        result["status"] = "导入完成"
        
    except Exception as e:
        result["success"] = False
        result["status"] = "导入失败"
        result["errors"].append({"exception": str(e)})
    finally:
        conn.close()
    
    return result

def check_status() -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()
    
    result = {
        "stores": 0,
        "products": 0,
        "batches": 0,
        "promotions": 0,
        "records_total": 0,
        "records_valid": 0,
        "records_error": 0,
        "unresolved_errors": 0,
        "import_batches": 0,
        "recent_activity": []
    }
    
    try:
        for table in ["stores", "products", "batches", "promotions"]:
            cursor.execute(f"SELECT COUNT(*) as cnt FROM {table}")
            result[table] = cursor.fetchone()["cnt"]
        
        cursor.execute("""
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'valid' THEN 1 ELSE 0 END) as valid_cnt,
                SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_cnt
            FROM sample_records
        """)
        row = cursor.fetchone()
        result["records_total"] = row["total"]
        result["records_valid"] = row["valid_cnt"] or 0
        result["records_error"] = row["error_cnt"] or 0
        
        cursor.execute("""
            SELECT COUNT(*) as cnt FROM validation_errors WHERE resolved = 0
        """)
        result["unresolved_errors"] = cursor.fetchone()["cnt"]
        
        cursor.execute("SELECT COUNT(*) as cnt FROM import_batches")
        result["import_batches"] = cursor.fetchone()["cnt"]
        
        cursor.execute("""
            SELECT entity_type, entity_id, action, operator, created_at
            FROM audit_logs
            ORDER BY created_at DESC
            LIMIT 10
        """)
        result["recent_activity"] = [dict(row) for row in cursor.fetchall()]
        
    finally:
        conn.close()
    
    return result

def get_record_detail(record_id: str) -> Optional[Dict[str, Any]]:
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            SELECT sr.*, s.name as store_name, p.name as product_name, 
                   pr.name as promotion_name, b.unit_cost
            FROM sample_records sr
            JOIN stores s ON sr.store_id = s.id
            JOIN batches b ON sr.batch_id = b.id
            JOIN products p ON b.product_id = p.id
            LEFT JOIN promotions pr ON sr.promotion_id = pr.id
            WHERE sr.id = ?
        """, (record_id,))
        record = cursor.fetchone()
        
        if not record:
            return None
        
        result = dict(record)
        result["cost"] = float(result["quantity"]) * float(result["unit_cost"])
        
        cursor.execute("""
            SELECT * FROM validation_errors WHERE sample_record_id = ?
        """, (record_id,))
        result["validation_errors"] = [dict(row) for row in cursor.fetchall()]
        
        cursor.execute("""
            SELECT * FROM audit_logs 
            WHERE entity_type = 'sample_record' AND entity_id = ?
            ORDER BY created_at ASC
        """, (record_id,))
        result["audit_history"] = [dict(row) for row in cursor.fetchall()]
        
        return result
    finally:
        conn.close()

def manual_correct(record_id: str, updates: Dict[str, Any], operator: str, reason: str) -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()
    
    result = {
        "success": False,
        "before": None,
        "after": None,
        "diff": {},
        "history": [],
        "errors": []
    }
    
    try:
        cursor.execute("SELECT * FROM sample_records WHERE id = ?", (record_id,))
        old_record = cursor.fetchone()
        
        if not old_record:
            result["errors"].append(f"记录不存在: {record_id}")
            return result
        
        result["before"] = dict(old_record)
        
        allowed_fields = ["quantity", "record_type", "promotion_id", "reason", "status"]
        for field in allowed_fields:
            if field in updates:
                if field == "quantity":
                    updates[field] = float(updates[field])
        
        set_clause = ", ".join([f"{k} = ?" for k in updates.keys() if k in allowed_fields])
        params = [updates[k] for k in updates.keys() if k in allowed_fields]
        
        if set_clause:
            cursor.execute(f"""
                UPDATE sample_records SET {set_clause}, operator = ? WHERE id = ?
            """, params + [operator, record_id])
            
            cursor.execute("SELECT * FROM sample_records WHERE id = ?", (record_id,))
            new_record = cursor.fetchone()
            result["after"] = dict(new_record)
            
            for key in updates:
                if key in allowed_fields and result["before"][key] != result["after"][key]:
                    result["diff"][key] = {
                        "before": result["before"][key],
                        "after": result["after"][key]
                    }
            
            cursor.execute("""
                INSERT INTO audit_logs 
                (entity_type, entity_id, action, before_data, after_data, operator, reason)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (
                "sample_record",
                record_id,
                "UPDATE",
                json.dumps(result["before"], default=str),
                json.dumps(result["after"], default=str),
                operator,
                reason
            ))
            
            cursor.execute("DELETE FROM validation_errors WHERE sample_record_id = ?", (record_id,))
            
            is_valid, validation_errors = validate_record(result["after"], conn)
            for err in validation_errors:
                cursor.execute("""
                    INSERT INTO validation_errors 
                    (sample_record_id, error_type, error_message)
                    VALUES (?, ?, ?)
                """, (record_id, err["type"], err["message"]))
            
            new_status = "valid" if is_valid else "error"
            if result["after"]["status"] != new_status:
                cursor.execute("UPDATE sample_records SET status = ? WHERE id = ?", 
                              (new_status, record_id))
                result["after"]["status"] = new_status
                result["diff"]["status"] = {
                    "before": result["before"]["status"],
                    "after": new_status
                }
            
            result["history"].append({
                "timestamp": datetime.now().isoformat(),
                "action": "CORRECT",
                "record_id": record_id,
                "diff": result["diff"]
            })
            
            conn.commit()
            result["success"] = True
        else:
            result["errors"].append("没有可更新的字段")
            
    except Exception as e:
        conn.rollback()
        result["errors"].append(f"修正失败: {str(e)}")
    finally:
        conn.close()
    
    return result

def generate_report(store_id: Optional[str] = None, 
                    promotion_id: Optional[str] = None,
                    start_date: Optional[str] = None,
                    end_date: Optional[str] = None) -> Dict[str, Any]:
    conn = get_connection()
    cursor = conn.cursor()
    
    result = {
        "summary": {
            "total_records": 0,
            "valid_records": 0,
            "error_records": 0,
            "total_cost": 0.0,
            "by_type": {},
            "by_store": {},
            "by_promotion": {},
            "by_batch": []
        },
        "details": [],
        "errors": []
    }
    
    try:
        where_conditions = []
        params = []
        
        if store_id:
            where_conditions.append("sr.store_id = ?")
            params.append(store_id)
        if promotion_id:
            where_conditions.append("sr.promotion_id = ?")
            params.append(promotion_id)
        if start_date:
            where_conditions.append("sr.record_date >= ?")
            params.append(start_date)
        if end_date:
            where_conditions.append("sr.record_date <= ?")
            params.append(end_date)
        
        where_clause = " AND ".join(where_conditions)
        if where_clause:
            where_clause = "WHERE " + where_clause
        
        cursor.execute(f"""
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN sr.status = 'valid' THEN 1 ELSE 0 END) as valid_cnt,
                SUM(CASE WHEN sr.status = 'error' THEN 1 ELSE 0 END) as error_cnt,
                SUM(CASE WHEN sr.status = 'valid' THEN sr.quantity * b.unit_cost ELSE 0 END) as total_cost
            FROM sample_records sr
            JOIN batches b ON sr.batch_id = b.id
            {where_clause}
        """, params)
        row = cursor.fetchone()
        result["summary"]["total_records"] = row["total"]
        result["summary"]["valid_records"] = row["valid_cnt"] or 0
        result["summary"]["error_records"] = row["error_cnt"] or 0
        result["summary"]["total_cost"] = float(row["total_cost"] or 0)
        
        cursor.execute(f"""
            SELECT sr.record_type, 
                   COUNT(*) as cnt,
                   SUM(sr.quantity * b.unit_cost) as cost
            FROM sample_records sr
            JOIN batches b ON sr.batch_id = b.id
            WHERE sr.status = 'valid'
            {('AND ' + where_clause.replace('WHERE ', '')) if where_clause else ''}
            GROUP BY sr.record_type
        """, params)
        for row in cursor.fetchall():
            result["summary"]["by_type"][row["record_type"]] = {
                "count": row["cnt"],
                "cost": float(row["cost"] or 0)
            }
        
        cursor.execute(f"""
            SELECT s.id as store_id, s.name as store_name,
                   COUNT(*) as cnt,
                   SUM(sr.quantity * b.unit_cost) as cost
            FROM sample_records sr
            JOIN stores s ON sr.store_id = s.id
            JOIN batches b ON sr.batch_id = b.id
            WHERE sr.status = 'valid'
            {('AND ' + where_clause.replace('WHERE ', '')) if where_clause else ''}
            GROUP BY s.id, s.name
        """, params)
        for row in cursor.fetchall():
            result["summary"]["by_store"][row["store_id"]] = {
                "name": row["store_name"],
                "count": row["cnt"],
                "cost": float(row["cost"] or 0)
            }
        
        cursor.execute(f"""
            SELECT pr.id as promo_id, pr.name as promo_name,
                   COUNT(*) as cnt,
                   SUM(sr.quantity * b.unit_cost) as cost
            FROM sample_records sr
            LEFT JOIN promotions pr ON sr.promotion_id = pr.id
            JOIN batches b ON sr.batch_id = b.id
            WHERE sr.status = 'valid'
            {('AND ' + where_clause.replace('WHERE ', '')) if where_clause else ''}
            GROUP BY pr.id, pr.name
        """, params)
        for row in cursor.fetchall():
            promo_key = row["promo_id"] or "no_promotion"
            result["summary"]["by_promotion"][promo_key] = {
                "name": row["promo_name"] or "无活动关联",
                "count": row["cnt"],
                "cost": float(row["cost"] or 0)
            }
        
        cursor.execute(f"""
            SELECT b.id as batch_id, p.name as product_name, p.category,
                   SUM(sr.quantity) as used_quantity,
                   SUM(sr.quantity * b.unit_cost) as cost,
                   COUNT(*) as record_count
            FROM sample_records sr
            JOIN batches b ON sr.batch_id = b.id
            JOIN products p ON b.product_id = p.id
            WHERE sr.status = 'valid'
            {('AND ' + where_clause.replace('WHERE ', '')) if where_clause else ''}
            GROUP BY b.id, p.name, p.category
        """, params)
        for row in cursor.fetchall():
            result["summary"]["by_batch"].append({
                "batch_id": row["batch_id"],
                "product_name": row["product_name"],
                "category": row["category"],
                "used_quantity": float(row["used_quantity"]),
                "cost": float(row["cost"] or 0),
                "record_count": row["record_count"]
            })
        
        cursor.execute(f"""
            SELECT sr.id, sr.store_id, s.name as store_name,
                   sr.batch_id, p.name as product_name, p.category,
                   sr.record_type, sr.quantity, b.unit_cost,
                   sr.quantity * b.unit_cost as cost,
                   sr.record_date, sr.promotion_id, pr.name as promotion_name,
                   sr.reason, sr.status, sr.operator
            FROM sample_records sr
            JOIN stores s ON sr.store_id = s.id
            JOIN batches b ON sr.batch_id = b.id
            JOIN products p ON b.product_id = p.id
            LEFT JOIN promotions pr ON sr.promotion_id = pr.id
            {where_clause}
            ORDER BY sr.record_date DESC, sr.created_at DESC
        """, params)
        for row in cursor.fetchall():
            result["details"].append(dict(row))
        
        cursor.execute(f"""
            SELECT ve.*, sr.record_type, sr.quantity, sr.record_date
            FROM validation_errors ve
            JOIN sample_records sr ON ve.sample_record_id = sr.id
            WHERE ve.resolved = 0
            {('AND ' + where_clause.replace('WHERE ', '')) if where_clause else ''}
        """, params)
        result["errors"] = [dict(row) for row in cursor.fetchall()]
        
    finally:
        conn.close()
    
    return result

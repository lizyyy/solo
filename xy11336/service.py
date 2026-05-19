import json
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from models import (
    Database, OperationType, OperationStatus, PartStatus,
    AuditInfo, Part, OperationRecord, StockFlow
)

class WarehouseService:
    def __init__(self, db: Database = None):
        self.db = db or Database()
    
    def _check_operation_exists(self, operation_id: str) -> Optional[Dict[str, Any]]:
        conn = self.db.get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT * FROM operation_records WHERE operation_id = ?",
            (operation_id,)
        )
        row = cursor.fetchone()
        conn.close()
        return dict(row) if row else None
    
    def _create_operation_record(self, operation_id: str, operation_type: OperationType,
                                 audit: AuditInfo, status: OperationStatus,
                                 details: Dict[str, Any], error_message: str = None) -> OperationRecord:
        conn = self.db.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO operation_records (
                operation_id, operation_type, operator_id, operator_name,
                role, operation_time, status, details, error_message
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            operation_id, operation_type.value,
            audit.operator_id, audit.operator_name, audit.role,
            audit.operation_time, status.value,
            json.dumps(details, ensure_ascii=False), error_message
        ))
        conn.commit()
        conn.close()
        return OperationRecord(
            operation_id=operation_id,
            operation_type=operation_type,
            operator_id=audit.operator_id,
            operator_name=audit.operator_name,
            role=audit.role,
            operation_time=audit.operation_time,
            status=status,
            details=details,
            error_message=error_message
        )
    
    def _update_operation_status(self, operation_id: str, status: OperationStatus,
                                  error_message: str = None):
        conn = self.db.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE operation_records SET status = ?, error_message = ?
            WHERE operation_id = ?
        """, (status.value, error_message, operation_id))
        conn.commit()
        conn.close()
    
    def _create_stock_flow(self, part_code: str, operation_type: OperationType,
                           quantity: int, operation_id: str, operator_id: str,
                           operation_time: datetime):
        conn = self.db.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO stock_flows (
                part_code, operation_type, quantity, operation_id,
                operator_id, operation_time
            ) VALUES (?, ?, ?, ?, ?, ?)
        """, (
            part_code, operation_type.value, quantity, operation_id,
            operator_id, operation_time
        ))
        conn.commit()
        conn.close()
    
    def _get_or_create_part(self, part_code: str, part_name: str) -> Tuple[Dict, bool]:
        conn = self.db.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM parts WHERE part_code = ?", (part_code,))
        row = cursor.fetchone()
        if row:
            conn.close()
            return dict(row), False
        
        cursor.execute("""
            INSERT INTO parts (part_code, part_name, quantity, status)
            VALUES (?, ?, 0, ?)
        """, (part_code, part_name, PartStatus.IN_STOCK.value))
        conn.commit()
        cursor.execute("SELECT * FROM parts WHERE part_code = ?", (part_code,))
        row = cursor.fetchone()
        conn.close()
        return dict(row), True
    
    def _update_part_quantity(self, part_code: str, quantity_delta: int, new_status: PartStatus = None):
        conn = self.db.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM parts WHERE part_code = ?", (part_code,))
        row = cursor.fetchone()
        if not row:
            conn.close()
            raise ValueError(f"零件 {part_code} 不存在")
        
        current_qty = row['quantity']
        new_qty = current_qty + quantity_delta
        if new_qty < 0:
            conn.close()
            raise ValueError(f"零件 {part_code} 库存不足: 当前 {current_qty}, 需要 {abs(quantity_delta)}")
        
        update_sql = "UPDATE parts SET quantity = ?, updated_at = CURRENT_TIMESTAMP"
        params = [new_qty]
        if new_status:
            update_sql += ", status = ?"
            params.append(new_status.value)
        update_sql += " WHERE part_code = ?"
        params.append(part_code)
        
        cursor.execute(update_sql, params)
        conn.commit()
        conn.close()
    
    def _create_part_operation(self, part_code: str, operation_id: str, quantity: int,
                                status: PartStatus, op_type_field: str):
        conn = self.db.get_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO part_operations (
                part_code, operation_id, quantity, status, {0}
            ) VALUES (?, ?, ?, ?, ?)
        """.format(op_type_field), (
            part_code, operation_id, quantity, status.value, operation_id
        ))
        conn.commit()
        conn.close()
    
    def receive_parts(self, operation_id: str, parts: List[Dict[str, Any]],
                      audit: AuditInfo) -> Dict[str, Any]:
        existing = self._check_operation_exists(operation_id)
        if existing:
            if existing['status'] == OperationStatus.SUCCESS.value:
                return {
                    "success": True,
                    "operation_id": operation_id,
                    "message": "操作已成功完成（幂等返回）",
                    "details": json.loads(existing['details'])
                }
            elif existing['status'] == OperationStatus.FAILED.value:
                pass
        
        try:
            self._create_operation_record(
                operation_id, OperationType.RECEIVE, audit,
                OperationStatus.PENDING, {"parts": parts}
            )
            
            result_parts = []
            for part in parts:
                part_code = part['part_code']
                part_name = part['part_name']
                quantity = part['quantity']
                
                part_info, _ = self._get_or_create_part(part_code, part_name)
                self._update_part_quantity(part_code, quantity)
                self._create_stock_flow(
                    part_code, OperationType.RECEIVE, quantity,
                    operation_id, audit.operator_id, audit.operation_time
                )
                self._create_part_operation(
                    part_code, operation_id, quantity,
                    PartStatus.ISSUED, "receive_id"
                )
                result_parts.append({
                    "part_code": part_code,
                    "part_name": part_name,
                    "quantity": quantity,
                    "status": "success"
                })
            
            self._update_operation_status(operation_id, OperationStatus.SUCCESS)
            
            return {
                "success": True,
                "operation_id": operation_id,
                "message": "领用成功",
                "total_parts": len(result_parts),
                "parts": result_parts
            }
        
        except Exception as e:
            self._update_operation_status(operation_id, OperationStatus.FAILED, str(e))
            return {
                "success": False,
                "operation_id": operation_id,
                "message": f"领用失败: {str(e)}"
            }
    
    def install_parts(self, operation_id: str, receive_operation_id: str,
                      parts: List[Dict[str, Any]], audit: AuditInfo) -> Dict[str, Any]:
        existing = self._check_operation_exists(operation_id)
        if existing:
            if existing['status'] == OperationStatus.SUCCESS.value:
                return {
                    "success": True,
                    "operation_id": operation_id,
                    "message": "操作已成功完成（幂等返回）",
                    "details": json.loads(existing['details'])
                }
        
        try:
            receive_record = self._check_operation_exists(receive_operation_id)
            if not receive_record or receive_record['status'] != OperationStatus.SUCCESS.value:
                raise ValueError(f"领用记录 {receive_operation_id} 不存在或未成功")
            
            self._create_operation_record(
                operation_id, OperationType.INSTALL, audit,
                OperationStatus.PENDING,
                {"receive_operation_id": receive_operation_id, "parts": parts}
            )
            
            result_parts = []
            for part in parts:
                part_code = part['part_code']
                quantity = part['quantity']
                
                self._update_part_quantity(part_code, -quantity, PartStatus.INSTALLED)
                self._create_stock_flow(
                    part_code, OperationType.INSTALL, -quantity,
                    operation_id, audit.operator_id, audit.operation_time
                )
                self._create_part_operation(
                    part_code, operation_id, quantity,
                    PartStatus.INSTALLED, "install_id"
                )
                result_parts.append({
                    "part_code": part_code,
                    "quantity": quantity,
                    "status": "success"
                })
            
            self._update_operation_status(operation_id, OperationStatus.SUCCESS)
            
            return {
                "success": True,
                "operation_id": operation_id,
                "message": "装机成功",
                "receive_operation_id": receive_operation_id,
                "total_parts": len(result_parts),
                "parts": result_parts
            }
        
        except Exception as e:
            self._update_operation_status(operation_id, OperationStatus.FAILED, str(e))
            return {
                "success": False,
                "operation_id": operation_id,
                "message": f"装机失败: {str(e)}"
            }
    
    def return_parts(self, operation_id: str, install_operation_id: str,
                     parts: List[Dict[str, Any]], audit: AuditInfo) -> Dict[str, Any]:
        existing = self._check_operation_exists(operation_id)
        if existing:
            if existing['status'] == OperationStatus.SUCCESS.value:
                return {
                    "success": True,
                    "operation_id": operation_id,
                    "message": "操作已成功完成（幂等返回）",
                    "details": json.loads(existing['details'])
                }
        
        try:
            install_record = self._check_operation_exists(install_operation_id)
            if not install_record or install_record['status'] != OperationStatus.SUCCESS.value:
                raise ValueError(f"装机记录 {install_operation_id} 不存在或未成功")
            
            self._create_operation_record(
                operation_id, OperationType.RETURN, audit,
                OperationStatus.PENDING,
                {"install_operation_id": install_operation_id, "parts": parts}
            )
            
            result_parts = []
            for part in parts:
                part_code = part['part_code']
                quantity = part['quantity']
                
                self._update_part_quantity(part_code, quantity, PartStatus.RETURNED)
                self._create_stock_flow(
                    part_code, OperationType.RETURN, quantity,
                    operation_id, audit.operator_id, audit.operation_time
                )
                self._create_part_operation(
                    part_code, operation_id, quantity,
                    PartStatus.RETURNED, "return_id"
                )
                result_parts.append({
                    "part_code": part_code,
                    "quantity": quantity,
                    "status": "success"
                })
            
            self._update_operation_status(operation_id, OperationStatus.SUCCESS)
            
            return {
                "success": True,
                "operation_id": operation_id,
                "message": "返还成功",
                "install_operation_id": install_operation_id,
                "total_parts": len(result_parts),
                "parts": result_parts
            }
        
        except Exception as e:
            self._update_operation_status(operation_id, OperationStatus.FAILED, str(e))
            return {
                "success": False,
                "operation_id": operation_id,
                "message": f"返还失败: {str(e)}"
            }
    
    def claim_parts(self, operation_id: str, return_operation_id: str,
                    parts: List[Dict[str, Any]], audit: AuditInfo) -> Dict[str, Any]:
        existing = self._check_operation_exists(operation_id)
        if existing:
            if existing['status'] == OperationStatus.SUCCESS.value:
                return {
                    "success": True,
                    "operation_id": operation_id,
                    "message": "操作已成功完成（幂等返回）",
                    "details": json.loads(existing['details'])
                }
        
        try:
            return_record = self._check_operation_exists(return_operation_id)
            if not return_record or return_record['status'] != OperationStatus.SUCCESS.value:
                raise ValueError(f"返还记录 {return_operation_id} 不存在或未成功")
            
            self._create_operation_record(
                operation_id, OperationType.CLAIM, audit,
                OperationStatus.PENDING,
                {"return_operation_id": return_operation_id, "parts": parts}
            )
            
            result_parts = []
            for part in parts:
                part_code = part['part_code']
                quantity = part['quantity']
                
                self._update_part_quantity(part_code, 0, PartStatus.CLAIMED)
                self._create_stock_flow(
                    part_code, OperationType.CLAIM, 0,
                    operation_id, audit.operator_id, audit.operation_time
                )
                self._create_part_operation(
                    part_code, operation_id, quantity,
                    PartStatus.CLAIMED, "claim_id"
                )
                result_parts.append({
                    "part_code": part_code,
                    "quantity": quantity,
                    "status": "success"
                })
            
            self._update_operation_status(operation_id, OperationStatus.SUCCESS)
            
            return {
                "success": True,
                "operation_id": operation_id,
                "message": "索赔成功",
                "return_operation_id": return_operation_id,
                "total_parts": len(result_parts),
                "parts": result_parts
            }
        
        except Exception as e:
            self._update_operation_status(operation_id, OperationStatus.FAILED, str(e))
            return {
                "success": False,
                "operation_id": operation_id,
                "message": f"索赔失败: {str(e)}"
            }
    
    def write_off_parts(self, operation_id: str, claim_operation_id: str,
                        parts: List[Dict[str, Any]], audit: AuditInfo) -> Dict[str, Any]:
        existing = self._check_operation_exists(operation_id)
        if existing:
            if existing['status'] == OperationStatus.SUCCESS.value:
                return {
                    "success": True,
                    "operation_id": operation_id,
                    "message": "操作已成功完成（幂等返回）",
                    "details": json.loads(existing['details'])
                }
        
        try:
            claim_record = self._check_operation_exists(claim_operation_id)
            if not claim_record or claim_record['status'] != OperationStatus.SUCCESS.value:
                raise ValueError(f"索赔记录 {claim_operation_id} 不存在或未成功")
            
            self._create_operation_record(
                operation_id, OperationType.WRITE_OFF, audit,
                OperationStatus.PENDING,
                {"claim_operation_id": claim_operation_id, "parts": parts}
            )
            
            result_parts = []
            for part in parts:
                part_code = part['part_code']
                quantity = part['quantity']
                
                self._update_part_quantity(part_code, -quantity, PartStatus.WRITTEN_OFF)
                self._create_stock_flow(
                    part_code, OperationType.WRITE_OFF, -quantity,
                    operation_id, audit.operator_id, audit.operation_time
                )
                self._create_part_operation(
                    part_code, operation_id, quantity,
                    PartStatus.WRITTEN_OFF, "write_off_id"
                )
                result_parts.append({
                    "part_code": part_code,
                    "quantity": quantity,
                    "status": "success"
                })
            
            self._update_operation_status(operation_id, OperationStatus.SUCCESS)
            
            return {
                "success": True,
                "operation_id": operation_id,
                "message": "核销成功",
                "claim_operation_id": claim_operation_id,
                "total_parts": len(result_parts),
                "parts": result_parts
            }
        
        except Exception as e:
            self._update_operation_status(operation_id, OperationStatus.FAILED, str(e))
            return {
                "success": False,
                "operation_id": operation_id,
                "message": f"核销失败: {str(e)}"
            }
    
    def batch_operation(self, operations: List[Dict[str, Any]], audit: AuditInfo) -> Dict[str, Any]:
        success_count = 0
        failed_count = 0
        success_operations = []
        failed_operations = []
        
        for op in operations:
            try:
                op_type = op['operation_type']
                op_id = op['operation_id']
                
                if op_type == OperationType.RECEIVE.value:
                    result = self.receive_parts(op_id, op['parts'], audit)
                elif op_type == OperationType.INSTALL.value:
                    result = self.install_parts(op_id, op['receive_operation_id'], op['parts'], audit)
                elif op_type == OperationType.RETURN.value:
                    result = self.return_parts(op_id, op['install_operation_id'], op['parts'], audit)
                elif op_type == OperationType.CLAIM.value:
                    result = self.claim_parts(op_id, op['return_operation_id'], op['parts'], audit)
                elif op_type == OperationType.WRITE_OFF.value:
                    result = self.write_off_parts(op_id, op['claim_operation_id'], op['parts'], audit)
                else:
                    raise ValueError(f"不支持的操作类型: {op_type}")
                
                if result['success']:
                    success_count += 1
                    success_operations.append({
                        "operation_id": op_id,
                        "operation_type": op_type,
                        "message": result['message']
                    })
                else:
                    failed_count += 1
                    failed_operations.append({
                        "operation_id": op_id,
                        "operation_type": op_type,
                        "error": result['message']
                    })
            
            except Exception as e:
                failed_count += 1
                failed_operations.append({
                    "operation_id": op.get('operation_id'),
                    "operation_type": op.get('operation_type'),
                    "error": str(e)
                })
        
        overall_status = OperationStatus.SUCCESS if failed_count == 0 else \
                        OperationStatus.PARTIAL if success_count > 0 else OperationStatus.FAILED
        
        return {
            "success": failed_count == 0,
            "overall_status": overall_status.value,
            "total_count": len(operations),
            "success_count": success_count,
            "failed_count": failed_count,
            "success_operations": success_operations,
            "failed_operations": failed_operations,
            "message": f"批量操作完成: 成功 {success_count}, 失败 {failed_count}"
        }
    
    def query_operations(self, operator_id: str = None, start_time: datetime = None,
                         end_time: datetime = None, status: str = None,
                         operation_type: str = None, error_type: str = None,
                         page: int = 1, page_size: int = 100) -> Dict[str, Any]:
        conn = self.db.get_connection()
        cursor = conn.cursor()
        
        query = "SELECT * FROM operation_records WHERE 1=1"
        params = []
        
        if operator_id:
            query += " AND operator_id = ?"
            params.append(operator_id)
        
        if start_time:
            query += " AND operation_time >= ?"
            params.append(start_time)
        
        if end_time:
            query += " AND operation_time <= ?"
            params.append(end_time)
        
        if status:
            query += " AND status = ?"
            params.append(status)
        
        if operation_type:
            query += " AND operation_type = ?"
            params.append(operation_type)
        
        if error_type:
            query += " AND error_message LIKE ?"
            params.append(f"%{error_type}%")
        
        query += " ORDER BY operation_time DESC LIMIT ? OFFSET ?"
        params.extend([page_size, (page - 1) * page_size])
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        count_query = query.split(" ORDER BY ")[0].replace("SELECT *", "SELECT COUNT(*)")
        cursor.execute(count_query, params[:-2])
        total = cursor.fetchone()[0]
        
        conn.close()
        
        operations = []
        for row in rows:
            op = dict(row)
            op['details'] = json.loads(op['details']) if op['details'] else {}
            operations.append(op)
        
        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size,
            "operations": operations
        }
    
    def export_report(self, operator_id: str = None, start_time: datetime = None,
                      end_time: datetime = None, status: str = None,
                      operation_type: str = None, error_type: str = None) -> str:
        result = self.query_operations(
            operator_id, start_time, end_time, status,
            operation_type, error_type, page=1, page_size=10000
        )
        
        lines = []
        lines.append("家电售后仓操作报告")
        lines.append(f"导出时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("=" * 80)
        lines.append(f"{'操作ID':<20} {'操作类型':<10} {'操作人':<12} {'角色':<10} {'操作时间':<20} {'状态':<10}")
        lines.append("-" * 80)
        
        for op in result['operations']:
            lines.append(
                f"{op['operation_id']:<20} "
                f"{op['operation_type']:<10} "
                f"{op['operator_name']:<12} "
                f"{op['role']:<10} "
                f"{op['operation_time'][:19]:<20} "
                f"{op['status']:<10}"
            )
        
        lines.append("=" * 80)
        lines.append(f"总计: {result['total']} 条记录")
        
        report_content = "\n".join(lines)
        
        report_file = f"report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        with open(report_file, 'w', encoding='utf-8') as f:
            f.write(report_content)
        
        return report_file
    
    def get_part_trace(self, part_code: str) -> Dict[str, Any]:
        conn = self.db.get_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT sf.*, ors.operator_name, ors.role
            FROM stock_flows sf
            JOIN operation_records ors ON sf.operation_id = ors.operation_id
            WHERE sf.part_code = ?
            ORDER BY sf.operation_time ASC
        """, (part_code,))
        
        rows = cursor.fetchall()
        
        cursor.execute("SELECT * FROM parts WHERE part_code = ?", (part_code,))
        part_row = cursor.fetchone()
        conn.close()
        
        trace = []
        for row in rows:
            trace.append({
                "operation_type": row['operation_type'],
                "operation_id": row['operation_id'],
                "quantity": row['quantity'],
                "operator_name": row['operator_name'],
                "role": row['role'],
                "operation_time": row['operation_time']
            })
        
        return {
            "part_code": part_code,
            "part_name": part_row['part_name'] if part_row else None,
            "current_quantity": part_row['quantity'] if part_row else 0,
            "current_status": part_row['status'] if part_row else None,
            "trace_count": len(trace),
            "trace": trace
        }

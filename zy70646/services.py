import json
import uuid
from datetime import datetime
from typing import List, Dict, Set, Tuple, Optional
from sqlalchemy.orm import Session
from models import (
    InboundOrder, UnpackRecord, OutboundOrder, RecallTask, RecallReport,
    InboundOrderCreate, UnpackRecordCreate, OutboundOrderCreate,
    RecallStatus, ErrorCode, ErrorResponse,
    BatchChainNode, CustomerDestination, RecallResult
)


class BatchRecallService:
    def __init__(self, db: Session):
        self.db = db

    def import_inbound_orders_jsonl(self, jsonl_content: str) -> Tuple[int, List[ErrorResponse]]:
        errors = []
        count = 0
        for line_num, line in enumerate(jsonl_content.strip().split('\n'), 1):
            try:
                data = json.loads(line)
                order_data = InboundOrderCreate(**data)
                
                if self.db.query(InboundOrder).filter(InboundOrder.id == order_data.id).first():
                    errors.append(ErrorResponse(
                        error_code=ErrorCode.DUPLICATE_ENTRY,
                        message=f"入库单ID已存在",
                        details={"line": line_num, "id": order_data.id}
                    ))
                    continue
                
                order = InboundOrder(**order_data.dict())
                self.db.add(order)
                count += 1
            except ValueError as e:
                errors.append(ErrorResponse(
                    error_code=ErrorCode.MISSING_FIELD,
                    message=f"JSON解析错误或字段缺失: {str(e)}",
                    details={"line": line_num}
                ))
            except Exception as e:
                errors.append(ErrorResponse(
                    error_code=ErrorCode.INVALID_STATUS,
                    message=f"导入失败: {str(e)}",
                    details={"line": line_num}
                ))
        
        self.db.commit()
        return count, errors

    def import_unpack_records_jsonl(self, jsonl_content: str) -> Tuple[int, List[ErrorResponse]]:
        errors = []
        count = 0
        for line_num, line in enumerate(jsonl_content.strip().split('\n'), 1):
            try:
                data = json.loads(line)
                record_data = UnpackRecordCreate(**data)
                
                if self.db.query(UnpackRecord).filter(UnpackRecord.id == record_data.id).first():
                    errors.append(ErrorResponse(
                        error_code=ErrorCode.DUPLICATE_ENTRY,
                        message=f"拆包记录ID已存在",
                        details={"line": line_num, "id": record_data.id}
                    ))
                    continue
                
                if not self.db.query(InboundOrder).filter(InboundOrder.id == record_data.inbound_order_id).first():
                    errors.append(ErrorResponse(
                        error_code=ErrorCode.RESOURCE_NOT_FOUND,
                        message=f"关联的入库单不存在",
                        details={"line": line_num, "inbound_order_id": record_data.inbound_order_id}
                    ))
                    continue
                
                record = UnpackRecord(**record_data.dict())
                self.db.add(record)
                count += 1
            except ValueError as e:
                errors.append(ErrorResponse(
                    error_code=ErrorCode.MISSING_FIELD,
                    message=f"JSON解析错误或字段缺失: {str(e)}",
                    details={"line": line_num}
                ))
            except Exception as e:
                errors.append(ErrorResponse(
                    error_code=ErrorCode.INVALID_STATUS,
                    message=f"导入失败: {str(e)}",
                    details={"line": line_num}
                ))
        
        self.db.commit()
        return count, errors

    def import_outbound_orders_jsonl(self, jsonl_content: str) -> Tuple[int, List[ErrorResponse]]:
        errors = []
        count = 0
        for line_num, line in enumerate(jsonl_content.strip().split('\n'), 1):
            try:
                data = json.loads(line)
                order_data = OutboundOrderCreate(**data)
                
                if self.db.query(OutboundOrder).filter(OutboundOrder.id == order_data.id).first():
                    errors.append(ErrorResponse(
                        error_code=ErrorCode.DUPLICATE_ENTRY,
                        message=f"出库单ID已存在",
                        details={"line": line_num, "id": order_data.id}
                    ))
                    continue
                
                order = OutboundOrder(**order_data.dict())
                self.db.add(order)
                count += 1
            except ValueError as e:
                errors.append(ErrorResponse(
                    error_code=ErrorCode.MISSING_FIELD,
                    message=f"JSON解析错误或字段缺失: {str(e)}",
                    details={"line": line_num}
                ))
            except Exception as e:
                errors.append(ErrorResponse(
                    error_code=ErrorCode.INVALID_STATUS,
                    message=f"导入失败: {str(e)}",
                    details={"line": line_num}
                ))
        
        self.db.commit()
        return count, errors

    def trace_batch_chain(self, target_batch: str) -> Tuple[List[BatchChainNode], bool]:
        visited = set()
        chain = []
        requires_review = False
        
        def trace_down(batch: str, level: int, quantity: float, path_type: str):
            nonlocal requires_review
            
            if batch in visited:
                return
            
            visited.add(batch)
            chain.append(BatchChainNode(
                batch_number=batch,
                level=level,
                quantity=quantity,
                path_type=path_type
            ))
            
            unpack_records = self.db.query(UnpackRecord).filter(
                UnpackRecord.parent_batch_number == batch
            ).all()
            
            for record in unpack_records:
                trace_down(
                    record.child_batch_number,
                    level + 1,
                    record.quantity,
                    "unpack"
                )
            
            outbound_orders = self.db.query(OutboundOrder).filter(
                OutboundOrder.batch_number == batch
            ).all()
            
            for _ in outbound_orders:
                pass
        
        inbound = self.db.query(InboundOrder).filter(
            InboundOrder.batch_number == target_batch
        ).first()
        
        if inbound:
            trace_down(target_batch, 0, inbound.quantity, "inbound")
        else:
            unpack = self.db.query(UnpackRecord).filter(
                UnpackRecord.child_batch_number == target_batch
            ).first()
            
            if unpack:
                trace_down(target_batch, 0, unpack.quantity, "child_batch")
            else:
                outbound = self.db.query(OutboundOrder).filter(
                    OutboundOrder.batch_number == target_batch
                ).first()
                
                if outbound:
                    trace_down(target_batch, 0, outbound.quantity, "outbound")
                else:
                    requires_review = True
        
        return chain, requires_review

    def get_customer_destinations(self, batch_chain: List[BatchChainNode]) -> List[CustomerDestination]:
        customer_map: Dict[str, CustomerDestination] = {}
        batch_numbers = [node.batch_number for node in batch_chain]
        
        outbound_orders = self.db.query(OutboundOrder).filter(
            OutboundOrder.batch_number.in_(batch_numbers)
        ).all()
        
        for order in outbound_orders:
            customer_id = order.customer_id
            
            if customer_id not in customer_map:
                customer_map[customer_id] = CustomerDestination(
                    customer_id=customer_id,
                    customer_name=order.customer_name,
                    quantity=0,
                    outbound_order_ids=[],
                    latest_outbound_date=None,
                    destination_addresses=[]
                )
            
            dest = customer_map[customer_id]
            dest.quantity += order.quantity
            dest.outbound_order_ids.append(order.id)
            
            if dest.latest_outbound_date is None or order.outbound_date > dest.latest_outbound_date:
                dest.latest_outbound_date = order.outbound_date
            
            if order.destination_address and order.destination_address not in dest.destination_addresses:
                dest.destination_addresses.append(order.destination_address)
        
        return list(customer_map.values())

    def create_recall_task(self, batch_number: str, reason: Optional[str] = None, operator: Optional[str] = None) -> Tuple[Optional[RecallResult], Optional[ErrorResponse]]:
        existing = self.db.query(RecallTask).filter(
            RecallTask.batch_number == batch_number,
            RecallTask.status.in_([RecallStatus.PENDING, RecallStatus.PROCESSING, RecallStatus.COMPLETED])
        ).first()
        
        if existing:
            return None, ErrorResponse(
                error_code=ErrorCode.ALREADY_PROCESSED,
                message=f"批号 {batch_number} 已有召回任务正在处理或已完成",
                details={"recall_task_id": existing.id, "status": existing.status}
            )
        
        task_id = str(uuid.uuid4())
        task = RecallTask(
            id=task_id,
            batch_number=batch_number,
            reason=reason,
            status=RecallStatus.PROCESSING,
            operator=operator
        )
        self.db.add(task)
        self.db.commit()
        
        batch_chain, requires_review = self.trace_batch_chain(batch_number)
        
        if requires_review:
            task.status = RecallStatus.NEEDS_REVIEW
            task.requires_manual_review = True
            task.review_notes = "批号未找到相关入库或拆包记录，需要人工复核"
            self.db.commit()
            
            return None, ErrorResponse(
                error_code=ErrorCode.NEEDS_MANUAL_REVIEW,
                message="需要人工复核批号信息",
                details={"recall_task_id": task_id, "batch_number": batch_number}
            )
        
        customer_destinations = self.get_customer_destinations(batch_chain)
        
        total_quantity = sum(dest.quantity for dest in customer_destinations)
        total_customers = len(customer_destinations)
        
        task.total_affected_quantity = total_quantity
        task.total_customers_affected = total_customers
        task.status = RecallStatus.COMPLETED
        task.completed_at = datetime.utcnow()
        
        for level, node in enumerate(batch_chain):
            report = RecallReport(
                id=str(uuid.uuid4()),
                recall_task_id=task_id,
                batch_number=batch_number,
                level=level,
                path_type=node.path_type,
                related_batch_number=node.batch_number,
                quantity=node.quantity
            )
            self.db.add(report)
        
        for dest in customer_destinations:
            for order_id in dest.outbound_order_ids:
                order = self.db.query(OutboundOrder).filter(OutboundOrder.id == order_id).first()
                if order:
                    report = RecallReport(
                        id=str(uuid.uuid4()),
                        recall_task_id=task_id,
                        batch_number=batch_number,
                        level=len(batch_chain),
                        path_type="customer",
                        related_batch_number=order.batch_number,
                        quantity=order.quantity,
                        customer_id=dest.customer_id,
                        customer_name=dest.customer_name,
                        outbound_order_id=order.id,
                        outbound_date=order.outbound_date,
                        warehouse=order.warehouse
                    )
                    self.db.add(report)
        
        self.db.commit()
        
        result = RecallResult(
            recall_task_id=task_id,
            batch_number=batch_number,
            status=RecallStatus.COMPLETED,
            total_affected_quantity=total_quantity,
            total_customers_affected=total_customers,
            customer_destinations=customer_destinations,
            batch_chain=batch_chain,
            requires_manual_review=False,
            created_at=task.created_at
        )
        
        return result, None

    def get_recall_task(self, task_id: str) -> Optional[RecallTask]:
        return self.db.query(RecallTask).filter(RecallTask.id == task_id).first()

    def get_recall_reports(self, task_id: str) -> List[RecallReport]:
        return self.db.query(RecallReport).filter(RecallReport.recall_task_id == task_id).all()

    def export_recall_report_json(self, task_id: str) -> Optional[Dict]:
        task = self.get_recall_task(task_id)
        if not task:
            return None
        
        reports = self.get_recall_reports(task_id)
        batch_chain, _ = self.trace_batch_chain(task.batch_number)
        customer_destinations = self.get_customer_destinations(batch_chain)
        
        return {
            "recall_task_id": task.id,
            "batch_number": task.batch_number,
            "reason": task.reason,
            "status": task.status,
            "created_at": task.created_at.isoformat(),
            "completed_at": task.completed_at.isoformat() if task.completed_at else None,
            "operator": task.operator,
            "total_affected_quantity": task.total_affected_quantity,
            "total_customers_affected": task.total_customers_affected,
            "requires_manual_review": task.requires_manual_review,
            "review_notes": task.review_notes,
            "batch_chain": [
                {
                    "batch_number": node.batch_number,
                    "level": node.level,
                    "quantity": node.quantity,
                    "path_type": node.path_type
                }
                for node in batch_chain
            ],
            "customer_destinations": [
                {
                    "customer_id": dest.customer_id,
                    "customer_name": dest.customer_name,
                    "quantity": dest.quantity,
                    "outbound_order_ids": dest.outbound_order_ids,
                    "latest_outbound_date": dest.latest_outbound_date.isoformat() if dest.latest_outbound_date else None,
                    "destination_addresses": dest.destination_addresses
                }
                for dest in customer_destinations
            ],
            "reports": [
                {
                    "id": r.id,
                    "level": r.level,
                    "path_type": r.path_type,
                    "related_batch_number": r.related_batch_number,
                    "quantity": r.quantity,
                    "customer_id": r.customer_id,
                    "customer_name": r.customer_name,
                    "outbound_order_id": r.outbound_order_id,
                    "outbound_date": r.outbound_date.isoformat() if r.outbound_date else None,
                    "warehouse": r.warehouse
                }
                for r in reports
            ]
        }

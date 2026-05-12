import uuid
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Tuple
from copy import deepcopy

from .models import (
    Batch, BatchStatus, Box, BoxStatus, InspectionReport, InspectionStatus,
    AuditLog, RecallRequest, FreezeRequest, Origin
)
from .database import db


class ValidationError(Exception):
    def __init__(self, message: str, rule_name: str = None):
        super().__init__(message)
        self.rule_name = rule_name or "unknown_rule"


class TraceabilityService:
    VALID_STATUS_TRANSITIONS = {
        BatchStatus.CREATED: [BatchStatus.INSPECTION_PENDING],
        BatchStatus.INSPECTION_PENDING: [BatchStatus.INSPECTION_PASSED, BatchStatus.INSPECTION_FAILED, BatchStatus.CANCELLED],
        BatchStatus.INSPECTION_PASSED: [BatchStatus.IN_WAREHOUSE, BatchStatus.FROZEN, BatchStatus.RECALLED],
        BatchStatus.INSPECTION_FAILED: [BatchStatus.FROZEN, BatchStatus.CANCELLED],
        BatchStatus.IN_WAREHOUSE: [BatchStatus.MIXED, BatchStatus.SORTED, BatchStatus.FROZEN, BatchStatus.OUTBOUND, BatchStatus.RECALLED],
        BatchStatus.MIXED: [BatchStatus.FROZEN, BatchStatus.RECALLED],
        BatchStatus.SORTED: [BatchStatus.OUTBOUND, BatchStatus.FROZEN, BatchStatus.RECALLED],
        BatchStatus.OUTBOUND: [BatchStatus.FROZEN, BatchStatus.RECALLED],
        BatchStatus.FROZEN: [BatchStatus.RECALLED, BatchStatus.CANCELLED],
        BatchStatus.RECALLED: [BatchStatus.CANCELLED],
    }

    def __init__(self):
        self.db = db

    def _generate_id(self, prefix: str) -> str:
        return f"{prefix}_{datetime.now().strftime('%Y%m%d%H%M%S')}_{uuid.uuid4().hex[:6]}"

    def _compute_diff(self, before: Optional[Dict], after: Optional[Dict]) -> Dict:
        diff = {}
        if not before:
            return {"_created": after} if after else {}
        if not after:
            return {"_deleted": before}
        for key in set(before.keys()) | set(after.keys()):
            if before.get(key) != after.get(key):
                diff[key] = {
                    "before": before.get(key),
                    "after": after.get(key)
                }
        return diff

    def _audit_log(self, operation: str, operator_id: str, operator_name: str,
                   entity_type: str, entity_id: str, action: str,
                   status: str, before_state: Optional[Dict] = None,
                   after_state: Optional[Dict] = None, remarks: str = None,
                   failure_reason: str = None, idempotency_key: str = None) -> AuditLog:
        log = AuditLog(
            log_id=self._generate_id("LOG"),
            operation=operation,
            operator_id=operator_id,
            operator_name=operator_name,
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            before_state=before_state,
            after_state=after_state,
            diff=self._compute_diff(before_state, after_state),
            remarks=remarks,
            status=status,
            failure_reason=failure_reason,
            timestamp=datetime.now(),
            idempotency_key=idempotency_key
        )
        self.db.add_audit_log(log)
        return log

    def _check_idempotency(self, idempotency_key: str) -> Optional[Dict]:
        if idempotency_key:
            existing = self.db.get_idempotency_result(idempotency_key)
            if existing:
                return existing
        return None

    def _save_idempotency_result(self, idempotency_key: str, result: Dict):
        if idempotency_key:
            self.db.set_idempotency_result(idempotency_key, result)

    def _validate_status_transition(self, current: BatchStatus, target: BatchStatus, batch_id: str):
        if target not in self.VALID_STATUS_TRANSITIONS.get(current, []):
            raise ValidationError(
                f"批次 {batch_id} 状态 {current} 不能转换为 {target}",
                "invalid_status_transition"
            )

    def _check_inspection_expiry(self, report: InspectionReport, batch_id: str):
        if report and report.status == InspectionStatus.PASSED:
            if datetime.now() > report.expiry_date:
                raise ValidationError(
                    f"批次 {batch_id} 的检测报告已过期，过期时间: {report.expiry_date}",
                    "inspection_expired"
                )

    def create_batch(self, origin: Dict, product_type: str, quantity: int, unit: str,
                     operator_id: str, operator_name: str, idempotency_key: str = None) -> Dict:
        cached = self._check_idempotency(idempotency_key)
        if cached:
            return {"idempotent": True, **cached}

        batch_id = self._generate_id("BATCH")
        batch = Batch(
            batch_id=batch_id,
            origin=Origin(**origin),
            product_type=product_type,
            quantity=quantity,
            unit=unit,
            arrival_date=datetime.now(),
            status=BatchStatus.CREATED
        )
        self.db.save_batch(batch)
        
        self._audit_log(
            "CREATE", operator_id, operator_name, "BATCH", batch_id,
            "创建批次", "SUCCESS", after_state=batch.model_dump(),
            idempotency_key=idempotency_key
        )
        result = {"batch_id": batch_id, "status": BatchStatus.CREATED.value, "message": "批次创建成功"}
        self._save_idempotency_result(idempotency_key, result)
        return result

    def submit_inspection(self, batch_id: str, inspector_id: str, items: List[Dict],
                          status: str, expiry_days: int = 30,
                          operator_id: str = None, operator_name: str = None,
                          idempotency_key: str = None, remarks: str = None) -> Dict:
        cached = self._check_idempotency(idempotency_key)
        if cached:
            return {"idempotent": True, **cached}

        batch = self.db.get_batch(batch_id)
        if not batch:
            raise ValidationError(f"批次 {batch_id} 不存在", "batch_not_found")

        op_id = operator_id or inspector_id
        op_name = operator_name or f"inspector_{inspector_id}"
        before = batch.model_dump()

        if batch.status == BatchStatus.CREATED:
            self._validate_status_transition(BatchStatus.CREATED, BatchStatus.INSPECTION_PENDING, batch_id)
            batch.status = BatchStatus.INSPECTION_PENDING

        inspect_status = InspectionStatus(status)
        report = InspectionReport(
            report_id=self._generate_id("REP"),
            batch_id=batch_id,
            inspector_id=inspector_id,
            inspection_date=datetime.now(),
            expiry_date=datetime.now() + timedelta(days=expiry_days),
            status=inspect_status,
            items=items,
            remarks=remarks
        )
        batch.inspection_report = report

        if inspect_status == InspectionStatus.PASSED:
            self._validate_status_transition(batch.status, BatchStatus.INSPECTION_PASSED, batch_id)
            batch.status = BatchStatus.INSPECTION_PASSED
        elif inspect_status == InspectionStatus.FAILED:
            self._validate_status_transition(batch.status, BatchStatus.INSPECTION_FAILED, batch_id)
            batch.status = BatchStatus.INSPECTION_FAILED

        self.db.save_batch(batch)
        self._audit_log(
            "INSPECTION", op_id, op_name, "BATCH", batch_id,
            "提交检测报告", "SUCCESS", before_state=before, after_state=batch.model_dump(),
            remarks=remarks, idempotency_key=idempotency_key
        )
        result = {
            "batch_id": batch_id,
            "status": batch.status.value,
            "report_id": report.report_id,
            "inspection_status": inspect_status.value,
            "message": f"检测报告提交成功，状态: {inspect_status.value}"
        }
        self._save_idempotency_result(idempotency_key, result)
        return result

    def warehouse_in(self, batch_id: str, box_count: int,
                     operator_id: str, operator_name: str,
                     idempotency_key: str = None) -> Dict:
        cached = self._check_idempotency(idempotency_key)
        if cached:
            return {"idempotent": True, **cached}

        batch = self.db.get_batch(batch_id)
        if not batch:
            raise ValidationError(f"批次 {batch_id} 不存在", "batch_not_found")

        if batch.status != BatchStatus.INSPECTION_PASSED:
            raise ValidationError(
                f"批次 {batch_id} 状态为 {batch.status}，只有检测通过才能入仓",
                "invalid_status_for_warehouse_in"
            )

        if batch.boxes:
            raise ValidationError(
                f"批次 {batch_id} 已入仓，禁止重复入仓",
                "duplicate_warehouse_in"
            )

        if batch.inspection_report:
            self._check_inspection_expiry(batch.inspection_report, batch_id)

        before = batch.model_dump()
        boxes = []
        for i in range(box_count):
            box = Box(
                box_id=self._generate_id("BOX"),
                batch_id=batch_id,
                original_batch_id=batch_id,
                status=BoxStatus.IN_WAREHOUSE
            )
            boxes.append(box)
            self.db.save_box(box)
            batch.boxes.append(box.box_id)

        self._validate_status_transition(batch.status, BatchStatus.IN_WAREHOUSE, batch_id)
        batch.status = BatchStatus.IN_WAREHOUSE
        self.db.save_batch(batch)

        self._audit_log(
            "WAREHOUSE_IN", operator_id, operator_name, "BATCH", batch_id,
            "入仓操作", "SUCCESS", before_state=before, after_state=batch.model_dump(),
            remarks=f"生成 {box_count} 个箱子", idempotency_key=idempotency_key
        )
        result = {
            "batch_id": batch_id,
            "status": batch.status.value,
            "box_count": box_count,
            "boxes": [b.box_id for b in boxes],
            "message": "入仓成功"
        }
        self._save_idempotency_result(idempotency_key, result)
        return result

    def mix_batches(self, source_batch_ids: List[str], new_batch_info: Dict,
                    operator_id: str, operator_name: str,
                    idempotency_key: str = None) -> Dict:
        cached = self._check_idempotency(idempotency_key)
        if cached:
            return {"idempotent": True, **cached}

        sources = []
        for bid in source_batch_ids:
            batch = self.db.get_batch(bid)
            if not batch:
                raise ValidationError(f"批次 {bid} 不存在", "batch_not_found")
            if batch.status != BatchStatus.IN_WAREHOUSE:
                raise ValidationError(
                    f"批次 {bid} 状态为 {batch.status}，只有在库批次才能混装",
                    "invalid_status_for_mixing"
                )
            if batch.frozen:
                raise ValidationError(
                    f"批次 {bid} 已冻结，不能参与混装",
                    "frozen_batch_cannot_mix"
                )
            if batch.recalled:
                raise ValidationError(
                    f"批次 {bid} 已召回，不能参与混装",
                    "recalled_batch_cannot_mix"
                )
            sources.append(batch)

        new_batch_id = self._generate_id("BATCH")
        first_source = sources[0]
        new_batch = Batch(
            batch_id=new_batch_id,
            origin=first_source.origin,
            product_type=new_batch_info.get("product_type", first_source.product_type),
            quantity=sum(s.quantity for s in sources),
            unit=first_source.unit,
            arrival_date=datetime.now(),
            status=BatchStatus.MIXED,
            is_mixed=True,
            source_batches=source_batch_ids,
            inspection_report=first_source.inspection_report
        )

        all_boxes = []
        for source in sources:
            source_before = source.model_dump()
            for box_id in source.boxes:
                box = self.db.get_box(box_id)
                if box:
                    box.batch_id = new_batch_id
                    box.status = BoxStatus.IN_MIXED_BATCH
                    self.db.save_box(box)
                    all_boxes.append(box_id)
                    new_batch.boxes.append(box_id)
            source.status = BatchStatus.MIXED
            source.child_batches.append(new_batch_id)
            self.db.save_batch(source)
            self._audit_log(
                "MIX", operator_id, operator_name, "BATCH", source.batch_id,
                "参与混装", "SUCCESS", before_state=source_before, after_state=source.model_dump(),
                remarks=f"混装到新批次 {new_batch_id}", idempotency_key=idempotency_key
            )

        self.db.save_batch(new_batch)
        self._audit_log(
            "MIX_CREATE", operator_id, operator_name, "BATCH", new_batch_id,
            "创建混装批次", "SUCCESS", after_state=new_batch.model_dump(),
            remarks=f"来源批次: {source_batch_ids}", idempotency_key=idempotency_key
        )

        result = {
            "new_batch_id": new_batch_id,
            "status": BatchStatus.MIXED.value,
            "source_batches": source_batch_ids,
            "total_boxes": len(all_boxes),
            "boxes": all_boxes,
            "message": "混装成功"
        }
        self._save_idempotency_result(idempotency_key, result)
        return result

    def sort_batch(self, batch_id: str, sorting_plan: List[Dict],
                   operator_id: str, operator_name: str,
                   idempotency_key: str = None) -> Dict:
        cached = self._check_idempotency(idempotency_key)
        if cached:
            return {"idempotent": True, **cached}

        batch = self.db.get_batch(batch_id)
        if not batch:
            raise ValidationError(f"批次 {batch_id} 不存在", "batch_not_found")

        if batch.recalled:
            raise ValidationError(
                f"批次 {batch_id} 已召回，禁止分拣",
                "recalled_batch_cannot_sort"
            )

        if batch.frozen:
            raise ValidationError(
                f"批次 {batch_id} 已冻结，禁止分拣",
                "frozen_batch_cannot_sort"
            )

        valid_sort_statuses = [BatchStatus.IN_WAREHOUSE, BatchStatus.MIXED]
        if batch.status not in valid_sort_statuses:
            raise ValidationError(
                f"批次 {batch_id} 状态为 {batch.status}，不能分拣",
                "invalid_status_for_sorting"
            )

        total_needed = sum(p["box_count"] for p in sorting_plan)
        available_boxes = [b for b in batch.boxes if self.db.get_box(b) and self.db.get_box(b).status in [BoxStatus.IN_WAREHOUSE, BoxStatus.IN_MIXED_BATCH]]
        
        if total_needed > len(available_boxes):
            raise ValidationError(
                f"需要 {total_needed} 个箱子，但只有 {len(available_boxes)} 个可用",
                "insufficient_boxes"
            )

        before = batch.model_dump()
        child_batches = []
        box_idx = 0

        for plan in sorting_plan:
            child_id = self._generate_id("BATCH")
            count = plan["box_count"]
            child_boxes = available_boxes[box_idx:box_idx + count]
            box_idx += count

            child = Batch(
                batch_id=child_id,
                parent_batch_id=batch_id,
                origin=batch.origin,
                product_type=plan.get("product_type", batch.product_type),
                quantity=count,
                unit="箱",
                arrival_date=datetime.now(),
                status=BatchStatus.SORTED,
                source_batches=[batch_id] if batch.is_mixed else batch.source_batches + [batch_id],
                boxes=child_boxes,
                inspection_report=batch.inspection_report
            )

            for box_id in child_boxes:
                box = self.db.get_box(box_id)
                if box:
                    box.batch_id = child_id
                    box.status = BoxStatus.SORTED
                    self.db.save_box(box)

            self.db.save_batch(child)
            child_batches.append({
                "child_batch_id": child_id,
                "box_count": count,
                "boxes": child_boxes,
                "product_type": child.product_type
            })
            batch.child_batches.append(child_id)

        batch.status = BatchStatus.SORTED
        self.db.save_batch(batch)

        self._audit_log(
            "SORT", operator_id, operator_name, "BATCH", batch_id,
            "分拣操作", "SUCCESS", before_state=before, after_state=batch.model_dump(),
            remarks=f"生成 {len(child_batches)} 个子批次", idempotency_key=idempotency_key
        )

        result = {
            "batch_id": batch_id,
            "status": BatchStatus.SORTED.value,
            "child_batches": child_batches,
            "message": "分拣成功"
        }
        self._save_idempotency_result(idempotency_key, result)
        return result

    def warehouse_out(self, batch_id: str, destination: str,
                      operator_id: str, operator_name: str,
                      idempotency_key: str = None) -> Dict:
        cached = self._check_idempotency(idempotency_key)
        if cached:
            return {"idempotent": True, **cached}

        batch = self.db.get_batch(batch_id)
        if not batch:
            raise ValidationError(f"批次 {batch_id} 不存在", "batch_not_found")

        if batch.status not in [BatchStatus.IN_WAREHOUSE, BatchStatus.SORTED]:
            raise ValidationError(
                f"批次 {batch_id} 状态为 {batch.status}，不能出库",
                "invalid_status_for_outbound"
            )

        if batch.frozen:
            raise ValidationError(
                f"批次 {batch_id} 已冻结，不能出库",
                "frozen_batch_cannot_outbound"
            )

        if batch.recalled:
            raise ValidationError(
                f"批次 {batch_id} 已召回，不能出库",
                "recalled_batch_cannot_outbound"
            )

        before = batch.model_dump()
        self._validate_status_transition(batch.status, BatchStatus.OUTBOUND, batch_id)
        batch.status = BatchStatus.OUTBOUND
        batch.outbound_at = datetime.now()

        outbound_boxes = []
        for box_id in batch.boxes:
            box = self.db.get_box(box_id)
            if box:
                box.status = BoxStatus.OUTBOUND
                box.outbound_at = datetime.now()
                box.destination = destination
                self.db.save_box(box)
                outbound_boxes.append(box_id)

        self.db.save_batch(batch)
        self._audit_log(
            "OUTBOUND", operator_id, operator_name, "BATCH", batch_id,
            "出库操作", "SUCCESS", before_state=before, after_state=batch.model_dump(),
            remarks=f"目的地: {destination}", idempotency_key=idempotency_key
        )

        result = {
            "batch_id": batch_id,
            "status": BatchStatus.OUTBOUND.value,
            "destination": destination,
            "outbound_boxes": outbound_boxes,
            "message": "出库成功"
        }
        self._save_idempotency_result(idempotency_key, result)
        return result

    def freeze_entity(self, entity_type: str, entity_id: str, reason: str,
                      operator_id: str, operator_name: str,
                      idempotency_key: str = None) -> Dict:
        cached = self._check_idempotency(idempotency_key)
        if cached:
            return {"idempotent": True, **cached}

        freeze_req = FreezeRequest(
            freeze_id=self._generate_id("FRZ"),
            reason=reason,
            entity_type=entity_type,
            entity_id=entity_id,
            operator_id=operator_id,
            created_at=datetime.now()
        )

        affected_boxes = []
        affected_batches = []

        if entity_type == "BATCH":
            batch = self.db.get_batch(entity_id)
            if not batch:
                raise ValidationError(f"批次 {entity_id} 不存在", "batch_not_found")
            affected_batches = self._freeze_batch_and_descendants(batch, reason, affected_boxes)
        elif entity_type == "BOX":
            box = self.db.get_box(entity_id)
            if not box:
                raise ValidationError(f"箱子 {entity_id} 不存在", "box_not_found")
            self._freeze_box(box, reason)
            affected_boxes = [entity_id]
        else:
            raise ValidationError(f"未知实体类型: {entity_type}", "invalid_entity_type")

        freeze_req.executed = True
        freeze_req.executed_at = datetime.now()
        freeze_req.affected_boxes = affected_boxes
        freeze_req.affected_batches = affected_batches
        self.db.save_freeze(freeze_req)

        self._audit_log(
            "FREEZE", operator_id, operator_name, entity_type, entity_id,
            "冻结操作", "SUCCESS",
            remarks=f"原因: {reason}, 冻结箱子: {len(affected_boxes)}, 冻结批次: {len(affected_batches)}",
            idempotency_key=idempotency_key
        )

        result = {
            "freeze_id": freeze_req.freeze_id,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "reason": reason,
            "affected_boxes_count": len(affected_boxes),
            "affected_boxes": affected_boxes,
            "affected_batches_count": len(affected_batches),
            "affected_batches": affected_batches,
            "message": "冻结成功"
        }
        self._save_idempotency_result(idempotency_key, result)
        return result

    def _freeze_batch_and_descendants(self, batch: Batch, reason: str, affected_boxes: List[str]) -> List[str]:
        affected_batches = []
        before = batch.model_dump()
        batch.frozen = True
        batch.frozen_reason = reason
        batch.frozen_at = datetime.now()
        if batch.status != BatchStatus.FROZEN:
            batch.status = BatchStatus.FROZEN
        self.db.save_batch(batch)
        affected_batches.append(batch.batch_id)

        for box_id in batch.boxes:
            box = self.db.get_box(box_id)
            if box and not box.frozen:
                self._freeze_box(box, reason)
                affected_boxes.append(box_id)

        for child_id in batch.child_batches:
            child = self.db.get_batch(child_id)
            if child and not child.frozen:
                child_affected = self._freeze_batch_and_descendants(child, reason, affected_boxes)
                affected_batches.extend(child_affected)

        return affected_batches

    def _freeze_box(self, box: Box, reason: str):
        box.frozen = True
        box.frozen_reason = reason
        box.frozen_at = datetime.now()
        if box.status not in [BoxStatus.FROZEN, BoxStatus.RECALLED]:
            box.status = BoxStatus.FROZEN
        self.db.save_box(box)

    def recall_batches(self, source_batch_ids: List[str], reason: str,
                       operator_id: str, operator_name: str,
                       idempotency_key: str = None) -> Dict:
        cached = self._check_idempotency(idempotency_key)
        if cached:
            return {"idempotent": True, **cached}

        recall = RecallRequest(
            recall_id=self._generate_id("RCL"),
            reason=reason,
            source_batch_ids=source_batch_ids,
            requester_id=operator_id,
            created_at=datetime.now()
        )

        affected_boxes = []
        affected_batches = []
        outbound_boxes = []

        for bid in source_batch_ids:
            batch = self.db.get_batch(bid)
            if not batch:
                raise ValidationError(f"批次 {bid} 不存在", "batch_not_found")
            batches, boxes, outbound = self._recall_batch_and_lineage(batch, reason, affected_boxes)
            affected_batches.extend(batches)
            affected_boxes.extend(boxes)
            outbound_boxes.extend(outbound)

        recall.executed = True
        recall.executed_at = datetime.now()
        recall.affected_boxes = list(set(affected_boxes))
        recall.affected_batches = list(set(affected_batches))
        self.db.save_recall(recall)

        self._audit_log(
            "RECALL", operator_id, operator_name, "RECALL", recall.recall_id,
            "召回操作", "SUCCESS",
            remarks=f"原因: {reason}, 来源批次: {source_batch_ids}",
            idempotency_key=idempotency_key
        )

        result = {
            "recall_id": recall.recall_id,
            "source_batch_ids": source_batch_ids,
            "reason": reason,
            "affected_batches_count": len(recall.affected_batches),
            "affected_batches": recall.affected_batches,
            "affected_boxes_count": len(recall.affected_boxes),
            "affected_boxes": recall.affected_boxes,
            "outbound_boxes_count": len(outbound_boxes),
            "outbound_boxes": outbound_boxes,
            "message": "召回成功，已冻结所有关联实体"
        }
        self._save_idempotency_result(idempotency_key, result)
        return result

    def _recall_batch_and_lineage(self, batch: Batch, reason: str, already_affected: List[str]) -> Tuple[List[str], List[str], List[str]]:
        affected_batches = []
        affected_boxes = []
        outbound_boxes = []

        if batch.batch_id in [b for b in already_affected] or batch.recalled:
            return affected_batches, affected_boxes, outbound_boxes

        before = batch.model_dump()
        batch.recalled = True
        batch.recalled_at = datetime.now()
        if not batch.frozen:
            batch.frozen = True
            batch.frozen_reason = f"召回冻结: {reason}"
            batch.frozen_at = datetime.now()
        if batch.status not in [BatchStatus.RECALLED, BatchStatus.FROZEN]:
            batch.status = BatchStatus.RECALLED
        self.db.save_batch(batch)
        affected_batches.append(batch.batch_id)

        for box_id in batch.boxes:
            box = self.db.get_box(box_id)
            if box and box.box_id not in already_affected:
                if box.status == BoxStatus.OUTBOUND:
                    outbound_boxes.append({
                        "box_id": box.box_id,
                        "destination": box.destination,
                        "outbound_at": box.outbound_at
                    })
                if not box.recalled:
                    box.recalled = True
                    box.recalled_at = datetime.now()
                if not box.frozen:
                    box.frozen = True
                    box.frozen_reason = f"召回冻结: {reason}"
                    box.frozen_at = datetime.now()
                box.status = BoxStatus.RECALLED
                self.db.save_box(box)
                affected_boxes.append(box.box_id)

        for child_id in batch.child_batches:
            child = self.db.get_batch(child_id)
            if child:
                cb, cbox, cout = self._recall_batch_and_lineage(child, reason, already_affected + affected_boxes)
                affected_batches.extend(cb)
                affected_boxes.extend(cbox)
                outbound_boxes.extend(cout)

        return affected_batches, affected_boxes, outbound_boxes

    def get_batch_detail(self, batch_id: str) -> Dict:
        batch = self.db.get_batch(batch_id)
        if not batch:
            raise ValidationError(f"批次 {batch_id} 不存在", "batch_not_found")

        boxes = [self.db.get_box(bid) for bid in batch.boxes]
        boxes = [b for b in boxes if b]
        source_batches = [self.db.get_batch(bid) for bid in batch.source_batches]
        source_batches = [b for b in source_batches if b]
        child_batches = [self.db.get_batch(bid) for bid in batch.child_batches]
        child_batches = [b for b in child_batches if b]

        lineage = self._build_lineage(batch_id)
        logs = self.db.get_audit_logs("BATCH", batch_id)

        return {
            "batch": batch.model_dump(),
            "boxes": [b.model_dump() for b in boxes],
            "source_batches": [b.model_dump() for b in source_batches],
            "child_batches": [b.model_dump() for b in child_batches],
            "lineage": lineage,
            "audit_logs": [l.model_dump() for l in logs]
        }

    def _build_lineage(self, batch_id: str) -> Dict:
        batch = self.db.get_batch(batch_id)
        if not batch:
            return {}
        
        sources = []
        for src_id in batch.source_batches:
            sources.append(self._build_lineage(src_id))
        
        children = []
        for child_id in batch.child_batches:
            children.append(self._build_lineage(child_id))

        return {
            "batch_id": batch.batch_id,
            "status": batch.status.value,
            "frozen": batch.frozen,
            "recalled": batch.recalled,
            "product_type": batch.product_type,
            "box_count": len(batch.boxes),
            "sources": sources,
            "children": children
        }

    def get_box_detail(self, box_id: str) -> Dict:
        box = self.db.get_box(box_id)
        if not box:
            raise ValidationError(f"箱子 {box_id} 不存在", "box_not_found")

        current_batch = self.db.get_batch(box.batch_id)
        original_batch = self.db.get_batch(box.original_batch_id)
        logs = self.db.get_audit_logs("BOX", box_id)

        return {
            "box": box.model_dump(),
            "current_batch": current_batch.model_dump() if current_batch else None,
            "original_batch": original_batch.model_dump() if original_batch else None,
            "audit_logs": [l.model_dump() for l in logs]
        }

    def trace_outbound(self, batch_id: str) -> Dict:
        batch = self.db.get_batch(batch_id)
        if not batch:
            raise ValidationError(f"批次 {batch_id} 不存在", "batch_not_found")

        outbound_boxes = []
        self._collect_outbound_boxes(batch, outbound_boxes)

        return {
            "batch_id": batch_id,
            "outbound_boxes_count": len(outbound_boxes),
            "outbound_boxes": outbound_boxes,
            "message": f"追溯到 {len(outbound_boxes)} 个已出库箱子"
        }

    def _collect_outbound_boxes(self, batch: Batch, result: List[Dict]):
        for box_id in batch.boxes:
            box = self.db.get_box(box_id)
            if box and box.status == BoxStatus.OUTBOUND:
                result.append({
                    "box_id": box.box_id,
                    "batch_id": box.batch_id,
                    "original_batch_id": box.original_batch_id,
                    "destination": box.destination,
                    "outbound_at": box.outbound_at
                })
        for child_id in batch.child_batches:
            child = self.db.get_batch(child_id)
            if child:
                self._collect_outbound_boxes(child, result)

    def generate_recall_report(self, recall_id: str) -> Dict:
        recall = self.db.get_recall(recall_id)
        if not recall:
            raise ValidationError(f"召回 {recall_id} 不存在", "recall_not_found")

        affected_batches_detail = []
        for bid in recall.affected_batches:
            batch = self.db.get_batch(bid)
            if batch:
                affected_batches_detail.append({
                    "batch_id": bid,
                    "status": batch.status.value,
                    "frozen": batch.frozen,
                    "recalled": batch.recalled,
                    "product_type": batch.product_type,
                    "origin": batch.origin.model_dump()
                })

        affected_boxes_detail = []
        for box_id in recall.affected_boxes:
            box = self.db.get_box(box_id)
            if box:
                affected_boxes_detail.append({
                    "box_id": box_id,
                    "current_batch_id": box.batch_id,
                    "original_batch_id": box.original_batch_id,
                    "status": box.status.value,
                    "frozen": box.frozen,
                    "recalled": box.recalled,
                    "outbound": box.status == BoxStatus.OUTBOUND or box.outbound_at is not None,
                    "destination": box.destination
                })

        outbound_boxes = [b for b in affected_boxes_detail if b["outbound"]]

        return {
            "report_id": self._generate_id("RPT"),
            "recall_id": recall_id,
            "generated_at": datetime.now(),
            "reason": recall.reason,
            "source_batch_ids": recall.source_batch_ids,
            "created_at": recall.created_at,
            "executed_at": recall.executed_at,
            "summary": {
                "total_affected_batches": len(affected_batches_detail),
                "total_affected_boxes": len(affected_boxes_detail),
                "outbound_boxes_count": len(outbound_boxes),
                "in_warehouse_boxes_count": len(affected_boxes_detail) - len(outbound_boxes)
            },
            "affected_batches": affected_batches_detail,
            "affected_boxes": affected_boxes_detail,
            "outbound_trace": outbound_boxes
        }

    def generate_freeze_report(self, freeze_id: str) -> Dict:
        freeze = self.db.get_freeze(freeze_id)
        if not freeze:
            raise ValidationError(f"冻结 {freeze_id} 不存在", "freeze_not_found")

        affected_batches_detail = []
        for bid in freeze.affected_batches:
            batch = self.db.get_batch(bid)
            if batch:
                affected_batches_detail.append({
                    "batch_id": bid,
                    "status": batch.status.value,
                    "frozen_at": batch.frozen_at,
                    "frozen_reason": batch.frozen_reason,
                    "product_type": batch.product_type
                })

        affected_boxes_detail = []
        for box_id in freeze.affected_boxes:
            box = self.db.get_box(box_id)
            if box:
                affected_boxes_detail.append({
                    "box_id": box_id,
                    "current_batch_id": box.batch_id,
                    "original_batch_id": box.original_batch_id,
                    "frozen_at": box.frozen_at,
                    "frozen_reason": box.frozen_reason,
                    "outbound_at": box.outbound_at,
                    "destination": box.destination
                })

        return {
            "report_id": self._generate_id("RPT"),
            "freeze_id": freeze_id,
            "generated_at": datetime.now(),
            "reason": freeze.reason,
            "entity_type": freeze.entity_type,
            "entity_id": freeze.entity_id,
            "created_at": freeze.created_at,
            "executed_at": freeze.executed_at,
            "summary": {
                "total_affected_batches": len(affected_batches_detail),
                "total_affected_boxes": len(affected_boxes_detail)
            },
            "affected_batches": affected_batches_detail,
            "affected_boxes": affected_boxes_detail
        }

    def manual_correction(self, entity_type: str, entity_id: str,
                          corrections: Dict, operator_id: str, operator_name: str,
                          reason: str) -> Dict:
        if entity_type == "BATCH":
            entity = self.db.get_batch(entity_id)
        elif entity_type == "BOX":
            entity = self.db.get_box(entity_id)
        else:
            raise ValidationError(f"未知实体类型: {entity_type}", "invalid_entity_type")

        if not entity:
            raise ValidationError(f"{entity_type} {entity_id} 不存在", "entity_not_found")

        before = entity.model_dump()
        for key, value in corrections.items():
            if hasattr(entity, key):
                setattr(entity, key, value)

        if entity_type == "BATCH":
            self.db.save_batch(entity)
        else:
            self.db.save_box(entity)

        after = entity.model_dump()
        self._audit_log(
            "MANUAL_CORRECTION", operator_id, operator_name, entity_type, entity_id,
            "人工修正", "SUCCESS", before_state=before, after_state=after,
            remarks=f"修正原因: {reason}"
        )

        return {
            "entity_type": entity_type,
            "entity_id": entity_id,
            "before": before,
            "after": after,
            "diff": self._compute_diff(before, after),
            "operator": operator_name,
            "reason": reason,
            "message": "人工修正完成"
        }

    def get_audit_history(self, entity_type: str = None, entity_id: str = None) -> Dict:
        logs = self.db.get_audit_logs(entity_type, entity_id)
        return {
            "total": len(logs),
            "logs": [l.model_dump() for l in logs]
        }

    def get_all_status(self) -> Dict:
        batches = self.db.get_all_batches()
        boxes = self.db.get_all_boxes()
        
        batch_status_summary = {}
        for b in batches:
            key = b.status.value
            batch_status_summary[key] = batch_status_summary.get(key, 0) + 1

        box_status_summary = {}
        frozen_boxes = 0
        recalled_boxes = 0
        for box in boxes:
            key = box.status.value
            box_status_summary[key] = box_status_summary.get(key, 0) + 1
            if box.frozen:
                frozen_boxes += 1
            if box.recalled:
                recalled_boxes += 1

        return {
            "batches_total": len(batches),
            "boxes_total": len(boxes),
            "batch_status_summary": batch_status_summary,
            "box_status_summary": box_status_summary,
            "frozen_boxes": frozen_boxes,
            "recalled_boxes": recalled_boxes,
            "recalls_total": len(self.db.get_all_recalls()),
            "freezes_total": len(self.db.get_all_freezes())
        }


service = TraceabilityService()

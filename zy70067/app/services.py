from sqlalchemy.orm import Session
from sqlalchemy import desc, and_, or_
from datetime import datetime
from typing import List, Optional, Dict, Any
import json
from . import models, schemas
from .models import (
    Material, Inventory, Teacher, ClassInfo, CoursePlan, CoursePlanItem,
    UsageRecord, UsageItem, ReturnItem, LossItem, CompensationRecord,
    InventoryLog, OperationLog, OperationStatus
)


class BusinessException(Exception):
    def __init__(self, message: str, code: str = "BUSINESS_ERROR"):
        self.message = message
        self.code = code
        super().__init__(message)


def generate_no(prefix: str, seq: int) -> str:
    now = datetime.now()
    date_str = now.strftime("%Y%m%d")
    return f"{prefix}{date_str}{seq:04d}"


def log_operation(db: Session, module: str, action: str, target_id: int,
                  operator_name: str, detail: str, result: str, error: str = None):
    log = OperationLog(
        module=module,
        action=action,
        target_id=target_id,
        operator_name=operator_name,
        detail=detail,
        result=result,
        error_message=error
    )
    db.add(log)


def log_inventory(db: Session, material_id: int, operation_type: str,
                  before_qty: float, change_qty: float, after_qty: float,
                  related_type: str = None, related_id: int = None,
                  operator_name: str = None, remarks: str = None):
    log = InventoryLog(
        material_id=material_id,
        operation_type=operation_type,
        before_qty=before_qty,
        change_qty=change_qty,
        after_qty=after_qty,
        related_type=related_type,
        related_id=related_id,
        operator_name=operator_name,
        remarks=remarks
    )
    db.add(log)


class MaterialService:
    @staticmethod
    def create_material(db: Session, data: schemas.MaterialCreate) -> Material:
        material = Material(**data.model_dump())
        db.add(material)
        db.flush()
        inventory = Inventory(
            material_id=material.id,
            total_qty=0,
            available_qty=0,
            reserved_qty=0,
            min_stock=0
        )
        db.add(inventory)
        return material

    @staticmethod
    def get_materials(db: Session, skip: int = 0, limit: int = 100) -> List[Material]:
        return db.query(Material).offset(skip).limit(limit).all()

    @staticmethod
    def get_material_by_id(db: Session, material_id: int) -> Optional[Material]:
        return db.query(Material).filter(Material.id == material_id).first()


class InventoryService:
    @staticmethod
    def check_available_qty(db: Session, material_id: int, required_qty: float) -> bool:
        inv = db.query(Inventory).filter(Inventory.material_id == material_id).first()
        if not inv:
            return False
        return inv.available_qty >= required_qty

    @staticmethod
    def reserve_qty(db: Session, material_id: int, qty: float, operator_name: str = None,
                    related_type: str = None, related_id: int = None):
        inv = db.query(Inventory).filter(Inventory.material_id == material_id).with_for_update().first()
        if not inv:
            raise BusinessException(f"耗材ID {material_id} 不存在库存记录")
        if inv.available_qty < qty:
            material = db.query(Material).filter(Material.id == material_id).first()
            name = material.name if material else f"ID:{material_id}"
            raise BusinessException(f"耗材「{name}」库存不足：需要 {qty}，可用 {inv.available_qty}")
        before = inv.available_qty
        inv.available_qty -= qty
        inv.reserved_qty += qty
        log_inventory(db, material_id, "库存预留", before, -qty, inv.available_qty,
                      related_type, related_id, operator_name, "领用预留")

    @staticmethod
    def release_reserved(db: Session, material_id: int, qty: float, operator_name: str = None,
                         related_type: str = None, related_id: int = None):
        inv = db.query(Inventory).filter(Inventory.material_id == material_id).with_for_update().first()
        if not inv:
            return
        if inv.reserved_qty < qty:
            qty = inv.reserved_qty
        before = inv.available_qty
        inv.available_qty += qty
        inv.reserved_qty -= qty
        log_inventory(db, material_id, "释放预留", before, qty, inv.available_qty,
                      related_type, related_id, operator_name, "预留释放")

    @staticmethod
    def deduct_from_reserved(db: Session, material_id: int, qty: float, operator_name: str = None,
                             related_type: str = None, related_id: int = None):
        inv = db.query(Inventory).filter(Inventory.material_id == material_id).with_for_update().first()
        if not inv:
            raise BusinessException(f"耗材ID {material_id} 不存在库存记录")
        if inv.reserved_qty < qty:
            material = db.query(Material).filter(Material.id == material_id).first()
            name = material.name if material else f"ID:{material_id}"
            raise BusinessException(f"耗材「{name}」预留数量不足：需要 {qty}，预留 {inv.reserved_qty}")
        before_total = inv.total_qty
        inv.total_qty -= qty
        inv.reserved_qty -= qty
        log_inventory(db, material_id, "领用出库", before_total, -qty, inv.total_qty,
                      related_type, related_id, operator_name, "实验领用")

    @staticmethod
    def return_to_inventory(db: Session, material_id: int, qty: float, operator_name: str = None,
                            related_type: str = None, related_id: int = None):
        inv = db.query(Inventory).filter(Inventory.material_id == material_id).with_for_update().first()
        if not inv:
            inv = Inventory(material_id=material_id, total_qty=0, available_qty=0, reserved_qty=0)
            db.add(inventory)
            db.flush()
        before_total = inv.total_qty
        before_available = inv.available_qty
        inv.total_qty += qty
        inv.available_qty += qty
        log_inventory(db, material_id, "退料入库", before_total, qty, inv.total_qty,
                      related_type, related_id, operator_name, "实验退料")

    @staticmethod
    def add_stock(db: Session, material_id: int, qty: float, operator_name: str = None, location: str = None):
        inv = db.query(Inventory).filter(Inventory.material_id == material_id).with_for_update().first()
        if not inv:
            inv = Inventory(material_id=material_id, total_qty=0, available_qty=0, reserved_qty=0)
            db.add(inv)
            db.flush()
        before = inv.total_qty
        inv.total_qty += qty
        inv.available_qty += qty
        if location:
            inv.location = location
        log_inventory(db, material_id, "采购入库", before, qty, inv.total_qty,
                      operator_name=operator_name, remarks="采购补充库存")

    @staticmethod
    def get_inventory_list(db: Session) -> List[Inventory]:
        return db.query(Inventory).all()


class CoursePlanService:
    @staticmethod
    def create_plan(db: Session, data: schemas.CoursePlanCreate) -> CoursePlan:
        seq = db.query(CoursePlan).count() + 1
        plan = CoursePlan(
            plan_no=generate_no("PLAN", seq),
            teacher_id=data.teacher_id,
            class_id=data.class_id,
            course_name=data.course_name,
            experiment_name=data.experiment_name,
            experiment_date=data.experiment_date,
            total_groups=data.total_groups,
            remarks=data.remarks,
            status=OperationStatus.PENDING
        )
        db.add(plan)
        db.flush()

        for item_data in data.plan_items:
            material = db.query(Material).filter(Material.id == item_data.material_id).first()
            if not material:
                raise BusinessException(f"耗材ID {item_data.material_id} 不存在")
            total_qty = item_data.qty_per_group * data.total_groups
            plan_item = CoursePlanItem(
                plan_id=plan.id,
                material_id=item_data.material_id,
                qty_per_group=item_data.qty_per_group,
                total_qty=total_qty,
                notes=item_data.notes
            )
            db.add(plan_item)

        plan.status = OperationStatus.PROCESSING
        return plan

    @staticmethod
    def get_plan_by_no(db: Session, plan_no: str) -> Optional[CoursePlan]:
        return db.query(CoursePlan).filter(CoursePlan.plan_no == plan_no).first()

    @staticmethod
    def get_plan_by_id(db: Session, plan_id: int) -> Optional[CoursePlan]:
        return db.query(CoursePlan).filter(CoursePlan.id == plan_id).first()


class CompensationService:
    @staticmethod
    def create_record(db: Session, usage_record_id: int, operation_type: str,
                      step_name: str, error_message: str, compensation_data: Dict[str, Any] = None) -> CompensationRecord:
        record = CompensationRecord(
            usage_record_id=usage_record_id,
            operation_type=operation_type,
            step_name=step_name,
            error_message=error_message,
            status=OperationStatus.FAILED,
            retry_count=0,
            compensation_data=json.dumps(compensation_data) if compensation_data else None,
            last_attempt_at=datetime.now()
        )
        db.add(record)
        db.flush()
        return record

    @staticmethod
    def get_pending_compensations(db: Session) -> List[CompensationRecord]:
        return db.query(CompensationRecord).filter(
            CompensationRecord.status == OperationStatus.FAILED
        ).order_by(desc(CompensationRecord.created_at)).all()

    @staticmethod
    def retry_compensation(db: Session, compensation_id: int, operator_name: str) -> Dict[str, Any]:
        comp = db.query(CompensationRecord).filter(
            CompensationRecord.id == compensation_id
        ).first()
        if not comp:
            raise BusinessException("补偿记录不存在")
        if comp.status == OperationStatus.SUCCESS:
            return {"message": "该补偿已处理完成，无需重试"}

        usage_record = db.query(UsageRecord).filter(UsageRecord.id == comp.usage_record_id).first()
        if not usage_record:
            raise BusinessException("关联的领用记录不存在")

        comp_data = {}
        if comp.compensation_data:
            comp_data = json.loads(comp.compensation_data)

        result = {"success": False, "message": ""}

        try:
            comp.retry_count += 1
            comp.last_attempt_at = datetime.now()

            if comp.operation_type == "领用" and comp.step_name == "库存扣减":
                result = CompensationService._retry_usage_deduction(db, usage_record, comp_data)
            elif comp.operation_type == "退料" and comp.step_name == "退料入库":
                result = CompensationService._retry_return_inbound(db, usage_record, comp_data)
            elif comp.operation_type == "损耗" and comp.step_name == "损耗登记":
                result = CompensationService._retry_loss_register(db, usage_record, comp_data)
            else:
                raise BusinessException(f"未知的补偿类型: {comp.operation_type} - {comp.step_name}")

            if result.get("success"):
                comp.status = OperationStatus.SUCCESS
                comp.resolved_at = datetime.now()
                comp.error_message = None
            else:
                comp.error_message = result.get("message", "重试失败")

            db.commit()
            return result

        except BusinessException as e:
            comp.error_message = str(e)
            db.commit()
            raise
        except Exception as e:
            comp.error_message = f"系统异常: {str(e)}"
            db.commit()
            raise BusinessException(f"补偿重试失败: {str(e)}")

    @staticmethod
    def _retry_usage_deduction(db: Session, usage_record: UsageRecord, data: Dict[str, Any]) -> Dict[str, Any]:
        items_to_deduct = data.get("items", [])
        operator_name = data.get("operator_name", "系统补偿")

        for item_data in items_to_deduct:
            material_id = item_data["material_id"]
            qty = item_data["actual_qty"]
            usage_item_id = item_data.get("usage_item_id")

            if usage_item_id:
                existing = db.query(UsageItem).filter(UsageItem.id == usage_item_id).first()
                if existing and existing.status == OperationStatus.SUCCESS:
                    continue

            try:
                InventoryService.deduct_from_reserved(
                    db, material_id, qty, operator_name, "领用记录", usage_record.id
                )
            except BusinessException as e:
                return {"success": False, "message": str(e)}

        usage_record.status = OperationStatus.SUCCESS
        return {
            "success": True,
            "message": f"领用单号 {usage_record.record_no} 库存扣减补偿成功",
            "record_no": usage_record.record_no
        }

    @staticmethod
    def _retry_return_inbound(db: Session, usage_record: UsageRecord, data: Dict[str, Any]) -> Dict[str, Any]:
        return_items = data.get("return_items", [])
        operator_name = data.get("operator_name", "系统补偿")

        for item_data in return_items:
            material_id = item_data["material_id"]
            qty = item_data["returned_qty"]

            try:
                InventoryService.return_to_inventory(
                    db, material_id, qty, operator_name, "退料记录", usage_record.id
                )
            except BusinessException as e:
                return {"success": False, "message": str(e)}

        usage_record.status = OperationStatus.NEEDS_CONFIRM
        return {
            "success": True,
            "message": f"领用单号 {usage_record.record_no} 退料入库补偿成功",
            "record_no": usage_record.record_no
        }

    @staticmethod
    def _retry_loss_register(db: Session, usage_record: UsageRecord, data: Dict[str, Any]) -> Dict[str, Any]:
        loss_items = data.get("loss_items", [])
        operator_name = data.get("operator_name", "系统补偿")

        usage_record.total_loss_qty = data.get("total_loss_qty", usage_record.total_loss_qty)
        usage_record.status = OperationStatus.NEEDS_CONFIRM

        return {
            "success": True,
            "message": f"领用单号 {usage_record.record_no} 损耗登记补偿成功",
            "record_no": usage_record.record_no
        }


class UsageService:
    @staticmethod
    def create_usage_record(db: Session, data: schemas.UsageRecordCreate) -> Dict[str, Any]:
        plan = CoursePlanService.get_plan_by_id(db, data.plan_id)
        if not plan:
            raise BusinessException("课程计划不存在")

        existing = db.query(UsageRecord).filter(
            UsageRecord.plan_id == plan.id,
            UsageRecord.status.in_([OperationStatus.PROCESSING, OperationStatus.SUCCESS,
                                  OperationStatus.NEEDS_CONFIRM])
        ).first()
        if existing:
            raise BusinessException(f"该课程计划已有进行中的领用记录（单号: {existing.record_no}），不能重复领用")

        seq = db.query(UsageRecord).count() + 1
        usage_record = UsageRecord(
            record_no=generate_no("LY", seq),
            plan_id=plan.id,
            class_id=plan.class_id,
            teacher_id=plan.teacher_id,
            operator_id=data.operator_id,
            operator_name=data.operator_name,
            status=OperationStatus.PROCESSING,
            remarks=data.remarks
        )
        db.add(usage_record)
        db.flush()

        try:
            log_operation(db, "领用管理", "开始领用", usage_record.id,
                        data.operator_name, f"开始处理领用单 {usage_record.record_no}", "处理中")

            plan_items_dict = {item.material_id: item for item in plan.planned_items}
            usage_items_for_compensation = []

            for item_data in data.items:
                material_id = item_data.material_id
                actual_qty = item_data.actual_qty
                plan_qty = plan_items_dict.get(material_id)
                plan_qty_value = plan_qty.total_qty if plan_qty else item_data.plan_qty

                material = db.query(Material).filter(Material.id == material_id).first()
                if not material:
                    raise BusinessException(f"耗材ID {material_id} 不存在")

                if actual_qty <= 0:
                    raise BusinessException(f"耗材「{material.name}」领用数量必须大于0")

                usage_item = UsageItem(
                    usage_record_id=usage_record.id,
                    material_id=material_id,
                    plan_qty=plan_qty_value,
                    actual_qty=actual_qty,
                    returnable_qty=item_data.returnable_qty,
                    status=OperationStatus.PROCESSING
                )
                db.add(usage_item)
                db.flush()

                if not InventoryService.check_available_qty(db, material_id, actual_qty):
                    inv = db.query(Inventory).filter(Inventory.material_id == material_id).first()
                    available = inv.available_qty if inv else 0
                    raise BusinessException(
                        f"耗材「{material.name}」库存不足：计划领用 {actual_qty} {material.unit}，当前可用 {available} {material.unit}"
                    )

                InventoryService.reserve_qty(
                    db, material_id, actual_qty, data.operator_name, "领用记录", usage_record.id
                )

                usage_items_for_compensation.append({
                    "material_id": material_id,
                    "actual_qty": actual_qty,
                    "usage_item_id": usage_item.id
                })

            for item_data in data.items:
                material_id = item_data.material_id
                actual_qty = item_data.actual_qty
                try:
                    InventoryService.deduct_from_reserved(
                        db, material_id, actual_qty, data.operator_name, "领用记录", usage_record.id
                    )
                except BusinessException as e:
                    CompensationService.create_record(
                        db, usage_record.id, "领用", "库存扣减",
                        f"扣减库存时失败: {str(e)}",
                        {
                            "operator_name": data.operator_name,
                            "items": usage_items_for_compensation
                        }
                    )
                    db.commit()
                    return {
                        "success": False,
                        "message": f"领用单 {usage_record.record_no} 处理中，但库存扣减环节失败，已生成补偿记录可重试",
                        "code": "PARTIAL_SUCCESS_NEED_COMPENSATION",
                        "data": {
                            "record_no": usage_record.record_no,
                            "status": "处理中断，需补偿",
                            "compensation_hint": "请联系管理员执行补偿重试"
                        }
                    }

            for ui in db.query(UsageItem).filter(UsageItem.usage_record_id == usage_record.id).all():
                ui.status = OperationStatus.SUCCESS

            usage_record.total_used_qty = sum(item.actual_qty for item in data.items)
            usage_record.status = OperationStatus.SUCCESS
            usage_record.pickup_time = datetime.now()

            plan.status = OperationStatus.SUCCESS

            log_operation(db, "领用管理", "领用完成", usage_record.id,
                        data.operator_name, f"领用单 {usage_record.record_no} 处理完成", "成功")
            db.commit()

            return {
                "success": True,
                "message": f"实验耗材领用成功！领用单号：{usage_record.record_no}",
                "code": "SUCCESS",
                "data": {
                    "record_no": usage_record.record_no,
                    "class_name": plan.class_info.name if plan.class_info else "",
                    "experiment_name": plan.experiment_name,
                    "total_items": len(data.items),
                    "total_qty": usage_record.total_used_qty,
                    "next_step": "实验完成后请办理退料和损耗登记"
                }
            }

        except BusinessException:
            db.rollback()
            raise
        except Exception as e:
            db.rollback()
            log_operation(db, "领用管理", "领用失败", usage_record.id if usage_record.id else 0,
                        data.operator_name, f"领用处理异常", "失败", str(e))
            raise BusinessException(f"领用处理失败: {str(e)}")

    @staticmethod
    def process_return(db: Session, data: schemas.ReturnProcessRequest) -> Dict[str, Any]:
        usage_record = db.query(UsageRecord).filter(
            UsageRecord.record_no == data.record_no
        ).first()
        if not usage_record:
            raise BusinessException(f"领用单号 {data.record_no} 不存在")

        if usage_record.status in [OperationStatus.FAILED, OperationStatus.CANCELLED]:
            raise BusinessException(f"领用单 {data.record_no} 状态为「{usage_record.status.value}」，不能办理退料")

        if usage_record.teacher_confirmed == 1:
            raise BusinessException(f"领用单 {data.record_no} 已完成教师确认，不能再办理退料")

        log_operation(db, "退料管理", "开始退料", usage_record.id,
                    data.operator_name, f"处理领用单 {data.record_no} 退料", "处理中")

        usage_items_dict = {ui.material_id: ui for ui in usage_record.usage_items}

        return_items_for_compensation = []

        for item_data in data.items:
            material_id = item_data.material_id
            returned_qty = item_data.returned_qty

            if material_id not in usage_items_dict:
                raise BusinessException(f"该领用单没有领用耗材ID {material_id}，不能退料")

            usage_item = usage_items_dict[material_id]
            already_returned = sum(ri.returned_qty for ri in usage_record.return_items
                                   if ri.material_id == material_id)
            already_loss = sum(li.loss_qty for li in usage_record.loss_items
                              if li.material_id == material_id)

            max_returnable = usage_item.actual_qty - already_returned - already_loss

            if returned_qty > max_returnable:
                material = db.query(Material).filter(Material.id == material_id).first()
                name = material.name if material else f"ID:{material_id}"
                raise BusinessException(
                    f"耗材「{name}」退料数量超限：最多可退 {max_returnable}，本次申请退 {returned_qty}"
                )

            if returned_qty <= 0:
                raise BusinessException("退料数量必须大于0")

            return_item = ReturnItem(
                usage_record_id=usage_record.id,
                material_id=material_id,
                usage_item_id=usage_item.id,
                returned_qty=returned_qty,
                condition=item_data.condition,
                notes=item_data.notes,
                status=OperationStatus.PROCESSING
            )
            db.add(return_item)
            db.flush()

            return_items_for_compensation.append({
                "material_id": material_id,
                "returned_qty": returned_qty,
                "return_item_id": return_item.id
            })

        try:
            for item_data in data.items:
                material_id = item_data.material_id
                returned_qty = item_data.returned_qty
                try:
                    InventoryService.return_to_inventory(
                        db, material_id, returned_qty, data.operator_name,
                        "退料记录", usage_record.id
                    )
                except Exception as e:
                    CompensationService.create_record(
                        db, usage_record.id, "退料", "退料入库",
                        f"退料入库失败: {str(e)}",
                        {
                            "operator_name": data.operator_name,
                            "return_items": return_items_for_compensation
                        }
                    )
                    db.commit()
                    return {
                        "success": False,
                        "message": f"退料登记成功，但入库环节失败，已生成补偿记录可重试",
                        "code": "PARTIAL_SUCCESS_NEED_COMPENSATION",
                        "data": {
                            "record_no": usage_record.record_no,
                            "status": "处理中断，需补偿"
                        }
                    }

            for ri in return_items_for_compensation:
                return_item = db.query(ReturnItem).filter(ReturnItem.id == ri["return_item_id"]).first()
                if return_item:
                    return_item.status = OperationStatus.SUCCESS

            usage_record.total_returned_qty = sum(ri.returned_qty for ri in usage_record.return_items)
            usage_record.status = OperationStatus.NEEDS_CONFIRM
            usage_record.return_time = datetime.now()

            log_operation(db, "退料管理", "退料完成", usage_record.id,
                        data.operator_name, f"退料处理完成", "成功")
            db.commit()

            return {
                "success": True,
                "message": f"退料处理成功！共退回 {len(data.items)} 种耗材，合计 {sum(i.returned_qty for i in data.items)}",
                "code": "SUCCESS",
                "data": {
                    "record_no": usage_record.record_no,
                    "total_returned_items": len(data.items),
                    "next_step": "请办理损耗登记，然后等待教师确认"
                }
            }

        except BusinessException:
            db.rollback()
            raise
        except Exception as e:
            db.rollback()
            raise BusinessException(f"退料处理失败: {str(e)}")

    @staticmethod
    def register_loss(db: Session, data: schemas.LossRegisterRequest) -> Dict[str, Any]:
        usage_record = db.query(UsageRecord).filter(
            UsageRecord.record_no == data.record_no
        ).first()
        if not usage_record:
            raise BusinessException(f"领用单号 {data.record_no} 不存在")

        if usage_record.teacher_confirmed == 1:
            raise BusinessException(f"领用单 {data.record_no} 已完成教师确认，不能再登记损耗")

        usage_items_dict = {ui.material_id: ui for ui in usage_record.usage_items}

        total_loss = 0

        for item_data in data.items:
            material_id = item_data.material_id
            loss_qty = item_data.loss_qty

            if material_id not in usage_items_dict:
                raise BusinessException(f"该领用单没有领用耗材ID {material_id}")

            usage_item = usage_items_dict[material_id]
            already_returned = sum(ri.returned_qty for ri in usage_record.return_items
                                   if ri.material_id == material_id)
            already_loss = sum(li.loss_qty for li in usage_record.loss_items
                              if li.material_id == material_id)

            max_lossable = usage_item.actual_qty - already_returned - already_loss

            if loss_qty > max_lossable:
                material = db.query(Material).filter(Material.id == material_id).first()
                name = material.name if material else f"ID:{material_id}"
                raise BusinessException(
                    f"耗材「{name}」损耗数量超限：最多可报损 {max_lossable}，本次申请报损 {loss_qty}"
                )

            if loss_qty <= 0:
                raise BusinessException("损耗数量必须大于0")

            if not item_data.loss_reason or len(item_data.loss_reason.strip()) < 2:
                raise BusinessException("请填写有效的损耗原因（至少2个字符）")

            loss_item = LossItem(
                usage_record_id=usage_record.id,
                material_id=material_id,
                usage_item_id=usage_item.id,
                loss_qty=loss_qty,
                loss_reason=item_data.loss_reason,
                notes=item_data.notes,
                status=OperationStatus.SUCCESS
            )
            db.add(loss_item)
            total_loss += loss_qty

        usage_record.total_loss_qty = sum(li.loss_qty for li in usage_record.loss_items)
        usage_record.status = OperationStatus.NEEDS_CONFIRM

        log_operation(db, "损耗管理", "损耗登记", usage_record.id,
                    data.operator_name, f"登记 {len(data.items)} 项损耗", "成功")
        db.commit()

        return {
            "success": True,
            "message": f"损耗登记成功！共登记 {len(data.items)} 种耗材，合计报损 {total_loss}",
            "code": "SUCCESS",
            "data": {
                "record_no": usage_record.record_no,
                "total_loss_items": len(data.items),
                "total_loss_qty": total_loss,
                "next_step": "请等待教师确认完成本次实验耗材结算"
            }
        }

    @staticmethod
    def teacher_confirm(db: Session, data: schemas.TeacherConfirmRequest) -> Dict[str, Any]:
        usage_record = db.query(UsageRecord).filter(
            UsageRecord.record_no == data.record_no
        ).first()
        if not usage_record:
            raise BusinessException(f"领用单号 {data.record_no} 不存在")

        if usage_record.teacher_id != data.teacher_id:
            teacher = db.query(Teacher).filter(Teacher.id == usage_record.teacher_id).first()
            teacher_name = teacher.name if teacher else f"ID:{usage_record.teacher_id}"
            raise BusinessException(f"只有任课教师「{teacher_name}」才能确认此领用单")

        if usage_record.teacher_confirmed == 1:
            return {
                "success": True,
                "message": f"领用单 {data.record_no} 已完成确认，无需重复操作",
                "code": "ALREADY_CONFIRMED",
                "data": {
                    "record_no": data.record_no,
                    "confirmed_at": usage_record.confirmed_at.strftime("%Y-%m-%d %H:%M:%S")
                    if usage_record.confirmed_at else None
                }
            }

        used = usage_record.total_used_qty
        returned = usage_record.total_returned_qty
        loss = usage_record.total_loss_qty
        unaccounted = used - returned - loss

        if unaccounted > 0:
            return {
                "success": False,
                "message": f"还有 {unaccounted} 数量的耗材未办理退料或损耗登记，请先完成全部结算",
                "code": "UNACCOUNTED_REMAINING",
                "data": {
                    "record_no": data.record_no,
                    "used": used,
                    "returned": returned,
                    "loss": loss,
                    "unaccounted": unaccounted
                }
            }

        usage_record.teacher_confirmed = 1
        usage_record.confirmed_by = data.teacher_id
        usage_record.confirmed_at = datetime.now()
        usage_record.status = OperationStatus.CONFIRMED

        teacher = db.query(Teacher).filter(Teacher.id == data.teacher_id).first()
        teacher_name = teacher.name if teacher else f"ID:{data.teacher_id}"

        log_operation(db, "教师确认", "确认完成", usage_record.id,
                    teacher_name, f"教师确认领用单 {data.record_no}", "成功")
        db.commit()

        return {
            "success": True,
            "message": f"教师确认成功！本次实验耗材领用流程全部完成",
            "code": "SUCCESS",
            "data": {
                "record_no": data.record_no,
                "confirmed_by": teacher_name,
                "confirmed_at": usage_record.confirmed_at.strftime("%Y-%m-%d %H:%M:%S"),
                "summary": {
                    "总领用": used,
                    "已退料": returned,
                    "报损耗": loss,
                    "结算状态": "已完成"
                }
            }
        }

    @staticmethod
    def get_usage_detail(db: Session, record_no: str) -> Optional[UsageRecord]:
        return db.query(UsageRecord).filter(UsageRecord.record_no == record_no).first()


class ReportService:
    @staticmethod
    def generate_inventory_report(db: Session, request: schemas.InventoryReportRequest) -> schemas.InventoryReportResponse:
        materials = db.query(Material)
        if request.category:
            materials = materials.filter(Material.category == request.category)
        if request.material_id:
            materials = materials.filter(Material.id == request.material_id)
        materials = materials.all()

        report_items = []
        total_out = 0
        total_return = 0
        total_loss = 0

        for material in materials:
            inv = db.query(Inventory).filter(Inventory.material_id == material.id).first()
            end_qty = inv.total_qty if inv else 0

            logs_query = db.query(InventoryLog).filter(InventoryLog.material_id == material.id)
            if request.start_date:
                logs_query = logs_query.filter(InventoryLog.created_at >= request.start_date)
            if request.end_date:
                logs_query = logs_query.filter(InventoryLog.created_at <= request.end_date)
            logs = logs_query.all()

            out_qty = sum(abs(l.change_qty) for l in logs if l.operation_type == "领用出库")
            return_qty = sum(l.change_qty for l in logs if l.operation_type == "退料入库")
            loss_qty = 0
            for li in db.query(LossItem).all():
                if li.material_id == material.id:
                    ur = db.query(UsageRecord).filter(UsageRecord.id == li.usage_record_id).first()
                    if ur:
                        loss_qty += li.loss_qty

            net_change = return_qty - out_qty
            begin_qty = end_qty - net_change

            total_out += out_qty
            total_return += return_qty
            total_loss += loss_qty

            report_items.append(schemas.InventoryReportItem(
                material_id=material.id,
                material_name=material.name,
                category=material.category,
                specification=material.specification,
                unit=material.unit,
                begin_qty=begin_qty,
                in_qty=sum(l.change_qty for l in logs if l.operation_type == "采购入库"),
                out_qty=out_qty,
                return_qty=return_qty,
                loss_qty=loss_qty,
                end_qty=end_qty,
                net_change=net_change
            ))

        return schemas.InventoryReportResponse(
            report_type="库存变动报表",
            start_date=request.start_date,
            end_date=request.end_date,
            total_materials=len(report_items),
            total_out_qty=total_out,
            total_return_qty=total_return,
            total_loss_qty=total_loss,
            items=report_items
        )

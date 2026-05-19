import json
import hashlib
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from database import (
    get_db_session, IdempotentService, OrderRepository,
    ShortageRepository, CompensationRepository,
    SettlementRepository, OperationLogRepository
)
from models import (
    ShortageStatus, CompensationType,
    OperationType, OperationStatus
)


def generate_idempotent_key(operation_type: str, unique_identifier: str) -> str:
    content = f"{operation_type}:{unique_identifier}"
    return hashlib.md5(content.encode('utf-8')).hexdigest()


class ShortageService:
    @staticmethod
    def identify_shortage(
        order_no: str,
        product_id: str,
        product_name: str,
        shortage_quantity: int,
        shortage_amount: float,
        operator: str,
        sku_id: Optional[str] = None,
        sku_name: Optional[str] = None,
        user_id: Optional[str] = None,
        user_name: Optional[str] = None,
        phone: Optional[str] = None,
        total_amount: Optional[float] = None,
        remark: Optional[str] = None
    ) -> Dict[str, Any]:
        idempotent_key = generate_idempotent_key(
            OperationType.IDENTIFY.value,
            f"{order_no}:{product_id}:{sku_id or 'NOSKU'}"
        )

        with get_db_session() as session:
            cached_result = IdempotentService.get_cached_result(session, idempotent_key)
            if cached_result:
                return {
                    "success": True,
                    "message": "重复提交，返回已有结果",
                    "data": cached_result,
                    "is_idempotent": True
                }

            lock = IdempotentService.acquire_lock(
                session, idempotent_key, OperationType.IDENTIFY.value
            )
            if not lock:
                return {
                    "success": False,
                    "message": "操作正在进行中，请稍后重试",
                    "is_idempotent": False
                }

            try:
                order = OrderRepository.get_or_create(session, order_no, {
                    "user_id": user_id or "UNKNOWN",
                    "user_name": user_name,
                    "phone": phone,
                    "total_amount": total_amount or shortage_amount
                })

                existing = ShortageRepository.get_by_order_product(
                    session, order.id, product_id, sku_id
                )
                if existing:
                    result = {
                        "shortage_no": existing.shortage_no,
                        "order_no": order_no,
                        "product_name": existing.product_name,
                        "status": existing.status,
                        "created_at": existing.created_at.isoformat()
                    }
                    IdempotentService.set_result(session, idempotent_key, result)
                    return {
                        "success": True,
                        "message": "缺货记录已存在",
                        "data": result,
                        "is_idempotent": True
                    }

                shortage = ShortageRepository.create(session, {
                    "order_id": order.id,
                    "product_id": product_id,
                    "product_name": product_name,
                    "sku_id": sku_id,
                    "sku_name": sku_name,
                    "shortage_quantity": shortage_quantity,
                    "shortage_amount": shortage_amount,
                    "status": ShortageStatus.IDENTIFIED.value,
                    "identified_by": operator,
                    "identified_at": datetime.now(),
                    "remark": remark
                })

                result = {
                    "shortage_no": shortage.shortage_no,
                    "order_no": order_no,
                    "product_name": shortage.product_name,
                    "shortage_quantity": shortage.shortage_quantity,
                    "shortage_amount": shortage.shortage_amount,
                    "status": shortage.status,
                    "identified_by": shortage.identified_by,
                    "identified_at": shortage.identified_at.isoformat()
                }

                IdempotentService.set_result(session, idempotent_key, result)

                OperationLogRepository.create(session, {
                    "operation_type": OperationType.IDENTIFY.value,
                    "operation_status": OperationStatus.SUCCESS.value,
                    "operator": operator,
                    "total_count": 1,
                    "success_count": 1,
                    "failed_count": 0,
                    "success_ids": json.dumps([shortage.shortage_no])
                })

                return {
                    "success": True,
                    "message": "缺货识别成功",
                    "data": result,
                    "is_idempotent": False
                }

            except Exception as e:
                OperationLogRepository.create(session, {
                    "operation_type": OperationType.IDENTIFY.value,
                    "operation_status": OperationStatus.FAILED.value,
                    "operator": operator,
                    "total_count": 1,
                    "success_count": 0,
                    "failed_count": 1,
                    "failed_details": json.dumps([{"order_no": order_no, "error": str(e)}]),
                    "error_message": str(e)
                })
                raise

    @staticmethod
    def confirm_shortage(shortage_no: str, operator: str, remark: Optional[str] = None) -> Dict[str, Any]:
        idempotent_key = generate_idempotent_key(OperationType.CONFIRM.value, shortage_no)

        with get_db_session() as session:
            cached_result = IdempotentService.get_cached_result(session, idempotent_key)
            if cached_result:
                return {
                    "success": True,
                    "message": "重复提交，返回已有结果",
                    "data": cached_result,
                    "is_idempotent": True
                }

            lock = IdempotentService.acquire_lock(
                session, idempotent_key, OperationType.CONFIRM.value
            )
            if not lock:
                return {
                    "success": False,
                    "message": "操作正在进行中，请稍后重试",
                    "is_idempotent": False
                }

            try:
                shortage = ShortageRepository.get_by_shortage_no(session, shortage_no)
                if not shortage:
                    return {"success": False, "message": "缺货记录不存在"}

                if shortage.status == ShortageStatus.CONFIRMED.value:
                    result = {
                        "shortage_no": shortage.shortage_no,
                        "status": shortage.status,
                        "confirmed_by": shortage.confirmed_by,
                        "confirmed_at": shortage.confirmed_at.isoformat() if shortage.confirmed_at else None
                    }
                    IdempotentService.set_result(session, idempotent_key, result)
                    return {
                        "success": True,
                        "message": "缺货已确认过",
                        "data": result,
                        "is_idempotent": True
                    }

                if shortage.status != ShortageStatus.IDENTIFIED.value:
                    return {
                        "success": False,
                        "message": f"当前状态{shortage.status}不允许确认"
                    }

                ShortageRepository.update_status(
                    session, shortage.id, ShortageStatus.CONFIRMED,
                    confirmed_by=operator,
                    confirmed_at=datetime.now(),
                    remark=remark
                )

                result = {
                    "shortage_no": shortage.shortage_no,
                    "status": ShortageStatus.CONFIRMED.value,
                    "confirmed_by": operator,
                    "confirmed_at": datetime.now().isoformat()
                }

                IdempotentService.set_result(session, idempotent_key, result)

                OperationLogRepository.create(session, {
                    "operation_type": OperationType.CONFIRM.value,
                    "operation_status": OperationStatus.SUCCESS.value,
                    "operator": operator,
                    "total_count": 1,
                    "success_count": 1,
                    "failed_count": 0,
                    "success_ids": json.dumps([shortage_no])
                })

                return {
                    "success": True,
                    "message": "缺货确认成功",
                    "data": result,
                    "is_idempotent": False
                }

            except Exception as e:
                OperationLogRepository.create(session, {
                    "operation_type": OperationType.CONFIRM.value,
                    "operation_status": OperationStatus.FAILED.value,
                    "operator": operator,
                    "total_count": 1,
                    "success_count": 0,
                    "failed_count": 1,
                    "failed_details": json.dumps([{"shortage_no": shortage_no, "error": str(e)}]),
                    "error_message": str(e)
                })
                raise

    @staticmethod
    def compensate_shortage(
        shortage_no: str,
        compensation_type: CompensationType,
        compensation_amount: float,
        operator: str,
        exchange_product_id: Optional[str] = None,
        exchange_product_name: Optional[str] = None,
        coupon_id: Optional[str] = None,
        coupon_name: Optional[str] = None,
        remark: Optional[str] = None
    ) -> Dict[str, Any]:
        idempotent_key = generate_idempotent_key(
            OperationType.COMPENSATE.value,
            f"{shortage_no}:{compensation_type.value}"
        )

        with get_db_session() as session:
            cached_result = IdempotentService.get_cached_result(session, idempotent_key)
            if cached_result:
                return {
                    "success": True,
                    "message": "重复提交，返回已有结果",
                    "data": cached_result,
                    "is_idempotent": True
                }

            lock = IdempotentService.acquire_lock(
                session, idempotent_key, OperationType.COMPENSATE.value
            )
            if not lock:
                return {
                    "success": False,
                    "message": "操作正在进行中，请稍后重试",
                    "is_idempotent": False
                }

            try:
                shortage = ShortageRepository.get_by_shortage_no(session, shortage_no)
                if not shortage:
                    return {"success": False, "message": "缺货记录不存在"}

                if shortage.status not in [
                    ShortageStatus.CONFIRMED.value,
                    ShortageStatus.COMPENSATED.value
                ]:
                    return {
                        "success": False,
                        "message": f"当前状态{shortage.status}不允许补偿"
                    }

                compensation = CompensationRepository.create(session, {
                    "shortage_id": shortage.id,
                    "compensation_type": compensation_type.value,
                    "compensation_amount": compensation_amount,
                    "exchange_product_id": exchange_product_id,
                    "exchange_product_name": exchange_product_name,
                    "coupon_id": coupon_id,
                    "coupon_name": coupon_name,
                    "operator": operator,
                    "remark": remark
                })

                if shortage.status != ShortageStatus.COMPENSATED.value:
                    ShortageRepository.update_status(
                        session, shortage.id, ShortageStatus.COMPENSATED
                    )

                result = {
                    "compensation_no": compensation.compensation_no,
                    "shortage_no": shortage_no,
                    "compensation_type": compensation_type.value,
                    "compensation_amount": compensation_amount,
                    "operator": operator,
                    "operated_at": compensation.operated_at.isoformat()
                }

                IdempotentService.set_result(session, idempotent_key, result)

                OperationLogRepository.create(session, {
                    "operation_type": OperationType.COMPENSATE.value,
                    "operation_status": OperationStatus.SUCCESS.value,
                    "operator": operator,
                    "total_count": 1,
                    "success_count": 1,
                    "failed_count": 0,
                    "success_ids": json.dumps([compensation.compensation_no])
                })

                return {
                    "success": True,
                    "message": "补偿成功",
                    "data": result,
                    "is_idempotent": False
                }

            except Exception as e:
                OperationLogRepository.create(session, {
                    "operation_type": OperationType.COMPENSATE.value,
                    "operation_status": OperationStatus.FAILED.value,
                    "operator": operator,
                    "total_count": 1,
                    "success_count": 0,
                    "failed_count": 1,
                    "failed_details": json.dumps([{"shortage_no": shortage_no, "error": str(e)}]),
                    "error_message": str(e)
                })
                raise

    @staticmethod
    def rollback_compensation(
        compensation_no: str,
        operator: str,
        remark: Optional[str] = None
    ) -> Dict[str, Any]:
        idempotent_key = generate_idempotent_key(OperationType.ROLLBACK.value, compensation_no)

        with get_db_session() as session:
            cached_result = IdempotentService.get_cached_result(session, idempotent_key)
            if cached_result:
                return {
                    "success": True,
                    "message": "重复提交，返回已有结果",
                    "data": cached_result,
                    "is_idempotent": True
                }

            lock = IdempotentService.acquire_lock(
                session, idempotent_key, OperationType.ROLLBACK.value
            )
            if not lock:
                return {
                    "success": False,
                    "message": "操作正在进行中，请稍后重试",
                    "is_idempotent": False
                }

            try:
                compensation = CompensationRepository.get_by_compensation_no(session, compensation_no)
                if not compensation:
                    return {"success": False, "message": "补偿记录不存在"}

                if compensation.is_rolled_back == 1:
                    result = {
                        "compensation_no": compensation_no,
                        "is_rolled_back": True,
                        "rolled_back_at": compensation.rolled_back_at.isoformat() if compensation.rolled_back_at else None,
                        "rolled_back_by": compensation.rolled_back_by
                    }
                    IdempotentService.set_result(session, idempotent_key, result)
                    return {
                        "success": True,
                        "message": "补偿已回滚过",
                        "data": result,
                        "is_idempotent": True
                    }

                compensation.is_rolled_back = 1
                compensation.rolled_back_at = datetime.now()
                compensation.rolled_back_by = operator
                if remark:
                    compensation.remark = remark
                session.flush()

                shortage = ShortageRepository.get_by_shortage_no(session, compensation.shortage_id)
                if shortage and shortage.status == ShortageStatus.COMPENSATED.value:
                    remaining_compensations = CompensationRepository.get_by_shortage_id(session, shortage.id)
                    if not remaining_compensations:
                        ShortageRepository.update_status(
                            session, shortage.id, ShortageStatus.CONFIRMED
                        )

                result = {
                    "compensation_no": compensation_no,
                    "is_rolled_back": True,
                    "rolled_back_at": datetime.now().isoformat(),
                    "rolled_back_by": operator
                }

                IdempotentService.set_result(session, idempotent_key, result)

                OperationLogRepository.create(session, {
                    "operation_type": OperationType.ROLLBACK.value,
                    "operation_status": OperationStatus.SUCCESS.value,
                    "operator": operator,
                    "total_count": 1,
                    "success_count": 1,
                    "failed_count": 0,
                    "success_ids": json.dumps([compensation_no])
                })

                return {
                    "success": True,
                    "message": "回滚成功",
                    "data": result,
                    "is_idempotent": False
                }

            except Exception as e:
                OperationLogRepository.create(session, {
                    "operation_type": OperationType.ROLLBACK.value,
                    "operation_status": OperationStatus.FAILED.value,
                    "operator": operator,
                    "total_count": 1,
                    "success_count": 0,
                    "failed_count": 1,
                    "failed_details": json.dumps([{"compensation_no": compensation_no, "error": str(e)}]),
                    "error_message": str(e)
                })
                raise

    @staticmethod
    def settle_shortage(
        shortage_no: str,
        operator: str,
        remark: Optional[str] = None
    ) -> Dict[str, Any]:
        idempotent_key = generate_idempotent_key(OperationType.SETTLE.value, shortage_no)

        with get_db_session() as session:
            cached_result = IdempotentService.get_cached_result(session, idempotent_key)
            if cached_result:
                return {
                    "success": True,
                    "message": "重复提交，返回已有结果",
                    "data": cached_result,
                    "is_idempotent": True
                }

            lock = IdempotentService.acquire_lock(
                session, idempotent_key, OperationType.SETTLE.value
            )
            if not lock:
                return {
                    "success": False,
                    "message": "操作正在进行中，请稍后重试",
                    "is_idempotent": False
                }

            try:
                shortage = ShortageRepository.get_by_shortage_no(session, shortage_no)
                if not shortage:
                    return {"success": False, "message": "缺货记录不存在"}

                if shortage.status == ShortageStatus.SETTLED.value:
                    existing_settlement = SettlementRepository.get_by_shortage_id(session, shortage.id)
                    if existing_settlement:
                        result = {
                            "settlement_no": existing_settlement.settlement_no,
                            "shortage_no": shortage_no,
                            "total_compensation_amount": existing_settlement.total_compensation_amount,
                            "settled_at": existing_settlement.operated_at.isoformat(),
                            "operator": existing_settlement.operator
                        }
                        IdempotentService.set_result(session, idempotent_key, result)
                        return {
                            "success": True,
                            "message": "缺货已结算过",
                            "data": result,
                            "is_idempotent": True
                        }

                if shortage.status not in [
                    ShortageStatus.COMPENSATED.value,
                    ShortageStatus.SETTLED.value
                ]:
                    return {
                        "success": False,
                        "message": f"当前状态{shortage.status}不允许结算"
                    }

                compensations = CompensationRepository.get_by_shortage_id(session, shortage.id)
                total_amount = sum(c.compensation_amount for c in compensations)

                settlement = SettlementRepository.create(session, {
                    "shortage_id": shortage.id,
                    "total_compensation_amount": total_amount,
                    "settlement_status": "completed",
                    "operator": operator,
                    "remark": remark
                })

                ShortageRepository.update_status(
                    session, shortage.id, ShortageStatus.SETTLED,
                    settled_by=operator,
                    settled_at=datetime.now()
                )

                result = {
                    "settlement_no": settlement.settlement_no,
                    "shortage_no": shortage_no,
                    "total_compensation_amount": total_amount,
                    "compensation_count": len(compensations),
                    "settled_at": datetime.now().isoformat(),
                    "operator": operator
                }

                IdempotentService.set_result(session, idempotent_key, result)

                OperationLogRepository.create(session, {
                    "operation_type": OperationType.SETTLE.value,
                    "operation_status": OperationStatus.SUCCESS.value,
                    "operator": operator,
                    "total_count": 1,
                    "success_count": 1,
                    "failed_count": 0,
                    "success_ids": json.dumps([shortage_no])
                })

                return {
                    "success": True,
                    "message": "结算成功",
                    "data": result,
                    "is_idempotent": False
                }

            except Exception as e:
                OperationLogRepository.create(session, {
                    "operation_type": OperationType.SETTLE.value,
                    "operation_status": OperationStatus.FAILED.value,
                    "operator": operator,
                    "total_count": 1,
                    "success_count": 0,
                    "failed_count": 1,
                    "failed_details": json.dumps([{"shortage_no": shortage_no, "error": str(e)}]),
                    "error_message": str(e)
                })
                raise


class BatchOperationService:
    @staticmethod
    def batch_identify(
        shortage_list: List[Dict[str, Any]],
        operator: str
    ) -> Dict[str, Any]:
        success_list = []
        failed_list = []

        for item in shortage_list:
            try:
                result = ShortageService.identify_shortage(
                    order_no=item["order_no"],
                    product_id=item["product_id"],
                    product_name=item["product_name"],
                    shortage_quantity=item["shortage_quantity"],
                    shortage_amount=item["shortage_amount"],
                    operator=operator,
                    sku_id=item.get("sku_id"),
                    sku_name=item.get("sku_name"),
                    user_id=item.get("user_id"),
                    user_name=item.get("user_name"),
                    phone=item.get("phone"),
                    total_amount=item.get("total_amount"),
                    remark=item.get("remark")
                )
                if result["success"]:
                    success_list.append({
                        "order_no": item["order_no"],
                        "product_id": item["product_id"],
                        "shortage_no": result["data"]["shortage_no"],
                        "is_idempotent": result.get("is_idempotent", False)
                    })
                else:
                    failed_list.append({
                        "order_no": item["order_no"],
                        "product_id": item["product_id"],
                        "error": result["message"]
                    })
            except Exception as e:
                failed_list.append({
                    "order_no": item.get("order_no", "UNKNOWN"),
                    "product_id": item.get("product_id", "UNKNOWN"),
                    "error": str(e)
                })

        with get_db_session() as session:
            OperationLogRepository.create(session, {
                "operation_type": OperationType.IDENTIFY.value,
                "operation_status": (OperationStatus.SUCCESS.value if not failed_list else
                                     OperationStatus.PARTIAL.value if success_list else
                                     OperationStatus.FAILED.value),
                "operator": operator,
                "total_count": len(shortage_list),
                "success_count": len(success_list),
                "failed_count": len(failed_list),
                "success_ids": json.dumps([s["shortage_no"] for s in success_list]),
                "failed_details": json.dumps(failed_list)
            })

        return {
            "success": True,
            "message": f"批量识别完成，成功{len(success_list)}条，失败{len(failed_list)}条",
            "data": {
                "total": len(shortage_list),
                "success_count": len(success_list),
                "failed_count": len(failed_list),
                "success_list": success_list,
                "failed_list": failed_list
            }
        }

    @staticmethod
    def batch_confirm(
        shortage_no_list: List[str],
        operator: str
    ) -> Dict[str, Any]:
        success_list = []
        failed_list = []

        for shortage_no in shortage_no_list:
            try:
                result = ShortageService.confirm_shortage(shortage_no, operator)
                if result["success"]:
                    success_list.append({
                        "shortage_no": shortage_no,
                        "is_idempotent": result.get("is_idempotent", False)
                    })
                else:
                    failed_list.append({
                        "shortage_no": shortage_no,
                        "error": result["message"]
                    })
            except Exception as e:
                failed_list.append({
                    "shortage_no": shortage_no,
                    "error": str(e)
                })

        with get_db_session() as session:
            OperationLogRepository.create(session, {
                "operation_type": OperationType.CONFIRM.value,
                "operation_status": (OperationStatus.SUCCESS.value if not failed_list else
                                     OperationStatus.PARTIAL.value if success_list else
                                     OperationStatus.FAILED.value),
                "operator": operator,
                "total_count": len(shortage_no_list),
                "success_count": len(success_list),
                "failed_count": len(failed_list),
                "success_ids": json.dumps([s["shortage_no"] for s in success_list]),
                "failed_details": json.dumps(failed_list)
            })

        return {
            "success": True,
            "message": f"批量确认完成，成功{len(success_list)}条，失败{len(failed_list)}条",
            "data": {
                "total": len(shortage_no_list),
                "success_count": len(success_list),
                "failed_count": len(failed_list),
                "success_list": success_list,
                "failed_list": failed_list
            }
        }

    @staticmethod
    def batch_compensate(
        compensation_list: List[Dict[str, Any]],
        operator: str
    ) -> Dict[str, Any]:
        success_list = []
        failed_list = []

        for item in compensation_list:
            try:
                result = ShortageService.compensate_shortage(
                    shortage_no=item["shortage_no"],
                    compensation_type=CompensationType(item["compensation_type"]),
                    compensation_amount=item["compensation_amount"],
                    operator=operator,
                    exchange_product_id=item.get("exchange_product_id"),
                    exchange_product_name=item.get("exchange_product_name"),
                    coupon_id=item.get("coupon_id"),
                    coupon_name=item.get("coupon_name"),
                    remark=item.get("remark")
                )
                if result["success"]:
                    success_list.append({
                        "shortage_no": item["shortage_no"],
                        "compensation_no": result["data"]["compensation_no"],
                        "is_idempotent": result.get("is_idempotent", False)
                    })
                else:
                    failed_list.append({
                        "shortage_no": item["shortage_no"],
                        "error": result["message"]
                    })
            except Exception as e:
                failed_list.append({
                    "shortage_no": item.get("shortage_no", "UNKNOWN"),
                    "error": str(e)
                })

        with get_db_session() as session:
            OperationLogRepository.create(session, {
                "operation_type": OperationType.COMPENSATE.value,
                "operation_status": (OperationStatus.SUCCESS.value if not failed_list else
                                     OperationStatus.PARTIAL.value if success_list else
                                     OperationStatus.FAILED.value),
                "operator": operator,
                "total_count": len(compensation_list),
                "success_count": len(success_list),
                "failed_count": len(failed_list),
                "success_ids": json.dumps([s["compensation_no"] for s in success_list]),
                "failed_details": json.dumps(failed_list)
            })

        return {
            "success": True,
            "message": f"批量补偿完成，成功{len(success_list)}条，失败{len(failed_list)}条",
            "data": {
                "total": len(compensation_list),
                "success_count": len(success_list),
                "failed_count": len(failed_list),
                "success_list": success_list,
                "failed_list": failed_list
            }
        }


class QueryExportService:
    @staticmethod
    def query_shortages(
        status: Optional[str] = None,
        operator: Optional[str] = None,
        start_time: Optional[str] = None,
        end_time: Optional[str] = None,
        order_no: Optional[str] = None,
        page: int = 1,
        page_size: int = 50
    ) -> Dict[str, Any]:
        start_dt = datetime.fromisoformat(start_time) if start_time else None
        end_dt = datetime.fromisoformat(end_time) if end_time else None

        with get_db_session() as session:
            result = ShortageRepository.query(
                session, status=status, operator=operator,
                start_time=start_dt, end_time=end_dt,
                order_no=order_no, page=page, page_size=page_size
            )

            records = []
            for shortage in result["records"]:
                records.append({
                    "shortage_no": shortage.shortage_no,
                    "order_no": shortage.order.order_no,
                    "product_id": shortage.product_id,
                    "product_name": shortage.product_name,
                    "sku_id": shortage.sku_id,
                    "sku_name": shortage.sku_name,
                    "shortage_quantity": shortage.shortage_quantity,
                    "shortage_amount": shortage.shortage_amount,
                    "status": shortage.status,
                    "identified_by": shortage.identified_by,
                    "identified_at": shortage.identified_at.isoformat() if shortage.identified_at else None,
                    "confirmed_by": shortage.confirmed_by,
                    "confirmed_at": shortage.confirmed_at.isoformat() if shortage.confirmed_at else None,
                    "settled_by": shortage.settled_by,
                    "settled_at": shortage.settled_at.isoformat() if shortage.settled_at else None,
                    "created_at": shortage.created_at.isoformat()
                })

            return {
                "success": True,
                "data": {
                    "total": result["total"],
                    "page": result["page"],
                    "page_size": result["page_size"],
                    "records": records
                }
            }

    @staticmethod
    def export_shortages(
        status: Optional[str] = None,
        operator: Optional[str] = None,
        start_time: Optional[str] = None,
        end_time: Optional[str] = None,
        order_no: Optional[str] = None,
        file_format: str = "csv"
    ) -> Dict[str, Any]:
        result = QueryExportService.query_shortages(
            status=status, operator=operator,
            start_time=start_time, end_time=end_time,
            order_no=order_no, page=1, page_size=10000
        )

        if not result["success"]:
            return result

        records = result["data"]["records"]

        if file_format == "csv":
            import csv
            import io
            output = io.StringIO()
            if records:
                writer = csv.DictWriter(output, fieldnames=records[0].keys())
                writer.writeheader()
                writer.writerows(records)
            csv_content = output.getvalue()

            return {
                "success": True,
                "data": {
                    "format": "csv",
                    "total_count": len(records),
                    "content": csv_content
                }
            }
        else:
            return {
                "success": True,
                "data": {
                    "format": "json",
                    "total_count": len(records),
                    "content": json.dumps(records, ensure_ascii=False, indent=2)
                }
            }

    @staticmethod
    def query_operation_logs(
        operation_type: Optional[str] = None,
        operation_status: Optional[str] = None,
        operator: Optional[str] = None,
        start_time: Optional[str] = None,
        end_time: Optional[str] = None,
        page: int = 1,
        page_size: int = 50
    ) -> Dict[str, Any]:
        start_dt = datetime.fromisoformat(start_time) if start_time else None
        end_dt = datetime.fromisoformat(end_time) if end_time else None

        with get_db_session() as session:
            result = OperationLogRepository.query(
                session, operation_type=operation_type,
                operation_status=operation_status, operator=operator,
                start_time=start_dt, end_time=end_dt,
                page=page, page_size=page_size
            )

            records = []
            for log in result["records"]:
                records.append({
                    "batch_no": log.batch_no,
                    "operation_type": log.operation_type,
                    "operation_status": log.operation_status,
                    "operator": log.operator,
                    "total_count": log.total_count,
                    "success_count": log.success_count,
                    "failed_count": log.failed_count,
                    "success_ids": json.loads(log.success_ids) if log.success_ids else [],
                    "failed_details": json.loads(log.failed_details) if log.failed_details else [],
                    "operated_at": log.operated_at.isoformat()
                })

            return {
                "success": True,
                "data": {
                    "total": result["total"],
                    "page": result["page"],
                    "page_size": result["page_size"],
                    "records": records
                }
            }

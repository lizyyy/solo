from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import json
import hashlib
import time
from typing import List, Optional, Tuple
import models
import schemas


class CacheService:
    CACHE_TTL_MINUTES = 5

    @staticmethod
    def get_cache(db: Session, cache_key: str) -> Optional[dict]:
        cache = db.query(models.CacheState).filter(
            models.CacheState.cache_key == cache_key
        ).first()
        
        if not cache:
            return None
        
        now = datetime.utcnow()
        is_expired = cache.expire_time and cache.expire_time < now
        is_stale = cache.is_stale or is_expired
        
        if is_stale:
            return None
        
        try:
            return json.loads(cache.cache_value)
        except:
            return None

    @staticmethod
    def set_cache(db: Session, cache_key: str, value: dict, ttl_minutes: int = None):
        ttl = CacheService.CACHE_TTL_MINUTES if ttl_minutes is None else ttl_minutes
        expire_time = datetime.utcnow() + timedelta(minutes=ttl)
        
        cache = db.query(models.CacheState).filter(
            models.CacheState.cache_key == cache_key
        ).first()
        
        if cache:
            cache.cache_value = json.dumps(value)
            cache.last_refresh_time = datetime.utcnow()
            cache.expire_time = expire_time
            cache.is_stale = False
            cache.refresh_count += 1
        else:
            cache = models.CacheState(
                cache_key=cache_key,
                cache_value=json.dumps(value),
                expire_time=expire_time,
                is_stale=False,
                refresh_count=1
            )
            db.add(cache)
        
        db.commit()

    @staticmethod
    def mark_cache_stale(db: Session, cache_key: str):
        cache = db.query(models.CacheState).filter(
            models.CacheState.cache_key == cache_key
        ).first()
        
        if cache:
            cache.is_stale = True
            db.commit()

    @staticmethod
    def is_cache_stale(db: Session, cache_key: str) -> bool:
        cache = db.query(models.CacheState).filter(
            models.CacheState.cache_key == cache_key
        ).first()
        
        if not cache:
            return True
        
        now = datetime.utcnow()
        is_expired = cache.expire_time and cache.expire_time <= now
        return cache.is_stale or is_expired

    @staticmethod
    def get_cache_status(db: Session, cache_key: str) -> Optional[models.CacheState]:
        return db.query(models.CacheState).filter(
            models.CacheState.cache_key == cache_key
        ).first()


class TenantSuspenderService:
    @staticmethod
    def create_tenant(db: Session, tenant: schemas.TenantCreate) -> models.Tenant:
        db_tenant = models.Tenant(**tenant.model_dump())
        db.add(db_tenant)
        db.commit()
        db.refresh(db_tenant)
        return db_tenant

    @staticmethod
    def get_tenant_by_code(db: Session, tenant_code: str) -> Optional[models.Tenant]:
        return db.query(models.Tenant).filter(
            models.Tenant.tenant_code == tenant_code
        ).first()

    @staticmethod
    def backfill_sms_records(
        db: Session,
        request: schemas.SmsBackfillRequest
    ) -> Tuple[schemas.ProcessingResult, List[str]]:
        start_time = time.time()
        errors = []
        success_count = 0
        failed_count = 0
        
        tenant_cache_key = f"tenant:{request.tenant_code}:status"
        cache_stale = CacheService.is_cache_stale(db, tenant_cache_key)
        
        input_summary = (
            f"批次号:{request.batch_no}, "
            f"租户:{request.tenant_code}, "
            f"部门:{request.department}, "
            f"提交人:{request.submitted_by}, "
            f"记录数:{len(request.records)}"
        )
        
        cached_tenant = CacheService.get_cache(db, tenant_cache_key)
        if not cached_tenant:
            tenant = TenantSuspenderService.get_tenant_by_code(db, request.tenant_code)
            if tenant:
                CacheService.set_cache(db, tenant_cache_key, {
                    "tenant_code": tenant.tenant_code,
                    "status": tenant.status,
                    "department": tenant.department
                })
                cache_stale = False
            else:
                errors.append(f"租户 {request.tenant_code} 不存在，且缓存未刷新")
                failed_count = len(request.records)
                
                processing_log = models.ProcessingLog(
                    batch_no=request.batch_no,
                    tenant_code=request.tenant_code,
                    action="SMS_BACKFILL",
                    status=schemas.ProcessingStatus.CACHE_STALE.value,
                    input_summary=input_summary,
                    action_details="租户信息缓存失效，无法验证租户状态",
                    conclusion="补录失败：缓存未刷新",
                    error_message="; ".join(errors),
                    executed_by=request.submitted_by,
                    duration_ms=int((time.time() - start_time) * 1000)
                )
                db.add(processing_log)
                db.commit()
                db.refresh(processing_log)
                
                return schemas.ProcessingResult(
                    batch_no=request.batch_no,
                    tenant_code=request.tenant_code,
                    status=schemas.ProcessingStatus.CACHE_STALE.value,
                    total_records=len(request.records),
                    success_count=0,
                    failed_count=failed_count,
                    log_id=processing_log.id,
                    summary="租户缓存未刷新，补录中断",
                    cache_status="STALE",
                    error_details=errors
                ), errors
        
        for idx, record in enumerate(request.records):
            try:
                db_record = models.SmsSendRecord(
                    batch_no=request.batch_no,
                    tenant_code=request.tenant_code,
                    phone_number=record.phone_number,
                    content=record.content,
                    send_time=record.send_time or datetime.utcnow(),
                    operator=record.operator,
                    department=request.department,
                    remark=record.remark,
                    is_backfill=True
                )
                db.add(db_record)
                success_count += 1
            except Exception as e:
                failed_count += 1
                errors.append(f"记录{idx+1}: {str(e)}")
        
        db.flush()
        
        action_details = (
            f"成功补录{success_count}条, "
            f"失败{failed_count}条, "
            f"缓存状态:{'已刷新' if not cache_stale else '未刷新'}"
        )
        
        conclusion = TenantSuspenderService._generate_conclusion(
            success_count, failed_count, cache_stale, request
        )
        
        logistics_ref = f"LOGISTICS-{request.batch_no}-SAMPLE-001"
        
        final_status = TenantSuspenderService._determine_status(
            success_count, failed_count, cache_stale, len(request.records)
        )
        
        processing_log = models.ProcessingLog(
            batch_no=request.batch_no,
            tenant_code=request.tenant_code,
            action="SMS_BACKFILL",
            status=final_status,
            input_summary=input_summary,
            action_details=action_details,
            conclusion=conclusion,
            error_message="; ".join(errors) if errors else None,
            logistics_screenshot_ref=logistics_ref,
            executed_by=request.submitted_by,
            duration_ms=int((time.time() - start_time) * 1000)
        )
        db.add(processing_log)
        
        summary_content = TenantSuspenderService._generate_material_summary(
            request, success_count, failed_count, conclusion
        )
        material_summary = models.MaterialSummary(
            batch_no=request.batch_no,
            tenant_code=request.tenant_code,
            summary_content=summary_content,
            material_count=success_count,
            export_token=hashlib.md5(request.batch_no.encode()).hexdigest()
        )
        db.add(material_summary)
        
        db.commit()
        db.refresh(processing_log)
        
        return schemas.ProcessingResult(
            batch_no=request.batch_no,
            tenant_code=request.tenant_code,
            status=final_status,
            total_records=len(request.records),
            success_count=success_count,
            failed_count=failed_count,
            log_id=processing_log.id,
            summary=conclusion,
            cache_status="FRESH" if not cache_stale else "STALE",
            error_details=errors if errors else None
        ), errors

    @staticmethod
    def _determine_status(success: int, failed: int, cache_stale: bool, total: int) -> str:
        if cache_stale and failed > 0:
            return schemas.ProcessingStatus.CACHE_STALE.value
        if failed == total:
            return schemas.ProcessingStatus.FAILED.value
        if failed > 0:
            return schemas.ProcessingStatus.PARTIAL_SUCCESS.value
        return schemas.ProcessingStatus.SUCCESS.value

    @staticmethod
    def _generate_conclusion(success_count: int, failed_count: int, cache_stale: bool,
                            request: schemas.SmsBackfillRequest) -> str:
        parts = []
        parts.append(f"【租户暂停补录结论】批次{request.batch_no}")
        parts.append(f"提交部门：{request.department}")
        parts.append(f"提交人：{request.submitted_by}")
        parts.append(f"处理结果：成功{success_count}条，失败{failed_count}条")
        
        if cache_stale:
            parts.append("⚠️ 警告：租户状态缓存未及时刷新，可能存在数据不一致风险")
        
        if success_count > 0:
            parts.append("✓ 已成功记录短信发送清单，可用于后续租户暂停核验")
        
        if failed_count > 0:
            parts.append("✗ 部分记录补录失败，请检查错误详情并重试")
        
        return " | ".join(parts)

    @staticmethod
    def _generate_material_summary(request: schemas.SmsBackfillRequest,
                                   success_count: int, failed_count: int,
                                   conclusion: str) -> str:
        summary_parts = []
        summary_parts.append("=" * 60)
        summary_parts.append("租户暂停器 - 材料摘要导出")
        summary_parts.append("=" * 60)
        summary_parts.append("")
        summary_parts.append("【输入材料】")
        summary_parts.append(f"  批次号: {request.batch_no}")
        summary_parts.append(f"  租户编码: {request.tenant_code}")
        summary_parts.append(f"  提交部门: {request.department}")
        summary_parts.append(f"  提交人: {request.submitted_by}")
        summary_parts.append(f"  短信记录数: {len(request.records)}条")
        summary_parts.append("")
        summary_parts.append("【执行动作】")
        summary_parts.append("  动作类型: 短信发送清单补录")
        summary_parts.append(f"  成功记录: {success_count}条")
        summary_parts.append(f"  失败记录: {failed_count}条")
        summary_parts.append("")
        summary_parts.append("【处理结论】")
        summary_parts.append(f"  {conclusion}")
        summary_parts.append("")
        summary_parts.append("【物流拦截复核样例】")
        summary_parts.append("  截图编号: LOGISTICS-{}-SAMPLE-001".format(request.batch_no))
        summary_parts.append("  复核说明: 请核对物流拦截记录中的收件人电话")
        summary_parts.append("  是否与短信发送清单中的号码一致")
        summary_parts.append("  复核状态: □ 一致  □ 不一致  □ 需进一步核实")
        summary_parts.append("")
        summary_parts.append("=" * 60)
        summary_parts.append(f"导出时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        
        return "\n".join(summary_parts)

    @staticmethod
    def query_processing_records(
        db: Session,
        batch_no: Optional[str] = None,
        tenant_code: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[models.ProcessingLog]:
        query = db.query(models.ProcessingLog)
        
        if batch_no:
            query = query.filter(models.ProcessingLog.batch_no == batch_no)
        if tenant_code:
            query = query.filter(models.ProcessingLog.tenant_code == tenant_code)
        if status:
            query = query.filter(models.ProcessingLog.status == status)
        
        return query.order_by(models.ProcessingLog.created_at.desc()).all()

    @staticmethod
    def get_material_summary(db: Session, batch_no: str) -> Optional[models.MaterialSummary]:
        return db.query(models.MaterialSummary).filter(
            models.MaterialSummary.batch_no == batch_no
        ).first()

    @staticmethod
    def get_all_sms_records(db: Session, batch_no: str) -> List[models.SmsSendRecord]:
        return db.query(models.SmsSendRecord).filter(
            models.SmsSendRecord.batch_no == batch_no
        ).all()

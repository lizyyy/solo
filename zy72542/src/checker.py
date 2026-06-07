import re
import uuid
import httpx
from datetime import datetime
from typing import List, Tuple
from sqlmodel import Session, select
from .models import QARecord, CheckResult, OperationLog


DISCLAIMER_PATTERNS = [
    r"免责声明",
    r"仅供参考",
    r"不构成法律意见",
    r"建议咨询专业律师",
    r"具体以法律规定为准",
    r"本回答仅供参考",
    r"不承担任何法律责任",
]


def has_disclaimer(answer: str) -> Tuple[bool, str]:
    found = []
    for pattern in DISCLAIMER_PATTERNS:
        if re.search(pattern, answer):
            found.append(pattern)
    return len(found) > 0, "、".join(found)


async def check_url_validity(url: str, timeout: int = 5) -> Tuple[bool, str]:
    if not url or not url.startswith(("http://", "https://")):
        return False, "URL格式不正确"
    try:
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            response = await client.head(url)
            if response.status_code == 404:
                return False, "404 Not Found"
            elif response.status_code >= 400:
                return False, f"HTTP {response.status_code}"
            return True, "正常"
    except httpx.ConnectError:
        return False, "连接失败"
    except httpx.TimeoutException:
        return False, "请求超时"
    except Exception as e:
        return False, str(e)


def log_operation(
    session: Session,
    qa_record_id: int,
    operation_type: str,
    operator: str,
    field_name: str = None,
    old_value: str = None,
    new_value: str = None,
    reason: str = None,
    run_id: str = None,
):
    log = OperationLog(
        qa_record_id=qa_record_id,
        operation_type=operation_type,
        operator=operator,
        field_name=field_name,
        old_value=old_value,
        new_value=new_value,
        reason=reason,
        run_id=run_id,
    )
    session.add(log)


async def run_single_check(
    session: Session,
    qa_record: QARecord,
    operator: str = "system",
    run_id: str = None,
) -> QARecord:
    if run_id is None:
        run_id = str(uuid.uuid4())[:8]

    old_status = qa_record.status

    has_disc, disc_found = has_disclaimer(qa_record.answer)
    qa_record.has_disclaimer = has_disc
    qa_record.disclaimer_text = disc_found

    check_disclaimer = CheckResult(
        qa_record_id=qa_record.id,
        check_type="disclaimer_check",
        check_passed=has_disc,
        details=f"检测到免责声明关键词: {disc_found}" if has_disc else "未检测到免责声明",
        checked_by=operator,
        run_id=run_id,
    )
    session.add(check_disclaimer)

    if qa_record.reference_url:
        url_valid, url_msg = await check_url_validity(qa_record.reference_url)
        qa_record.url_status = "valid" if url_valid else "invalid"
        qa_record.url_error = url_msg

        check_url = CheckResult(
            qa_record_id=qa_record.id,
            check_type="url_check",
            check_passed=url_valid,
            details=url_msg,
            checked_by=operator,
            run_id=run_id,
        )
        session.add(check_url)

    if not qa_record.has_disclaimer:
        qa_record.status = "failed"
        qa_record.conflict_reason = "未包含法律免责声明"
        qa_record.missing_materials = "需要补充免责声明"
        qa_record.next_action = "editor_review"
    elif qa_record.reference_url and qa_record.url_status == "invalid":
        qa_record.status = "conflict"
        qa_record.conflict_reason = f"引用链接异常({qa_record.url_error})但系统未拦截，需人工复核"
        qa_record.missing_materials = "需要确认链接有效性是否影响回答准确性"
        qa_record.next_action = "pm_review"
    else:
        qa_record.status = "passed"
        qa_record.next_action = "complete"

    qa_record.updated_at = datetime.now()

    log_operation(
        session,
        qa_record.id,
        "check_run",
        operator,
        field_name="status",
        old_value=old_status,
        new_value=qa_record.status,
        reason=f"执行检查，run_id={run_id}",
        run_id=run_id,
    )

    session.add(qa_record)
    session.commit()
    session.refresh(qa_record)
    return qa_record


async def run_batch_check(
    session: Session,
    record_ids: List[int] = None,
    operator: str = "system",
) -> str:
    run_id = str(uuid.uuid4())[:8]

    if record_ids:
        statement = select(QARecord).where(QARecord.id.in_(record_ids))
    else:
        statement = select(QARecord)

    records = session.exec(statement).all()

    for record in records:
        await run_single_check(session, record, operator=operator, run_id=run_id)

    return run_id


def update_gray_batch(
    session: Session,
    qa_record_id: int,
    gray_batch: str,
    operator: str,
    reason: str = None,
) -> QARecord:
    record = session.get(QARecord, qa_record_id)
    if not record:
        raise ValueError(f"记录 {qa_record_id} 不存在")

    old_gray = record.gray_batch
    record.gray_batch = gray_batch
    record.updated_at = datetime.now()

    if record.status == "conflict" and gray_batch:
        if record.url_status == "invalid":
            record.conflict_reason = f"灰度批次[{gray_batch}]补录后确认：引用链接异常({record.url_error})仍被判通过，需产品经理确认是否调整规则"
            record.missing_materials = "产品经理需确认：失效链接是否影响回答的合规性"
            record.next_action = "pm_review"

    log_operation(
        session,
        record.id,
        "field_update",
        operator,
        field_name="gray_batch",
        old_value=str(old_gray),
        new_value=gray_batch,
        reason=reason or "补录灰度批次信息",
    )

    session.add(record)
    session.commit()
    session.refresh(record)
    return record


def manual_fix(
    session: Session,
    qa_record_id: int,
    operator: str,
    new_status: str = None,
    review_comment: str = None,
    next_action: str = None,
    reason: str = None,
) -> QARecord:
    record = session.get(QARecord, qa_record_id)
    if not record:
        raise ValueError(f"记录 {qa_record_id} 不存在")

    old_status = record.status

    if new_status:
        record.status = new_status
    if review_comment:
        record.review_comment = review_comment
    if next_action:
        record.next_action = next_action

    record.reviewer = operator
    record.updated_at = datetime.now()

    log_operation(
        session,
        record.id,
        "manual_fix",
        operator,
        field_name="status",
        old_value=old_status,
        new_value=record.status,
        reason=reason or "人工修正",
    )

    session.add(record)
    session.commit()
    session.refresh(record)
    return record


def import_qa_records(
    session: Session,
    records_data: List[dict],
    source_batch: str,
    operator: str,
) -> List[QARecord]:
    imported = []
    for data in records_data:
        record = QARecord(
            question=data["question"],
            answer=data["answer"],
            reference_url=data.get("reference_url"),
            desensitization_notes=data.get("desensitization_notes"),
            source_batch=source_batch,
            status="pending",
        )
        session.add(record)
        session.flush()

        log_operation(
            session,
            record.id,
            "import",
            operator,
            reason=f"从批次 {source_batch} 导入",
        )
        imported.append(record)

    session.commit()
    for record in imported:
        session.refresh(record)
    return imported

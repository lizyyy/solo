import uuid
from datetime import datetime
from typing import List, Optional, Tuple

from models import (
    CopyrightReminder,
    JielongRecord,
    ContractScreenshot,
    ConflictEvidence,
    SplitDetail,
    HistoryEntry,
    RecordSource,
    ProcessingStatus,
    ConfirmAction,
)


def generate_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


def add_history(
    reminder: CopyrightReminder,
    source: RecordSource,
    action: str,
    operator: str,
    detail: str = "",
) -> None:
    entry = HistoryEntry(
        entry_id=generate_id("HIS"),
        record_id=reminder.record_id,
        source=source,
        action=action,
        operator=operator,
        detail=detail,
    )
    reminder.history.append(entry)
    reminder.updated_at = datetime.now()


def parse_jielong(raw_content: str, performer_name: str, performance_date: str, program_name: str) -> JielongRecord:
    lines = raw_content.strip().split("\n")
    copyright_status = "未知"
    remark = ""

    for line in lines:
        if "版权" in line and "到期" in line:
            copyright_status = line.strip()
        if "备注" in line or "说明" in line:
            remark = line.strip()

    return JielongRecord(
        record_id=generate_id("JL"),
        performer_name=performer_name,
        performance_date=performance_date,
        program_name=program_name,
        copyright_status=copyright_status,
        remark=remark,
        raw_content=raw_content,
    )


def import_jielong(
    reminder: CopyrightReminder,
    jielong: JielongRecord,
    operator: str = "系统导入",
) -> None:
    reminder.jielong = jielong
    reminder.status = ProcessingStatus.PENDING

    full_text = jielong.remark + " " + jielong.raw_content
    is_temp_substitute = "临时替补" in full_text
    is_rare = ("罕见边角料" in full_text) and ("不是罕见边角料" not in full_text)

    if is_temp_substitute and not is_rare:
        reminder.status = ProcessingStatus.NEED_REVIEW
        reminder.review_note = "临时替补仅在群内通知，待票务同事复核"
        add_history(
            reminder,
            RecordSource.TEMP_SUBSTITUTE,
            "标记待复核",
            operator,
            "临时替补仅在群内说了一句，不是罕见边角料，留票务复核",
        )
    else:
        add_history(
            reminder,
            RecordSource.GROUP_JIELONG,
            "接龙导入",
            operator,
            f"导入排练群接龙记录: {jielong.copyright_status}",
        )


def parse_contract_screenshot(
    record_id: str,
    contract_no: str,
    valid_until: str,
    copyright_owner: str,
    old_caliber: bool = False,
    raw_ref: str = "",
) -> ContractScreenshot:
    return ContractScreenshot(
        screenshot_id=generate_id("CT"),
        record_id=record_id,
        contract_no=contract_no,
        valid_until=valid_until,
        copyright_owner=copyright_owner,
        old_caliber=old_caliber,
        raw_screenshot_ref=raw_ref,
    )


def _extract_date(text: str) -> str:
    import re
    pattern = r'\d{4}-\d{2}-\d{2}'
    match = re.search(pattern, text)
    return match.group(0) if match else ""


def detect_conflicts(
    jielong: JielongRecord,
    contract: ContractScreenshot,
) -> List[ConflictEvidence]:
    conflicts = []

    jielong_date = _extract_date(jielong.copyright_status)
    if jielong_date and contract.valid_until and jielong_date != contract.valid_until:
        conflicts.append(
            ConflictEvidence(
                field_name="版权到期日",
                jielong_value=jielong_date,
                screenshot_value=contract.valid_until,
                description="接龙记录与合同截图的版权到期日期不一致",
            )
        )

    if contract.old_caliber:
        conflicts.append(
            ConflictEvidence(
                field_name="计算口径",
                jielong_value="按当前标准口径",
                screenshot_value="旧口径",
                description="合同截图为旧口径标准，需确认是否适用",
            )
        )

    return conflicts


def upload_contract(
    reminder: CopyrightReminder,
    contract: ContractScreenshot,
    operator: str = "版权运营小鹿",
) -> Tuple[ProcessingStatus, List[ConflictEvidence]]:
    reminder.contract = contract
    conflicts = []

    if reminder.jielong:
        conflicts = detect_conflicts(reminder.jielong, contract)

    if conflicts:
        reminder.conflicts = conflicts
        reminder.status = ProcessingStatus.CONFLICT
        add_history(
            reminder,
            RecordSource.CONTRACT_SCREENSHOT,
            "合同截图上传-发现冲突",
            operator,
            f"发现 {len(conflicts)} 处信息冲突，待版权运营确认",
        )
    elif contract.old_caliber:
        reminder.status = ProcessingStatus.OLD_RULE
        add_history(
            reminder,
            RecordSource.CONTRACT_SCREENSHOT,
            "合同截图上传-旧口径",
            operator,
            "旧口径合同截图补录完成",
        )
    else:
        if reminder.status == ProcessingStatus.NEED_REVIEW:
            add_history(
                reminder,
                RecordSource.CONTRACT_SCREENSHOT,
                "合同截图上传",
                operator,
                "合同已补录，但仍需票务复核临时替补事项",
            )
        else:
            reminder.status = ProcessingStatus.NORMAL
            add_history(
                reminder,
                RecordSource.CONTRACT_SCREENSHOT,
                "合同截图上传",
                operator,
                "合同截图信息核对一致，进入正常流程",
            )

    return reminder.status, conflicts


def resolve_conflict(
    reminder: CopyrightReminder,
    action: ConfirmAction,
    operator: str = "版权运营小鹿",
    resolve_note: str = "",
) -> None:
    if action == ConfirmAction.CONFIRM:
        reminder.status = ProcessingStatus.CONFIRMED
        reminder.conflicts = []
        add_history(
            reminder,
            RecordSource.MANUAL_CONFIRM,
            "冲突确认",
            operator,
            f"版权运营确认以合同截图为准。{resolve_note}",
        )
    else:
        reminder.status = ProcessingStatus.REJECTED
        add_history(
            reminder,
            RecordSource.MANUAL_CONFIRM,
            "冲突驳回",
            operator,
            f"版权运营驳回，合同截图无效。{resolve_note}",
        )


def ticket_review(
    reminder: CopyrightReminder,
    passed: bool,
    operator: str = "票务同事",
    review_note: str = "",
) -> None:
    if passed:
        if reminder.contract:
            if reminder.contract.old_caliber:
                reminder.status = ProcessingStatus.OLD_RULE
            else:
                reminder.status = ProcessingStatus.NORMAL
        else:
            reminder.status = ProcessingStatus.NORMAL
        add_history(
            reminder,
            RecordSource.MANUAL_CONFIRM,
            "票务复核通过",
            operator,
            f"临时替补事项复核通过。{review_note}",
        )
    else:
        reminder.status = ProcessingStatus.REJECTED
        add_history(
            reminder,
            RecordSource.MANUAL_CONFIRM,
            "票务复核不通过",
            operator,
            f"临时替补事项复核不通过。{review_note}",
        )


def calculate_split(
    reminder: CopyrightReminder,
    amount: float,
    split_ratio: str,
    payee: str,
    operator: str = "系统",
) -> SplitDetail:
    version = len(reminder.split_details) + 1
    detail = SplitDetail(
        detail_id=generate_id("SD"),
        record_id=reminder.record_id,
        amount=amount,
        split_ratio=split_ratio,
        payee=payee,
        version=version,
    )
    reminder.split_details.append(detail)
    reminder.status = ProcessingStatus.COMPLETED

    caliber_note = "旧口径" if (reminder.contract and reminder.contract.old_caliber) else "标准口径"
    add_history(
        reminder,
        RecordSource.MANUAL_CONFIRM,
        "分账明细更新",
        operator,
        f"{caliber_note}计算：金额{amount}，比例{split_ratio}，收款人{payee}",
    )

    return detail


def trace_by_sources(reminder: CopyrightReminder) -> dict:
    sources = {
        RecordSource.GROUP_JIELONG: [],
        RecordSource.CONTRACT_SCREENSHOT: [],
        RecordSource.MANUAL_CONFIRM: [],
        RecordSource.TEMP_SUBSTITUTE: [],
    }
    for entry in reminder.history:
        if entry.source in sources:
            sources[entry.source].append(entry)
    return sources


def create_reminder(performer_name: str, performance_date: str, program_name: str) -> CopyrightReminder:
    return CopyrightReminder(
        record_id=generate_id("CR"),
        performer_name=performer_name,
        performance_date=performance_date,
        program_name=program_name,
    )

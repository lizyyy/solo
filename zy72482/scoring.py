from typing import List, Tuple, Optional, Dict, Any
from models import ComplaintRecord


BASE_SUGGESTIONS_NORMAL = [
    "快递柜选址符合无障碍通行要求",
    "建议定期检查坡道维护情况"
]

BASE_SUGGESTIONS_ISSUES = [
    "快递柜选址存在无障碍通行障碍",
    "需增设无障碍坡道或调整柜位",
    "建议设置醒目标识指引视障人士"
]

OLD_CALIBER_KEYWORDS = ["历史遗留", "旧口径", "2019标准", "原规定", "老标准"]


def calculate_score(record: ComplaintRecord) -> Tuple[int, List[str], bool, bool]:
    score = 60
    issues_found = []
    review_needed = False
    old_caliber = False

    if record.ramp_exist is True:
        score += 15
    elif record.ramp_exist is False:
        score -= 20
        issues_found.append("缺少无障碍坡道")
    else:
        score -= 5
        issues_found.append("坡道情况待确认")

    if record.photo_remarks:
        if any(kw in record.photo_remarks for kw in OLD_CALIBER_KEYWORDS):
            old_caliber = True
            score += 10
            issues_found.append("按历史口径处理")
        if "积水" in record.photo_remarks:
            score -= 10
            issues_found.append("雨天易积水，影响通行")
        if "台阶" in record.photo_remarks and record.ramp_exist is not True:
            score -= 15
            issues_found.append("存在台阶无坡道补偿")
        if "盲道" in record.photo_remarks and "阻断" in record.photo_remarks:
            score -= 10
            issues_found.append("盲道被阻断")
        if "轮椅" in record.photo_remarks and "困难" in record.photo_remarks:
            score -= 15
            issues_found.append("轮椅通行困难")
        if "狭窄" in record.photo_remarks:
            score -= 5
            issues_found.append("通道偏窄")
        if record.photo_remarks.strip():
            score += 5

    if record.ramp_remarks:
        if "损坏" in record.ramp_remarks:
            score -= 10
            issues_found.append("坡道有损坏")
        if "坡度" in record.ramp_remarks and "陡" in record.ramp_remarks:
            score -= 8
            issues_found.append("坡度过陡")
        if "扶手" in record.ramp_remarks and "无" in record.ramp_remarks:
            score -= 5
            issues_found.append("坡道无扶手")

    score = max(0, min(100, score))

    if score >= 60:
        suggestions = BASE_SUGGESTIONS_NORMAL.copy()
    else:
        suggestions = BASE_SUGGESTIONS_ISSUES.copy()

    for issue in issues_found:
        if issue == "按历史口径处理":
            suggestions.append("本记录适用旧口径标准，已标注")
        else:
            suggestions.append(f"整改重点：{issue}")

    if record.ramp_exist is not None and record.initial_score is not None:
        if abs(score - record.initial_score) <= 3:
            review_needed = True
            suggestions.append("⚠️ 坡道补录后评分变化不明显，需人工复核")

    return score, suggestions, review_needed, old_caliber


def apply_ramp_supplement(record: ComplaintRecord, ramp_exist: bool,
                          ramp_remarks: str = "", run_id: str = "") -> ComplaintRecord:
    before = record.snapshot_fields()
    old_score = record.current_score

    record.ramp_exist = ramp_exist
    record.ramp_remarks = ramp_remarks

    new_score, suggestions, review_needed, old_caliber = calculate_score(record)

    if record.initial_score is None:
        record.initial_score = new_score

    score_diff = new_score - old_score if old_score is not None else 0

    record.current_score = new_score
    record.suggestions = suggestions
    record.review_needed = review_needed
    old_status = record.status
    record.status = "ramp_supplemented"

    after = record.snapshot_fields()

    reason = f"坡道补录：存在={ramp_exist}"
    if ramp_remarks:
        reason += f"，备注={ramp_remarks}"
    if abs(score_diff) <= 3 and old_score is not None:
        reason += "；评分变化≤3分，不自动归正常，留待复核"

    details = f"原评分={old_score}，新评分={new_score}，变化={score_diff:+d}"

    record.add_log(
        operator="system",
        action="ramp_supplement",
        details=details,
        before=before,
        after=after,
        reason=reason,
        run_id=run_id
    )

    return record


def apply_photo_supplement(record: ComplaintRecord, photo_remarks: str,
                           photo_urls: Optional[List[str]] = None,
                           run_id: str = "") -> ComplaintRecord:
    before = record.snapshot_fields()
    old_suggestions = record.suggestions.copy()

    old_photo_remarks = record.photo_remarks
    record.photo_remarks = photo_remarks
    if photo_urls:
        record.photo_urls.extend(photo_urls)

    new_score, suggestions, review_needed, old_caliber = calculate_score(record)

    if record.initial_score is None:
        record.initial_score = new_score

    old_score = record.current_score
    record.current_score = new_score
    record.suggestions = suggestions
    record.old_caliber_applied = old_caliber
    old_status = record.status
    record.status = "photo_supplemented"

    after = record.snapshot_fields()

    reason = "照片备注补录"
    if old_photo_remarks:
        reason += f"（覆盖原备注：{old_photo_remarks[:30]}）"

    suggestions_diff = [s for s in suggestions if s not in old_suggestions]
    details = f"照片备注：{photo_remarks[:50]}"
    if suggestions_diff:
        details += f"；新增整改建议：{'; '.join(suggestions_diff)}"
    if old_caliber:
        details += "；检测到旧口径关键词"

    record.add_log(
        operator="老马",
        action="photo_supplement",
        details=details,
        before=before,
        after=after,
        reason=reason,
        run_id=run_id
    )

    return record


def review_confirm(record: ComplaintRecord, reviewer: str = "老马",
                   run_id: str = "") -> ComplaintRecord:
    before = record.snapshot_fields()

    record.review_needed = False
    record.review_by = reviewer
    old_status = record.status
    record.status = "reviewed"

    after = record.snapshot_fields()

    reason = f"{reviewer}人工复核确认"
    if before.get("review_needed"):
        reason += "；坡道补录后评分变化不大的情况经人工确认"

    record.add_log(
        operator=reviewer,
        action="review_confirm",
        details="人工复核通过",
        before=before,
        after=after,
        reason=reason,
        run_id=run_id
    )

    return record


def finalize_record(record: ComplaintRecord, run_id: str = "") -> ComplaintRecord:
    before = record.snapshot_fields()
    record.status = "finalized"
    after = record.snapshot_fields()
    record.add_log(
        operator="system",
        action="finalize",
        details="记录已结案",
        before=before,
        after=after,
        reason="结案",
        run_id=run_id
    )
    return record

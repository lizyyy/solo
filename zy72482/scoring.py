from typing import List, Tuple, Optional
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
        photo_lower = record.photo_remarks.lower()
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


def apply_ramp_supplement(record: ComplaintRecord, ramp_exist: bool, ramp_remarks: str = "") -> ComplaintRecord:
    old_score = record.current_score
    record.ramp_exist = ramp_exist
    record.ramp_remarks = ramp_remarks

    new_score, suggestions, review_needed, old_caliber = calculate_score(record)

    if record.initial_score is None:
        record.initial_score = new_score

    score_changed = old_score != new_score

    record.current_score = new_score
    record.suggestions = suggestions
    record.review_needed = review_needed
    record.status = "ramp_supplemented"

    details = f"坡道补录：存在={ramp_exist}，备注={ramp_remarks}，原评分={old_score}，新评分={new_score}"
    if not score_changed and old_score is not None:
        details += "【评分无变化，待复核】"
    record.add_log("system", "ramp_supplement", details)

    return record


def apply_photo_supplement(record: ComplaintRecord, photo_remarks: str, photo_urls: Optional[List[str]] = None) -> ComplaintRecord:
    old_suggestions = record.suggestions.copy()
    record.photo_remarks = photo_remarks
    if photo_urls:
        record.photo_urls.extend(photo_urls)

    new_score, suggestions, review_needed, old_caliber = calculate_score(record)

    if record.initial_score is None:
        record.initial_score = new_score

    record.current_score = new_score
    record.suggestions = suggestions
    record.old_caliber_applied = old_caliber
    record.status = "photo_supplemented"

    details = f"照片补录备注：{photo_remarks[:50]}..."
    suggestions_diff = [s for s in suggestions if s not in old_suggestions]
    if suggestions_diff:
        details += f"，新增整改建议：{'; '.join(suggestions_diff)}"
    if old_caliber:
        details += "【检测到旧口径关键词】"
    record.add_log("老马", "photo_supplement", details)

    return record


def review_confirm(record: ComplaintRecord, reviewer: str = "老马") -> ComplaintRecord:
    record.review_needed = False
    record.review_by = reviewer
    record.status = "reviewed"
    record.add_log(reviewer, "review_confirm", "人工复核通过")
    return record


def finalize_record(record: ComplaintRecord) -> ComplaintRecord:
    record.status = "finalized"
    record.add_log("system", "finalize", "记录已结案")
    return record

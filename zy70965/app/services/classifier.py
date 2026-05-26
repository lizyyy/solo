from typing import List, Dict, Any, Tuple
from app.services.idempotency import RULES


def classify_records(
    quality_records: List[Dict[str, Any]],
    audio_summaries: Dict[str, Dict[str, Any]],
    appeal_records: List[Dict[str, Any]]
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:

    appeal_map = {}
    for appeal in appeal_records:
        key = f"{appeal.get('agent_id', '')}|{appeal.get('call_id', '')}"
        appeal_map[key] = appeal

    normal = []
    pending = []
    failed = []

    for q_record in quality_records:
        key = f"{q_record.get('agent_id', '')}|{q_record.get('call_id', '')}"
        appeal = appeal_map.get(key)
        audio = audio_summaries.get(q_record.get('call_id', ''))

        result = _apply_rules(q_record, appeal, audio)
        record_type = result.pop("_record_type")
        result.update(q_record)

        if appeal:
            result["appeal_reason"] = appeal.get("appeal_reason", "")
            result["score_after_appeal"] = appeal.get("score_after_appeal")

        if record_type == "normal":
            normal.append(result)
        elif record_type == "pending":
            pending.append(result)
        else:
            failed.append(result)

    return normal, pending, failed


def _apply_rules(
    quality: Dict[str, Any],
    appeal: Dict[str, Any],
    audio: Dict[str, Any]
) -> Dict[str, Any]:

    result = {
        "review_status": "normal",
        "is_deduction_revoked": False,
        "needs_second_review": False,
        "suggestion": "",
        "error_message": "",
        "raw_data": quality.get("_raw", ""),
    }

    if not appeal:
        result["_record_type"] = "normal"
        result["review_status"] = "no_appeal"
        result["suggestion"] = "无申诉，记录正常归档"
        return result

    score_original = _safe_float(quality.get("score_original"))
    score_appeal = _safe_float(appeal.get("score_after_appeal"))
    review_score = _safe_float(appeal.get("review_score"))
    review_result = str(appeal.get("review_result", "")).lower()
    review_opinion = str(appeal.get("reviewer_opinion", ""))

    deduction_points = _safe_float(quality.get("deduction_points"))

    should_revoke, revoke_reason = _check_revoke(quality, appeal, audio)
    if should_revoke:
        result["is_deduction_revoked"] = True
        result["suggestion"] = f"【扣分项撤销】{revoke_reason}"
        result["score_final"] = score_original + deduction_points if deduction_points else score_appeal
        result["_record_type"] = "normal"
        result["review_status"] = "revoked"
        return result

    if deduction_points >= 5 or "重大" in review_opinion or "争议" in review_opinion:
        result["needs_second_review"] = True
        result["_record_type"] = "pending"
        result["review_status"] = "need_second_review"
        result["suggestion"] = "【二次复核】扣分≥5分或存在重大争议，需质检主管二次复核"
        return result

    if score_appeal is not None and review_score is not None and abs(score_appeal - review_score) >= 2:
        result["_record_type"] = "pending"
        result["review_status"] = "score_inconsistent"
        result["suggestion"] = f"【分数不一致】申诉后期望分数({score_appeal})与复核分数({review_score})差异≥2分，需确认"
        return result

    if "驳回" in review_result or "拒绝" in review_result:
        result["_record_type"] = "normal"
        result["review_status"] = "appeal_rejected"
        result["suggestion"] = "申诉已驳回，成绩保持不变"
        result["score_final"] = score_original
        return result

    if "通过" in review_result or "同意" in review_result:
        result["_record_type"] = "normal"
        result["review_status"] = "appeal_approved"
        result["suggestion"] = "【成绩回写】申诉通过，最终成绩已更新"
        result["score_final"] = score_appeal if score_appeal is not None else review_score
        return result

    result["_record_type"] = "pending"
    result["review_status"] = "review_pending"
    result["suggestion"] = "申诉处理状态不明确，需人工确认"
    return result


def _check_revoke(
    quality: Dict[str, Any],
    appeal: Dict[str, Any],
    audio: Dict[str, Any]
) -> Tuple[bool, str]:

    if not audio:
        return False, ""

    deduction_reason = str(quality.get("deduction_reason", ""))
    appeal_reason = str(appeal.get("appeal_reason", ""))
    audio_summary = str(audio.get("summary", audio.get("content", "")))

    if "未使用" in deduction_reason and "已使用" in appeal_reason and "使用" in audio_summary:
        return True, f"录音摘要显示【{audio_summary[:30]}...】，与申诉理由一致，原扣分『{deduction_reason[:20]}』不成立"

    if "未告知" in deduction_reason and "已告知" in appeal_reason and "告知" in audio_summary:
        return True, f"录音摘要显示已告知相关信息，与申诉吻合，撤销扣分项"

    if "态度" in deduction_reason and "态度良好" in appeal_reason and "礼貌" in audio_summary:
        return True, "录音显示服务态度礼貌，申诉有理，撤销态度相关扣分项"

    return False, ""


def _safe_float(value: Any) -> float:
    if value is None:
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def get_rules_info() -> List[Dict[str, Any]]:
    return RULES

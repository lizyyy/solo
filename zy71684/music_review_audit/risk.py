import re
from collections import defaultdict
from typing import List

from .models import (
    AuditEntry,
    AuditStatus,
    RiskItem,
    RiskType,
    SongStatus,
)

POSITIVE_TAGS = {"正面", "积极", "开心", "喜欢", "感动", "赞美", "好评", "positive", "happy", "love", "joy"}
NEGATIVE_TAGS = {"负面", "消极", "悲伤", "愤怒", "失望", "讨厌", "差评", "negative", "sad", "angry", "hate"}
NEUTRAL_TAGS = {"中性", "平淡", "中立", "neutral"}

SARCASM_PATTERNS = [
    r"[哈呵嘻]{3,}",
    r"真好[啊吧呢嘛]$",
    r"[可却倒]是.{0,4}[呢吧啊]",
    r"真.{0,2}(行|棒|厉害|不错)[哦啊呢吧]",
    r"多.{0,2}(好|棒|美|行)[啊哦呢]",
    r"(呵呵|嘿嘿|嗬嗬)",
    r"感谢.{0,6}(鬼|个屁|毛)",
    r"妙[啊哦]",
    r"[太好]+[了得]",
    r"(谁|哪个).{0,4}(信|觉得|能)",
]

SPAM_SIMILARITY_THRESHOLD = 0.8

SPAM_USER_THRESHOLD = 5


def _text_similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    a_set = set(a)
    b_set = set(b)
    if not a_set or not b_set:
        return 0.0
    intersection = a_set & b_set
    union = a_set | b_set
    return len(intersection) / len(union)


def detect_sarcasm_misjudge(entry: AuditEntry) -> List[RiskItem]:
    risks = []

    has_correction = entry.manual_correction and entry.manual_correction.corrected_tag
    if has_correction:
        orig = (entry.manual_correction.original_tag or "").lower()
        corrected = (entry.manual_correction.corrected_tag or "").lower()
        orig_positive = orig in POSITIVE_TAGS or any(p in orig for p in POSITIVE_TAGS)
        corrected_negative = corrected in NEGATIVE_TAGS or any(p in corrected for p in NEGATIVE_TAGS)
        if orig_positive and corrected_negative:
            risks.append(
                RiskItem(
                    risk_type=RiskType.SARCASM_MISJUDGE,
                    severity="高",
                    description=f"算法标签'{entry.manual_correction.original_tag}'被人工修正为'{entry.manual_correction.corrected_tag}'，疑为讽刺误判",
                    evidence=entry.review_text[:120],
                    source=entry.manual_correction.source,
                )
            )

    current_tag_lower = entry.current_tag.lower()
    is_positive = current_tag_lower in POSITIVE_TAGS or any(p in current_tag_lower for p in POSITIVE_TAGS)

    if is_positive:
        for pattern in SARCASM_PATTERNS:
            if re.search(pattern, entry.review_text):
                risks.append(
                    RiskItem(
                        risk_type=RiskType.SARCASM_MISJUDGE,
                        severity="中",
                        description=f"正面标签'{entry.current_tag}'但文本含讽刺特征(匹配: {pattern})",
                        evidence=entry.review_text[:120],
                    )
                )
                break

    return risks


def detect_spam(entries: List[AuditEntry]) -> dict:
    user_reviews = defaultdict(list)
    for e in entries:
        if e.user_id:
            user_reviews[e.user_id].append(e)

    spam_risks = {}

    for user_id, user_entries in user_reviews.items():
        if len(user_entries) < SPAM_USER_THRESHOLD:
            continue

        groups = defaultdict(list)
        for i, e1 in enumerate(user_entries):
            for j, e2 in enumerate(user_entries):
                if i >= j:
                    continue
                sim = _text_similarity(e1.review_text, e2.review_text)
                if sim >= SPAM_SIMILARITY_THRESHOLD:
                    key = min(e1.review_id, e2.review_id)
                    groups[key].append(e1)
                    groups[key].append(e2)

        seen_ids = set()
        for key, group in groups.items():
            unique_group = []
            for e in group:
                if e.review_id not in seen_ids:
                    seen_ids.add(e.review_id)
                    unique_group.append(e)

            if len(unique_group) >= SPAM_USER_THRESHOLD:
                for e in unique_group:
                    risk = RiskItem(
                        risk_type=RiskType.SPAM_DUPLICATE,
                        severity="高" if len(unique_group) >= 10 else "中",
                        description=f"用户{user_id}存在{len(unique_group)}条高度相似乐评，疑为刷屏",
                        evidence=f"相似文本样本: {unique_group[0].review_text[:80]}",
                    )
                    if e.review_id not in spam_risks:
                        spam_risks[e.review_id] = risk

    return spam_risks


def detect_delisted_song(entries: List[AuditEntry]) -> List[tuple]:
    results = []

    for entry in entries:
        if entry.song_status == SongStatus.DELISTED.value:
            risk = RiskItem(
                risk_type=RiskType.DELISTED_SONG,
                severity="高",
                description=f"歌曲'{entry.song_title}'(ID:{entry.song_id})已下架，但仍存在关联乐评",
                evidence=f"乐评ID: {entry.review_id}",
            )
            results.append((entry, risk))

    return results


def run_risk_scan(entries: List[AuditEntry]) -> List[AuditEntry]:
    spam_map = detect_spam(entries)
    delisted_results = detect_delisted_song(entries)
    delisted_ids = {}

    for entry, risk in delisted_results:
        entry.risks.append(risk)
        if entry.audit_status == AuditStatus.PENDING.value:
            entry.audit_status = AuditStatus.RETURNED.value
            entry.audit_note = (entry.audit_note + "; " if entry.audit_note else "") + "关联歌曲已下架，需补材料"
        delisted_ids[entry.review_id] = risk

    for entry in entries:
        if entry.review_id in spam_map:
            entry.risks.append(spam_map[entry.review_id])
            if entry.audit_status == AuditStatus.PENDING.value:
                entry.audit_status = AuditStatus.RETURNED.value
                entry.audit_note = (entry.audit_note + "; " if entry.audit_note else "") + "刷屏嫌疑，需补充材料"

        sarcasm_risks = detect_sarcasm_misjudge(entry)
        for risk in sarcasm_risks:
            entry.risks.append(risk)
            if risk.severity == "高" and entry.audit_status == AuditStatus.PENDING.value:
                entry.audit_status = AuditStatus.RETURNED.value
                entry.audit_note = (entry.audit_note + "; " if entry.audit_note else "") + "讽刺误判嫌疑，需人工复核"

    return entries


def get_risk_summary(entries: List[AuditEntry]) -> dict:
    summary = defaultdict(int)
    for entry in entries:
        for risk in entry.risks:
            key = f"{risk.risk_type.value}_{risk.severity}"
            summary[key] += 1

    by_type = defaultdict(int)
    by_severity = defaultdict(int)
    for entry in entries:
        for risk in entry.risks:
            by_type[risk.risk_type.value] += 1
            by_severity[risk.severity] += 1

    return {
        "total_risks": sum(by_type.values()),
        "by_type": dict(by_type),
        "by_severity": dict(by_severity),
        "detail": dict(summary),
    }

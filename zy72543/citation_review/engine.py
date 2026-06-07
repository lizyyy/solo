"""核心复核引擎"""
import re
import uuid
from collections import defaultdict
from typing import List, Tuple, Optional
from difflib import SequenceMatcher
from datetime import datetime

from .models import (
    FeedbackTicket, DesensitizationNote, ReviewRecord,
    DuplicateGroup, ReviewReport, EvidencePlayback,
    ReviewStatus, NextOwner
)
from .storage import JsonStorage


def _char_ngrams(text: str, n: int = 2) -> set:
    """提取字符 n-gram"""
    text = re.sub(r'\s+', '', text)
    return set(text[i:i+n] for i in range(len(text)-n+1))


def text_similarity(a: str, b: str) -> float:
    """计算文本相似度（中文友好：字符 2-gram Jaccard + 关键词重合）"""
    grams_a = _char_ngrams(a, 2)
    grams_b = _char_ngrams(b, 2)

    if not grams_a or not grams_b:
        return 0.0

    intersection = grams_a & grams_b
    union = grams_a | grams_b
    jaccard = len(intersection) / len(union)

    key_chars_a = set(re.sub(r'[的了是我你他它在和有就都]', '', a))
    key_chars_b = set(re.sub(r'[的了是我你他它在和有就都]', '', b))
    if key_chars_a and key_chars_b:
        char_overlap = len(key_chars_a & key_chars_b) / len(key_chars_a | key_chars_b)
    else:
        char_overlap = 0.0

    return jaccard * 0.7 + char_overlap * 0.3


def generate_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


class CitationReviewEngine:
    """学术摘要引用复核引擎"""

    def __init__(self, storage: JsonStorage):
        self.storage = storage
        self.similarity_threshold = 0.20

    def detect_duplicates(self) -> List[DuplicateGroup]:
        """检测同一用户的重复反馈"""
        tickets = self.storage.list_tickets()
        self.storage.clear_groups()

        user_tickets = defaultdict(list)
        for t in tickets:
            user_tickets[t.user_id].append(t)

        groups = []
        for user_id, user_ts in user_tickets.items():
            if len(user_ts) < 2:
                continue

            visited = set()
            for i, t1 in enumerate(user_ts):
                if t1.ticket_id in visited:
                    continue
                group_tickets = [t1]
                visited.add(t1.ticket_id)

                for j, t2 in enumerate(user_ts):
                    if i == j or t2.ticket_id in visited:
                        continue
                    sim = text_similarity(t1.user_feedback, t2.user_feedback)
                    if sim >= self.similarity_threshold:
                        group_tickets.append(t2)
                        visited.add(t2.ticket_id)

                if len(group_tickets) >= 2:
                    avg_sim = sum(
                        text_similarity(group_tickets[0].user_feedback, t.user_feedback)
                        for t in group_tickets[1:]
                    ) / (len(group_tickets) - 1)

                    merged_summary = (
                        f"用户 {user_id} 在 {len(group_tickets)} 条工单中重复反馈："
                        f"「{group_tickets[0].user_feedback[:30]}...」"
                        f"，平均相似度 {avg_sim:.2%}"
                    )

                    group = DuplicateGroup(
                        group_id=generate_id("grp"),
                        user_id=user_id,
                        ticket_ids=[t.ticket_id for t in group_tickets],
                        similarity_score=round(avg_sim, 4),
                        merged_summary=merged_summary
                    )
                    groups.append(group)
                    self.storage.save_group(group)

        return groups

    def _build_evidence(self, ticket: FeedbackTicket,
                        group: Optional[DuplicateGroup],
                        note: Optional[DesensitizationNote]) -> EvidencePlayback:
        """构建证据回放 - 像编辑部校稿一样说明理由"""
        if group and ticket.ticket_id in group.ticket_ids:
            other_ids = [tid for tid in group.ticket_ids if tid != ticket.ticket_id]

            why_kept = (
                f"该工单与同用户 {len(other_ids)} 条其他工单（{', '.join(other_ids)}）"
                f"文本相似度达 {group.similarity_score:.2%}，疑似重复计入。"
                f"按规则不自动归为正常，留待标注负责人人工复核确认。"
            )
            missing = []
            if not note:
                missing.append("缺少 AI 产品经理阿宁补录的脱敏规则备注")
            missing.append("缺少标注负责人的最终复核结论")
            missing.append("缺少原始工单页面跳转链接或截图证据")

            return EvidencePlayback(
                why_kept=why_kept,
                missing_materials=missing,
                next_owner=NextOwner.ANNOTATION_LEAD,
                next_action="请标注负责人核对是否确为同一用户重复反馈，确认后标记为重复或恢复正常",
                confidence_score=group.similarity_score,
                duplicate_ticket_ids=other_ids,
                reasoning_detail=(
                    "判定依据：同用户 + 反馈文本高度相似。"
                    "编辑部校稿原则：疑似重复不得自动放行，须人工确认。"
                    f"当前有脱敏备注：{'是' if note else '否'}。"
                )
            )
        else:
            why_kept = "该工单未发现同一用户重复反馈特征，暂作为正常工单记录。"
            missing = []
            if not note:
                missing.append("缺少脱敏规则备注，建议 AI 产品经理阿宁补录")

            return EvidencePlayback(
                why_kept=why_kept,
                missing_materials=missing,
                next_owner=NextOwner.AI_PRODUCT_MANAGER,
                next_action="建议阿宁补录脱敏规则备注后再观察" if not note else "已补录备注，可进入下一环节",
                confidence_score=0.95,
                duplicate_ticket_ids=[],
                reasoning_detail=(
                    "判定依据：未匹配到同用户高相似度反馈。"
                    f"脱敏备注状态：{'已补录' if note else '未补录'}。"
                )
            )

    def run_review(self) -> List[ReviewRecord]:
        """执行完整复核流程"""
        tickets = self.storage.list_tickets()
        groups = self.detect_duplicates()

        group_map = {}
        for g in groups:
            for tid in g.ticket_ids:
                group_map[tid] = g

        records = []
        for ticket in tickets:
            group = group_map.get(ticket.ticket_id)
            note = self.storage.get_note_for_ticket(ticket.ticket_id)

            status = ReviewStatus.PENDING
            if group:
                status = ReviewStatus.DUPLICATE_DETECTED

            evidence = self._build_evidence(ticket, group, note)

            record = ReviewRecord(
                review_id=generate_id("rev"),
                ticket_id=ticket.ticket_id,
                status=status,
                duplicate_group_id=group.group_id if group else None,
                evidence=evidence
            )
            records.append(record)
            self.storage.save_review(record)

        return records

    def update_evidence_with_note(self, ticket_id: str) -> Optional[ReviewRecord]:
        """补录脱敏备注后更新证据回放"""
        note = self.storage.get_note_for_ticket(ticket_id)
        if not note:
            return None

        review = self.storage.get_review_for_ticket(ticket_id)
        if not review:
            return None

        ticket = self.storage.get_ticket(ticket_id)
        group = None
        if review.duplicate_group_id:
            for g in self.storage.list_groups():
                if g.group_id == review.duplicate_group_id:
                    group = g
                    break

        new_evidence = self._build_evidence(ticket, group, note)
        review.evidence = new_evidence

        if review.status == ReviewStatus.DUPLICATE_DETECTED:
            review.status = ReviewStatus.NEED_MORE_INFO
            review.evidence.next_owner = NextOwner.ANNOTATION_LEAD
            review.evidence.next_action = "阿宁已补录脱敏规则，请标注负责人继续复核确认"
        elif review.status == ReviewStatus.PENDING:
            review.evidence.next_owner = NextOwner.ANNOTATION_LEAD
            review.evidence.next_action = "阿宁已补录脱敏规则，请标注负责人复核"

        self.storage.save_review(review)
        return review

    def generate_report(self) -> ReviewReport:
        """生成学术摘要风格的复核报告"""
        records = self.storage.list_reviews()
        groups = self.storage.list_groups()

        dup_count = sum(
            1 for r in records
            if r.status in (ReviewStatus.DUPLICATE_DETECTED, ReviewStatus.CONFIRMED_DUPLICATE)
        )
        normal_count = sum(1 for r in records if r.status == ReviewStatus.NORMAL)
        need_info_count = sum(1 for r in records if r.status == ReviewStatus.NEED_MORE_INFO)

        key_findings = []
        if groups:
            key_findings.append(
                f"检测到 {len(groups)} 组重复反馈，涉及 {dup_count} 条工单，"
                f"均已留待标注负责人人工复核，未自动归为正常。"
            )
        no_note_count = sum(
            1 for r in records
            if not self.storage.get_note_for_ticket(r.ticket_id)
        )
        if no_note_count:
            key_findings.append(
                f"{no_note_count} 条工单缺少脱敏规则备注，"
                f"建议 AI 产品经理阿宁尽快补录以完善证据链。"
            )

        summary_parts = [
            f"本次共复核工单 {len(records)} 条",
            f"疑似重复 {dup_count} 条",
            f"正常 {normal_count} 条",
            f"需补充信息 {need_info_count} 条",
        ]
        summary = "，".join(summary_parts) + "。按编辑部校稿原则，所有疑似重复均已扣留待人工确认。"

        return ReviewReport(
            report_id=generate_id("rpt"),
            total_tickets=len(records),
            duplicate_groups_count=len(groups),
            duplicate_tickets_count=dup_count,
            normal_tickets_count=normal_count,
            need_more_info_count=need_info_count,
            summary=summary,
            key_findings=key_findings,
            review_records=records,
            duplicate_groups=groups
        )

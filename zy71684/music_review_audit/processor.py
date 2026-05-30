import hashlib
from collections import defaultdict
from typing import Dict, List, Optional

from .models import (
    AlgorithmTag,
    AuditEntry,
    AuditStatus,
    ImportResult,
    ManualCorrection,
    ReportRecord,
    ReviewRecord,
    SongInfo,
    SongStatus,
    TagVersionEntry,
)


def _text_fingerprint(text: str) -> str:
    normalized = text.strip().lower()
    return hashlib.md5(normalized.encode("utf-8")).hexdigest()


def _deduplicate_reviews(reviews: List[ReviewRecord]) -> tuple:
    seen_content = defaultdict(list)
    seen_ids = {}
    unique = []
    duplicates = []

    for r in reviews:
        if r.review_id in seen_ids:
            duplicates.append((r, f"review_id重复: {r.review_id}"))
            continue

        fp = _text_fingerprint(r.text) if r.text else ""
        user_key = f"{r.user_id}:{fp}"
        if fp and user_key in seen_content:
            duplicates.append((r, f"同一用户相似内容: user={r.user_id}"))
            continue

        seen_ids[r.review_id] = r
        if fp:
            seen_content[user_key].append(r.review_id)
        unique.append(r)

    return unique, duplicates


def _deduplicate_tags(tags: List[AlgorithmTag]) -> tuple:
    seen = {}
    unique = []
    duplicates = []

    for t in tags:
        key = f"{t.review_id}:{t.tag}:{t.algorithm_version}"
        if key in seen:
            duplicates.append((t, f"标签重复: review={t.review_id}, tag={t.tag}, version={t.algorithm_version}"))
            continue
        seen[key] = t
        unique.append(t)

    return unique, duplicates


def _deduplicate_corrections(corrections: List[ManualCorrection]) -> tuple:
    seen = {}
    unique = []
    duplicates = []

    for c in corrections:
        key = f"{c.review_id}:{c.corrected_tag}:{c.reviewer_id}"
        if key in seen:
            duplicates.append((c, f"修正重复: review={c.review_id}"))
            continue
        seen[key] = c
        unique.append(c)

    return unique, duplicates


def build_tag_version_chain(
    tags: List[AlgorithmTag],
    correction: Optional[ManualCorrection],
) -> List[TagVersionEntry]:
    chain = []

    sorted_tags = sorted(tags, key=lambda t: t.tagged_at or "")
    for t in sorted_tags:
        chain.append(
            TagVersionEntry(
                tag=t.tag,
                source_type="算法",
                version=t.algorithm_version,
                timestamp=t.tagged_at,
                operator=t.algorithm_version,
            )
        )

    if correction:
        chain.append(
            TagVersionEntry(
                tag=correction.corrected_tag,
                source_type="人工修正",
                version="manual",
                timestamp=correction.corrected_at,
                operator=correction.reviewer_id or "unknown",
            )
        )

    return chain


def resolve_current_tag(
    tags: List[AlgorithmTag],
    correction: Optional[ManualCorrection],
) -> str:
    if correction and correction.corrected_tag:
        return correction.corrected_tag

    if tags:
        sorted_tags = sorted(tags, key=lambda t: t.tagged_at or "")
        return sorted_tags[-1].tag

    return ""


class Processor:
    def __init__(self):
        self.reviews: List[ReviewRecord] = []
        self.tags: List[AlgorithmTag] = []
        self.corrections: List[ManualCorrection] = []
        self.songs: List[SongInfo] = []
        self.reports: List[ReportRecord] = []
        self.dedup_log: list = []
        self.audit_entries: List[AuditEntry] = []

    def load_import_results(self, results: Dict[str, ImportResult]):
        for data_type, result in results.items():
            if data_type == "reviews":
                self.reviews = [r for r in result.records if isinstance(r, ReviewRecord)]
            elif data_type == "tags":
                self.tags = [r for r in result.records if isinstance(r, AlgorithmTag)]
            elif data_type == "corrections":
                self.corrections = [r for r in result.records if isinstance(r, ManualCorrection)]
            elif data_type == "songs":
                self.songs = [r for r in result.records if isinstance(r, SongInfo)]
            elif data_type == "reports":
                self.reports = [r for r in result.records if isinstance(r, ReportRecord)]

    def deduplicate(self):
        self.reviews, rev_dups = _deduplicate_reviews(self.reviews)
        self.tags, tag_dups = _deduplicate_tags(self.tags)
        self.corrections, corr_dups = _deduplicate_corrections(self.corrections)

        self.dedup_log = []
        for item, reason in rev_dups + tag_dups + corr_dups:
            self.dedup_log.append(
                {
                    "type": type(item).__name__,
                    "id": getattr(item, "review_id", getattr(item, "report_id", "")),
                    "reason": reason,
                    "source": str(item.source) if item.source else "",
                }
            )

    def process(self) -> List[AuditEntry]:
        self.deduplicate()

        song_map: Dict[str, SongInfo] = {s.song_id: s for s in self.songs}
        tags_by_review: Dict[str, List[AlgorithmTag]] = defaultdict(list)
        for t in self.tags:
            tags_by_review[t.review_id].append(t)

        correction_map: Dict[str, ManualCorrection] = {}
        for c in self.corrections:
            if c.review_id not in correction_map:
                correction_map[c.review_id] = c

        reports_by_review: Dict[str, List[ReportRecord]] = defaultdict(list)
        for r in self.reports:
            reports_by_review[r.review_id].append(r)

        entries = []
        for review in self.reviews:
            song = song_map.get(review.song_id)
            song_title = song.title if song else ""
            song_status = song.status if song else SongStatus.ACTIVE.value

            review_tags = tags_by_review.get(review.review_id, [])
            correction = correction_map.get(review.review_id)
            report_records = reports_by_review.get(review.review_id, [])

            version_chain = build_tag_version_chain(review_tags, correction)
            current_tag = resolve_current_tag(review_tags, correction)

            source_traces = []
            if review.source:
                source_traces.append(review.source)
            for t in review_tags:
                if t.source:
                    source_traces.append(t.source)
            if correction and correction.source:
                source_traces.append(correction.source)
            if song and song.source:
                source_traces.append(song.source)

            audit_status = AuditStatus.PENDING.value
            audit_note = ""

            if correction and correction.corrected_tag:
                audit_status = AuditStatus.PROCESSED.value
                audit_note = f"人工修正: {correction.original_tag}→{correction.corrected_tag}"
                if correction.note:
                    audit_note += f" ({correction.note})"
            elif report_records:
                unresolved = [r for r in report_records if r.status not in ("resolved", "closed", "已解决", "已关闭")]
                if unresolved:
                    audit_status = AuditStatus.RETURNED.value
                    audit_note = f"有{len(unresolved)}条未解决举报，需补充材料"

            entry = AuditEntry(
                review_id=review.review_id,
                review_text=review.text,
                user_id=review.user_id,
                song_id=review.song_id,
                song_title=song_title,
                song_status=song_status,
                algorithm_tags=review_tags,
                manual_correction=correction,
                current_tag=current_tag,
                tag_version_chain=version_chain,
                report_records=report_records,
                risks=[],
                audit_status=audit_status,
                audit_note=audit_note,
                source_traces=source_traces,
            )
            entries.append(entry)

        self.audit_entries = entries
        return entries

    def get_statistics(self) -> dict:
        status_counts = defaultdict(int)
        for e in self.audit_entries:
            status_counts[e.audit_status] += 1

        return {
            "total": len(self.audit_entries),
            "dedup_removed": len(self.dedup_log),
            "by_status": dict(status_counts),
            "songs_total": len(self.songs),
            "songs_delisted": sum(1 for s in self.songs if s.status == SongStatus.DELISTED.value),
            "tags_total": len(self.tags),
            "corrections_total": len(self.corrections),
            "reports_total": len(self.reports),
        }

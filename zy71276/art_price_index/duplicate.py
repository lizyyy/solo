from datetime import datetime
from typing import List, Dict, Tuple, Optional
from collections import defaultdict

from .models import (
    AuctionRecord,
    RecordState,
    Issue,
    IssueType,
    IssueSeverity,
    ProcessingResult,
)


class DuplicateDetector:
    def __init__(
        self,
        title_similarity_threshold: float = 0.8,
        fuzzy_matching: bool = True,
    ):
        self.title_similarity_threshold = title_similarity_threshold
        self.fuzzy_matching = fuzzy_matching
        self.duplicate_groups: Dict[str, List[AuctionRecord]] = {}
        self.removed_count = 0

    def _simple_hash(
        self,
        artist: Optional[str],
        title: Optional[str],
        date: Optional[datetime],
        price: Optional[float],
    ) -> str:
        artist_clean = (artist or "").strip().lower()
        title_clean = (title or "").strip().lower()
        date_str = date.strftime("%Y%m%d") if date else ""
        price_str = f"{price:.0f}" if price else ""
        return f"{artist_clean}|{title_clean}|{date_str}|{price_str}"

    def _calculate_similarity(self, str1: str, str2: str) -> float:
        if not str1 or not str2:
            return 0.0

        str1_clean = str1.strip().lower()
        str2_clean = str2.strip().lower()

        if str1_clean == str2_clean:
            return 1.0

        set1 = set(str1_clean.split())
        set2 = set(str2_clean.split())
        if not set1 or not set2:
            return 0.0

        intersection = len(set1 & set2)
        union = len(set1 | set2)
        return intersection / union if union > 0 else 0.0

    def _is_duplicate(
        self, record1: AuctionRecord, record2: AuctionRecord
    ) -> Tuple[bool, str]:
        if record1.record_id == record2.record_id:
            return False, ""

        if record1.artist_name and record2.artist_name:
            sim_artist = self._calculate_similarity(
                record1.artist_name, record2.artist_name
            )
            if sim_artist < 0.9:
                return False, "艺术家不匹配"

        if record1.auction_date and record2.auction_date:
            days_diff = abs(
                (record1.auction_date - record2.auction_date).total_seconds() / 86400
            )
            if days_diff > 7:
                return False, "拍卖日期相差超过7天"

        if record1.artwork_title and record2.artwork_title:
            sim_title = self._calculate_similarity(
                record1.artwork_title, record2.artwork_title
            )
            if sim_title < self.title_similarity_threshold:
                return False, f"作品标题相似度不足 ({sim_title:.2f})"

        if record1.usd_price and record2.usd_price:
            price_ratio = max(record1.usd_price, record2.usd_price) / min(
                record1.usd_price, record2.usd_price
            )
            if price_ratio > 1.5:
                return False, f"价格差异过大 ({price_ratio:.2f}x)"

        reasons = []
        if record1.auction_date == record2.auction_date:
            reasons.append("日期完全相同")
        if record1.artwork_title == record2.artwork_title:
            reasons.append("标题完全相同")
        if record1.original_price == record2.original_price:
            reasons.append("价格完全相同")

        return True, "; ".join(reasons) if reasons else "多重特征匹配"

    def _find_exact_duplicates(
        self, records: List[AuctionRecord]
    ) -> List[Tuple[AuctionRecord, AuctionRecord, str]]:
        exact_hash_map: Dict[str, List[AuctionRecord]] = defaultdict(list)
        duplicates = []

        for record in records:
            if record.state not in (
                RecordState.CURRENCY_NORMALIZED,
                RecordState.IMPORTED,
            ):
                continue

            hash_key = self._simple_hash(
                record.artist_name,
                record.artwork_title,
                record.auction_date,
                record.original_price,
            )
            exact_hash_map[hash_key].append(record)

        for hash_key, group in exact_hash_map.items():
            if len(group) > 1:
                for i in range(len(group)):
                    for j in range(i + 1, len(group)):
                        duplicates.append(
                            (group[i], group[j], "精确哈希匹配: 艺术家+标题+日期+价格")
                        )

        return duplicates

    def _find_fuzzy_duplicates(
        self, records: List[AuctionRecord]
    ) -> List[Tuple[AuctionRecord, AuctionRecord, str]]:
        duplicates = []
        valid_records = [
            r
            for r in records
            if r.state
            in (
                RecordState.CURRENCY_NORMALIZED,
                RecordState.IMPORTED,
            )
        ]

        for i in range(len(valid_records)):
            for j in range(i + 1, len(valid_records)):
                is_dup, reason = self._is_duplicate(
                    valid_records[i], valid_records[j]
                )
                if is_dup:
                    duplicates.append((valid_records[i], valid_records[j], reason))

        return duplicates

    def _mark_duplicates(
        self,
        duplicates: List[Tuple[AuctionRecord, AuctionRecord, str]],
        result: ProcessingResult,
    ) -> None:
        seen_pairs = set()

        for record1, record2, reason in duplicates:
            pair_key = tuple(sorted([record1.record_id, record2.record_id]))
            if pair_key in seen_pairs:
                continue
            seen_pairs.add(pair_key)

            keep_record = record1
            dup_record = record2

            if record1.source_file.endswith("_primary.csv"):
                keep_record = record1
                dup_record = record2
            elif record2.source_file.endswith("_primary.csv"):
                keep_record = record2
                dup_record = record1
            elif len(record1.issues) < len(record2.issues):
                keep_record = record1
                dup_record = record2

            dup_record.duplicate_of = keep_record.record_id
            dup_record.state = RecordState.DEDUPLICATED

            issue = Issue(
                issue_type=IssueType.DUPLICATE_RECORD,
                severity=IssueSeverity.WARNING,
                message=f"检测到重复记录，与 {keep_record.record_id} 重复: {reason}",
                field="duplicate_check",
                impact="该记录已标记为重复，将不参与指数计算",
                suggestion=f"参考保留记录: {keep_record.artwork_title} ({keep_record.record_id})",
                affected_records=1,
            )
            dup_record.add_issue(issue)
            result.issues.append(issue)
            self.removed_count += 1

    def detect_and_remove_duplicates(
        self, result: ProcessingResult
    ) -> ProcessingResult:
        self.duplicate_groups.clear()
        self.removed_count = 0

        exact_duplicates = self._find_exact_duplicates(result.records)
        if self.fuzzy_matching:
            fuzzy_duplicates = self._find_fuzzy_duplicates(result.records)
            all_duplicates = exact_duplicates + fuzzy_duplicates
        else:
            all_duplicates = exact_duplicates

        self._mark_duplicates(all_duplicates, result)

        result.records_by_state = {}
        for record in result.records:
            state = record.state.value
            result.records_by_state[state] = result.records_by_state.get(state, 0) + 1

        result.completed_at = datetime.now()
        return result

    def get_duplicate_summary(self) -> Dict:
        return {
            "total_duplicates_removed": self.removed_count,
            "fuzzy_matching_enabled": self.fuzzy_matching,
            "title_similarity_threshold": self.title_similarity_threshold,
        }

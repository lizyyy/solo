from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass
from enum import Enum
import statistics


class RankingMode(str, Enum):
    COMPETITION = "competition"
    DENSE = "dense"


class PromotionStatus(str, Enum):
    PROMOTED = "promoted"
    TIE_AT_BOUNDARY = "tie_at_boundary"
    EXACTLY_BOUNDARY = "exactly_boundary"
    CROSS_LINE_AFTER_APPEAL = "cross_line_after_appeal"
    NOT_PROMOTED = "not_promoted"


@dataclass
class ContestantScore:
    contestant_id: str
    name: str
    scores: List[float]
    dropped_scores: List[float]
    final_score: float
    category: Optional[str] = None
    appeal_impact: Optional[str] = None


@dataclass
class RankedContestant:
    contestant_id: str
    name: str
    final_score: float
    rank: int
    rank_display: str
    category: Optional[str]
    is_promoted: bool
    promotion_status: Optional[str]
    appeal_impact: Optional[str]


class RankingService:
    @staticmethod
    def calculate_final_score(
        scores: List[float],
        drop_highest: int = 0,
        drop_lowest: int = 0
    ) -> Tuple[float, List[float], List[float]]:
        if not scores:
            return 0.0, [], []
        
        sorted_scores = sorted(scores)
        total_count = len(sorted_scores)
        
        if drop_highest + drop_lowest >= total_count and total_count > 0:
            effective_drop_highest = min(drop_highest, total_count - 1)
            effective_drop_lowest = min(drop_lowest, total_count - 1 - effective_drop_highest)
        else:
            effective_drop_highest = drop_highest
            effective_drop_lowest = drop_lowest
        
        dropped_lowest = sorted_scores[:effective_drop_lowest] if effective_drop_lowest > 0 else []
        dropped_highest = sorted_scores[-effective_drop_highest:] if effective_drop_highest > 0 else []
        
        dropped_scores = dropped_lowest + dropped_highest
        
        start_idx = effective_drop_lowest
        end_idx = total_count - effective_drop_highest
        
        if start_idx >= end_idx:
            effective_scores = sorted_scores
        else:
            effective_scores = sorted_scores[start_idx:end_idx]
        
        if not effective_scores:
            final_score = 0.0
        else:
            final_score = statistics.mean(effective_scores)
        
        return final_score, effective_scores, dropped_scores
    
    @staticmethod
    def rank_contestants(
        contestants: List[ContestantScore],
        ranking_mode: RankingMode = RankingMode.COMPETITION,
        promotion_threshold: Optional[int] = None,
        promotion_score: Optional[float] = None,
        category: Optional[str] = None
    ) -> List[RankedContestant]:
        if not contestants:
            return []
        
        filtered_contestants = contestants
        if category:
            filtered_contestants = [c for c in contestants if c.category == category]
        
        if not filtered_contestants:
            return []
        
        sorted_contestants = sorted(
            filtered_contestants,
            key=lambda x: x.final_score,
            reverse=True
        )
        
        ranked_list = []
        current_rank = 1
        previous_score = None
        same_score_count = 0
        
        for idx, contestant in enumerate(sorted_contestants):
            if previous_score is None:
                previous_score = contestant.final_score
                same_score_count = 1
            elif contestant.final_score == previous_score:
                same_score_count += 1
            else:
                if ranking_mode == RankingMode.COMPETITION:
                    current_rank = idx + 1
                else:
                    current_rank += 1
                previous_score = contestant.final_score
                same_score_count = 1
            
            rank_display = str(current_rank)
            if same_score_count > 1:
                rank_display = f"{current_rank}T"
            
            is_promoted = False
            promotion_status = None
            
            if promotion_threshold is not None:
                if ranking_mode == RankingMode.COMPETITION:
                    is_promoted = current_rank <= promotion_threshold
                else:
                    threshold_position = promotion_threshold - 1
                    if threshold_position < len(sorted_contestants):
                        threshold_score = sorted_contestants[threshold_position].final_score
                        is_promoted = contestant.final_score >= threshold_score
                    
                    if promotion_score is not None:
                        is_promoted = contestant.final_score >= promotion_score
            
            if promotion_threshold is not None or promotion_score is not None:
                if is_promoted:
                    promotion_status = PromotionStatus.PROMOTED.value
                    
                    if promotion_score is not None and contestant.final_score == promotion_score:
                        promotion_status = PromotionStatus.EXACTLY_BOUNDARY.value
                    
                    threshold_score = None
                    if promotion_threshold is not None and promotion_threshold - 1 < len(sorted_contestants):
                        threshold_idx = promotion_threshold - 1
                        while threshold_idx > 0 and sorted_contestants[threshold_idx].final_score == sorted_contestants[threshold_idx - 1].final_score:
                            threshold_idx -= 1
                        threshold_score = sorted_contestants[threshold_idx].final_score
                    
                    if threshold_score and contestant.final_score == threshold_score:
                        if current_rank == promotion_threshold or (ranking_mode == RankingMode.DENSE and current_rank <= promotion_threshold):
                            promotion_status = PromotionStatus.TIE_AT_BOUNDARY.value
                    
                    if contestant.appeal_impact and "crossed" in contestant.appeal_impact.lower():
                        promotion_status = PromotionStatus.CROSS_LINE_AFTER_APPEAL.value
                else:
                    promotion_status = PromotionStatus.NOT_PROMOTED.value
            
            ranked_contestant = RankedContestant(
                contestant_id=contestant.contestant_id,
                name=contestant.name,
                final_score=round(contestant.final_score, 3),
                rank=current_rank,
                rank_display=rank_display,
                category=contestant.category,
                is_promoted=is_promoted,
                promotion_status=promotion_status,
                appeal_impact=contestant.appeal_impact
            )
            
            ranked_list.append(ranked_contestant)
        
        return ranked_list
    
    @staticmethod
    def get_categories(contestants: List[ContestantScore]) -> List[str]:
        categories = set()
        for c in contestants:
            if c.category:
                categories.add(c.category)
        return sorted(list(categories))

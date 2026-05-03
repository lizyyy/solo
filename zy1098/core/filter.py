from dataclasses import dataclass
from datetime import date, datetime
from typing import List, Dict, Any, Optional, Callable, TypeVar, Generic, Tuple
from enum import Enum
from collections import defaultdict
from .models import Essay, Feedback, Mistake, LabeledItem, WeaknessPoint
from config.loader import DictionaryConfig


T = TypeVar('T')


class SortOrder(Enum):
    ASC = "asc"
    DESC = "desc"


@dataclass
class FilterCriteria:
    student_name: Optional[str] = None
    student_names: Optional[List[str]] = None
    essay_type: Optional[str] = None
    essay_types: Optional[List[str]] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    score_min: Optional[float] = None
    score_max: Optional[float] = None
    labels: Optional[List[str]] = None
    confidence_min: Optional[float] = None
    severity: Optional[str] = None
    item_types: Optional[List[str]] = None


@dataclass
class SortCriteria:
    field: str
    order: SortOrder = SortOrder.DESC


class FilterEngine:
    def __init__(self, dict_config: Optional[DictionaryConfig] = None):
        self.dict_config = dict_config or DictionaryConfig()

    def filter_essays(
        self,
        essays: List[Essay],
        criteria: FilterCriteria
    ) -> List[Essay]:
        if not essays:
            return []

        filtered = essays

        if criteria.student_name:
            filtered = [e for e in filtered if criteria.student_name in e.student_name]

        if criteria.student_names:
            filtered = [e for e in filtered if e.student_name in criteria.student_names]

        if criteria.essay_type:
            filtered = [e for e in filtered if criteria.essay_type in e.essay_type]

        if criteria.essay_types:
            filtered = [e for e in filtered if e.essay_type in criteria.essay_types]

        if criteria.date_from:
            filtered = [e for e in filtered if e.date >= criteria.date_from]

        if criteria.date_to:
            filtered = [e for e in filtered if e.date <= criteria.date_to]

        if criteria.score_min is not None:
            filtered = [e for e in filtered if e.score >= criteria.score_min]

        if criteria.score_max is not None:
            filtered = [e for e in filtered if e.score <= criteria.score_max]

        return filtered

    def filter_feedback(
        self,
        feedback_list: List[Feedback],
        criteria: FilterCriteria
    ) -> List[Feedback]:
        if not feedback_list:
            return []

        filtered = feedback_list

        if criteria.student_name:
            filtered = [f for f in filtered if criteria.student_name in f.student_name]

        if criteria.student_names:
            filtered = [f for f in filtered if f.student_name in criteria.student_names]

        if criteria.essay_type:
            filtered = [f for f in filtered if f.essay_type and criteria.essay_type in f.essay_type]

        if criteria.essay_types:
            filtered = [f for f in filtered if f.essay_type and f.essay_type in criteria.essay_types]

        if criteria.date_from:
            filtered = [f for f in filtered if f.date and f.date >= criteria.date_from]

        if criteria.date_to:
            filtered = [f for f in filtered if f.date and f.date <= criteria.date_to]

        if criteria.score_min is not None:
            filtered = [f for f in filtered if f.score is not None and f.score >= criteria.score_min]

        if criteria.score_max is not None:
            filtered = [f for f in filtered if f.score is not None and f.score <= criteria.score_max]

        return filtered

    def filter_mistakes(
        self,
        mistakes: List[Mistake],
        criteria: FilterCriteria
    ) -> List[Mistake]:
        if not mistakes:
            return []

        filtered = mistakes

        if criteria.student_name:
            filtered = [m for m in filtered if criteria.student_name in m.student_name]

        if criteria.student_names:
            filtered = [m for m in filtered if m.student_name in criteria.student_names]

        if criteria.essay_type:
            filtered = [m for m in filtered if m.essay_type and criteria.essay_type in m.essay_type]

        if criteria.essay_types:
            filtered = [m for m in filtered if m.essay_type and m.essay_type in criteria.essay_types]

        if criteria.date_from:
            filtered = [m for m in filtered if m.date and m.date >= criteria.date_from]

        if criteria.date_to:
            filtered = [m for m in filtered if m.date and m.date <= criteria.date_to]

        if criteria.severity:
            filtered = [m for m in filtered if m.severity == criteria.severity]

        return filtered

    def filter_labeled_items(
        self,
        items: List[LabeledItem],
        criteria: FilterCriteria
    ) -> List[LabeledItem]:
        if not items:
            return []

        filtered = items

        if criteria.student_name:
            filtered = [i for i in filtered if criteria.student_name in i.student_name]

        if criteria.student_names:
            filtered = [i for i in filtered if i.student_name in criteria.student_names]

        if criteria.labels:
            filtered = [i for i in filtered if any(l in criteria.labels for l in i.labels)]

        if criteria.confidence_min is not None:
            filtered = [
                i for i in filtered
                if any(c >= criteria.confidence_min for c in i.confidence.values())
            ]

        if criteria.item_types:
            filtered = [i for i in filtered if i.item_type in criteria.item_types]

        return filtered

    def sort_essays(
        self,
        essays: List[Essay],
        criteria: SortCriteria
    ) -> List[Essay]:
        if not essays:
            return []

        key_funcs = {
            'score': lambda e: e.score,
            'date': lambda e: e.date,
            'student_name': lambda e: e.student_name,
            'essay_type': lambda e: e.essay_type,
            'title': lambda e: e.title,
        }

        key_func = key_funcs.get(criteria.field, lambda e: e.score)
        reverse = criteria.order == SortOrder.DESC

        return sorted(essays, key=key_func, reverse=reverse)

    def sort_labeled_items(
        self,
        items: List[LabeledItem],
        criteria: SortCriteria
    ) -> List[LabeledItem]:
        if not items:
            return []

        def get_max_confidence(item: LabeledItem) -> float:
            return max(item.confidence.values()) if item.confidence else 0.0

        def get_labels_count(item: LabeledItem) -> int:
            return len(item.labels)

        key_funcs = {
            'confidence': get_max_confidence,
            'student_name': lambda i: i.student_name,
            'labels_count': get_labels_count,
            'item_type': lambda i: i.item_type,
        }

        key_func = key_funcs.get(criteria.field, get_max_confidence)
        reverse = criteria.order == SortOrder.DESC

        return sorted(items, key=key_func, reverse=reverse)

    def sort_weakness_points(
        self,
        weaknesses: List[WeaknessPoint],
        criteria: SortCriteria
    ) -> List[WeaknessPoint]:
        if not weaknesses:
            return []

        key_funcs = {
            'priority': lambda w: w.priority,
            'frequency': lambda w: w.frequency,
            'impact_score': lambda w: w.impact_score,
            'avg_confidence': lambda w: w.avg_confidence,
            'label': lambda w: w.label,
            'student_name': lambda w: w.student_name,
        }

        key_func = key_funcs.get(criteria.field, lambda w: w.priority)
        reverse = criteria.order == SortOrder.DESC

        return sorted(weaknesses, key=key_func, reverse=reverse)

    def get_unique_students(self, items: List[Any], extractor: Optional[Callable[[Any], str]] = None) -> List[str]:
        if not items:
            return []

        if extractor is None:
            def default_extractor(item: Any) -> str:
                if hasattr(item, 'student_name'):
                    return item.student_name
                return ""

            extractor = default_extractor

        students = set()
        for item in items:
            name = extractor(item)
            if name:
                students.add(name)

        return sorted(students)

    def get_unique_essay_types(self, items: List[Any], extractor: Optional[Callable[[Any], Optional[str]]] = None) -> List[str]:
        if not items:
            return []

        if extractor is None:
            def default_extractor(item: Any) -> Optional[str]:
                if hasattr(item, 'essay_type'):
                    return item.essay_type
                return None

            extractor = default_extractor

        types = set()
        for item in items:
            t = extractor(item)
            if t and t != '未知':
                types.add(t)

        return sorted(types)

    def get_date_range(self, items: List[Any], extractor: Optional[Callable[[Any], Optional[date]]] = None) -> Tuple[Optional[date], Optional[date]]:
        if not items:
            return None, None

        if extractor is None:
            def default_extractor(item: Any) -> Optional[date]:
                if hasattr(item, 'date'):
                    return item.date
                return None

            extractor = default_extractor

        dates = []
        for item in items:
            d = extractor(item)
            if d:
                dates.append(d)

        if not dates:
            return None, None

        return min(dates), max(dates)

    def get_label_distribution(self, items: List[LabeledItem]) -> Dict[str, int]:
        distribution: Dict[str, int] = defaultdict(int)

        for item in items:
            for label in item.labels:
                distribution[label] += 1

        return dict(sorted(distribution.items(), key=lambda x: x[1], reverse=True))

    def get_student_stats(self, items: List[LabeledItem]) -> Dict[str, Dict[str, Any]]:
        stats: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
            'total': 0,
            'labels': defaultdict(int),
            'avg_confidence': 0.0,
        })

        for item in items:
            student_stats = stats[item.student_name]
            student_stats['total'] += 1

            for label in item.labels:
                student_stats['labels'][label] += 1

            if item.confidence:
                avg_conf = sum(item.confidence.values()) / len(item.confidence)
                student_stats['avg_confidence'] = (
                    (student_stats['avg_confidence'] * (student_stats['total'] - 1) + avg_conf)
                    / student_stats['total']
                )

        for student_stats in stats.values():
            student_stats['labels'] = dict(student_stats['labels'])

        return dict(stats)

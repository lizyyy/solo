from dataclasses import dataclass
from datetime import date, timedelta
from typing import List, Dict, Any, Optional
from collections import defaultdict
import uuid
from .models import LabeledItem, WeaknessPoint, Task
from config.loader import RulesConfig, DictionaryConfig, LabelRule


@dataclass
class TaskGenerationConfig:
    max_tasks_per_student: int = 5
    min_priority: int = 1
    include_evidence: bool = True
    deadline_days: int = 7


class TaskGenerator:
    def __init__(
        self,
        rules_config: RulesConfig,
        dict_config: Optional[DictionaryConfig] = None
    ):
        self.rules = rules_config
        self.dict_config = dict_config or DictionaryConfig()

    def generate_weakness_points(
        self,
        labeled_items: List[LabeledItem],
        by_student: bool = True
    ) -> List[WeaknessPoint]:
        if not labeled_items:
            return []

        if by_student:
            return self._generate_by_student(labeled_items)
        else:
            return self._generate_aggregated(labeled_items)

    def _generate_by_student(self, labeled_items: List[LabeledItem]) -> List[WeaknessPoint]:
        student_groups: Dict[str, List[LabeledItem]] = defaultdict(list)

        for item in labeled_items:
            student_groups[item.student_name].append(item)

        all_weaknesses: List[WeaknessPoint] = []

        for student_name, items in student_groups.items():
            weaknesses = self._calculate_weaknesses_for_student(student_name, items)
            all_weaknesses.extend(weaknesses)

        all_weaknesses.sort(key=lambda w: (w.student_name, -w.priority))

        return all_weaknesses

    def _generate_aggregated(self, labeled_items: List[LabeledItem]) -> List[WeaknessPoint]:
        return self._calculate_weaknesses_for_student("全部学生", labeled_items)

    def _calculate_weaknesses_for_student(
        self,
        student_name: str,
        items: List[LabeledItem]
    ) -> List[WeaknessPoint]:
        label_stats: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
            'count': 0,
            'total_confidence': 0.0,
            'evidences': [],
            'recent_date': None,
        })

        for item in items:
            for label in item.labels:
                stats = label_stats[label]
                stats['count'] += 1

                confidence = item.confidence.get(label, 0.5)
                stats['total_confidence'] += confidence

                for evidence in item.evidence:
                    if evidence.get('label_id') == label:
                        stats['evidences'].append({
                            'text': item.text[:150] + '...' if len(item.text) > 150 else item.text,
                            'matched_text': evidence.get('matched_text', ''),
                            'confidence': evidence.get('confidence', 0.0),
                            'item_id': item.item_id,
                            'item_type': item.item_type,
                        })

                if hasattr(item.original_item, 'date') and item.original_item.date:
                    if stats['recent_date'] is None or item.original_item.date > stats['recent_date']:
                        stats['recent_date'] = item.original_item.date

        weaknesses: List[WeaknessPoint] = []

        for label_id, stats in label_stats.items():
            rule = self.rules.labels.get(label_id)
            if not rule:
                continue

            count = stats['count']
            avg_confidence = stats['total_confidence'] / count if count > 0 else 0.0

            severity_multiplier = self.dict_config.severity_levels.get('medium', 1.0)
            if rule.priority >= 4:
                severity_multiplier = self.dict_config.severity_levels.get('high', 1.5)
            elif rule.priority <= 2:
                severity_multiplier = self.dict_config.severity_levels.get('low', 0.5)

            impact_score = (count * avg_confidence * rule.priority * severity_multiplier)

            priority = self._calculate_priority(count, avg_confidence, rule.priority, stats['recent_date'])

            suggestion = rule.suggestion_template

            weaknesses.append(WeaknessPoint(
                label=label_id,
                student_name=student_name,
                frequency=count,
                avg_confidence=round(avg_confidence, 3),
                impact_score=round(impact_score, 3),
                recent_date=stats['recent_date'],
                priority=priority,
                evidence=stats['evidences'][:5],
                suggestion=suggestion
            ))

        weaknesses.sort(key=lambda w: (-w.priority, -w.impact_score))

        return weaknesses

    def _calculate_priority(
        self,
        count: int,
        avg_confidence: float,
        label_priority: int,
        recent_date: Optional[date]
    ) -> int:
        base_priority = label_priority

        if count >= 5:
            base_priority += 2
        elif count >= 3:
            base_priority += 1

        if avg_confidence >= 0.8:
            base_priority += 1
        elif avg_confidence >= 0.6:
            base_priority += 0
        else:
            base_priority -= 1

        if recent_date:
            days_ago = (date.today() - recent_date).days
            if days_ago <= 7:
                base_priority += 1
            elif days_ago <= 14:
                base_priority += 0
            else:
                base_priority -= 1

        return max(1, min(10, int(base_priority)))

    def generate_tasks(
        self,
        weaknesses: List[WeaknessPoint],
        config: Optional[TaskGenerationConfig] = None
    ) -> List[Task]:
        if not weaknesses:
            return []

        config = config or TaskGenerationConfig()

        student_weaknesses: Dict[str, List[WeaknessPoint]] = defaultdict(list)
        for w in weaknesses:
            if w.priority >= config.min_priority:
                student_weaknesses[w.student_name].append(w)

        all_tasks: List[Task] = []
        task_counter = 0

        for student_name, student_weak_list in student_weaknesses.items():
            student_weak_list.sort(key=lambda w: (-w.priority, -w.impact_score))

            selected_weaknesses = student_weak_list[:config.max_tasks_per_student]

            for weakness in selected_weaknesses:
                rule = self.rules.labels.get(weakness.label)
                if not rule:
                    continue

                task_description = self._build_task_description(weakness, rule)

                evidence = weakness.evidence[:3] if config.include_evidence else []

                task = Task(
                    task_id=f"task_{uuid.uuid4().hex[:8]}",
                    student_name=student_name,
                    weakness_label=weakness.label,
                    priority=weakness.priority,
                    task_description=task_description,
                    estimated_time=rule.estimated_time,
                    difficulty=rule.difficulty,
                    evidence=evidence,
                    status='pending',
                    deadline=date.today() + timedelta(days=config.deadline_days)
                )

                all_tasks.append(task)
                task_counter += 1

        all_tasks.sort(key=lambda t: (-t.priority, t.student_name))

        return all_tasks

    def _build_task_description(self, weakness: WeaknessPoint, rule: LabelRule) -> str:
        label_name = rule.display_name

        description_parts = [
            f"【{label_name}】",
            f"已发现 {weakness.frequency} 次相关问题，平均置信度 {weakness.avg_confidence:.0%}",
        ]

        if weakness.recent_date:
            description_parts.append(f"最近一次出现于 {weakness.recent_date}")

        description_parts.append("")
        description_parts.append(rule.suggestion_template)

        if weakness.evidence:
            description_parts.append("")
            description_parts.append("问题证据片段：")
            for idx, ev in enumerate(weakness.evidence[:2], 1):
                short_text = ev.get('text', '')[:100]
                matched = ev.get('matched_text', '')
                conf = ev.get('confidence', 0)
                description_parts.append(
                    f"  {idx}. 关键词「{matched}」(置信度 {conf:.0%})：{short_text}..."
                )

        return '\n'.join(description_parts)

    def get_tasks_by_student(self, tasks: List[Task]) -> Dict[str, List[Task]]:
        student_tasks: Dict[str, List[Task]] = defaultdict(list)
        for task in tasks:
            student_tasks[task.student_name].append(task)
        return dict(student_tasks)

    def get_tasks_by_priority(self, tasks: List[Task]) -> Dict[int, List[Task]]:
        priority_tasks: Dict[int, List[Task]] = defaultdict(list)
        for task in tasks:
            priority_tasks[task.priority].append(task)
        return dict(sorted(priority_tasks.items(), reverse=True))

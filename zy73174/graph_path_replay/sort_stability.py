from __future__ import annotations

import random
from typing import Any, Callable

from .models import QuestionItem, SortDetection, SortStability


def _default_key(q: QuestionItem) -> tuple:
    if q.sort_key is not None:
        try:
            return (q.sort_key, q.question_id)
        except TypeError:
            pass
    return (q.question_id,)


class SortStabilityChecker:
    def __init__(self, key_func: Callable[[QuestionItem], Any] | None = None):
        self.key_func = key_func or _default_key
        self._runs = 10

    def check(self, questions: list[QuestionItem]) -> SortDetection:
        before_order = [q.question_id for q in questions]
        trials: list[list[str]] = []

        for _ in range(self._runs):
            shuffled = list(questions)
            random.shuffle(shuffled)
            sorted_list = sorted(shuffled, key=self.key_func)
            trials.append([q.question_id for q in sorted_list])

        baseline = trials[0]
        diff_indices: list[tuple[int, str, str]] = []
        all_same = True

        for trial in trials[1:]:
            if trial != baseline:
                all_same = False
                for idx, (a, b) in enumerate(zip(baseline, trial)):
                    if a != b:
                        existing = any(d[0] == idx for d in diff_indices)
                        if not existing:
                            diff_indices.append((idx, a, b))

        after_order = baseline
        stable = SortStability.STABLE if all_same else SortStability.UNSTABLE

        if stable == SortStability.STABLE:
            suggestion = self._stable_actions()
        else:
            suggestion = self._unstable_actions(diff_indices, questions, baseline)

        return SortDetection(
            stable=stable,
            before_order=before_order,
            after_order=after_order,
            diff_indices=sorted(diff_indices, key=lambda x: x[0]),
            action_suggestion=suggestion,
        )

    def _stable_actions(self) -> str:
        lines = [
            "[排序稳定] 当前排序键产生确定性顺序，可以直接进入下一步。",
            "  动作：",
            "    1. 无需处理，按当前顺序继续回放。",
            "    2. 如需核对，可比较 sort_key 列是否全部唯一。",
        ]
        return "\n".join(lines)

    def _unstable_actions(
        self,
        diff_indices: list[tuple[int, str, str]],
        questions: list[QuestionItem],
        baseline: list[str],
    ) -> str:
        qmap = {q.question_id: q for q in questions}
        lines = [
            f"[排序不稳定] 在 {self._runs} 次随机洗牌重试中发现 {len(diff_indices)} 处顺序差异。",
            "  影响：",
            f"    同一排序键下至少 {len(diff_indices)} 个位置结果不唯一，回放批次间顺序可能不同。",
            "  问题位置（前5条展示）：",
        ]
        for idx, a, b in diff_indices[:5]:
            qa = qmap.get(a)
            qb = qmap.get(b)
            key_a = qa.sort_key if qa else "?"
            key_b = qb.sort_key if qb else "?"
            title_a = qa.title[:12] if qa else "?"
            title_b = qb.title[:12] if qb else "?"
            lines.append(
                f"    位置 {idx}: [{a}|{title_a}|sort_key={key_a}] ↔ "
                f"[{b}|{title_b}|sort_key={key_b}]"
            )
        if len(diff_indices) > 5:
            lines.append(f"    ... 还有 {len(diff_indices) - 5} 处差异")

        lines += [
            "",
            "  建议人工处理动作（按优先级）：",
            "    1. 【首选】补充排序键：在题目清单里给这些重复 sort_key 的行增加二级排序字段，",
            "       例如 difficulty_priority、update_time 等，确保排序键唯一。",
            "    2. 【快速】在 sort_key 列后追加 question_id 作为 tie-breaker，",
            "       保证顺序稳定（脚本可自动处理，见 --auto-tiebreak 选项）。",
            "    3. 【合规】如果顺序本身不影响业务，可在复核页面勾选“忽略排序差异”，",
            "       但需在备注中记录以留痕。",
            "    4. 【兜底】导出不稳定位置列表，由数据小孟人工逐条确认最终顺序，",
            "       并将结果回写到清单后再运行回放。",
            "",
            "  下一步工具：",
            "    $ graph-path-replay inspect --show-ties   # 列出所有重复 sort_key 的题目组",
            "    $ graph-path-replay fix-sort --tiebreak id  # 自动用 id 作为二级排序",
        ]
        return "\n".join(lines)

    def find_tie_groups(self, questions: list[QuestionItem]) -> dict[Any, list[QuestionItem]]:
        groups: dict[Any, list[QuestionItem]] = {}
        for q in questions:
            key = self.key_func(q)
            groups.setdefault(key, []).append(q)
        return {k: v for k, v in groups.items() if len(v) > 1}

    def print_tie_groups(self, questions: list[QuestionItem], stream=None) -> None:
        import sys
        out = stream or sys.stdout
        ties = self.find_tie_groups(questions)
        if not ties:
            print("[排序] 未发现重复排序键，顺序天然稳定。", file=out)
            return
        print(f"[排序] 发现 {len(ties)} 组重复排序键：", file=out)
        for i, (key, items) in enumerate(ties.items()):
            print(f"\n  组 #{i + 1}  sort_key={key!r}  ({len(items)} 题冲突):", file=out)
            for q in items:
                print(f"    - {q.question_id} | {q.title[:20]}", file=out)

    def apply_tiebreak(self, questions: list[QuestionItem], field: str = "question_id") -> None:
        for q in questions:
            try:
                tb = getattr(q, field)
            except AttributeError:
                tb = q.path_params.get(field, q.question_id)
            current = q.sort_key
            if isinstance(current, tuple):
                q.sort_key = current + (tb,)
            else:
                q.sort_key = (current, tb) if current is not None else tb

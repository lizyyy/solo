from typing import Dict, List, Any, Tuple
from .base_grader import BaseGrader
from .music_theory import KEY_SIGNATURES


class KeySignatureGrader(BaseGrader):
    def get_scoring_dimensions(self) -> Dict[str, float]:
        return {
            "tonic": self.full_score * 0.3,
            "mode": self.full_score * 0.2,
            "accidental_count": self.full_score * 0.3,
            "accidental_type": self.full_score * 0.2
        }

    def validate_answer_format(self, answer: Dict[str, Any], is_standard: bool = False) -> Tuple[bool, List[str]]:
        errors = []
        required_keys = ["tonic", "mode", "sharps", "flats"]

        for key in required_keys:
            if key not in answer:
                errors.append(f"缺少必填字段：{key}")

        if "tonic" in answer:
            tonic = str(answer["tonic"]).strip().upper()
            if len(tonic) == 0 or tonic[0] not in "CDEFGAB":
                errors.append("主音必须是C、D、E、F、G、A、B之一（可带变音记号）")

        if "mode" in answer:
            mode = str(answer["mode"]).strip().lower()
            if mode not in ["major", "minor"]:
                errors.append('调式必须是"major"（大调）或"minor"（小调）')

        if "sharps" in answer and not isinstance(answer["sharps"], int):
            errors.append("sharps字段必须是整数")
        if "flats" in answer and not isinstance(answer["flats"], int):
            errors.append("flats字段必须是整数")

        if "sharps" in answer and "flats" in answer:
            if answer["sharps"] > 0 and answer["flats"] > 0:
                errors.append("升号和降号不能同时存在")
            if answer["sharps"] < 0 or answer["flats"] < 0:
                errors.append("变音记号数量不能为负数")
            if answer["sharps"] > 7 or answer["flats"] > 7:
                errors.append("变音记号数量不能超过7个")

        return len(errors) == 0, errors

    def grade(self, student_answer: Dict[str, Any], standard_answer: Dict[str, Any]) -> Tuple[float, bool]:
        self.reset()

        format_valid, format_errors = self.validate_answer_format(student_answer)
        if not format_valid:
            answer_keys = set(student_answer.keys())
            required = {"tonic", "mode", "sharps", "flats"}
            if not required.issubset(answer_keys) and answer_keys and not required.intersection(answer_keys):
                self.check_question_type_compatibility(
                    student_answer,
                    ["tonic", "mode", "sharps", "flats"]
                )
            for error in format_errors:
                self.add_error(
                    error_type="format_error",
                    explanation=f"答案格式错误：{error}",
                    position="整体"
                )
            self.add_partial_score("格式验证", self.full_score, 0.0,
                                    "答案格式不符合要求，无法判分")
            return 0.0, False

        self.check_question_type_compatibility(
            student_answer,
            ["tonic", "mode", "sharps", "flats"]
        )

        dimensions = self.get_scoring_dimensions()

        def normalize_tonic(t):
            t = t.strip()
            if not t:
                return t
            return t[0].upper() + t[1:]

        student_tonic = normalize_tonic(str(student_answer.get("tonic", "")))
        standard_tonic = normalize_tonic(str(standard_answer.get("tonic", "")))
        student_mode = str(student_answer.get("mode", "")).strip().lower()
        standard_mode = str(standard_answer.get("mode", "")).strip().lower()
        student_sharps = student_answer.get("sharps", 0)
        standard_sharps = standard_answer.get("sharps", 0)
        student_flats = student_answer.get("flats", 0)
        standard_flats = standard_answer.get("flats", 0)

        self.check_enharmonic_equivalence(student_tonic, standard_tonic, "主音")

        tonic_correct = student_tonic == standard_tonic
        self.add_partial_score(
            "主音音高",
            dimensions["tonic"],
            dimensions["tonic"] if tonic_correct else 0.0,
            f"主音正确（{standard_tonic}），得满分" if tonic_correct
            else f"主音错误，应为{standard_tonic}，学生写{student_tonic}"
        )
        if not tonic_correct:
            self.add_error(
                error_type="tonic_error",
                position="主音",
                student_value=student_tonic,
                standard_value=standard_tonic,
                explanation=f"调号主音错误，正确主音是{standard_tonic}"
            )

        mode_correct = student_mode == standard_mode
        mode_names = {"major": "大调", "minor": "小调"}
        self.add_partial_score(
            "调式",
            dimensions["mode"],
            dimensions["mode"] if mode_correct else 0.0,
            f"调式正确（{mode_names.get(standard_mode, standard_mode)}），得满分" if mode_correct
            else f"调式错误，应为{mode_names.get(standard_mode, standard_mode)}，学生写{mode_names.get(student_mode, student_mode)}"
        )
        if not mode_correct:
            self.add_error(
                error_type="mode_error",
                position="调式",
                student_value=mode_names.get(student_mode, student_mode),
                standard_value=mode_names.get(standard_mode, standard_mode),
                explanation=f"调式判断错误，正确调式是{mode_names.get(standard_mode, standard_mode)}"
            )

        count_correct = (student_sharps == standard_sharps and
                         student_flats == standard_flats)
        total_std = standard_sharps + standard_flats
        total_stu = student_sharps + student_flats
        count_score = 0.0
        if count_correct:
            count_score = dimensions["accidental_count"]
        elif total_std > 0:
            diff = abs(total_stu - total_std)
            count_score = dimensions["accidental_count"] * max(0, 1 - diff / total_std)

        self.add_partial_score(
            "变音记号数量",
            dimensions["accidental_count"],
            count_score,
            f"变音记号数量正确（{standard_sharps}个升号，{standard_flats}个降号），得满分"
            if count_correct
            else f"变音记号数量错误，应共{total_std}个，学生写{total_stu}个，按误差比例扣分"
        )
        if not count_correct:
            self.add_error(
                error_type="accidental_count_error",
                position="变音记号数量",
                student_value=f"{student_sharps}升{student_flats}降",
                standard_value=f"{standard_sharps}升{standard_flats}降",
                explanation=f"变音记号数量错误，正确数量是{standard_sharps}个升号、{standard_flats}个降号"
            )

        type_correct = ((student_sharps > 0 and standard_sharps > 0) or
                        (student_flats > 0 and standard_flats > 0) or
                        (student_sharps == 0 and student_flats == 0 and
                         standard_sharps == 0 and standard_flats == 0))
        self.add_partial_score(
            "变音记号类型",
            dimensions["accidental_type"],
            dimensions["accidental_type"] if type_correct else 0.0,
            "变音记号类型正确，得满分" if type_correct
            else "变音记号类型错误，升号降号类型混淆"
        )
        if not type_correct:
            self.add_error(
                error_type="accidental_type_error",
                position="变音记号类型",
                student_value="升号" if student_sharps > 0 else "降号" if student_flats > 0 else "无",
                standard_value="升号" if standard_sharps > 0 else "降号" if standard_flats > 0 else "无",
                explanation="变音记号类型判断错误，升号降号类型混淆"
            )

        key_name = f"{standard_tonic}_{standard_mode}"
        if key_name in KEY_SIGNATURES:
            expected = KEY_SIGNATURES[key_name]
            if standard_sharps != expected["sharps"] or standard_flats != expected["flats"]:
                self.needs_manual_review = True
                self.review_reason = "标准答案的调号配置与乐理规则不符，需业务确认"

        total_score = self.calculate_total_score()
        is_correct = abs(total_score - self.full_score) < 0.01

        self.check_missing_scoring_dimensions(
            list(student_answer.keys()),
            ["tonic", "mode", "sharps", "flats"]
        )

        return total_score, is_correct

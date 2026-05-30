from typing import Dict, List, Any, Tuple
from .base_grader import BaseGrader
from .music_theory import parse_note, calculate_interval_semitones, calculate_interval_number, normalize_interval_name


class IntervalGrader(BaseGrader):
    def get_scoring_dimensions(self) -> Dict[str, float]:
        return {
            "lower_note_pitch": self.full_score * 0.3,
            "upper_note_pitch": self.full_score * 0.3,
            "interval_number": self.full_score * 0.2,
            "interval_quality": self.full_score * 0.2
        }

    def validate_answer_format(self, answer: Dict[str, Any], is_standard: bool = False) -> Tuple[bool, List[str]]:
        errors = []
        required_keys = ["lower_note", "upper_note"]

        for key in required_keys:
            if key not in answer:
                errors.append(f"缺少必填字段：{key}")
            else:
                try:
                    parse_note(str(answer[key]))
                except ValueError as e:
                    errors.append(f"{key}格式错误：{str(e)}")

        if "interval" in answer:
            interval = answer["interval"]
            if not isinstance(interval, dict):
                errors.append("interval字段必须是对象类型")
            else:
                if "number" in interval and not isinstance(interval["number"], int):
                    errors.append("interval.number必须是整数")
                if "quality" in interval and not isinstance(interval["quality"], str):
                    errors.append("interval.quality必须是字符串")

        return len(errors) == 0, errors

    def grade(self, student_answer: Dict[str, Any], standard_answer: Dict[str, Any]) -> Tuple[float, bool]:
        self.reset()

        format_valid, format_errors = self.validate_answer_format(student_answer)
        if not format_valid:
            answer_keys = set(student_answer.keys())
            required = {"lower_note", "upper_note"}
            if not required.issubset(answer_keys) and answer_keys and not required.intersection(answer_keys):
                self.check_question_type_compatibility(student_answer, ["lower_note", "upper_note"])
            for error in format_errors:
                self.add_error(
                    error_type="format_error",
                    explanation=f"答案格式错误：{error}",
                    position="整体"
                )
            self.add_partial_score("格式验证", self.full_score, 0.0,
                                    "答案格式不符合要求，无法判分")
            return 0.0, False

        self.check_question_type_compatibility(student_answer, ["lower_note", "upper_note"])

        dimensions = self.get_scoring_dimensions()

        student_lower = str(student_answer.get("lower_note", "")).strip()
        standard_lower = str(standard_answer.get("lower_note", "")).strip()
        student_upper = str(student_answer.get("upper_note", "")).strip()
        standard_upper = str(standard_answer.get("upper_note", "")).strip()

        self.check_enharmonic_equivalence(student_lower, standard_lower, "下方音")
        self.check_enharmonic_equivalence(student_upper, standard_upper, "上方音")

        lower_correct = student_lower == standard_lower
        upper_correct = student_upper == standard_upper

        self.add_partial_score(
            "下方音音高",
            dimensions["lower_note_pitch"],
            dimensions["lower_note_pitch"] if lower_correct else 0.0,
            "下方音音高正确，得满分" if lower_correct else f"下方音音高错误，应为{standard_lower}，学生写{student_lower}"
        )
        if not lower_correct:
            self.add_error(
                error_type="note_pitch_error",
                position="下方音",
                student_value=student_lower,
                standard_value=standard_lower,
                explanation=f"下方音音高错误，正确答案是{standard_lower}"
            )

        self.add_partial_score(
            "上方音音高",
            dimensions["upper_note_pitch"],
            dimensions["upper_note_pitch"] if upper_correct else 0.0,
            "上方音音高正确，得满分" if upper_correct else f"上方音音高错误，应为{standard_upper}，学生写{student_upper}"
        )
        if not upper_correct:
            self.add_error(
                error_type="note_pitch_error",
                position="上方音",
                student_value=student_upper,
                standard_value=standard_upper,
                explanation=f"上方音音高错误，正确答案是{standard_upper}"
            )

        try:
            calc_student_semitones = calculate_interval_semitones(student_lower, student_upper)
            calc_student_number = calculate_interval_number(student_lower, student_upper)
            standard_semitones = calculate_interval_semitones(standard_lower, standard_upper)
            standard_number = calculate_interval_number(standard_lower, standard_upper)

            student_interval = student_answer.get("interval", {})
            if student_interval and ("number" in student_interval or "quality" in student_interval):
                student_number = student_interval.get("number", calc_student_number)
                student_quality_input = student_interval.get("quality", "")
                student_quality = student_quality_input
                number_correct = student_number == standard_number
                quality_matches = student_quality_input and (
                    (student_quality_input == "major" and standard_semitones in {2, 4, 9, 11}) or
                    (student_quality_input == "minor" and standard_semitones in {1, 3, 8, 10}) or
                    (student_quality_input == "perfect" and standard_semitones in {0, 5, 7}) or
                    (student_quality_input == "diminished" and standard_semitones in {0, 3, 6, 9}) or
                    (student_quality_input == "augmented" and standard_semitones in {1, 6, 8})
                )
                quality_correct = quality_matches and number_correct
                if not quality_matches:
                    student_quality = student_quality_input
                else:
                    student_quality = normalize_interval_name(standard_number, standard_semitones)
            else:
                student_number = calc_student_number
                student_semitones = calc_student_semitones
                number_correct = student_number == standard_number
                quality_correct = student_semitones == standard_semitones and number_correct
                student_quality = normalize_interval_name(student_number, student_semitones)

            standard_quality = normalize_interval_name(standard_number, standard_semitones)

            number_correct = student_number == standard_number
            self.add_partial_score(
                "音程度数",
                dimensions["interval_number"],
                dimensions["interval_number"] if number_correct else 0.0,
                f"音程度数正确（{standard_number}度），得满分" if number_correct
                else f"音程度数错误，应为{standard_number}度，学生答案为{student_number}度"
            )
            if not number_correct:
                self.add_error(
                    error_type="interval_number_error",
                    position="音程度数",
                    student_value=student_number,
                    standard_value=standard_number,
                    explanation=f"音程度数计算错误，正确度数是{standard_number}度"
                )
            self.add_partial_score(
                "音程性质",
                dimensions["interval_quality"],
                dimensions["interval_quality"] if quality_correct else 0.0,
                f"音程性质正确（{standard_quality}），得满分" if quality_correct
                else f"音程性质错误，应为{standard_quality}，学生答案为{student_quality}"
            )
            if not quality_correct:
                self.add_error(
                    error_type="interval_quality_error",
                    position="音程性质",
                    student_value=student_quality,
                    standard_value=standard_quality,
                    explanation=f"音程性质判断错误，正确性质是{standard_quality}"
                )

        except Exception as e:
            self.add_partial_score("音程度数", dimensions["interval_number"], 0.0,
                                    f"计算音程时出错：{str(e)}")
            self.add_partial_score("音程性质", dimensions["interval_quality"], 0.0,
                                    f"计算音程时出错：{str(e)}")
            self.add_error(
                error_type="calculation_error",
                explanation=f"音程计算异常：{str(e)}"
            )
            self.needs_manual_review = True
            self.review_reason = "音程计算过程出现异常，需人工复核"

        total_score = self.calculate_total_score()
        is_correct = abs(total_score - self.full_score) < 0.01

        if student_answer.get("interval"):
            self.check_missing_scoring_dimensions(
                list(student_answer.get("interval", {}).keys()),
                ["number", "quality"]
            )

        return total_score, is_correct

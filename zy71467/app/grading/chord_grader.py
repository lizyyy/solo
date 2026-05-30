from typing import Dict, List, Any, Tuple
from .base_grader import BaseGrader
from .music_theory import parse_note, identify_chord


class ChordGrader(BaseGrader):
    def get_scoring_dimensions(self) -> Dict[str, float]:
        return {
            "root_note": self.full_score * 0.25,
            "chord_tones": self.full_score * 0.35,
            "chord_type": self.full_score * 0.25,
            "inversion": self.full_score * 0.15
        }

    def validate_answer_format(self, answer: Dict[str, Any], is_standard: bool = False) -> Tuple[bool, List[str]]:
        errors = []
        required_keys = ["notes"]

        for key in required_keys:
            if key not in answer:
                errors.append(f"缺少必填字段：{key}")
            else:
                notes = answer[key]
                if not isinstance(notes, list) or len(notes) < 3:
                    errors.append("notes字段必须是包含至少3个音的列表")
                else:
                    for i, note in enumerate(notes):
                        try:
                            parse_note(str(note))
                        except ValueError as e:
                            errors.append(f"第{i+1}个音格式错误：{str(e)}")

        if "chord_type" in answer and not isinstance(answer["chord_type"], str):
            errors.append("chord_type字段必须是字符串类型")

        if "inversion" in answer and answer["inversion"] not in [0, 1, 2, 3]:
            errors.append("inversion字段必须是0（原位）、1（第一转位）、2（第二转位）、3（第三转位）")

        return len(errors) == 0, errors

    def grade(self, student_answer: Dict[str, Any], standard_answer: Dict[str, Any]) -> Tuple[float, bool]:
        self.reset()

        format_valid, format_errors = self.validate_answer_format(student_answer)
        if not format_valid:
            answer_keys = set(student_answer.keys())
            required = {"notes"}
            if not required.issubset(answer_keys) and answer_keys and not required.intersection(answer_keys):
                self.check_question_type_compatibility(student_answer, ["notes"])
            for error in format_errors:
                self.add_error(
                    error_type="format_error",
                    explanation=f"答案格式错误：{error}",
                    position="整体"
                )
            self.add_partial_score("格式验证", self.full_score, 0.0,
                                    "答案格式不符合要求，无法判分")
            return 0.0, False

        self.check_question_type_compatibility(student_answer, ["notes"])

        dimensions = self.get_scoring_dimensions()

        student_notes = [str(n).strip() for n in student_answer.get("notes", [])]
        standard_notes = [str(n).strip() for n in standard_answer.get("notes", [])]

        student_semis = []
        standard_semis = []
        for n in student_notes:
            try:
                _, _, s = parse_note(n)
                student_semis.append(s)
            except ValueError:
                pass
        for n in standard_notes:
            try:
                _, _, s = parse_note(n)
                standard_semis.append(s)
            except ValueError:
                pass

        student_root = student_notes[0] if student_notes else ""
        standard_root = standard_notes[0] if standard_notes else ""

        self.check_enharmonic_equivalence(student_root, standard_root, "根音位置")

        root_correct = student_root == standard_root
        self.add_partial_score(
            "根音位置",
            dimensions["root_note"],
            dimensions["root_note"] if root_correct else 0.0,
            f"根音位置正确（{standard_root}），得满分" if root_correct
            else f"根音位置错误，应为{standard_root}，学生写{student_root}"
        )
        if not root_correct:
            self.add_error(
                error_type="root_note_error",
                position="根音",
                student_value=student_root,
                standard_value=standard_root,
                explanation=f"和弦根音错误，正确根音是{standard_root}"
            )

        student_set = set(student_semis)
        standard_set = set(standard_semis)
        correct_tones = len(student_set & standard_set)
        total_tones = len(standard_set)
        chord_tones_score = 0.0
        if total_tones > 0:
            chord_tones_score = dimensions["chord_tones"] * (correct_tones / total_tones)

        self.add_partial_score(
            "和弦音组成",
            dimensions["chord_tones"],
            chord_tones_score,
            f"和弦音正确{correct_tones}/{total_tones}个，按比例得分"
        )
        if correct_tones < total_tones:
            missing_notes = [standard_notes[i] for i, s in enumerate(standard_semis) if s not in student_set]
            wrong_notes = [student_notes[i] for i, s in enumerate(student_semis) if s not in standard_set]
            self.add_error(
                error_type="chord_tones_error",
                position="和弦组成音",
                student_value=wrong_notes,
                standard_value=missing_notes,
                explanation=f"和弦音错误，缺少{missing_notes}，多余{wrong_notes}"
            )

        try:
            student_chord_type = identify_chord(student_notes)
            standard_chord_type = identify_chord(standard_notes)
            student_chord_name = student_answer.get("chord_type", "") or student_chord_type or "未知"
            standard_chord_name = standard_answer.get("chord_type", "") or standard_chord_type or "未知"

            chord_type_correct = (student_chord_type == standard_chord_type and
                                  student_chord_type is not None)
            self.add_partial_score(
                "和弦类型",
                dimensions["chord_type"],
                dimensions["chord_type"] if chord_type_correct else 0.0,
                f"和弦类型识别正确（{standard_chord_name}），得满分" if chord_type_correct
                else f"和弦类型识别错误，应为{standard_chord_name}，学生识别为{student_chord_name}"
            )
            if not chord_type_correct:
                self.add_error(
                    error_type="chord_type_error",
                    position="和弦类型",
                    student_value=student_chord_name,
                    standard_value=standard_chord_name,
                    explanation=f"和弦类型判断错误，正确类型是{standard_chord_name}"
                )
        except Exception as e:
            self.add_partial_score("和弦类型", dimensions["chord_type"], 0.0,
                                    f"识别和弦类型时出错：{str(e)}")
            self.add_error(
                error_type="calculation_error",
                explanation=f"和弦类型识别异常：{str(e)}"
            )

        student_inversion = student_answer.get("inversion", 0)
        standard_inversion = standard_answer.get("inversion", 0)
        inversion_correct = student_inversion == standard_inversion

        inversion_names = {0: "原位", 1: "第一转位", 2: "第二转位", 3: "第三转位"}
        self.add_partial_score(
            "转位状态",
            dimensions["inversion"],
            dimensions["inversion"] if inversion_correct else 0.0,
            f"转位状态正确（{inversion_names.get(standard_inversion, str(standard_inversion))}），得满分"
            if inversion_correct
            else f"转位状态错误，应为{inversion_names.get(standard_inversion, str(standard_inversion))}，学生写{inversion_names.get(student_inversion, str(student_inversion))}"
        )
        if not inversion_correct:
            self.add_error(
                error_type="inversion_error",
                position="转位",
                student_value=inversion_names.get(student_inversion, str(student_inversion)),
                standard_value=inversion_names.get(standard_inversion, str(standard_inversion)),
                explanation=f"转位判断错误，正确转位是{inversion_names.get(standard_inversion, str(standard_inversion))}"
            )

        for i, (sn, tn) in enumerate(zip(student_notes, standard_notes)):
            if sn != tn:
                self.check_enharmonic_equivalence(sn, tn, f"第{i+1}个和弦音")

        total_score = self.calculate_total_score()
        is_correct = abs(total_score - self.full_score) < 0.01

        if "chord_type" in student_answer or "inversion" in student_answer:
            self.check_missing_scoring_dimensions(
                list(student_answer.keys()),
                ["notes", "chord_type", "inversion"]
            )

        return total_score, is_correct

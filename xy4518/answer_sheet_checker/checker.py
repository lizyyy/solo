"""问题检测模块 - 自动检测各类答题卡问题。"""

from collections import defaultdict
from datetime import datetime
from typing import Dict, List, Optional, Set, Tuple

from .models import (
    AbsentRecord,
    AnswerSheet,
    CheckResult,
    GradingBatch,
    Issue,
    IssueSeverity,
    IssueType,
    RoomStatistics,
    Student,
)


class IssueChecker:
    """问题检测器。"""

    @classmethod
    def check_all(
        cls,
        scanned_sheets: Dict[str, List[AnswerSheet]],
        student_roster: Dict[str, Student],
        absent_records: Dict[str, AbsentRecord],
        grading_batch: GradingBatch,
        remark_store: Optional[Dict[str, str]] = None,
    ) -> CheckResult:
        """
        执行所有检查。

        Args:
            scanned_sheets: 扫描的答题卡（条码 -> 答题卡列表）
            student_roster: 学生名单（学号 -> 学生）
            absent_records: 缺考记录（学号 -> 缺考记录）
            grading_batch: 阅卷批次信息
            remark_store: 备注存储

        Returns:
            检查结果
        """
        if remark_store is None:
            remark_store = {}

        all_issues: List[Issue] = []

        missing_scan_issues = cls.check_missing_scans(scanned_sheets, student_roster, absent_records)
        all_issues.extend(missing_scan_issues)

        duplicate_issues = cls.check_duplicate_barcodes(scanned_sheets)
        all_issues.extend(duplicate_issues)

        room_mixup_issues = cls.check_room_mixup(scanned_sheets, student_roster)
        all_issues.extend(room_mixup_issues)

        absent_issues = cls.check_absent_with_sheet(scanned_sheets, absent_records, student_roster)
        all_issues.extend(absent_issues)

        orientation_issues = cls.check_page_orientation(scanned_sheets)
        all_issues.extend(orientation_issues)

        extra_issues = cls.check_extra_sheets(scanned_sheets, student_roster)
        all_issues.extend(extra_issues)

        statistics = cls._compile_statistics(
            all_issues, student_roster, absent_records, scanned_sheets
        )

        return CheckResult(
            batch_id=grading_batch.batch_id,
            generated_at=datetime.now(),
            statistics=statistics,
            all_issues=all_issues,
            scanned_sheets={
                barcode: sheets[0] if sheets else None
                for barcode, sheets in scanned_sheets.items()
                if sheets
            },
            student_roster=student_roster,
            absent_records=absent_records,
            grading_batch=grading_batch,
            remark_store=remark_store,
        )

    @classmethod
    def check_missing_scans(
        cls,
        scanned_sheets: Dict[str, List[AnswerSheet]],
        student_roster: Dict[str, Student],
        absent_records: Dict[str, AbsentRecord],
    ) -> List[Issue]:
        """
        检查漏扫。

        漏扫定义：
        - 学生在座位表中
        - 学生不在缺考名单中
        - 没有扫描到对应的答题卡

        Returns:
            Issue 列表
        """
        issues: List[Issue] = []

        scanned_barcodes = set(scanned_sheets.keys())

        for student_id, student in student_roster.items():
            if student_id in absent_records:
                continue

            if student_id not in scanned_barcodes:
                issue = Issue(
                    issue_type=IssueType.MISSING_SCAN,
                    severity=IssueSeverity.CRITICAL,
                    description=f"学生 {student.name} ({student_id}) 未扫描到答题卡，座位号: {student.seat_number}",
                    affected_barcodes=[student_id],
                    affected_files=[],
                    room_number=student.room_number,
                    recommendation="请检查是否漏扫，或确认学生是否实际缺考",
                )
                issues.append(issue)

        return issues

    @classmethod
    def check_duplicate_barcodes(
        cls, scanned_sheets: Dict[str, List[AnswerSheet]]
    ) -> List[Issue]:
        """
        检查重复条码。

        重复条码定义：
        - 同一条码出现在多个文件中

        Returns:
            Issue 列表
        """
        issues: List[Issue] = []

        for barcode, sheets in scanned_sheets.items():
            if len(sheets) > 1:
                filenames = [s.filename for s in sheets]
                issue = Issue(
                    issue_type=IssueType.DUPLICATE_BARCODE,
                    severity=IssueSeverity.CRITICAL,
                    description=f"条码 {barcode} 出现 {len(sheets)} 次重复扫描",
                    affected_barcodes=[barcode],
                    affected_files=filenames,
                    recommendation="请检查是否重复扫描，删除重复文件",
                )
                issues.append(issue)

        return issues

    @classmethod
    def check_room_mixup(
        cls,
        scanned_sheets: Dict[str, List[AnswerSheet]],
        student_roster: Dict[str, Student],
    ) -> List[Issue]:
        """
        检查考场混放。

        考场混放定义：
        - 同一扫描批次中出现不同考场的答题卡
        - 或条码对应的考场与预期不符

        Returns:
            Issue 列表
        """
        issues: List[Issue] = []

        barcode_to_room: Dict[str, str] = {}
        for barcode, sheets in scanned_sheets.items():
            if not sheets:
                continue

            student = student_roster.get(barcode)
            if student:
                barcode_to_room[barcode] = student.room_number
            else:
                filename = sheets[0].filename
                room_match = cls._extract_room_from_filename(filename)
                if room_match:
                    barcode_to_room[barcode] = room_match

        if len(barcode_to_room) <= 1:
            return issues

        room_count: Dict[str, int] = defaultdict(int)
        for barcode, room in barcode_to_room.items():
            room_count[room] += 1

        if len(room_count) > 1:
            for barcode, sheets in scanned_sheets.items():
                if not sheets:
                    continue

                student = student_roster.get(barcode)
                if student:
                    expected_room = student.room_number
                    actual_room = barcode_to_room.get(barcode, "")

                    if actual_room and actual_room != expected_room:
                        issue = Issue(
                            issue_type=IssueType.ROOM_MIXUP,
                            severity=IssueSeverity.MAJOR,
                            description=f"考场混放: 学生 {student.name} ({barcode}) 应在考场 {expected_room}，"
                            f"但扫描文件显示来自考场 {actual_room}",
                            affected_barcodes=[barcode],
                            affected_files=[s.filename for s in sheets],
                            room_number=actual_room,
                            recommendation="请检查该考场是否混入了其他考场的答题卡",
                        )
                        issues.append(issue)

        return issues

    @classmethod
    def check_absent_with_sheet(
        cls,
        scanned_sheets: Dict[str, List[AnswerSheet]],
        absent_records: Dict[str, AbsentRecord],
        student_roster: Dict[str, Student],
    ) -> List[Issue]:
        """
        检查缺考却有答题卡。

        定义：
        - 学生在缺考名单中
        - 但扫描到了该学生的答题卡

        Returns:
            Issue 列表
        """
        issues: List[Issue] = []

        for student_id, record in absent_records.items():
            if student_id in scanned_sheets:
                sheets = scanned_sheets[student_id]
                student = student_roster.get(student_id)
                name = student.name if student else student_id

                issue = Issue(
                    issue_type=IssueType.ABSENT_WITH_SHEET,
                    severity=IssueSeverity.CRITICAL,
                    description=f"缺考学生 {name} ({student_id}) 存在扫描的答题卡",
                    affected_barcodes=[student_id],
                    affected_files=[s.filename for s in sheets],
                    room_number=record.room_number,
                    recommendation="请核实：该学生是实际缺考还是签到有误，答题卡是否为其他学生的",
                )
                issues.append(issue)

        return issues

    @classmethod
    def check_page_orientation(
        cls, scanned_sheets: Dict[str, List[AnswerSheet]]
    ) -> List[Issue]:
        """
        检查页码方向异常。

        定义：
        - 图片方向为横向（landscape）
        - 或同一学生的不同页面方向不一致

        Returns:
            Issue 列表
        """
        issues: List[Issue] = []

        for barcode, sheets in scanned_sheets.items():
            if len(sheets) == 0:
                continue

            orientations = [s.orientation for s in sheets if s.orientation]

            if not orientations:
                continue

            for sheet in sheets:
                if sheet.orientation == "landscape":
                    issue = Issue(
                        issue_type=IssueType.PAGE_ORIENTATION,
                        severity=IssueSeverity.MINOR,
                        description=f"条码 {barcode} 的答题卡方向为横向，可能影响后续处理",
                        affected_barcodes=[barcode],
                        affected_files=[sheet.filename],
                        recommendation="请确认方向是否正确，必要时旋转图片",
                    )
                    issues.append(issue)

            unique_orientations = set(orientations)
            if len(unique_orientations) > 1:
                issue = Issue(
                    issue_type=IssueType.PAGE_ORIENTATION,
                    severity=IssueSeverity.MAJOR,
                    description=f"条码 {barcode} 的多页答题卡方向不一致: {unique_orientations}",
                    affected_barcodes=[barcode],
                    affected_files=[s.filename for s in sheets],
                    recommendation="请统一所有页面的方向",
                )
                issues.append(issue)

        return issues

    @classmethod
    def check_extra_sheets(
        cls,
        scanned_sheets: Dict[str, List[AnswerSheet]],
        student_roster: Dict[str, Student],
    ) -> List[Issue]:
        """
        检查额外答题卡。

        定义：
        - 扫描到的条码不在学生名单中

        Returns:
            Issue 列表
        """
        issues: List[Issue] = []

        for barcode, sheets in scanned_sheets.items():
            if not sheets:
                continue

            if barcode.startswith("UNKNOWN_"):
                issue = Issue(
                    issue_type=IssueType.EXTRA_SHEET,
                    severity=IssueSeverity.MAJOR,
                    description=f"无法识别条码的答题卡: {sheets[0].filename}",
                    affected_barcodes=[barcode],
                    affected_files=[s.filename for s in sheets],
                    recommendation="请手动识别该答题卡对应的学生，或确认是否为多余文件",
                )
                issues.append(issue)
                continue

            if barcode not in student_roster:
                issue = Issue(
                    issue_type=IssueType.EXTRA_SHEET,
                    severity=IssueSeverity.MAJOR,
                    description=f"条码 {barcode} 不在学生名单中，可能是额外的答题卡",
                    affected_barcodes=[barcode],
                    affected_files=[s.filename for s in sheets],
                    recommendation="请确认该条码对应的学生是否属于本次考试",
                )
                issues.append(issue)

        return issues

    @staticmethod
    def _extract_room_from_filename(filename: str) -> Optional[str]:
        """从文件名中提取考场号。"""
        import re

        room_patterns = [
            r"考场[_\s\-]?(\d+)",
            r"room[_\s\-]?(\d+)",
            r"[rR][_\s\-]?(\d{3,4})",
        ]

        for pattern in room_patterns:
            match = re.search(pattern, filename)
            if match:
                return match.group(1)

        return None

    @staticmethod
    def _compile_statistics(
        issues: List[Issue],
        student_roster: Dict[str, Student],
        absent_records: Dict[str, AbsentRecord],
        scanned_sheets: Dict[str, List[AnswerSheet]],
    ) -> Dict[str, RoomStatistics]:
        """按考场统计数据。"""
        room_stats: Dict[str, RoomStatistics] = {}

        rooms: Set[str] = set()
        for student in student_roster.values():
            if student.room_number:
                rooms.add(student.room_number)

        for room in rooms:
            room_students = {
                sid: s for sid, s in student_roster.items() if s.room_number == room
            }
            room_absent = {
                sid: r for sid, r in absent_records.items() if r.room_number == room
            }

            room_scanned_count = 0
            for barcode, sheets in scanned_sheets.items():
                if not sheets:
                    continue
                student = student_roster.get(barcode)
                if student and student.room_number == room:
                    room_scanned_count += len(sheets)

            total_students = len(room_students)
            absent_count = len(room_absent)
            present_count = total_students - absent_count
            scanned_count = sum(
                1 for sid in room_students if sid in scanned_sheets and sid not in room_absent
            )
            missing_count = present_count - scanned_count

            room_issues = [i for i in issues if i.room_number == room]
            duplicate_count = sum(
                1 for i in room_issues if i.issue_type == IssueType.DUPLICATE_BARCODE
            )

            room_stats[room] = RoomStatistics(
                room_number=room,
                total_students=total_students,
                present_students=present_count,
                absent_students=absent_count,
                scanned_sheets=room_scanned_count,
                missing_sheets=missing_count,
                duplicate_count=duplicate_count,
                issues=room_issues,
            )

        return room_stats

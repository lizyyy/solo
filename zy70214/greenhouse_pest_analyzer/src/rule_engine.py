"""规则引擎 - 数据校验和规则匹配"""

import os
import yaml
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple

from .models import (
    TrapRecord,
    PestCount,
    ValidationIssue,
    AnalysisResult
)


class RuleEngine:
    """规则引擎类"""

    def __init__(self, config_path: str):
        self.config_path = config_path
        self.rules = self._load_rules()
        self.valid_pest_types = set()
        self.valid_board_types = set()
        self._load_valid_types()

    def _load_rules(self) -> Dict[str, Any]:
        """加载规则配置"""
        if not os.path.exists(self.config_path):
            raise FileNotFoundError(f"规则配置文件不存在: {self.config_path}")

        with open(self.config_path, 'r', encoding='utf-8') as f:
            return yaml.safe_load(f)

    def _load_valid_types(self):
        """加载合法的虫害类型和诱捕板类型"""
        pest_types = self.rules.get('pest_types', {})
        for key, value in pest_types.items():
            self.valid_pest_types.add(key)
            self.valid_pest_types.add(value.get('chinese_name', ''))
            self.valid_pest_types.add(value.get('name', ''))

        board_types = self.rules.get('trap_board_types', {})
        for key, value in board_types.items():
            self.valid_board_types.add(key)
            self.valid_board_types.add(value.get('chinese_name', ''))
            self.valid_board_types.add(value.get('name', ''))

    def _get_alert_thresholds(self) -> Dict[str, int]:
        """获取预警阈值"""
        return self.rules.get('alert_thresholds', {'low': 10, 'medium': 50, 'high': 150})

    def _get_result_grades(self) -> Dict[str, Dict[str, Any]]:
        """获取结果评级"""
        return self.rules.get('result_grades', {})

    def _get_grade_for_score(self, score: float) -> Tuple[str, str]:
        """根据分数获取评级"""
        grades = self._get_result_grades()
        sorted_grades = sorted(grades.items(), key=lambda x: x[1].get('min_score', 0), reverse=True)

        for grade_code, grade_info in sorted_grades:
            if score >= grade_info.get('min_score', 0):
                return grade_code, grade_info.get('name', grade_code)

        return "D", "不合格"

    def validate_required_fields(self, record: TrapRecord) -> Optional[ValidationIssue]:
        """校验必填字段"""
        required_fields = [
            ('trap_board_id', '诱捕板编号'),
            ('greenhouse_id', '温室编号'),
            ('capture_date', '拍摄日期'),
            ('board_type', '诱捕板类型')
        ]

        missing_fields = []
        for field_attr, field_name in required_fields:
            value = getattr(record, field_attr, None)
            if value is None or (isinstance(value, str) and not value.strip()):
                missing_fields.append(field_name)

        if missing_fields:
            return ValidationIssue(
                issue_id=f"REQ_{record.record_id}",
                rule_id="MISSING_REQUIRED_FIELD",
                rule_name="缺少必填字段",
                level="critical",
                level_name="严重错误",
                severity="必须修正",
                description="记录缺少必要的关键字段",
                reason=f"缺少以下必填字段: {', '.join(missing_fields)}。这些字段是识别诱捕板和进行数据分析的基础信息。",
                suggestion=f"请补充缺失的字段: {', '.join(missing_fields)}。诱捕板编号用于定位具体设备，温室编号用于区域分析，拍摄日期用于时间序列追踪，板类型用于虫害类型判断。",
                related_fields=missing_fields,
                related_values={},
                score_penalty=100
            )
        return None

    def validate_date_format(self, record: TrapRecord) -> Optional[ValidationIssue]:
        """校验日期格式"""
        date_str = record.capture_date
        if not date_str:
            return None

        valid_formats = ['%Y-%m-%d', '%Y/%m/%d', '%Y%m%d']
        parsed_date = None

        for fmt in valid_formats:
            try:
                parsed_date = datetime.strptime(date_str, fmt)
                break
            except ValueError:
                continue

        if parsed_date is None:
            return ValidationIssue(
                issue_id=f"DATE_{record.record_id}",
                rule_id="INVALID_DATE",
                rule_name="日期无效",
                level="critical",
                level_name="严重错误",
                severity="必须修正",
                description="拍摄日期格式不正确",
                reason=f"日期 '{date_str}' 无法解析。支持的格式: YYYY-MM-DD, YYYY/MM/DD, YYYYMMDD。",
                suggestion="请使用标准日期格式，例如: 2024-05-10 或 2024/05/10。",
                related_fields=['capture_date'],
                related_values={'capture_date': date_str},
                score_penalty=90
            )

        if parsed_date > datetime.now():
            return ValidationIssue(
                issue_id=f"FUTURE_{record.record_id}",
                rule_id="INVALID_DATE",
                rule_name="日期无效",
                level="critical",
                level_name="严重错误",
                severity="必须修正",
                description="拍摄日期是未来日期",
                reason=f"日期 '{date_str}' 是未来日期，超出当前时间范围。",
                suggestion="请检查日期是否输入错误。诱捕板数据应该是历史数据，不应该是未来日期。",
                related_fields=['capture_date'],
                related_values={'capture_date': date_str, 'current_date': datetime.now().strftime('%Y-%m-%d')},
                score_penalty=90
            )

        return None

    def validate_negative_counts(self, record: TrapRecord) -> List[ValidationIssue]:
        """校验负数计数"""
        issues = []
        for pest_count in record.pest_counts:
            if pest_count.ai_count < 0:
                issues.append(ValidationIssue(
                    issue_id=f"NEG_{record.record_id}_{pest_count.pest_type}_ai",
                    rule_id="NEGATIVE_COUNT",
                    rule_name="负数计数",
                    level="critical",
                    level_name="严重错误",
                    severity="必须修正",
                    description=f"{pest_count.pest_name}的AI计数为负数",
                    reason=f"{pest_count.pest_name}的AI计数为 {pest_count.ai_count}。虫害数量不能为负数。",
                    suggestion=f"请检查 {pest_count.pest_name} 的AI计数。如果是输入错误，请修正为正确的非负整数。",
                    related_fields=[f'{pest_count.pest_type}_ai_count'],
                    related_values={'pest_type': pest_count.pest_type, 'ai_count': pest_count.ai_count},
                    score_penalty=100
                ))
            if pest_count.final_count < 0:
                issues.append(ValidationIssue(
                    issue_id=f"NEG_{record.record_id}_{pest_count.pest_type}_final",
                    rule_id="NEGATIVE_COUNT",
                    rule_name="负数计数",
                    level="critical",
                    level_name="严重错误",
                    severity="必须修正",
                    description=f"{pest_count.pest_name}的最终计数为负数",
                    reason=f"{pest_count.pest_name}的最终计数为 {pest_count.final_count}。虫害数量不能为负数。",
                    suggestion=f"请检查 {pest_count.pest_name} 的最终计数。如果是输入错误，请修正为正确的非负整数。",
                    related_fields=[f'{pest_count.pest_type}_final_count'],
                    related_values={'pest_type': pest_count.pest_type, 'final_count': pest_count.final_count},
                    score_penalty=100
                ))
        return issues

    def validate_excessive_counts(self, record: TrapRecord) -> List[ValidationIssue]:
        """校验计数异常偏高"""
        issues = []
        max_threshold = 200
        for pest_count in record.pest_counts:
            if pest_count.ai_count > max_threshold:
                issues.append(ValidationIssue(
                    issue_id=f"EXC_{record.record_id}_{pest_count.pest_type}_ai",
                    rule_id="COUNT_EXCEEDS_THRESHOLD",
                    rule_name="计数异常偏高",
                    level="high",
                    level_name="高优先级问题",
                    severity="建议立即修正",
                    description=f"{pest_count.pest_name}的AI计数异常偏高",
                    reason=f"{pest_count.pest_name}的AI计数为 {pest_count.ai_count}，超过合理阈值 {max_threshold}。人工计数通常不会超过这个数量。",
                    suggestion=f"请复核 {pest_count.pest_name} 的AI计数 {pest_count.ai_count}。可能是AI误识别、图片重叠或数据录入错误。",
                    related_fields=[f'{pest_count.pest_type}_ai_count'],
                    related_values={'pest_type': pest_count.pest_type, 'ai_count': pest_count.ai_count, 'threshold': max_threshold},
                    score_penalty=50
                ))
            if pest_count.final_count > max_threshold:
                issues.append(ValidationIssue(
                    issue_id=f"EXC_{record.record_id}_{pest_count.pest_type}_final",
                    rule_id="COUNT_EXCEEDS_THRESHOLD",
                    rule_name="计数异常偏高",
                    level="high",
                    level_name="高优先级问题",
                    severity="建议立即修正",
                    description=f"{pest_count.pest_name}的最终计数异常偏高",
                    reason=f"{pest_count.pest_name}的最终计数为 {pest_count.final_count}，超过合理阈值 {max_threshold}。",
                    suggestion=f"请复核 {pest_count.pest_name} 的最终计数 {pest_count.final_count}。",
                    related_fields=[f'{pest_count.pest_type}_final_count'],
                    related_values={'pest_type': pest_count.pest_type, 'final_count': pest_count.final_count, 'threshold': max_threshold},
                    score_penalty=50
                ))
        return issues

    def validate_duplicates(self, records: List[TrapRecord]) -> List[ValidationIssue]:
        """校验重复记录"""
        seen = {}
        issues = []

        for record in records:
            dup_key = record.get_duplicate_key()
            if dup_key in seen:
                original_record = seen[dup_key]
                issues.append(ValidationIssue(
                    issue_id=f"DUP_{record.record_id}",
                    rule_id="DUPLICATE_RECORD",
                    rule_name="重复记录",
                    level="critical",
                    level_name="严重错误",
                    severity="必须修正",
                    description=f"诱捕板 {record.trap_board_id} 在 {record.capture_date} 存在重复记录",
                    reason=f"系统检测到同一诱捕板在同一天存在多条记录。原始记录ID: {original_record.record_id}，重复记录ID: {record.record_id}。",
                    suggestion=f"请删除重复记录或合并数据。诱捕板 {record.trap_board_id} 在 {record.capture_date} 应该只有一条记录。",
                    related_fields=['trap_board_id', 'capture_date'],
                    related_values={
                        'trap_board_id': record.trap_board_id,
                        'capture_date': record.capture_date,
                        'original_record_id': original_record.record_id,
                        'duplicate_record_id': record.record_id
                    },
                    score_penalty=80
                ))
            else:
                seen[dup_key] = record

        return issues

    def validate_manual_correction(self, record: TrapRecord) -> List[ValidationIssue]:
        """校验人工修正"""
        issues = []
        for pest_count in record.pest_counts:
            if not pest_count.is_manual_corrected:
                continue

            diff_percent = pest_count.get_count_difference_percent()
            if diff_percent is None:
                continue

            if diff_percent > 50:
                issues.append(ValidationIssue(
                    issue_id=f"MC_LG_{record.record_id}_{pest_count.pest_type}",
                    rule_id="MANUAL_CORRECTION_LARGE",
                    rule_name="人工改幅度过大",
                    level="high",
                    level_name="高优先级问题",
                    severity="建议检查",
                    description=f"{pest_count.pest_name}的人工修正幅度过大",
                    reason=f"AI计数为 {pest_count.ai_count}，人工修正后为 {pest_count.final_count}，差异 {diff_percent:.1f}%。过大的修正可能意味着AI识别存在系统性问题或人工修正有误。",
                    suggestion=f"请重新检查 {pest_count.pest_name} 的计数。AI: {pest_count.ai_count}，人工: {pest_count.final_count}。如果修正理由充分，请添加详细备注说明。",
                    related_fields=[f'{pest_count.pest_type}_ai_count', f'{pest_count.pest_type}_final_count'],
                    related_values={
                        'pest_type': pest_count.pest_type,
                        'ai_count': pest_count.ai_count,
                        'final_count': pest_count.final_count,
                        'difference_percent': round(diff_percent, 1),
                        'threshold': 50
                    },
                    score_penalty=45
                ))
            elif diff_percent > 10:
                issues.append(ValidationIssue(
                    issue_id=f"MC_SM_{record.record_id}_{pest_count.pest_type}",
                    rule_id="MANUAL_CORRECTION_SMALL",
                    rule_name="人工改幅度过小",
                    level="medium",
                    level_name="中优先级问题",
                    severity="建议检查",
                    description=f"{pest_count.pest_name}的人工修正有一定差异",
                    reason=f"AI计数为 {pest_count.ai_count}，人工修正后为 {pest_count.final_count}，差异 {diff_percent:.1f}%。",
                    suggestion=f"确认 {pest_count.pest_name} 的人工修正是否正确。AI: {pest_count.ai_count}，人工: {pest_count.final_count}。",
                    related_fields=[f'{pest_count.pest_type}_ai_count', f'{pest_count.pest_type}_final_count'],
                    related_values={
                        'pest_type': pest_count.pest_type,
                        'ai_count': pest_count.ai_count,
                        'final_count': pest_count.final_count,
                        'difference_percent': round(diff_percent, 1)
                    },
                    score_penalty=20
                ))
        return issues

    def validate_rounds_consistency(self, record: TrapRecord) -> List[ValidationIssue]:
        """校验多轮复核一致性"""
        issues = []
        for pest_count in record.pest_counts:
            diff_percent = pest_count.get_rounds_difference_percent()
            if diff_percent is None:
                continue

            if diff_percent > 10:
                issues.append(ValidationIssue(
                    issue_id=f"ROUND_{record.record_id}_{pest_count.pest_type}",
                    rule_id="COUNT_MISMATCH_BETWEEN_ROUNDS",
                    rule_name="多轮复核计数不一致",
                    level="medium",
                    level_name="中优先级问题",
                    severity="建议检查",
                    description=f"{pest_count.pest_name}的两轮复核计数差异较大",
                    reason=f"第一轮复核: {pest_count.manual_count_round1}，第二轮复核: {pest_count.manual_count_round2}，差异 {diff_percent:.1f}%。",
                    suggestion=f"请进行第三轮复核以确定 {pest_count.pest_name} 的正确数量。第一轮: {pest_count.manual_count_round1}，第二轮: {pest_count.manual_count_round2}。",
                    related_fields=[f'{pest_count.pest_type}_round1', f'{pest_count.pest_type}_round2'],
                    related_values={
                        'pest_type': pest_count.pest_type,
                        'round1': pest_count.manual_count_round1,
                        'round2': pest_count.manual_count_round2,
                        'difference_percent': round(diff_percent, 1),
                        'threshold': 10
                    },
                    score_penalty=30
                ))
            elif diff_percent > 5:
                issues.append(ValidationIssue(
                    issue_id=f"ROUND_MN_{record.record_id}_{pest_count.pest_type}",
                    rule_id="COUNT_MISMATCH_MINOR",
                    rule_name="轻微计数差异",
                    level="low",
                    level_name="低优先级提醒",
                    severity="建议注意",
                    description=f"{pest_count.pest_name}的两轮复核存在轻微差异",
                    reason=f"第一轮复核: {pest_count.manual_count_round1}，第二轮复核: {pest_count.manual_count_round2}，差异 {diff_percent:.1f}%。",
                    suggestion=f"建议确认 {pest_count.pest_name} 的最终计数。",
                    related_fields=[f'{pest_count.pest_type}_round1', f'{pest_count.pest_type}_round2'],
                    related_values={
                        'pest_type': pest_count.pest_type,
                        'round1': pest_count.manual_count_round1,
                        'round2': pest_count.manual_count_round2,
                        'difference_percent': round(diff_percent, 1)
                    },
                    score_penalty=10
                ))
        return issues

    def validate_optional_fields(self, record: TrapRecord) -> List[ValidationIssue]:
        """校验可选字段"""
        issues = []
        missing_optional = []

        if not record.capture_time:
            missing_optional.append('拍摄时间')
        if not record.operator:
            missing_optional.append('操作员')
        if not record.image_path:
            missing_optional.append('图片路径')

        if missing_optional:
            issues.append(ValidationIssue(
                issue_id=f"OPT_{record.record_id}",
                rule_id="MISSING_OPTIONAL_FIELD",
                rule_name="缺少可选字段",
                level="medium",
                level_name="中优先级问题",
                severity="建议补充",
                description="记录缺少辅助信息字段",
                reason=f"缺少以下可选字段: {', '.join(missing_optional)}。这些信息有助于追踪和复核数据。",
                suggestion=f"建议补充以下信息: {', '.join(missing_optional)}。拍摄时间用于精确追踪，操作员用于责任追溯，图片路径用于后续复核。",
                related_fields=missing_optional,
                related_values={},
                score_penalty=15
            ))

        return issues

    def validate_count_sum(self, record: TrapRecord) -> Optional[ValidationIssue]:
        """校验计数总和"""
        total_ai = record.get_total_ai_count()
        total_final = record.get_total_final_count()

        if record.total_ai_count != 0 and total_ai != record.total_ai_count:
            return ValidationIssue(
                issue_id=f"SUM_AI_{record.record_id}",
                rule_id="INCONSISTENT_COUNT_SUM",
                rule_name="计数总和不一致",
                level="high",
                level_name="高优先级问题",
                severity="建议立即修正",
                description="AI计数总和与分项之和不符",
                reason=f"记录中AI计数总和为 {record.total_ai_count}，但分项求和为 {total_ai}，相差 {abs(record.total_ai_count - total_ai)}。",
                suggestion=f"请检查AI计数的总和是否正确。分项之和: {total_ai}，记录总和: {record.total_ai_count}。",
                related_fields=['total_ai_count'],
                related_values={
                    'record_total': record.total_ai_count,
                    'calculated_total': total_ai,
                    'difference': abs(record.total_ai_count - total_ai)
                },
                score_penalty=60
            )

        if record.total_final_count != 0 and total_final != record.total_final_count:
            return ValidationIssue(
                issue_id=f"SUM_FINAL_{record.record_id}",
                rule_id="INCONSISTENT_COUNT_SUM",
                rule_name="计数总和不一致",
                level="high",
                level_name="高优先级问题",
                severity="建议立即修正",
                description="最终计数总和与分项之和不符",
                reason=f"记录中最终计数总和为 {record.total_final_count}，但分项求和为 {total_final}。",
                suggestion=f"请检查最终计数的总和是否正确。分项之和: {total_final}，记录总和: {record.total_final_count}。",
                related_fields=['total_final_count'],
                related_values={
                    'record_total': record.total_final_count,
                    'calculated_total': total_final
                },
                score_penalty=60
            )

        return None

    def validate_pest_types(self, record: TrapRecord) -> List[ValidationIssue]:
        """校验虫害类型"""
        issues = []
        for pest_count in record.pest_counts:
            pest_key = pest_count.pest_type.lower()
            pest_name = pest_count.pest_name.lower()

            if pest_key not in self.valid_pest_types and pest_name not in self.valid_pest_types:
                issues.append(ValidationIssue(
                    issue_id=f"PEST_{record.record_id}_{pest_count.pest_type}",
                    rule_id="UNEXPECTED_PEST_TYPE",
                    rule_name="非预期虫害类型",
                    level="medium",
                    level_name="中优先级问题",
                    severity="建议确认",
                    description=f"检测到未定义的虫害类型: {pest_count.pest_name}",
                    reason=f"虫害类型 '{pest_count.pest_name}' (代码: {pest_count.pest_type}) 不在规则库中定义。可能是新虫害类型或数据录入错误。",
                    suggestion=f"请确认虫害类型 '{pest_count.pest_name}' 是否正确。如果是新发现的虫害类型，请联系管理员更新规则库。",
                    related_fields=['pest_type'],
                    related_values={
                        'pest_type_code': pest_count.pest_type,
                        'pest_type_name': pest_count.pest_name
                    },
                    score_penalty=25
                ))
        return issues

    def analyze_single_record(self, record: TrapRecord) -> AnalysisResult:
        """分析单条记录"""
        result = AnalysisResult(
            record_id=record.record_id,
            trap_board_id=record.trap_board_id,
            greenhouse_id=record.greenhouse_id,
            capture_date=record.capture_date
        )

        issue = self.validate_required_fields(record)
        if issue:
            result.add_issue(issue)

        issue = self.validate_date_format(record)
        if issue:
            result.add_issue(issue)

        for issue in self.validate_negative_counts(record):
            result.add_issue(issue)

        for issue in self.validate_excessive_counts(record):
            result.add_issue(issue)

        for issue in self.validate_manual_correction(record):
            result.add_issue(issue)

        for issue in self.validate_rounds_consistency(record):
            result.add_issue(issue)

        for issue in self.validate_optional_fields(record):
            result.add_issue(issue)

        issue = self.validate_count_sum(record)
        if issue:
            result.add_issue(issue)

        for issue in self.validate_pest_types(record):
            result.add_issue(issue)

        self._build_pest_summary(result, record)
        self._check_pest_alert(result, record)
        self._determine_grade(result)
        self._build_confidence_notes(result)

        return result

    def _build_pest_summary(self, result: AnalysisResult, record: TrapRecord):
        """构建虫害摘要"""
        thresholds = self._get_alert_thresholds()
        total_count = 0

        for pest_count in record.pest_counts:
            alert_level = "normal"
            if pest_count.final_count >= thresholds['high']:
                alert_level = "high"
            elif pest_count.final_count >= thresholds['medium']:
                alert_level = "medium"
            elif pest_count.final_count >= thresholds['low']:
                alert_level = "low"

            result.pest_summary[pest_count.pest_type] = {
                'name': pest_count.pest_name,
                'ai_count': pest_count.ai_count,
                'final_count': pest_count.final_count,
                'manual_corrected': pest_count.is_manual_corrected,
                'alert_level': alert_level
            }
            total_count += pest_count.final_count

        result.pest_summary['_total'] = {
            'ai_count': record.get_total_ai_count(),
            'final_count': total_count
        }

    def _check_pest_alert(self, result: AnalysisResult, record: TrapRecord):
        """检查虫害预警"""
        thresholds = self._get_alert_thresholds()
        total_count = record.get_total_final_count()

        if total_count >= thresholds['high']:
            result.alert_level = "high"
            result.alert_message = f"高预警！总虫量 {total_count} 头，超过高风险阈值 {thresholds['high']} 头，请立即采取防治措施。"
        elif total_count >= thresholds['medium']:
            result.alert_level = "medium"
            result.alert_message = f"中预警！总虫量 {total_count} 头，超过中风险阈值 {thresholds['medium']} 头，建议加强监测。"
        elif total_count >= thresholds['low']:
            result.alert_level = "low"
            result.alert_message = f"低预警！总虫量 {total_count} 头，超过低风险阈值 {thresholds['low']} 头，建议继续观察。"
        else:
            result.alert_level = "normal"
            result.alert_message = f"正常。总虫量 {total_count} 头，在安全范围内。"

    def _determine_grade(self, result: AnalysisResult):
        """确定评级"""
        if result.has_critical_issues():
            result.quality_grade = "D"
            result.quality_grade_name = "不合格"
            return

        grade_code, grade_name = self._get_grade_for_score(result.quality_score)
        result.quality_grade = grade_code
        result.quality_grade_name = grade_name

    def _build_confidence_notes(self, result: AnalysisResult):
        """构建置信度说明"""
        notes = []

        if result.has_critical_issues():
            notes.append("⚠️ 存在严重错误，数据质量无法保证，建议修正后重新分析。")

        critical_count = result.count_issues_by_level("critical")
        high_count = result.count_issues_by_level("high")
        medium_count = result.count_issues_by_level("medium")
        low_count = result.count_issues_by_level("low")

        if critical_count > 0:
            notes.append(f"🔴 严重问题 {critical_count} 个：必须修正，否则数据不可用。")
        if high_count > 0:
            notes.append(f"🟠 高优先级问题 {high_count} 个：建议立即检查。")
        if medium_count > 0:
            notes.append(f"🟡 中优先级问题 {medium_count} 个：建议核查确认。")
        if low_count > 0:
            notes.append(f"🔵 低优先级提醒 {low_count} 个：建议优化但不影响核心分析。")

        if not notes:
            notes.append("✅ 数据质量良好，未发现明显问题。")

        result.confidence_notes = notes

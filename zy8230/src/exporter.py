import pandas as pd
from pathlib import Path
from typing import Dict, List
from datetime import datetime

from .data_loader import DataIssue
from .analyzer import AnalysisResult, ScoreAnalyzer


class Exporter:
    def __init__(self,
                 data_loader: 'DataLoader',
                 analyzer: ScoreAnalyzer,
                 result: AnalysisResult):
        self.data_loader = data_loader
        self.analyzer = analyzer
        self.result = result

    def export_issues_csv(self, output_path: str) -> str:
        output_file = Path(output_path)
        
        issues_df = self.data_loader.get_issues_df()
        
        conflicts_df = self.analyzer.get_review_conflicts_df(self.result.review_conflicts)
        conflicts_df = conflicts_df[conflicts_df['是否冲突'] == '是'].copy()
        if not conflicts_df.empty:
            conflicts_df['issue_type'] = 'review_conflict'
            conflicts_df['description'] = '二评评分冲突'
        
        missing_df = self.analyzer.get_missing_reviews_df(self.result.missing_reviews)
        if not missing_df.empty:
            missing_df['issue_type'] = 'missing_review'
            missing_df['description'] = '疑似漏评'
        
        all_issues = []
        
        if not issues_df.empty:
            all_issues.append(issues_df)
        
        if not conflicts_df.empty:
            all_issues.append(conflicts_df)
        
        if not missing_df.empty:
            all_issues.append(missing_df)
        
        if not all_issues:
            empty_df = pd.DataFrame(columns=['issue_type', 'description', '生成时间'])
            empty_df.to_csv(output_file, index=False, encoding='utf-8-sig')
            return str(output_file)
        
        combined_df = pd.concat(all_issues, ignore_index=True, sort=False)
        combined_df['生成时间'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        combined_df.to_csv(output_file, index=False, encoding='utf-8-sig')
        return str(output_file)

    def export_review_report_md(self, output_path: str) -> str:
        output_file = Path(output_path)
        
        report = self._generate_report_content()
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(report)
        
        return str(output_file)

    def _generate_report_content(self) -> str:
        summary = self.result.summary
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        lines = [
            '# 实验课主观题阅卷一致性复核报告',
            '',
            f'**生成时间**: {now}',
            '',
            '---',
            '',
            '## 一、数据概览',
            '',
            '| 指标 | 数值 |',
            '|------|------|',
            f"| 课程数量 | {summary.get('total_courses', 0)} |",
            f"| 题目总数 | {summary.get('total_questions', 0)} |",
            f"| 学生总数 | {summary.get('total_students', 0)} |",
            f"| 教师总数 | {summary.get('total_teachers', 0)} |",
            f"| 教师评分记录数 | {summary.get('total_teacher_ratings', 0)} |",
            '',
            '---',
            '',
            '## 二、分题差异分析',
            '',
        ]
        
        if self.result.question_diffs:
            lines.extend([
                '| 课程 | 题号 | 满分 | 学生平均分 | 教师平均分 | 分差 | 分差率 | 学生数 |',
                '|------|------|------|------------|------------|------|--------|--------|',
            ])
            
            for q in self.result.question_diffs:
                avg_student = round(q.avg_score, 2) if pd.notna(q.avg_score) else '-'
                avg_teacher = round(q.avg_teacher_score, 2) if pd.notna(q.avg_teacher_score) else '-'
                diff = round(q.score_diff, 2) if pd.notna(q.score_diff) else '-'
                diff_pct = f"{round(q.score_diff_percent, 2)}%" if pd.notna(q.score_diff_percent) else '-'
                
                lines.append(
                    f"| {q.course} | {q.question_num} | {q.max_score} | "
                    f"{avg_student} | {avg_teacher} | {diff} | {diff_pct} | {q.student_count} |"
                )
        else:
            lines.append('暂无分题差异数据。')
        
        lines.extend([
            '',
            '---',
            '',
            '## 三、教师评分严格度分析',
            '',
        ])
        
        if self.result.teacher_strictness:
            lines.extend([
                '| 教师 | 评分次数 | 平均给分 | 严格度分数 | 严格度标签 |',
                '|------|----------|----------|------------|------------|',
            ])
            
            for t in self.result.teacher_strictness:
                avg_score = round(t.avg_score, 2) if pd.notna(t.avg_score) else '-'
                strictness = round(t.strictness_score, 2)
                
                lines.append(
                    f"| {t.teacher} | {t.total_ratings} | {avg_score} | "
                    f"{strictness} | {t.strictness_label} |"
                )
        else:
            lines.append('暂无教师严格度数据。')
        
        lines.extend([
            '',
            '**严格度说明**：',
            '- **偏严**: 严格度分数 < -1，教师给分普遍低于同题其他教师',
            '- **正常**: -1 ≤ 严格度分数 ≤ 1，教师给分与整体水平一致',
            '- **偏松**: 严格度分数 > 1，教师给分普遍高于同题其他教师',
            '',
            '---',
            '',
            '## 四、二评冲突分析',
            '',
        ])
        
        conflicts = [c for c in self.result.review_conflicts if c.is_conflict]
        
        if conflicts:
            lines.extend([
                f"**检测到 {len(conflicts)} 条冲突记录**",
                '',
                '| 学生ID | 课程 | 题号 | 教师1 | 得分1 | 教师2 | 得分2 | 分差 | 分差率 |',
                '|--------|------|------|-------|-------|-------|-------|------|--------|',
            ])
            
            for c in conflicts:
                diff_pct = f"{round(c.diff_percent, 2)}%"
                
                lines.append(
                    f"| {c.student_id} | {c.course} | {c.question_num} | "
                    f"{c.teacher1} | {c.score1} | {c.teacher2} | {c.score2} | "
                    f"{c.diff} | {diff_pct} |"
                )
        else:
            lines.append('未检测到二评冲突记录。')
        
        lines.extend([
            '',
            '---',
            '',
            '## 五、疑似漏评列表',
            '',
        ])
        
        if self.result.missing_reviews:
            lines.extend([
                f"**检测到 {len(self.result.missing_reviews)} 条疑似漏评记录**",
                '',
                '| 学生ID | 课程 | 题号 | 预期评卷数 | 实际评卷数 | 已评教师 |',
                '|--------|------|------|------------|------------|----------|',
            ])
            
            for m in self.result.missing_reviews:
                existing = ', '.join(m.existing_teachers) if m.existing_teachers else '-'
                
                lines.append(
                    f"| {m.student_id} | {m.course} | {m.question_num} | "
                    f"{m.expected_teachers} | {m.actual_teachers} | {existing} |"
                )
        else:
            lines.append('未检测到疑似漏评记录。')
        
        lines.extend([
            '',
            '---',
            '',
            '## 六、数据问题预警',
            '',
        ])
        
        data_issues = self.data_loader.get_issues()
        
        if data_issues:
            for issue in data_issues:
                lines.append(f"### {issue.issue_type}")
                lines.append('')
                lines.append(f"**描述**: {issue.description}")
                lines.append('')
                lines.append(f"**影响记录数**: {len(issue.affected_records)}")
                lines.append('')
                
                if issue.issue_type == 'duplicate_ratings':
                    lines.append('| 学生ID | 课程 | 题号 | 教师 | 重复次数 | 评分历史 |')
                    lines.append('|--------|------|------|------|----------|----------|')
                    for rec in issue.affected_records:
                        scores = ', '.join(map(str, rec.get('scores', [])))
                        lines.append(
                            f"| {rec.get('student_id', '-')} | {rec.get('course', '-')} | "
                            f"{rec.get('question_num', '-')} | {rec.get('teacher', '-')} | "
                            f"{rec.get('count', 0)} | {scores} |"
                        )
                
                elif issue.issue_type == 'missing_max_score_config':
                    lines.append('| 课程 | 题号 | 影响学生数 |')
                    lines.append('|------|------|------------|')
                    for rec in issue.affected_records:
                        lines.append(
                            f"| {rec.get('course', '-')} | {rec.get('question_num', '-')} | "
                            f"{rec.get('student_count', 0)} |"
                        )
                
                lines.append('')
        else:
            lines.append('未检测到数据加载或预处理过程中的问题。')
        
        lines.extend([
            '',
            '---',
            '',
            '## 七、建议措施',
            '',
            '1. **二评冲突**: 对于分差超过阈值的评分记录，建议安排第三位教师进行仲裁评分。',
            '',
            '2. **教师严格度**:',
            '   - 对于"偏严"的教师，建议检查其评分标准是否过于严格，可组织标准卷校准。',
            '   - 对于"偏松"的教师，建议提醒其关注扣分规则，确保评分的严谨性。',
            '',
            '3. **疑似漏评**: 对于只收到一位教师评分的学生答题，建议尽快安排第二位教师完成评分。',
            '',
            '4. **数据质量**: 关注数据预警中的问题，建立定期的数据质量检查机制。',
            '',
            '---',
            '',
            '*报告结束*',
        ])
        
        return '\n'.join(lines)

    def export_all(self, issues_path: str, report_path: str) -> Dict[str, str]:
        results = {}
        results['issues_csv'] = self.export_issues_csv(issues_path)
        results['report_md'] = self.export_review_report_md(report_path)
        return results

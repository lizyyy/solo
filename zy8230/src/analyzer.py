import pandas as pd
import numpy as np
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass, field
from collections import defaultdict


@dataclass
class QuestionDiff:
    course: str
    question_num: int
    max_score: float
    avg_score: float
    avg_teacher_score: float
    score_diff: float
    score_diff_percent: float
    teacher_count: int
    student_count: int


@dataclass
class TeacherStrictness:
    teacher: str
    courses: List[str]
    total_ratings: int
    avg_score: float
    overall_avg: float
    strictness_score: float
    strictness_label: str


@dataclass
class ReviewConflict:
    student_id: str
    course: str
    question_num: int
    teacher1: str
    score1: float
    teacher2: str
    score2: float
    diff: float
    diff_percent: float
    max_score: float
    is_conflict: bool


@dataclass
class MissingReview:
    student_id: str
    course: str
    question_num: int
    expected_teachers: int
    actual_teachers: int
    existing_teachers: List[str]
    max_score: float


@dataclass
class AnalysisResult:
    question_diffs: List[QuestionDiff] = field(default_factory=list)
    teacher_strictness: List[TeacherStrictness] = field(default_factory=list)
    review_conflicts: List[ReviewConflict] = field(default_factory=list)
    missing_reviews: List[MissingReview] = field(default_factory=list)
    summary: Dict = field(default_factory=dict)


class ScoreAnalyzer:
    def __init__(self,
                 student_scores: pd.DataFrame,
                 teacher_ratings: pd.DataFrame,
                 exam_config: Dict,
                 conflict_threshold: float = 3.0,
                 conflict_threshold_percent: float = 0.3):
        self.student_scores = student_scores.copy()
        self.teacher_ratings = teacher_ratings.copy()
        self.exam_config = exam_config
        self.conflict_threshold = conflict_threshold
        self.conflict_threshold_percent = conflict_threshold_percent
        
        self._max_scores: Dict[Tuple[str, int], float] = {}
        self._load_max_scores()

    def _load_max_scores(self):
        for course in self.exam_config.get('courses', []):
            course_name = course.get('name')
            for question in course.get('questions', []):
                key = (course_name, question.get('num'))
                self._max_scores[key] = question.get('max_score', 0)
        
        for _, row in self.student_scores.iterrows():
            key = (row['course'], row['question_num'])
            if key not in self._max_scores:
                self._max_scores[key] = row.get('max_score', 0)

    def _get_max_score(self, course: str, question_num: int) -> float:
        return self._max_scores.get((course, question_num), 0)

    def analyze(self) -> AnalysisResult:
        result = AnalysisResult()
        
        result.question_diffs = self._analyze_question_diffs()
        result.teacher_strictness = self._analyze_teacher_strictness()
        result.review_conflicts = self._analyze_review_conflicts()
        result.missing_reviews = self._analyze_missing_reviews()
        result.summary = self._generate_summary(result)
        
        return result

    def _analyze_question_diffs(self) -> List[QuestionDiff]:
        question_diffs = []
        
        for (course, question_num), student_group in self.student_scores.groupby(['course', 'question_num']):
            max_score = self._get_max_score(course, question_num)
            
            teacher_mask = (
                (self.teacher_ratings['course'] == course) &
                (self.teacher_ratings['question_num'] == question_num)
            )
            teacher_scores = self.teacher_ratings[teacher_mask]
            
            avg_student_score = student_group['score'].mean()
            avg_teacher_score = teacher_scores['score'].mean() if len(teacher_scores) > 0 else np.nan
            teacher_count = teacher_scores['teacher'].nunique()
            student_count = student_group['student_id'].nunique()
            
            if pd.notna(avg_student_score) and pd.notna(avg_teacher_score):
                score_diff = avg_teacher_score - avg_student_score
                score_diff_percent = (score_diff / max_score * 100) if max_score > 0 else 0
            else:
                score_diff = np.nan
                score_diff_percent = np.nan
            
            question_diffs.append(QuestionDiff(
                course=course,
                question_num=question_num,
                max_score=max_score,
                avg_score=avg_student_score,
                avg_teacher_score=avg_teacher_score,
                score_diff=score_diff,
                score_diff_percent=score_diff_percent,
                teacher_count=teacher_count,
                student_count=student_count
            ))
        
        return question_diffs

    def _analyze_teacher_strictness(self) -> List[TeacherStrictness]:
        teacher_data = defaultdict(lambda: {
            'courses': set(),
            'total_ratings': 0,
            'scores': [],
            'relative_scores': []
        })
        
        overall_avg = self.teacher_ratings['score'].mean()
        
        for (course, question_num), group in self.teacher_ratings.groupby(['course', 'question_num']):
            question_avg = group['score'].mean()
            
            for _, row in group.iterrows():
                teacher = row['teacher']
                score = row['score']
                relative_score = score - question_avg
                
                teacher_data[teacher]['courses'].add(course)
                teacher_data[teacher]['total_ratings'] += 1
                teacher_data[teacher]['scores'].append(score)
                teacher_data[teacher]['relative_scores'].append(relative_score)
        
        strictness_list = []
        
        for teacher, data in teacher_data.items():
            avg_score = np.mean(data['scores']) if data['scores'] else np.nan
            avg_relative = np.mean(data['relative_scores']) if data['relative_scores'] else 0
            
            if avg_relative < -1:
                label = '偏严'
            elif avg_relative > 1:
                label = '偏松'
            else:
                label = '正常'
            
            strictness_list.append(TeacherStrictness(
                teacher=teacher,
                courses=sorted(data['courses']),
                total_ratings=data['total_ratings'],
                avg_score=avg_score,
                overall_avg=overall_avg,
                strictness_score=avg_relative,
                strictness_label=label
            ))
        
        return strictness_list

    def _analyze_review_conflicts(self) -> List[ReviewConflict]:
        conflicts = []
        
        for (student_id, course, question_num), group in self.teacher_ratings.groupby(
            ['student_id', 'course', 'question_num']
        ):
            if len(group) < 2:
                continue
            
            teachers = group['teacher'].tolist()
            scores = group['score'].tolist()
            max_score = self._get_max_score(course, question_num)
            
            for i in range(len(group)):
                for j in range(i + 1, len(group)):
                    score1 = scores[i]
                    score2 = scores[j]
                    diff = abs(score1 - score2)
                    diff_percent = (diff / max_score * 100) if max_score > 0 else 0
                    
                    is_conflict = (
                        diff > self.conflict_threshold or
                        (max_score > 0 and diff_percent > self.conflict_threshold_percent * 100)
                    )
                    
                    conflicts.append(ReviewConflict(
                        student_id=student_id,
                        course=course,
                        question_num=question_num,
                        teacher1=teachers[i],
                        score1=score1,
                        teacher2=teachers[j],
                        score2=score2,
                        diff=diff,
                        diff_percent=diff_percent,
                        max_score=max_score,
                        is_conflict=is_conflict
                    ))
        
        return conflicts

    def _analyze_missing_reviews(self) -> List[MissingReview]:
        missing_reviews = []
        
        expected_reviewers = 2
        
        for (student_id, course, question_num), student_group in self.student_scores.groupby(
            ['student_id', 'course', 'question_num']
        ):
            teacher_mask = (
                (self.teacher_ratings['student_id'] == student_id) &
                (self.teacher_ratings['course'] == course) &
                (self.teacher_ratings['question_num'] == question_num)
            )
            teacher_reviews = self.teacher_ratings[teacher_mask]
            actual_teachers = teacher_reviews['teacher'].nunique()
            existing_teachers = teacher_reviews['teacher'].unique().tolist()
            
            if actual_teachers < expected_reviewers:
                max_score = self._get_max_score(course, question_num)
                
                missing_reviews.append(MissingReview(
                    student_id=student_id,
                    course=course,
                    question_num=question_num,
                    expected_teachers=expected_reviewers,
                    actual_teachers=actual_teachers,
                    existing_teachers=existing_teachers,
                    max_score=max_score
                ))
        
        return missing_reviews

    def _generate_summary(self, result: AnalysisResult) -> Dict:
        summary = {
            'total_courses': len(self.student_scores['course'].unique()),
            'total_questions': len(self.student_scores.groupby(['course', 'question_num'])),
            'total_students': len(self.student_scores['student_id'].unique()),
            'total_teachers': len(self.teacher_ratings['teacher'].unique()),
            'total_teacher_ratings': len(self.teacher_ratings),
            
            'question_with_large_diff': len([
                q for q in result.question_diffs
                if pd.notna(q.score_diff) and abs(q.score_diff) > 2
            ]),
            
            'strict_teachers': len([t for t in result.teacher_strictness if t.strictness_label == '偏严']),
            'loose_teachers': len([t for t in result.teacher_strictness if t.strictness_label == '偏松']),
            'normal_teachers': len([t for t in result.teacher_strictness if t.strictness_label == '正常']),
            
            'total_conflicts': len([c for c in result.review_conflicts if c.is_conflict]),
            'total_conflict_pairs': len(result.review_conflicts),
            
            'total_missing_reviews': len(result.missing_reviews),
        }
        
        return summary

    def filter_data(self,
                    courses: Optional[List[str]] = None,
                    question_nums: Optional[List[int]] = None,
                    teachers: Optional[List[str]] = None) -> Tuple[pd.DataFrame, pd.DataFrame]:
        filtered_scores = self.student_scores.copy()
        filtered_ratings = self.teacher_ratings.copy()
        
        if courses:
            filtered_scores = filtered_scores[filtered_scores['course'].isin(courses)]
            filtered_ratings = filtered_ratings[filtered_ratings['course'].isin(courses)]
        
        if question_nums:
            filtered_scores = filtered_scores[filtered_scores['question_num'].isin(question_nums)]
            filtered_ratings = filtered_ratings[filtered_ratings['question_num'].isin(question_nums)]
        
        if teachers:
            filtered_ratings = filtered_ratings[filtered_ratings['teacher'].isin(teachers)]
        
        return filtered_scores, filtered_ratings

    def get_question_diffs_df(self, question_diffs: List[QuestionDiff]) -> pd.DataFrame:
        records = []
        for q in question_diffs:
            records.append({
                '课程': q.course,
                '题号': q.question_num,
                '满分': q.max_score,
                '学生平均分': round(q.avg_score, 2) if pd.notna(q.avg_score) else None,
                '教师平均分': round(q.avg_teacher_score, 2) if pd.notna(q.avg_teacher_score) else None,
                '分差': round(q.score_diff, 2) if pd.notna(q.score_diff) else None,
                '分差率(%)': round(q.score_diff_percent, 2) if pd.notna(q.score_diff_percent) else None,
                '参与教师数': q.teacher_count,
                '学生人数': q.student_count
            })
        return pd.DataFrame(records)

    def get_teacher_strictness_df(self, strictness: List[TeacherStrictness]) -> pd.DataFrame:
        records = []
        for t in strictness:
            records.append({
                '教师': t.teacher,
                '教授课程': ', '.join(t.courses),
                '评分次数': t.total_ratings,
                '平均给分': round(t.avg_score, 2) if pd.notna(t.avg_score) else None,
                '整体平均分': round(t.overall_avg, 2) if pd.notna(t.overall_avg) else None,
                '严格度分数': round(t.strictness_score, 2),
                '严格度标签': t.strictness_label
            })
        return pd.DataFrame(records)

    def get_review_conflicts_df(self, conflicts: List[ReviewConflict]) -> pd.DataFrame:
        records = []
        for c in conflicts:
            records.append({
                '学生ID': c.student_id,
                '课程': c.course,
                '题号': c.question_num,
                '教师1': c.teacher1,
                '得分1': c.score1,
                '教师2': c.teacher2,
                '得分2': c.score2,
                '分差': c.diff,
                '分差率(%)': round(c.diff_percent, 2),
                '满分': c.max_score,
                '是否冲突': '是' if c.is_conflict else '否'
            })
        return pd.DataFrame(records)

    def get_missing_reviews_df(self, missing: List[MissingReview]) -> pd.DataFrame:
        records = []
        for m in missing:
            records.append({
                '学生ID': m.student_id,
                '课程': m.course,
                '题号': m.question_num,
                '预期评卷教师数': m.expected_teachers,
                '实际评卷教师数': m.actual_teachers,
                '已评教师': ', '.join(m.existing_teachers),
                '满分': m.max_score
            })
        return pd.DataFrame(records)

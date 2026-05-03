import pandas as pd
import json
import yaml
from pathlib import Path
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
import warnings


@dataclass
class DataIssue:
    issue_type: str
    description: str
    affected_records: List[Dict]


class DataLoader:
    def __init__(self, base_path: str = "sample"):
        self.base_path = Path(base_path)
        self.issues: List[DataIssue] = []
        self.student_scores: Optional[pd.DataFrame] = None
        self.teacher_ratings: Optional[pd.DataFrame] = None
        self.exam_config: Optional[Dict] = None

    def load_all(self,
                 scores_csv: str = "student_scores.csv",
                 ratings_jsonl: str = "teacher_ratings.jsonl",
                 config_yaml: str = "exam_config.yaml") -> Tuple[pd.DataFrame, pd.DataFrame, Dict]:
        self.student_scores = self._load_scores_csv(scores_csv)
        self.teacher_ratings = self._load_ratings_jsonl(ratings_jsonl)
        self.exam_config = self._load_config_yaml(config_yaml)
        
        self._validate_and_clean_data()
        return self.student_scores, self.teacher_ratings, self.exam_config

    def _load_scores_csv(self, filename: str) -> pd.DataFrame:
        file_path = self.base_path / filename
        if not file_path.exists():
            raise FileNotFoundError(f"学生成绩文件不存在: {file_path}")
        
        df = pd.read_csv(file_path)
        required_columns = ['student_id', 'course', 'question_num', 'score', 'max_score']
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            raise ValueError(f"CSV文件缺少必要列: {missing_columns}")
        
        return df

    def _load_ratings_jsonl(self, filename: str) -> pd.DataFrame:
        file_path = self.base_path / filename
        if not file_path.exists():
            raise FileNotFoundError(f"教师评分文件不存在: {file_path}")
        
        records = []
        with open(file_path, 'r', encoding='utf-8') as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                try:
                    record = json.loads(line)
                    records.append(record)
                except json.JSONDecodeError as e:
                    warnings.warn(f"第 {line_num} 行 JSON 解析错误: {e}")
        
        if not records:
            raise ValueError("JSONL 文件为空或格式错误")
        
        df = pd.DataFrame(records)
        required_columns = ['student_id', 'course', 'question_num', 'teacher', 'score']
        missing_columns = [col for col in required_columns if col not in df.columns]
        if missing_columns:
            raise ValueError(f"JSONL 文件缺少必要字段: {missing_columns}")
        
        return df

    def _load_config_yaml(self, filename: str) -> Dict:
        file_path = self.base_path / filename
        if not file_path.exists():
            raise FileNotFoundError(f"配置文件不存在: {file_path}")
        
        with open(file_path, 'r', encoding='utf-8') as f:
            config = yaml.safe_load(f)
        
        if not config:
            raise ValueError("YAML 配置文件为空")
        
        return config

    def _validate_and_clean_data(self):
        self._handle_duplicate_ratings()
        self._handle_missing_max_scores()
        self._validate_score_ranges()

    def _handle_duplicate_ratings(self):
        if self.teacher_ratings is None:
            return
        
        duplicate_records = []
        
        for (student_id, course, question_num, teacher), group in self.teacher_ratings.groupby(
            ['student_id', 'course', 'question_num', 'teacher']
        ):
            if len(group) > 1:
                duplicate_records.append({
                    'student_id': student_id,
                    'course': course,
                    'question_num': question_num,
                    'teacher': teacher,
                    'count': len(group),
                    'scores': group['score'].tolist(),
                    'timestamps': group.get('timestamp', pd.Series()).tolist()
                })
        
        if duplicate_records:
            self.issues.append(DataIssue(
                issue_type='duplicate_ratings',
                description='存在同一学生同一题目由同一老师多次评分的记录',
                affected_records=duplicate_records
            ))
            
            if 'timestamp' in self.teacher_ratings.columns:
                self.teacher_ratings['timestamp'] = pd.to_datetime(self.teacher_ratings['timestamp'])
                self.teacher_ratings = self.teacher_ratings.sort_values('timestamp')
                self.teacher_ratings = self.teacher_ratings.drop_duplicates(
                    subset=['student_id', 'course', 'question_num', 'teacher'],
                    keep='last'
                )
            else:
                self.teacher_ratings = self.teacher_ratings.drop_duplicates(
                    subset=['student_id', 'course', 'question_num', 'teacher'],
                    keep='last'
                )

    def _handle_missing_max_scores(self):
        if self.student_scores is None or self.exam_config is None:
            return
        
        configured_max_scores = {}
        for course in self.exam_config.get('courses', []):
            course_name = course.get('name')
            for question in course.get('questions', []):
                key = (course_name, question.get('num'))
                configured_max_scores[key] = question.get('max_score')
        
        missing_configs = []
        
        for _, row in self.student_scores.iterrows():
            key = (row['course'], row['question_num'])
            if key not in configured_max_scores:
                missing_configs.append({
                    'course': row['course'],
                    'question_num': row['question_num'],
                    'student_count': len(self.student_scores[
                        (self.student_scores['course'] == row['course']) &
                        (self.student_scores['question_num'] == row['question_num'])
                    ]['student_id'].unique())
                })
        
        if missing_configs:
            self.issues.append(DataIssue(
                issue_type='missing_max_score_config',
                description='存在题目未在配置文件中定义满分',
                affected_records=missing_configs
            ))
            
            for key in missing_configs:
                course = key['course']
                q_num = key['question_num']
                csv_max = self.student_scores[
                    (self.student_scores['course'] == course) &
                    (self.student_scores['question_num'] == q_num)
                ]['max_score'].max()
                
                if pd.notna(csv_max):
                    for course_config in self.exam_config.get('courses', []):
                        if course_config.get('name') == course:
                            course_config.setdefault('questions', []).append({
                                'num': q_num,
                                'max_score': csv_max,
                                'deduction_rules': []
                            })
                            break

    def _validate_score_ranges(self):
        if self.student_scores is None or self.teacher_ratings is None:
            return
        
        invalid_scores = []
        
        for df_name, df in [('student_scores', self.student_scores), ('teacher_ratings', self.teacher_ratings)]:
            for _, row in df.iterrows():
                max_score = self._get_max_score(row['course'], row['question_num'])
                score = row['score']
                
                if pd.isna(score) or score < 0 or (max_score is not None and score > max_score):
                    invalid_scores.append({
                        'source': df_name,
                        'student_id': row.get('student_id'),
                        'course': row['course'],
                        'question_num': row['question_num'],
                        'teacher': row.get('teacher'),
                        'score': score,
                        'max_score': max_score
                    })
        
        if invalid_scores:
            self.issues.append(DataIssue(
                issue_type='invalid_score_range',
                description='存在分数超出有效范围(0-满分)的记录',
                affected_records=invalid_scores
            ))

    def _get_max_score(self, course: str, question_num: int) -> Optional[float]:
        if self.exam_config is None:
            return None
        
        for course_config in self.exam_config.get('courses', []):
            if course_config.get('name') == course:
                for question in course_config.get('questions', []):
                    if question.get('num') == question_num:
                        return question.get('max_score')
        
        if self.student_scores is not None:
            mask = (
                (self.student_scores['course'] == course) &
                (self.student_scores['question_num'] == question_num)
            )
            if mask.any():
                return self.student_scores[mask]['max_score'].max()
        
        return None

    def get_issues(self) -> List[DataIssue]:
        return self.issues

    def get_issues_df(self) -> pd.DataFrame:
        rows = []
        for issue in self.issues:
            for record in issue.affected_records:
                row = {
                    'issue_type': issue.issue_type,
                    'description': issue.description,
                    **record
                }
                rows.append(row)
        
        return pd.DataFrame(rows) if rows else pd.DataFrame()

    def get_courses(self) -> List[str]:
        if self.student_scores is None:
            return []
        return sorted(self.student_scores['course'].unique().tolist())

    def get_teachers(self) -> List[str]:
        if self.teacher_ratings is None:
            return []
        return sorted(self.teacher_ratings['teacher'].unique().tolist())

    def get_question_numbers(self, course: Optional[str] = None) -> List[int]:
        if self.student_scores is None:
            return []
        
        df = self.student_scores
        if course:
            df = df[df['course'] == course]
        
        return sorted(df['question_num'].unique().tolist())

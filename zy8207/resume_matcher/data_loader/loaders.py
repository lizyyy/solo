"""
Data Loaders Module
Loads job requirements (YAML), resumes (JSONL), model scores (CSV), and interview results (CSV).
"""

import csv
import json
import yaml
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from pathlib import Path


@dataclass
class JobRequirement:
    """Data class for job requirements from YAML"""
    job_id: str
    job_title: str
    required_skills: List[str] = field(default_factory=list)
    preferred_skills: List[str] = field(default_factory=list)
    experience_min: Optional[float] = None
    experience_max: Optional[float] = None
    education_level: Optional[str] = None
    location: Optional[str] = None
    remote_allowed: bool = False


@dataclass
class CandidateResume:
    """Data class for desensitized resume from JSONL"""
    candidate_id: str
    skills: List[str] = field(default_factory=list)
    total_experience_years: Optional[float] = None
    education_level: Optional[str] = None
    current_location: Optional[str] = None
    willing_to_relocate: bool = False
    current_title: Optional[str] = None
    salary_expectation: Optional[float] = None


@dataclass
class ModelScore:
    """Data class for model score from CSV"""
    candidate_id: str
    job_id: str
    model_score: float
    model_rank: int
    score_breakdown: Dict[str, float] = field(default_factory=dict)


@dataclass
class InterviewResult:
    """Data class for interview result from CSV"""
    candidate_id: str
    job_id: str
    interview_date: Optional[str] = None
    interviewer: Optional[str] = None
    overall_rating: Optional[float] = None
    technical_rating: Optional[float] = None
    behavioral_rating: Optional[float] = None
    final_outcome: str = "unknown"
    rejection_reason: Optional[str] = None
    interview_notes: Optional[str] = None


class YAMLLoader:
    """Loader for job requirements YAML files"""

    @staticmethod
    def load(file_path: str) -> JobRequirement:
        """
        Load job requirements from YAML file.

        Expected YAML structure:
        job_id: JOB001
        job_title: Senior Python Developer
        required_skills:
          - Python
          - Django
          - PostgreSQL
        preferred_skills:
          - AWS
          - Docker
        experience_min: 5
        experience_max: 10
        education_level: Bachelor
        location: Beijing
        remote_allowed: true
        """
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Job requirements file not found: {file_path}")

        with open(path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)

        return JobRequirement(
            job_id=data.get('job_id', 'UNKNOWN'),
            job_title=data.get('job_title', 'Unknown Position'),
            required_skills=data.get('required_skills', []),
            preferred_skills=data.get('preferred_skills', []),
            experience_min=data.get('experience_min'),
            experience_max=data.get('experience_max'),
            education_level=data.get('education_level'),
            location=data.get('location'),
            remote_allowed=data.get('remote_allowed', False)
        )


class JSONLLoader:
    """Loader for desensitized resume JSONL files"""

    @staticmethod
    def load(file_path: str) -> List[CandidateResume]:
        """
        Load resumes from JSONL file.

        Expected JSONL line structure:
        {
          "candidate_id": "CAND001",
          "skills": ["Python", "Django", "REST API"],
          "total_experience_years": 6.5,
          "education_level": "Master",
          "current_location": "Shanghai",
          "willing_to_relocate": true,
          "current_title": "Python Developer",
          "salary_expectation": 25000
        }
        """
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Resumes file not found: {file_path}")

        resumes = []
        with open(path, 'r', encoding='utf-8') as f:
            for line_number, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    resume = CandidateResume(
                        candidate_id=data.get('candidate_id', f'CAND_LINE_{line_number}'),
                        skills=data.get('skills', []),
                        total_experience_years=data.get('total_experience_years'),
                        education_level=data.get('education_level'),
                        current_location=data.get('current_location'),
                        willing_to_relocate=data.get('willing_to_relocate', False),
                        current_title=data.get('current_title'),
                        salary_expectation=data.get('salary_expectation')
                    )
                    resumes.append(resume)
                except json.JSONDecodeError as e:
                    raise ValueError(f"Invalid JSON in line {line_number}: {e}")

        return resumes


class CSVLoader:
    """Base loader for CSV files"""

    @staticmethod
    def _safe_float(value: str, default: float = 0.0) -> float:
        """Safely convert string to float"""
        if not value:
            return default
        try:
            return float(value)
        except (ValueError, TypeError):
            return default

    @staticmethod
    def _safe_int(value: str, default: int = 0) -> int:
        """Safely convert string to int"""
        if not value:
            return default
        try:
            return int(float(value))
        except (ValueError, TypeError):
            return default


class ModelScoreLoader(CSVLoader):
    """Loader for model score CSV files"""

    @staticmethod
    def load(file_path: str) -> List[ModelScore]:
        """
        Load model scores from CSV file.

        Expected CSV columns:
        candidate_id,job_id,model_score,model_rank,skill_score,experience_score,education_score
        CAND001,JOB001,0.85,1,0.9,0.8,0.9
        """
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Model scores file not found: {file_path}")

        scores = []
        with open(path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                score_breakdown = {}
                for key, value in row.items():
                    if key.endswith('_score') and key != 'model_score':
                        score_breakdown[key] = CSVLoader._safe_float(value)

                score = ModelScore(
                    candidate_id=row.get('candidate_id', ''),
                    job_id=row.get('job_id', ''),
                    model_score=CSVLoader._safe_float(row.get('model_score', '0')),
                    model_rank=CSVLoader._safe_int(row.get('model_rank', '0')),
                    score_breakdown=score_breakdown
                )
                scores.append(score)

        return scores

    @staticmethod
    def get_score_by_candidate_job(
        scores: List[ModelScore],
        candidate_id: str,
        job_id: str
    ) -> Optional[ModelScore]:
        """Get model score for specific candidate and job"""
        for score in scores:
            if score.candidate_id == candidate_id and score.job_id == job_id:
                return score
        return None


class InterviewResultLoader(CSVLoader):
    """Loader for interview result CSV files"""

    @staticmethod
    def load(file_path: str) -> List[InterviewResult]:
        """
        Load interview results from CSV file.

        Expected CSV columns:
        candidate_id,job_id,interview_date,interviewer,overall_rating,technical_rating,
        behavioral_rating,final_outcome,rejection_reason,interview_notes
        CAND001,JOB001,2024-01-15,Zhang San,4.5,4.8,4.2,pass,,Excellent technical skills
        CAND002,JOB001,2024-01-16,Li Si,2.0,1.5,2.5,fail,Insufficient Python experience,Lacks depth
        """
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Interview results file not found: {file_path}")

        results = []
        with open(path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                result = InterviewResult(
                    candidate_id=row.get('candidate_id', ''),
                    job_id=row.get('job_id', ''),
                    interview_date=row.get('interview_date'),
                    interviewer=row.get('interviewer'),
                    overall_rating=CSVLoader._safe_float(row.get('overall_rating')) if row.get('overall_rating') else None,
                    technical_rating=CSVLoader._safe_float(row.get('technical_rating')) if row.get('technical_rating') else None,
                    behavioral_rating=CSVLoader._safe_float(row.get('behavioral_rating')) if row.get('behavioral_rating') else None,
                    final_outcome=row.get('final_outcome', 'unknown').lower(),
                    rejection_reason=row.get('rejection_reason'),
                    interview_notes=row.get('interview_notes')
                )
                results.append(result)

        return results

    @staticmethod
    def get_result_by_candidate_job(
        results: List[InterviewResult],
        candidate_id: str,
        job_id: str
    ) -> Optional[InterviewResult]:
        """Get interview result for specific candidate and job"""
        for result in results:
            if result.candidate_id == candidate_id and result.job_id == job_id:
                return result
        return None


def load_all_data(
    job_yaml_path: str,
    resumes_jsonl_path: str,
    model_scores_csv_path: str,
    interview_results_csv_path: str
) -> tuple:
    """
    Convenience function to load all data files at once.

    Returns:
        (job_requirement, resumes, model_scores, interview_results)
    """
    job = YAMLLoader.load(job_yaml_path)
    resumes = JSONLLoader.load(resumes_jsonl_path)
    model_scores = ModelScoreLoader.load(model_scores_csv_path)
    interview_results = InterviewResultLoader.load(interview_results_csv_path)

    return job, resumes, model_scores, interview_results

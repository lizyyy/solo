"""
Bias Reviewer Module
Core logic for reviewing model-vs-interview mismatches and bias detection.

Key anomaly types handled:
1. Skill alias mismatch - Different skill names but same skill
2. Experience boundary cases - Years exactly at requirement boundaries
3. High model score but interview rejection - Model favored but human rejected
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path

from resume_matcher.data_loader.loaders import (
    JobRequirement,
    CandidateResume,
    ModelScore,
    InterviewResult,
    ModelScoreLoader,
    InterviewResultLoader
)
from resume_matcher.normalizer.skill_normalizer import (
    SkillNormalizer,
    ExperienceValidator,
    ExperienceInfo,
    NormalizedSkill
)


class MismatchType(Enum):
    """Types of mismatches to detect"""
    SKILL_ALIAS_MISMATCH = "skill_alias_mismatch"
    EXPERIENCE_BOUNDARY = "experience_boundary"
    HIGH_SCORE_BUT_REJECTED = "high_score_but_rejected"
    LOW_SCORE_BUT_PASSED = "low_score_but_passed"
    SKILL_GAP = "skill_gap"
    EXPERIENCE_GAP = "experience_gap"


@dataclass
class MismatchCase:
    """Data class for a single mismatch case"""
    candidate_id: str
    job_id: str
    mismatch_type: MismatchType
    severity: str  # "high", "medium", "low"
    description: str
    details: Dict[str, Any] = field(default_factory=dict)
    model_score: Optional[float] = None
    model_rank: Optional[int] = None
    interview_outcome: Optional[str] = None
    technical_rating: Optional[float] = None
    recommendation: str = ""


@dataclass
class CandidateReviewResult:
    """Complete review result for a candidate"""
    candidate_id: str
    job_id: str
    candidate_resume: CandidateResume
    model_score: Optional[ModelScore] = None
    interview_result: Optional[InterviewResult] = None

    skill_match_score: float = 0.0
    matched_skills: List[str] = field(default_factory=list)
    missing_skills: List[str] = field(default_factory=list)
    skill_alias_mappings: List[Tuple[str, str, float]] = field(default_factory=list)

    experience_info: Optional[ExperienceInfo] = None
    experience_meets_requirements: bool = True
    experience_reason: str = ""

    mismatches: List[MismatchCase] = field(default_factory=list)
    overall_conclusion: str = ""


class BiasReviewer:
    """
    Core reviewer class that analyzes candidates for potential biases and mismatches.
    """

    HIGH_SCORE_THRESHOLD = 0.7
    LOW_SCORE_THRESHOLD = 0.3
    TOP_RANK_THRESHOLD = 5

    def __init__(self, job_requirement: JobRequirement):
        self.job = job_requirement
        self.skill_normalizer = SkillNormalizer()
        self.all_reviews: List[CandidateReviewResult] = []
        self.mismatch_cases: List[MismatchCase] = []

    def review_candidate(
        self,
        resume: CandidateResume,
        model_score: Optional[ModelScore] = None,
        interview_result: Optional[InterviewResult] = None
    ) -> CandidateReviewResult:
        """
        Review a single candidate for potential biases and mismatches.
        """
        review = CandidateReviewResult(
            candidate_id=resume.candidate_id,
            job_id=self.job.job_id,
            candidate_resume=resume,
            model_score=model_score,
            interview_result=interview_result
        )

        if model_score:
            review.model_score = model_score

        if interview_result:
            review.interview_result = interview_result

        self._analyze_skills(review)
        self._analyze_experience(review)
        self._detect_mismatches(review)

        self.all_reviews.append(review)
        self.mismatch_cases.extend(review.mismatches)

        return review

    def _analyze_skills(self, review: CandidateReviewResult):
        """Analyze skill matching with alias normalization"""
        (
            review.skill_match_score,
            review.matched_skills,
            review.missing_skills,
            review.skill_alias_mappings
        ) = self.skill_normalizer.calculate_skill_match(
            review.candidate_resume.skills,
            self.job.required_skills
        )

    def _analyze_experience(self, review: CandidateReviewResult):
        """Analyze experience requirements with boundary detection"""
        candidate_years = review.candidate_resume.total_experience_years

        if candidate_years is None:
            review.experience_meets_requirements = True
            review.experience_reason = "Experience data not available"
            return

        review.experience_info = ExperienceValidator.validate_experience(
            candidate_years,
            self.job.experience_min,
            self.job.experience_max
        )

        (
            review.experience_meets_requirements,
            review.experience_reason
        ) = ExperienceValidator.meets_requirements(
            candidate_years,
            self.job.experience_min,
            self.job.experience_max
        )

    def _detect_mismatches(self, review: CandidateReviewResult):
        """Detect all types of mismatches for a candidate"""
        self._detect_skill_alias_mismatch(review)
        self._detect_experience_boundary(review)
        self._detect_score_interview_mismatch(review)
        self._detect_skill_gap(review)
        self._detect_experience_gap(review)

    def _detect_skill_alias_mismatch(self, review: CandidateReviewResult):
        """
        Detect cases where candidate has skills written differently
        from job requirements (alias mismatch).
        
        Only mark as mismatch if:
        1. Candidate's original skill is NOT in the job's required skills (exact match)
        2. But the normalized standard skill IS in the normalized required skills
        
        This means: candidate wrote "Py" but job requires "Python" → mismatch
        But: candidate wrote "PostgreSQL" and job requires "PostgreSQL" → not a mismatch
        """
        if not review.skill_alias_mappings:
            return

        job_required_skills_lower = {s.lower() for s in self.job.required_skills}

        for original, standard, confidence in review.skill_alias_mappings:
            original_lower = original.lower()

            if original_lower in job_required_skills_lower:
                continue

            if confidence >= 0.7:
                severity = "high" if confidence >= 0.9 else "medium"
                mismatch = MismatchCase(
                    candidate_id=review.candidate_id,
                    job_id=review.job_id,
                    mismatch_type=MismatchType.SKILL_ALIAS_MISMATCH,
                    severity=severity,
                    description=f"Skill alias detected: '{original}' mapped to '{standard}'",
                    details={
                        "original_skill": original,
                        "standard_skill": standard,
                        "confidence": confidence,
                        "job_required_skills": self.job.required_skills,
                        "candidate_skills": review.candidate_resume.skills
                    },
                    model_score=review.model_score.model_score if review.model_score else None,
                    model_rank=review.model_score.model_rank if review.model_score else None,
                    interview_outcome=review.interview_result.final_outcome if review.interview_result else None,
                    technical_rating=review.interview_result.technical_rating if review.interview_result else None,
                    recommendation=f"Review skill normalization: '{original}' should be treated as '{standard}'"
                )
                review.mismatches.append(mismatch)

    def _detect_experience_boundary(self, review: CandidateReviewResult):
        """
        Detect cases where candidate experience is exactly at boundary
        of requirements (within tolerance).
        """
        if review.experience_info and review.experience_info.is_boundary_case:
            direction_desc = {
                'below': "slightly below",
                'exact': "exactly at",
                'above': "slightly above"
            }

            direction = review.experience_info.boundary_direction or 'exact'
            boundary = review.experience_info.boundary_threshold

            severity = "high" if direction in ['below', 'exact'] else "medium"

            mismatch = MismatchCase(
                candidate_id=review.candidate_id,
                job_id=review.job_id,
                mismatch_type=MismatchType.EXPERIENCE_BOUNDARY,
                severity=severity,
                description=f"Experience {review.experience_info.total_years} years is {direction_desc[direction]} boundary of {boundary} years",
                details={
                    "candidate_years": review.experience_info.total_years,
                    "boundary_threshold": boundary,
                    "boundary_direction": direction,
                    "required_min": self.job.experience_min,
                    "required_max": self.job.experience_max,
                    "meets_requirements": review.experience_meets_requirements
                },
                model_score=review.model_score.model_score if review.model_score else None,
                model_rank=review.model_score.model_rank if review.model_score else None,
                interview_outcome=review.interview_result.final_outcome if review.interview_result else None,
                technical_rating=review.interview_result.technical_rating if review.interview_result else None,
                recommendation=f"Review experience boundary: {review.experience_info.total_years} years vs requirement {boundary} years"
            )
            review.mismatches.append(mismatch)

    def _detect_score_interview_mismatch(self, review: CandidateReviewResult):
        """
        Detect critical mismatches between model scores and interview outcomes:
        - High model score but interview rejection
        - Low model score but interview pass
        """
        if not review.model_score or not review.interview_result:
            return

        model_score = review.model_score.model_score
        model_rank = review.model_score.model_rank
        interview_outcome = review.interview_result.final_outcome.lower()

        if model_score >= self.HIGH_SCORE_THRESHOLD and interview_outcome == 'fail':
            mismatch = MismatchCase(
                candidate_id=review.candidate_id,
                job_id=review.job_id,
                mismatch_type=MismatchType.HIGH_SCORE_BUT_REJECTED,
                severity="high",
                description=f"High model score ({model_score:.2f}, rank #{model_rank}) but interview rejected",
                details={
                    "model_score": model_score,
                    "model_rank": model_rank,
                    "interview_outcome": interview_outcome,
                    "technical_rating": review.interview_result.technical_rating,
                    "behavioral_rating": review.interview_result.behavioral_rating,
                    "rejection_reason": review.interview_result.rejection_reason,
                    "interview_notes": review.interview_result.interview_notes,
                    "skill_match_score": review.skill_match_score,
                    "missing_skills": review.missing_skills
                },
                model_score=model_score,
                model_rank=model_rank,
                interview_outcome=interview_outcome,
                technical_rating=review.interview_result.technical_rating,
                recommendation="Investigate model bias: Why did model favor this candidate but interview rejected?"
            )
            review.mismatches.append(mismatch)

        if model_score <= self.LOW_SCORE_THRESHOLD and interview_outcome == 'pass':
            mismatch = MismatchCase(
                candidate_id=review.candidate_id,
                job_id=review.job_id,
                mismatch_type=MismatchType.LOW_SCORE_BUT_PASSED,
                severity="high",
                description=f"Low model score ({model_score:.2f}) but interview passed",
                details={
                    "model_score": model_score,
                    "model_rank": model_rank,
                    "interview_outcome": interview_outcome,
                    "technical_rating": review.interview_result.technical_rating,
                    "behavioral_rating": review.interview_result.behavioral_rating,
                    "skill_match_score": review.skill_match_score,
                    "matched_skills": review.matched_skills
                },
                model_score=model_score,
                model_rank=model_rank,
                interview_outcome=interview_outcome,
                technical_rating=review.interview_result.technical_rating,
                recommendation="Investigate model under-scoring: Why did model under-rate this candidate who passed interview?"
            )
            review.mismatches.append(mismatch)

    def _detect_skill_gap(self, review: CandidateReviewResult):
        """Detect significant skill gaps between candidate and requirements"""
        if review.missing_skills and len(review.missing_skills) >= 2:
            mismatch = MismatchCase(
                candidate_id=review.candidate_id,
                job_id=review.job_id,
                mismatch_type=MismatchType.SKILL_GAP,
                severity="medium",
                description=f"Skill gap detected: missing {len(review.missing_skills)} required skills",
                details={
                    "missing_skills": review.missing_skills,
                    "matched_skills": review.matched_skills,
                    "skill_match_score": review.skill_match_score,
                    "job_required_skills": self.job.required_skills
                },
                model_score=review.model_score.model_score if review.model_score else None,
                model_rank=review.model_score.model_rank if review.model_score else None,
                interview_outcome=review.interview_result.final_outcome if review.interview_result else None,
                technical_rating=review.interview_result.technical_rating if review.interview_result else None,
                recommendation=f"Review skill requirements: missing {', '.join(review.missing_skills)}"
            )
            review.mismatches.append(mismatch)

    def _detect_experience_gap(self, review: CandidateReviewResult):
        """Detect experience gaps where candidate fails to meet requirements"""
        if not review.experience_meets_requirements and review.experience_info:
            if not review.experience_info.is_boundary_case:
                mismatch = MismatchCase(
                    candidate_id=review.candidate_id,
                    job_id=review.job_id,
                    mismatch_type=MismatchType.EXPERIENCE_GAP,
                    severity="high",
                    description=f"Experience gap: {review.experience_reason}",
                    details={
                        "candidate_years": review.experience_info.total_years,
                        "required_min": self.job.experience_min,
                        "required_max": self.job.experience_max,
                        "reason": review.experience_reason
                    },
                    model_score=review.model_score.model_score if review.model_score else None,
                    model_rank=review.model_score.model_rank if review.model_score else None,
                    interview_outcome=review.interview_result.final_outcome if review.interview_result else None,
                    technical_rating=review.interview_result.technical_rating if review.interview_result else None,
                    recommendation=f"Review experience requirement: {review.experience_reason}"
                )
                review.mismatches.append(mismatch)

    def get_summary_statistics(self) -> Dict[str, Any]:
        """Get summary statistics for all reviews"""
        total_candidates = len(self.all_reviews)
        total_mismatches = len(self.mismatch_cases)

        mismatch_counts = {}
        for mismatch in self.mismatch_cases:
            mtype = mismatch.mismatch_type.value
            if mtype not in mismatch_counts:
                mismatch_counts[mtype] = 0
            mismatch_counts[mtype] += 1

        severity_counts = {}
        for mismatch in self.mismatch_cases:
            sev = mismatch.severity
            if sev not in severity_counts:
                severity_counts[sev] = 0
            severity_counts[sev] += 1

        candidates_with_mismatches = len(set(m.candidate_id for m in self.mismatch_cases))

        return {
            "total_candidates": total_candidates,
            "total_mismatches": total_mismatches,
            "candidates_with_mismatches": candidates_with_mismatches,
            "mismatch_type_counts": mismatch_counts,
            "severity_counts": severity_counts,
            "job_id": self.job.job_id,
            "job_title": self.job.job_title
        }

    def get_mismatches_by_type(self, mismatch_type: MismatchType) -> List[MismatchCase]:
        """Get all mismatches of a specific type"""
        return [m for m in self.mismatch_cases if m.mismatch_type == mismatch_type]

    def get_mismatches_by_candidate(self, candidate_id: str) -> List[MismatchCase]:
        """Get all mismatches for a specific candidate"""
        return [m for m in self.mismatch_cases if m.candidate_id == candidate_id]

    def get_review_by_candidate(self, candidate_id: str) -> Optional[CandidateReviewResult]:
        """Get review result for a specific candidate"""
        for review in self.all_reviews:
            if review.candidate_id == candidate_id:
                return review
        return None

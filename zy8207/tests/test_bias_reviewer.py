"""Tests for bias reviewer module"""

import pytest
from resume_matcher.matcher.bias_reviewer import (
    BiasReviewer,
    MismatchType,
    MismatchCase,
    CandidateReviewResult
)
from resume_matcher.data_loader.loaders import (
    JobRequirement,
    CandidateResume,
    ModelScore,
    InterviewResult
)


class TestBiasReviewer:
    """Tests for BiasReviewer class"""

    def setup_method(self):
        self.job = JobRequirement(
            job_id="JOB001",
            job_title="Senior Python Developer",
            required_skills=["Python", "Django", "PostgreSQL", "Git"],
            preferred_skills=["AWS", "Docker"],
            experience_min=3.0,
            experience_max=8.0,
            education_level="Bachelor",
            location="Beijing",
            remote_allowed=True
        )
        self.reviewer = BiasReviewer(self.job)

    def test_review_candidate_skill_alias_mismatch(self):
        """Test detection of skill alias mismatches"""
        resume = CandidateResume(
            candidate_id="CAND001",
            skills=["Py", "Django Framework", "MySQL", "Github"],
            total_experience_years=5.0,
            education_level="Bachelor"
        )

        review = self.reviewer.review_candidate(resume)

        alias_mismatches = [
            m for m in review.mismatches
            if m.mismatch_type == MismatchType.SKILL_ALIAS_MISMATCH
        ]

        assert len(alias_mismatches) > 0
        assert any("Py" in m.description for m in alias_mismatches)
        assert any("Github" in m.description for m in alias_mismatches)

    def test_review_candidate_experience_boundary(self):
        """Test detection of experience boundary cases"""
        resume = CandidateResume(
            candidate_id="CAND001",
            skills=["Python", "Django", "PostgreSQL", "Git"],
            total_experience_years=3.0,
            education_level="Bachelor"
        )

        review = self.reviewer.review_candidate(resume)

        boundary_mismatches = [
            m for m in review.mismatches
            if m.mismatch_type == MismatchType.EXPERIENCE_BOUNDARY
        ]

        assert len(boundary_mismatches) == 1
        assert "exactly at" in boundary_mismatches[0].description
        assert boundary_mismatches[0].severity == "high"

    def test_review_candidate_high_score_but_rejected(self):
        """Test detection of high score but interview rejected"""
        resume = CandidateResume(
            candidate_id="CAND001",
            skills=["Python", "Django", "PostgreSQL", "Git"],
            total_experience_years=5.0,
            education_level="Bachelor"
        )

        model_score = ModelScore(
            candidate_id="CAND001",
            job_id="JOB001",
            model_score=0.85,
            model_rank=1,
            score_breakdown={"skill_score": 0.9}
        )

        interview_result = InterviewResult(
            candidate_id="CAND001",
            job_id="JOB001",
            final_outcome="fail",
            technical_rating=2.0,
            rejection_reason="Poor technical skills"
        )

        review = self.reviewer.review_candidate(resume, model_score, interview_result)

        mismatch = [
            m for m in review.mismatches
            if m.mismatch_type == MismatchType.HIGH_SCORE_BUT_REJECTED
        ]

        assert len(mismatch) == 1
        assert "0.85" in mismatch[0].description
        assert "rejected" in mismatch[0].description.lower()
        assert mismatch[0].severity == "high"

    def test_review_candidate_low_score_but_passed(self):
        """Test detection of low score but interview passed"""
        resume = CandidateResume(
            candidate_id="CAND001",
            skills=["Python", "Django", "PostgreSQL", "Git"],
            total_experience_years=5.0,
            education_level="Bachelor"
        )

        model_score = ModelScore(
            candidate_id="CAND001",
            job_id="JOB001",
            model_score=0.25,
            model_rank=10,
            score_breakdown={"skill_score": 0.3}
        )

        interview_result = InterviewResult(
            candidate_id="CAND001",
            job_id="JOB001",
            final_outcome="pass",
            technical_rating=4.5
        )

        review = self.reviewer.review_candidate(resume, model_score, interview_result)

        mismatch = [
            m for m in review.mismatches
            if m.mismatch_type == MismatchType.LOW_SCORE_BUT_PASSED
        ]

        assert len(mismatch) == 1
        assert "0.25" in mismatch[0].description
        assert "pass" in mismatch[0].description.lower()

    def test_review_candidate_skill_gap(self):
        """Test detection of skill gaps"""
        resume = CandidateResume(
            candidate_id="CAND001",
            skills=["Python"],
            total_experience_years=5.0,
            education_level="Bachelor"
        )

        review = self.reviewer.review_candidate(resume)

        skill_gaps = [
            m for m in review.mismatches
            if m.mismatch_type == MismatchType.SKILL_GAP
        ]

        assert len(skill_gaps) == 1
        assert "missing" in skill_gaps[0].description.lower()

    def test_review_candidate_experience_gap(self):
        """Test detection of experience gaps (not boundary cases)"""
        resume = CandidateResume(
            candidate_id="CAND001",
            skills=["Python", "Django", "PostgreSQL", "Git"],
            total_experience_years=1.0,
            education_level="Bachelor"
        )

        review = self.reviewer.review_candidate(resume)

        experience_gaps = [
            m for m in review.mismatches
            if m.mismatch_type == MismatchType.EXPERIENCE_GAP
        ]

        assert len(experience_gaps) == 1
        assert "below minimum" in experience_gaps[0].description.lower()

    def test_get_summary_statistics(self):
        """Test summary statistics calculation"""
        resume1 = CandidateResume(
            candidate_id="CAND001",
            skills=["Py", "Django"],
            total_experience_years=3.0
        )
        resume2 = CandidateResume(
            candidate_id="CAND002",
            skills=["Python", "Django", "PostgreSQL", "Git"],
            total_experience_years=5.0
        )

        self.reviewer.review_candidate(resume1)
        self.reviewer.review_candidate(resume2)

        stats = self.reviewer.get_summary_statistics()

        assert stats["total_candidates"] == 2
        assert stats["total_mismatches"] > 0
        assert stats["job_id"] == "JOB001"
        assert stats["job_title"] == "Senior Python Developer"

    def test_get_mismatches_by_type(self):
        """Test getting mismatches by type"""
        resume = CandidateResume(
            candidate_id="CAND001",
            skills=["Py", "Django Framework"],
            total_experience_years=3.0
        )

        self.reviewer.review_candidate(resume)

        alias_mismatches = self.reviewer.get_mismatches_by_type(MismatchType.SKILL_ALIAS_MISMATCH)
        boundary_mismatches = self.reviewer.get_mismatches_by_type(MismatchType.EXPERIENCE_BOUNDARY)

        assert len(alias_mismatches) > 0
        assert len(boundary_mismatches) == 1

    def test_get_mismatches_by_candidate(self):
        """Test getting mismatches by candidate"""
        resume1 = CandidateResume(
            candidate_id="CAND001",
            skills=["Py"],
            total_experience_years=3.0
        )
        resume2 = CandidateResume(
            candidate_id="CAND002",
            skills=["Python"],
            total_experience_years=5.0
        )

        self.reviewer.review_candidate(resume1)
        self.reviewer.review_candidate(resume2)

        mismatches1 = self.reviewer.get_mismatches_by_candidate("CAND001")
        mismatches2 = self.reviewer.get_mismatches_by_candidate("CAND002")

        assert len(mismatches1) > 0
        assert all(m.candidate_id == "CAND001" for m in mismatches1)

    def test_get_review_by_candidate(self):
        """Test getting review result by candidate"""
        resume = CandidateResume(
            candidate_id="CAND001",
            skills=["Python"],
            total_experience_years=5.0
        )

        self.reviewer.review_candidate(resume)

        review = self.reviewer.get_review_by_candidate("CAND001")
        assert review is not None
        assert review.candidate_id == "CAND001"

        review_none = self.reviewer.get_review_by_candidate("NONEXISTENT")
        assert review_none is None

    def test_multiple_mismatch_types(self):
        """Test candidate with multiple mismatch types"""
        resume = CandidateResume(
            candidate_id="CAND001",
            skills=["Py", "Django Framework"],
            total_experience_years=3.0
        )

        review = self.reviewer.review_candidate(resume)

        mismatch_types = set(m.mismatch_type for m in review.mismatches)

        assert MismatchType.SKILL_ALIAS_MISMATCH in mismatch_types
        assert MismatchType.EXPERIENCE_BOUNDARY in mismatch_types

    def test_no_mismatches(self):
        """Test candidate with no mismatches (ideal case)"""
        resume = CandidateResume(
            candidate_id="CAND001",
            skills=["Python", "Django", "PostgreSQL", "Git"],
            total_experience_years=5.0,
            education_level="Bachelor"
        )

        model_score = ModelScore(
            candidate_id="CAND001",
            job_id="JOB001",
            model_score=0.85,
            model_rank=1
        )

        interview_result = InterviewResult(
            candidate_id="CAND001",
            job_id="JOB001",
            final_outcome="pass",
            technical_rating=4.5
        )

        review = self.reviewer.review_candidate(resume, model_score, interview_result)

        assert len(review.mismatches) == 0

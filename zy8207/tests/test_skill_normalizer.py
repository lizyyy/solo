"""Tests for skill normalization module"""

import pytest
from resume_matcher.normalizer.skill_normalizer import (
    SkillNormalizer,
    ExperienceValidator,
    ExperienceInfo,
    extract_years_from_text,
    NormalizedSkill
)


class TestSkillNormalizer:
    """Tests for SkillNormalizer class"""

    def setup_method(self):
        self.normalizer = SkillNormalizer()

    def test_normalize_exact_match(self):
        """Test normalization of exact skill name"""
        result = self.normalizer.normalize("Python")
        assert result.standard == "python"
        assert result.confidence == 1.0
        assert result.is_alias is False

    def test_normalize_alias(self):
        """Test normalization of skill aliases"""
        result = self.normalizer.normalize("Python3")
        assert result.standard == "python"
        assert result.confidence == 1.0
        assert result.is_alias is True

    def test_normalize_alias_js(self):
        """Test JS alias normalization"""
        result = self.normalizer.normalize("JS")
        assert result.standard == "javascript"
        assert result.confidence == 1.0
        assert result.is_alias is True

    def test_normalize_alias_k8s(self):
        """Test K8s alias normalization"""
        result = self.normalizer.normalize("K8s")
        assert result.standard == "kubernetes"
        assert result.confidence == 1.0
        assert result.is_alias is True

    def test_normalize_unknown_skill(self):
        """Test normalization of unknown skill"""
        result = self.normalizer.normalize("UnknownSkill123")
        assert result.standard == "UnknownSkill123"
        assert result.confidence == 0.0
        assert result.is_alias is False

    def test_normalize_case_insensitive(self):
        """Test case insensitive normalization"""
        result1 = self.normalizer.normalize("PYTHON")
        result2 = self.normalizer.normalize("python")
        result3 = self.normalizer.normalize("Python")
        assert result1.standard == result2.standard == result3.standard

    def test_calculate_skill_match_all_match(self):
        """Test skill match calculation when all skills match"""
        candidate = ["Python", "Django", "PostgreSQL"]
        required = ["Python", "Django", "PostgreSQL"]
        score, matched, missing, aliases = self.normalizer.calculate_skill_match(
            candidate, required
        )
        assert score == 1.0
        assert len(matched) == 3
        assert len(missing) == 0

    def test_calculate_skill_match_with_aliases(self):
        """Test skill match calculation with aliases"""
        candidate = ["Py", "Django Framework", "MySQL"]
        required = ["Python", "Django", "SQL"]
        score, matched, missing, aliases = self.normalizer.calculate_skill_match(
            candidate, required
        )
        assert "python" in [s.lower() for s in matched]
        assert "django" in [s.lower() for s in matched]
        assert len(aliases) > 0

    def test_calculate_skill_match_partial(self):
        """Test partial skill match"""
        candidate = ["Python", "Django"]
        required = ["Python", "Django", "PostgreSQL", "Redis"]
        score, matched, missing, aliases = self.normalizer.calculate_skill_match(
            candidate, required
        )
        assert score == 0.5
        assert len(matched) == 2
        assert len(missing) == 2

    def test_normalize_list(self):
        """Test normalizing a list of skills"""
        skills = ["Python3", "JS", "K8s", "Unknown"]
        results = self.normalizer.normalize_list(skills)
        assert len(results) == 4
        assert results[0].standard == "python"
        assert results[1].standard == "javascript"
        assert results[2].standard == "kubernetes"

    def test_get_standard_skill_set(self):
        """Test getting standard skill set"""
        skills = ["Python3", "JS", "Django Framework"]
        standard_set = self.normalizer.get_standard_skill_set(skills)
        assert "python" in standard_set
        assert "javascript" in standard_set
        assert "django" in standard_set


class TestExperienceValidator:
    """Tests for ExperienceValidator class"""

    def test_validate_experience_exact_match(self):
        """Test experience exactly at minimum boundary"""
        info = ExperienceValidator.validate_experience(
            candidate_years=3.0,
            required_min=3.0,
            required_max=8.0
        )
        assert info.is_boundary_case is True
        assert info.boundary_threshold == 3.0
        assert info.boundary_direction == 'exact'

    def test_validate_experience_slightly_below(self):
        """Test experience slightly below minimum (within tolerance)"""
        info = ExperienceValidator.validate_experience(
            candidate_years=2.8,
            required_min=3.0,
            required_max=8.0
        )
        assert info.is_boundary_case is True
        assert info.boundary_direction == 'below'

    def test_validate_experience_slightly_above(self):
        """Test experience slightly above minimum (within tolerance)"""
        info = ExperienceValidator.validate_experience(
            candidate_years=3.2,
            required_min=3.0,
            required_max=8.0
        )
        assert info.is_boundary_case is True
        assert info.boundary_direction == 'above'

    def test_validate_experience_max_boundary(self):
        """Test experience at maximum boundary"""
        info = ExperienceValidator.validate_experience(
            candidate_years=7.8,
            required_min=3.0,
            required_max=8.0
        )
        assert info.is_boundary_case is True

    def test_validate_experience_above_max(self):
        """Test experience above maximum"""
        info = ExperienceValidator.validate_experience(
            candidate_years=8.2,
            required_min=3.0,
            required_max=8.0
        )
        assert info.is_boundary_case is True

    def test_validate_experience_not_boundary(self):
        """Test experience not at boundary"""
        info = ExperienceValidator.validate_experience(
            candidate_years=5.0,
            required_min=3.0,
            required_max=8.0
        )
        assert info.is_boundary_case is False

    def test_validate_experience_no_requirements(self):
        """Test experience validation with no requirements"""
        info = ExperienceValidator.validate_experience(
            candidate_years=5.0,
            required_min=None,
            required_max=None
        )
        assert info.is_boundary_case is False

    def test_meets_requirements_passes(self):
        """Test experience meets requirements"""
        meets, reason = ExperienceValidator.meets_requirements(
            candidate_years=5.0,
            required_min=3.0,
            required_max=8.0
        )
        assert meets is True
        assert "meets requirements" in reason.lower()

    def test_meets_requirements_below_min(self):
        """Test experience below minimum requirement"""
        meets, reason = ExperienceValidator.meets_requirements(
            candidate_years=2.0,
            required_min=3.0,
            required_max=8.0
        )
        assert meets is False
        assert "below minimum" in reason.lower()

    def test_meets_requirements_above_max(self):
        """Test experience above maximum requirement"""
        meets, reason = ExperienceValidator.meets_requirements(
            candidate_years=10.0,
            required_min=3.0,
            required_max=8.0
        )
        assert meets is False
        assert "above maximum" in reason.lower()


class TestExtractYearsFromText:
    """Tests for extract_years_from_text function"""

    def test_extract_years_simple(self):
        """Test extracting simple year values"""
        assert extract_years_from_text("5 years of experience") == 5.0
        assert extract_years_from_text("3 years") == 3.0

    def test_extract_years_decimal(self):
        """Test extracting decimal year values"""
        assert extract_years_from_text("2.5 years experience") == 2.5
        assert extract_years_from_text("3.5 years") == 3.5

    def test_extract_years_with_plus(self):
        """Test extracting years with plus sign"""
        assert extract_years_from_text("3+ years") == 3.0
        assert extract_years_from_text("5+ years experience") == 5.0

    def test_extract_months(self):
        """Test extracting months and converting to years"""
        assert extract_years_from_text("6 months") == 0.5
        assert extract_years_from_text("12 months experience") == 1.0

    def test_extract_years_abbreviation(self):
        """Test extracting years with abbreviations"""
        assert extract_years_from_text("5 yrs") == 5.0
        assert extract_years_from_text("3 yr experience") == 3.0

    def test_extract_years_no_match(self):
        """Test text with no year information"""
        assert extract_years_from_text("No experience mentioned") is None
        assert extract_years_from_text("Some random text") is None

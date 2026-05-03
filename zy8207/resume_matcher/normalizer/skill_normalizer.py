"""
Skill Normalizer Module
Handles skill alias normalization, text matching, and experience year validation.
"""

import re
from typing import List, Set, Tuple, Optional, Dict
from dataclasses import dataclass

from resume_matcher.config.skill_aliases import build_reverse_alias_map, get_standard_skills


@dataclass
class NormalizedSkill:
    original: str
    standard: str
    confidence: float
    is_alias: bool


@dataclass
class ExperienceInfo:
    total_years: float
    is_boundary_case: bool
    boundary_threshold: Optional[float] = None
    boundary_direction: Optional[str] = None  # 'below', 'exact', 'above'


class SkillNormalizer:
    """
    Normalizes skills by mapping aliases to standard forms and performs
    lightweight text matching for unrecognized skills.
    """

    def __init__(self):
        self.reverse_alias_map = build_reverse_alias_map()
        self.standard_skills = get_standard_skills()
        self.standard_skills_lower = {s.lower(): s for s in self.standard_skills}

    def normalize(self, skill: str) -> NormalizedSkill:
        """
        Normalize a single skill string to its standard form.

        Args:
            skill: The skill string to normalize (e.g., "python3", "JS", "React.js")

        Returns:
            NormalizedSkill object with original, standard, confidence, and is_alias
        """
        skill_lower = skill.strip().lower()

        if skill_lower in self.reverse_alias_map:
            standard = self.reverse_alias_map[skill_lower]
            return NormalizedSkill(
                original=skill,
                standard=standard,
                confidence=1.0,
                is_alias=(skill_lower != standard.lower())
            )

        matched, confidence = self._fuzzy_match(skill_lower)
        if matched:
            return NormalizedSkill(
                original=skill,
                standard=matched,
                confidence=confidence,
                is_alias=True
            )

        return NormalizedSkill(
            original=skill,
            standard=skill,
            confidence=0.0,
            is_alias=False
        )

    def normalize_list(self, skills: List[str]) -> List[NormalizedSkill]:
        """Normalize a list of skills."""
        return [self.normalize(skill) for skill in skills]

    def get_standard_skill_set(self, skills: List[str]) -> Set[str]:
        """
        Convert a list of skills to a set of normalized standard skill names.
        For unknown skills, keep the original name as the standard form.
        """
        normalized = self.normalize_list(skills)
        result = set()
        for ns in normalized:
            if ns.confidence > 0.5:
                result.add(ns.standard.lower())
            else:
                result.add(ns.original.lower())
        return result

    def calculate_skill_match(
        self,
        candidate_skills: List[str],
        required_skills: List[str]
    ) -> Tuple[float, List[str], List[str], List[Tuple[str, str, float]]]:
        """
        Calculate skill match between candidate and required skills.

        Returns:
            (match_score, matched_skills, missing_skills, alias_mappings)
            - match_score: 0.0 to 1.0
            - matched_skills: list of standard skills that matched
            - missing_skills: list of required skills not found
            - alias_mappings: list of (original, standard, confidence) for alias matches
        """
        candidate_standard = self.get_standard_skill_set(candidate_skills)
        required_standard = self.get_standard_skill_set(required_skills)

        if not required_standard:
            return 1.0, [], [], []

        matched = candidate_standard & required_standard
        missing = required_standard - candidate_standard
        match_score = len(matched) / len(required_standard)

        alias_mappings = []
        normalized_candidate = self.normalize_list(candidate_skills)
        for ns in normalized_candidate:
            if ns.is_alias and ns.standard in matched:
                alias_mappings.append((ns.original, ns.standard, ns.confidence))

        return (
            match_score,
            list(matched),
            list(missing),
            alias_mappings
        )

    def _fuzzy_match(self, skill_lower: str) -> Tuple[Optional[str], float]:
        """
        Perform lightweight fuzzy matching for unrecognized skills.
        Uses substring matching and common variations.
        """
        skill_clean = re.sub(r'[\s\-_\.]+', '', skill_lower)

        for standard_lower, standard in self.standard_skills_lower.items():
            standard_clean = re.sub(r'[\s\-_\.]+', '', standard_lower)

            if skill_clean == standard_clean:
                return standard, 0.9

            if len(skill_clean) >= 3 and (skill_clean in standard_clean or standard_clean in skill_clean):
                return standard, 0.7

            partial_matches = self._check_partial_variations(skill_clean, standard_clean, standard)
            if partial_matches:
                return partial_matches

        return None, 0.0

    def _check_partial_variations(
        self,
        skill_clean: str,
        standard_clean: str,
        standard: str
    ) -> Tuple[Optional[str], float]:
        """Check for common partial variations like 'js' for 'javascript'."""
        common_prefixes = {
            'js': 'javascript',
            'ts': 'typescript',
            'py': 'python',
            'ml': 'machine learning',
            'dl': 'deep learning',
            'cv': 'computer vision',
            'nlp': 'natural language processing',
            'k8s': 'kubernetes',
            'ds': 'data science',
        }

        if skill_clean in common_prefixes:
            matched_skill = common_prefixes[skill_clean]
            if standard.lower() == matched_skill.lower():
                return matched_skill, 0.85

        return None


class ExperienceValidator:
    """
    Validates experience years against job requirements,
    with special handling for boundary cases.
    """

    BOUNDARY_TOLERANCE = 0.5  # 6 months tolerance for boundary detection

    @classmethod
    def validate_experience(
        cls,
        candidate_years: float,
        required_min: Optional[float] = None,
        required_max: Optional[float] = None
    ) -> ExperienceInfo:
        """
        Validate candidate experience against requirements.

        Args:
            candidate_years: Total years of candidate experience
            required_min: Minimum required years (if any)
            required_max: Maximum required years (if any)

        Returns:
            ExperienceInfo with total_years, is_boundary_case, and boundary details
        """
        is_boundary = False
        boundary_threshold = None
        boundary_direction = None

        if required_min is not None:
            diff = candidate_years - required_min
            if abs(diff) <= cls.BOUNDARY_TOLERANCE:
                is_boundary = True
                boundary_threshold = required_min
                if diff < 0:
                    boundary_direction = 'below'
                elif diff == 0:
                    boundary_direction = 'exact'
                else:
                    boundary_direction = 'above'

        if required_max is not None and not is_boundary:
            diff = candidate_years - required_max
            if abs(diff) <= cls.BOUNDARY_TOLERANCE:
                is_boundary = True
                boundary_threshold = required_max
                if diff > 0:
                    boundary_direction = 'above'
                elif diff == 0:
                    boundary_direction = 'exact'
                else:
                    boundary_direction = 'below'

        return ExperienceInfo(
            total_years=candidate_years,
            is_boundary_case=is_boundary,
            boundary_threshold=boundary_threshold,
            boundary_direction=boundary_direction
        )

    @classmethod
    def meets_requirements(
        cls,
        candidate_years: float,
        required_min: Optional[float] = None,
        required_max: Optional[float] = None
    ) -> Tuple[bool, str]:
        """
        Check if candidate meets experience requirements.

        Returns:
            (meets_requirements, reason)
        """
        info = cls.validate_experience(candidate_years, required_min, required_max)

        if required_min is not None and candidate_years < required_min:
            return False, f"Experience {candidate_years} years below minimum {required_min} years"

        if required_max is not None and candidate_years > required_max:
            return False, f"Experience {candidate_years} years above maximum {required_max} years"

        return True, "Experience meets requirements"


def extract_years_from_text(text: str) -> Optional[float]:
    """
    Extract years of experience from text descriptions.

    Examples:
        - "5 years of experience" -> 5.0
        - "3+ years" -> 3.0
        - "2.5 years" -> 2.5
        - "6 months" -> 0.5
    """
    patterns = [
        r'(\d+\.?\d*)\s*\+?\s*year',
        r'(\d+\.?\d*)\s*\+?\s*yr',
        r'(\d+)\s*\+?\s*month',
        r'(\d+\.?\d*)\s*\+?\s*yrs',
    ]

    for pattern in patterns:
        match = re.search(pattern, text.lower())
        if match:
            value = float(match.group(1))
            if 'month' in pattern.lower() or 'months' in text.lower():
                return value / 12
            return value

    return None

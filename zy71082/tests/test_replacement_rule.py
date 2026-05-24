import pytest

from gradle_dep_replace.models.dependency import DependencyCoordinate
from gradle_dep_replace.models.replacement import (
    ReplacementRule,
    MatchStrategy,
    ReplacementChain,
)


class TestReplacementRule:
    def test_exact_match(self):
        rule = ReplacementRule(
            id="test-1",
            name="Test Rule",
            match_strategy=MatchStrategy.EXACT,
            match_pattern="com.squareup.okhttp3:okhttp:4.11.0",
            target_version="4.12.0",
        )

        dep = DependencyCoordinate.parse("com.squareup.okhttp3:okhttp:4.11.0")
        assert rule.matches(dep) is True

        dep2 = DependencyCoordinate.parse("com.squareup.okhttp3:okhttp:4.10.0")
        assert rule.matches(dep2) is False

    def test_group_match(self):
        rule = ReplacementRule(
            id="test-2",
            name="Test Rule",
            match_strategy=MatchStrategy.GROUP,
            match_pattern="com.squareup.okhttp3",
            target_version="4.12.0",
        )

        dep1 = DependencyCoordinate.parse("com.squareup.okhttp3:okhttp:4.11.0")
        dep2 = DependencyCoordinate.parse("com.squareup.okhttp3:logging-interceptor:4.11.0")
        dep3 = DependencyCoordinate.parse("com.squareup.retrofit2:retrofit:2.9.0")

        assert rule.matches(dep1) is True
        assert rule.matches(dep2) is True
        assert rule.matches(dep3) is False

    def test_name_match(self):
        rule = ReplacementRule(
            id="test-3",
            name="Test Rule",
            match_strategy=MatchStrategy.NAME,
            match_pattern="okhttp",
            target_version="4.12.0",
        )

        dep = DependencyCoordinate.parse("com.squareup.okhttp3:okhttp:4.11.0")
        assert rule.matches(dep) is True

    def test_pattern_match(self):
        rule = ReplacementRule(
            id="test-4",
            name="Test Rule",
            match_strategy=MatchStrategy.PATTERN,
            match_pattern=r"androidx\.lifecycle:lifecycle-.*",
            target_version="2.6.2",
        )

        dep1 = DependencyCoordinate.parse("androidx.lifecycle:lifecycle-viewmodel-ktx:2.6.1")
        dep2 = DependencyCoordinate.parse("androidx.lifecycle:lifecycle-livedata-ktx:2.6.1")
        dep3 = DependencyCoordinate.parse("androidx.room:room-runtime:2.5.0")

        assert rule.matches(dep1) is True
        assert rule.matches(dep2) is True
        assert rule.matches(dep3) is False

    def test_apply_replacement(self):
        rule = ReplacementRule(
            id="test-5",
            name="Test Rule",
            match_strategy=MatchStrategy.GROUP,
            match_pattern="com.squareup.okhttp3",
            target_version="4.12.0",
        )

        dep = DependencyCoordinate.parse("com.squareup.okhttp3:okhttp:4.11.0")
        new_dep = rule.apply(dep)

        assert new_dep.group == "com.squareup.okhttp3"
        assert new_dep.name == "okhttp"
        assert new_dep.version == "4.12.0"

    def test_inactive_rule_not_matches(self):
        rule = ReplacementRule(
            id="test-6",
            name="Test Rule",
            match_strategy=MatchStrategy.EXACT,
            match_pattern="com.squareup.okhttp3:okhttp:4.11.0",
            target_version="4.12.0",
            is_active=False,
        )

        dep = DependencyCoordinate.parse("com.squareup.okhttp3:okhttp:4.11.0")
        assert rule.matches(dep) is False


class TestReplacementChain:
    def test_empty_chain(self):
        original = DependencyCoordinate.parse("com.squareup.okhttp3:okhttp:4.11.0")
        chain = ReplacementChain(original=original)

        assert chain.has_changes is False
        assert chain.change_count == 0
        assert chain.final == original

    def test_single_step_chain(self):
        original = DependencyCoordinate.parse("com.squareup.okhttp3:okhttp:4.11.0")
        chain = ReplacementChain(original=original)

        step1 = DependencyCoordinate.parse("com.squareup.okhttp3:okhttp:4.12.0")
        chain.add_step(step1, "rule-1")

        assert chain.has_changes is True
        assert chain.change_count == 1
        assert chain.final == step1
        assert chain.applied_rules == ["rule-1"]

    def test_multi_step_chain(self):
        original = DependencyCoordinate.parse("com.squareup.okhttp3:okhttp:4.10.0")
        chain = ReplacementChain(original=original)

        step1 = DependencyCoordinate.parse("com.squareup.okhttp3:okhttp:4.11.0")
        step2 = DependencyCoordinate.parse("com.squareup.okhttp3:okhttp:4.12.0")

        chain.add_step(step1, "rule-1")
        chain.add_step(step2, "rule-2")

        assert chain.has_changes is True
        assert chain.change_count == 2
        assert chain.final == step2
        assert chain.applied_rules == ["rule-1", "rule-2"]

    def test_chain_to_dict(self):
        original = DependencyCoordinate.parse("com.squareup.okhttp3:okhttp:4.11.0")
        chain = ReplacementChain(original=original)

        step1 = DependencyCoordinate.parse("com.squareup.okhttp3:okhttp:4.12.0")
        chain.add_step(step1, "rule-1")

        data = chain.to_dict()
        assert data["has_changes"] is True
        assert data["change_count"] == 1
        assert "original" in data
        assert "final" in data
        assert len(data["chain"]) == 1
        assert data["applied_rules"] == ["rule-1"]

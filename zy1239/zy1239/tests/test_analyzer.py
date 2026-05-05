"""Tests for the analyzer module."""

from datetime import datetime

import pytest

from metaclass_analyzer.analyzer import MetaclassAnalyzer
from metaclass_analyzer.models import (
    AnalysisResult,
    ClassInfo,
    ConflictInfo,
    Event,
    EventType,
    FieldInfo,
)


class TestMetaclassAnalyzer:
    """Tests for MetaclassAnalyzer."""

    def test_analyze_basic(self, sample_class_info, sample_events):
        """Test basic analysis."""
        analyzer = MetaclassAnalyzer(
            classes=[sample_class_info],
            events=sample_events,
            snippet_classes=[],
        )
        result = analyzer.analyze()

        assert len(result.classes) == 1
        assert len(result.timeline) == len(sample_events)

    def test_build_class_timeline(self, sample_class_info, sample_events):
        """Test building class timeline."""
        analyzer = MetaclassAnalyzer(
            classes=[sample_class_info],
            events=sample_events,
            snippet_classes=[],
        )
        result = analyzer.analyze()

        assert len(result.timeline) == len(sample_events)
        assert sample_class_info.name in result.classes
        assert len(result.classes[sample_class_info.name].events) > 0

    def test_analyze_metaclass_selection(self):
        """Test metaclass selection analysis."""
        class_info = ClassInfo(
            name="TestClass",
            bases=[],
            metaclass="CustomMeta",
            mro=["TestClass", "object"],
        )

        events = [
            Event(
                event_type=EventType.METACLASS_SELECT,
                timestamp=datetime.now(),
                class_name="TestClass",
                metaclass_name="CustomMeta",
                details={"selected_from": "explicit_metaclass"},
                order=1,
                success=True,
            )
        ]

        analyzer = MetaclassAnalyzer(
            classes=[class_info],
            events=events,
            snippet_classes=[],
        )
        result = analyzer.analyze()

        assert any("uses explicit metaclass" in w for w in result.warnings)

    def test_analyze_prepare_calls(self):
        """Test __prepare__ call analysis."""
        class_info = ClassInfo(
            name="OrderedClass",
            bases=[],
            metaclass="OrderedMeta",
            mro=["OrderedClass", "object"],
            fields=[
                FieldInfo(name="first", value=1, defined_in_class="OrderedClass", order=1),
                FieldInfo(name="second", value=2, defined_in_class="OrderedClass", order=2),
            ],
        )

        events = [
            Event(
                event_type=EventType.PREPARE,
                timestamp=datetime.now(),
                class_name="OrderedClass",
                metaclass_name="OrderedMeta",
                details={"returns": "OrderedDict"},
                order=1,
                success=True,
            )
        ]

        analyzer = MetaclassAnalyzer(
            classes=[class_info],
            events=events,
            snippet_classes=[],
        )
        result = analyzer.analyze()

        assert any("OrderedDict in __prepare__" in s for s in result.suggestions)

    def test_analyze_new_init_calls(self):
        """Test __new__ and __init__ call analysis."""
        class_info = ClassInfo(
            name="TestClass",
            bases=[],
            metaclass="type",
            mro=["TestClass", "object"],
        )

        events = [
            Event(
                event_type=EventType.NEW,
                timestamp=datetime.now(),
                class_name="TestClass",
                metaclass_name="type",
                details={},
                order=1,
                success=True,
            ),
        ]

        analyzer = MetaclassAnalyzer(
            classes=[class_info],
            events=events,
            snippet_classes=[],
        )
        result = analyzer.analyze()

        assert any("__new__ called but __init__ not called" in w for w in result.warnings)

    def test_analyze_failed_events(self):
        """Test analysis of failed events."""
        class_info = ClassInfo(
            name="TestClass",
            bases=[],
            metaclass="type",
            mro=["TestClass", "object"],
        )

        events = [
            Event(
                event_type=EventType.NEW,
                timestamp=datetime.now(),
                class_name="TestClass",
                metaclass_name="type",
                details={},
                order=1,
                success=False,
                error_message="Failed to create class",
            ),
            Event(
                event_type=EventType.INIT,
                timestamp=datetime.now(),
                class_name="TestClass",
                metaclass_name="type",
                details={},
                order=2,
                success=False,
                error_message="Failed to init class",
            ),
        ]

        analyzer = MetaclassAnalyzer(
            classes=[class_info],
            events=events,
            snippet_classes=[],
        )
        result = analyzer.analyze()

        assert any("__new__ failed" in e for e in result.errors)
        assert any("__init__ failed" in e for e in result.errors)

    def test_detect_metaclass_conflicts(self):
        """Test metaclass conflict detection."""
        class_info = ClassInfo(
            name="MultiInheritClass",
            bases=["MetaClass", "SimpleClass"],
            metaclass="type",
            mro=["MultiInheritClass", "MetaClass", "SimpleClass", "object"],
            has_conflict=True,
        )

        events = [
            Event(
                event_type=EventType.METACLASS_CONFLICT,
                timestamp=datetime.now(),
                class_name="MultiInheritClass",
                metaclass_name=None,
                details={
                    "conflicting_bases": ["MetaClass", "SimpleClass"],
                    "metaclasses": ["CustomMeta", "type"],
                },
                order=1,
                success=False,
                error_message="Metaclass conflict detected",
            )
        ]

        analyzer = MetaclassAnalyzer(
            classes=[class_info],
            events=events,
            snippet_classes=[],
        )
        result = analyzer.analyze()

        assert len(result.conflicts) == 1
        conflict = result.conflicts[0]
        assert conflict.class_name == "MultiInheritClass"
        assert len(conflict.resolution_steps) > 0

    def test_check_potential_conflicts(self):
        """Test detection of potential metaclass conflicts."""
        base1 = ClassInfo(
            name="MetaClass",
            bases=[],
            metaclass="CustomMeta",
            mro=["MetaClass", "object"],
        )

        base2 = ClassInfo(
            name="SimpleClass",
            bases=[],
            metaclass="type",
            mro=["SimpleClass", "object"],
        )

        derived = ClassInfo(
            name="MultiInheritClass",
            bases=["MetaClass", "SimpleClass"],
            metaclass="type",
            mro=["MultiInheritClass", "MetaClass", "SimpleClass", "object"],
        )

        analyzer = MetaclassAnalyzer(
            classes=[base1, base2, derived],
            events=[],
            snippet_classes=[],
        )
        result = analyzer.analyze()

        assert len(result.conflicts) == 1
        assert result.conflicts[0].severity == "warning"

    def test_analyze_field_registration_order(self):
        """Test field registration order analysis."""
        class_info = ClassInfo(
            name="OrderedClass",
            bases=[],
            metaclass="OrderedMeta",
            mro=["OrderedClass", "object"],
            fields=[
                FieldInfo(name="first", value=1, defined_in_class="OrderedClass", order=1),
                FieldInfo(name="second", value=2, defined_in_class="OrderedClass", order=2),
                FieldInfo(name="third", value=3, defined_in_class="OrderedClass", order=3),
            ],
        )

        events = [
            Event(
                event_type=EventType.PREPARE,
                timestamp=datetime.now(),
                class_name="OrderedClass",
                metaclass_name="OrderedMeta",
                details={"returns": "OrderedDict"},
                order=1,
                success=True,
            )
        ]

        analyzer = MetaclassAnalyzer(
            classes=[class_info],
            events=events,
            snippet_classes=[],
        )
        result = analyzer.analyze()

        assert any("field order is preserved" in s for s in result.suggestions)

    def test_duplicate_field_orders(self):
        """Test detection of duplicate field orders."""
        class_info = ClassInfo(
            name="BadClass",
            bases=[],
            metaclass="type",
            mro=["BadClass", "object"],
            fields=[
                FieldInfo(name="field1", value=1, defined_in_class="BadClass", order=1),
                FieldInfo(name="field2", value=2, defined_in_class="BadClass", order=1),
            ],
        )

        analyzer = MetaclassAnalyzer(
            classes=[class_info],
            events=[],
            snippet_classes=[],
        )
        result = analyzer.analyze()

        assert any("same order" in e for e in result.errors)

    def test_generate_suggestions_with_conflicts(self):
        """Test suggestion generation when conflicts exist."""
        conflict = ConflictInfo(
            class_name="TestClass",
            bases=["A", "B"],
            base_metaclasses={"A": "MetaA", "B": "MetaB"},
            severity="error",
        )

        class_info = ClassInfo(
            name="TestClass",
            bases=["A", "B"],
            metaclass="type",
            mro=["TestClass", "A", "B", "object"],
            has_conflict=True,
        )

        analyzer = MetaclassAnalyzer(
            classes=[class_info],
            events=[],
            snippet_classes=[],
        )
        analyzer.result.conflicts = [conflict]
        result = analyzer.analyze()

        assert any("metaclass design" in s for s in result.suggestions)

    def test_merge_snippet_info(self):
        """Test merging snippet information."""
        class_info = ClassInfo(
            name="ExistingClass",
            bases=[],
            metaclass="type",
            mro=["ExistingClass", "object"],
        )

        snippet_classes = [
            {
                "name": "ExistingClass",
                "bases": [],
                "metaclass": "type",
                "uses_metaclass": False,
                "uses_init_subclass": False,
                "has_descriptors": False,
                "fields": [
                    {"name": "new_field", "value": "test", "order": 1},
                ],
            },
            {
                "name": "NewClass",
                "bases": ["ExistingClass"],
                "metaclass": "CustomMeta",
                "uses_metaclass": True,
                "uses_init_subclass": True,
                "has_descriptors": True,
                "fields": [],
            },
        ]

        analyzer = MetaclassAnalyzer(
            classes=[class_info],
            events=[],
            snippet_classes=snippet_classes,
        )
        result = analyzer.analyze()

        assert "NewClass" in result.classes
        assert len(result.classes["NewClass"].bases) == 1
        assert result.classes["NewClass"].metaclass == "CustomMeta"

    def test_set_name_analysis(self):
        """Test __set_name__ analysis."""
        class_info = ClassInfo(
            name="DescriptorClass",
            bases=[],
            metaclass="type",
            mro=["DescriptorClass", "object"],
            fields=[
                FieldInfo(
                    name="name",
                    value="descriptor",
                    defined_in_class="DescriptorClass",
                    order=1,
                    descriptor_type="StringDescriptor",
                    set_name_called=True,
                ),
                FieldInfo(
                    name="value",
                    value=0,
                    defined_in_class="DescriptorClass",
                    order=2,
                    descriptor_type="IntegerDescriptor",
                    set_name_called=False,
                ),
            ],
        )

        events = [
            Event(
                event_type=EventType.SET_NAME,
                timestamp=datetime.now(),
                class_name="DescriptorClass",
                metaclass_name="type",
                details={"descriptor": "name", "owner": "DescriptorClass"},
                order=1,
                success=True,
            )
        ]

        analyzer = MetaclassAnalyzer(
            classes=[class_info],
            events=events,
            snippet_classes=[],
        )
        result = analyzer.analyze()

        assert any("descriptor" in s.lower() for s in result.suggestions)

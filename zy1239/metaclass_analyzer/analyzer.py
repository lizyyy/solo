"""Metaclass mechanism analyzer."""

from collections import defaultdict
from datetime import datetime
from typing import Any, Dict, List, Optional, Set, Tuple

from .errors import MetaclassConflictError
from .models import (
    AnalysisResult,
    ClassInfo,
    ConflictInfo,
    Event,
    EventType,
    FieldInfo,
)


class MetaclassAnalyzer:
    """Analyzer for metaclass-related mechanisms and issues."""

    def __init__(
        self,
        classes: List[ClassInfo],
        events: List[Event],
        snippet_classes: Optional[List[Dict[str, Any]]] = None,
    ):
        self.classes: Dict[str, ClassInfo] = {c.name: c for c in classes}
        self.events = events
        self.snippet_classes = snippet_classes or []
        self.result = AnalysisResult()

    def analyze(self) -> AnalysisResult:
        """Run all analysis steps."""
        self._build_class_timeline()
        self._analyze_metaclass_selection()
        self._analyze_prepare_calls()
        self._analyze_new_init_calls()
        self._analyze_set_name_calls()
        self._analyze_init_subclass_calls()
        self._analyze_mro()
        self._detect_metaclass_conflicts()
        self._analyze_field_registration_order()
        self._generate_suggestions()
        self._merge_snippet_info()

        return self.result

    def _build_class_timeline(self) -> None:
        """Build a timeline of all class creation events."""
        sorted_events = sorted(
            self.events,
            key=lambda e: (e.timestamp, e.order)
        )
        self.result.timeline = sorted_events

        for event in sorted_events:
            if event.class_name in self.classes:
                self.classes[event.class_name].events.append(event)

    def _analyze_metaclass_selection(self) -> None:
        """Analyze how metaclasses are selected for each class."""
        for class_name, class_info in self.classes.items():
            select_events = [
                e for e in self.events
                if e.class_name == class_name and e.event_type == EventType.METACLASS_SELECT
            ]

            for event in select_events:
                details = event.details
                selected_from = details.get("selected_from", "unknown")

                if selected_from == "explicit_metaclass":
                    self.result.warnings.append(
                        f"Class '{class_name}' uses explicit metaclass '{class_info.metaclass}'"
                    )
                elif selected_from == "inheritance":
                    from_base = details.get("from_base", "unknown")
                    self.result.warnings.append(
                        f"Class '{class_name}' inherits metaclass from '{from_base}'"
                    )
                elif selected_from == "default":
                    pass

    def _analyze_prepare_calls(self) -> None:
        """Analyze __prepare__ method calls."""
        prepare_events = [
            e for e in self.events
            if e.event_type == EventType.PREPARE
        ]

        for event in prepare_events:
            class_name = event.class_name
            returns = event.details.get("returns", "dict")

            if returns != "dict" and returns != "OrderedDict":
                self.result.warnings.append(
                    f"Class '{class_name}' __prepare__ returns non-standard type: {returns}"
                )

            if class_name in self.classes:
                self.classes[class_name].fields.sort(key=lambda f: f.order)

    def _analyze_new_init_calls(self) -> None:
        """Analyze __new__ and __init__ method calls."""
        for class_name, class_info in self.classes.items():
            new_events = [
                e for e in self.events
                if e.class_name == class_name and e.event_type == EventType.NEW
            ]
            init_events = [
                e for e in self.events
                if e.class_name == class_name and e.event_type == EventType.INIT
            ]

            if new_events and not init_events:
                self.result.warnings.append(
                    f"Class '{class_name}': __new__ called but __init__ not called"
                )

            for event in new_events:
                if not event.success:
                    self.result.errors.append(
                        f"Class '{class_name}': __new__ failed: {event.error_message}"
                    )

            for event in init_events:
                if not event.success:
                    self.result.errors.append(
                        f"Class '{class_name}': __init__ failed: {event.error_message}"
                    )

    def _analyze_set_name_calls(self) -> None:
        """Analyze __set_name__ descriptor calls."""
        set_name_events = [
            e for e in self.events
            if e.event_type == EventType.SET_NAME
        ]

        descriptor_classes: Dict[str, List[str]] = defaultdict(list)

        for event in set_name_events:
            class_name = event.class_name
            descriptor = event.details.get("descriptor", "unknown")
            descriptor_classes[class_name].append(descriptor)

            if class_name in self.classes:
                for field in self.classes[class_name].fields:
                    if field.name == descriptor or (field.descriptor_type and descriptor in field.descriptor_type):
                        field.set_name_called = True

        for class_name, descriptors in descriptor_classes.items():
            if class_name in self.classes:
                for field in self.classes[class_name].fields:
                    if field.descriptor_type and not field.set_name_called:
                        self.result.warnings.append(
                            f"Descriptor '{field.name}' in class '{class_name}' may not have __set_name__ called"
                        )

    def _analyze_init_subclass_calls(self) -> None:
        """Analyze __init_subclass__ calls."""
        init_subclass_events = [
            e for e in self.events
            if e.event_type == EventType.INIT_SUBCLASS
        ]

        for event in init_subclass_events:
            class_name = event.class_name
            called_on = event.details.get("called_on", "unknown")

            if not event.success:
                self.result.errors.append(
                    f"__init_subclass__ failed for class '{class_name}': {event.error_message}"
                )

            if class_name in self.classes and called_on in self.classes:
                base_class = self.classes[called_on]
                if "registry" not in [f.name for f in base_class.fields]:
                    self.result.warnings.append(
                        f"Base class '{called_on}' uses __init_subclass__ but may not track subclasses"
                    )

    def _analyze_mro(self) -> None:
        """Analyze Method Resolution Order for each class."""
        for class_name, class_info in self.classes.items():
            mro_events = [
                e for e in self.events
                if e.class_name == class_name and e.event_type == EventType.MRO_COMPUTE
            ]

            if mro_events:
                computed_mro = mro_events[0].details.get("computed_mro", [])
                if computed_mro and class_info.mro != computed_mro:
                    self.result.warnings.append(
                        f"Class '{class_name}': MRO mismatch. "
                        f"Declared: {class_info.mro}, Computed: {computed_mro}"
                    )

            if len(class_info.bases) > 1:
                self._check_diamond_inheritance(class_name, class_info)

    def _check_diamond_inheritance(self, class_name: str, class_info: ClassInfo) -> None:
        """Check for diamond inheritance patterns."""
        mro = class_info.mro
        base_classes = set(class_info.bases)

        common_bases = []
        for base in base_classes:
            if base in self.classes:
                base_mro = set(self.classes[base].mro)
                for other_base in base_classes - {base}:
                    if other_base in self.classes:
                        other_base_mro = set(self.classes[other_base].mro)
                        common = base_mro & other_base_mro - {class_name, "object"}
                        if common:
                            common_bases.extend(common)

        if common_bases:
            self.result.warnings.append(
                f"Class '{class_name}' may have diamond inheritance. "
                f"Common bases: {list(set(common_bases))}"
            )

    def _detect_metaclass_conflicts(self) -> None:
        """Detect metaclass conflicts in multiple inheritance."""
        conflict_events = [
            e for e in self.events
            if e.event_type == EventType.METACLASS_CONFLICT
        ]

        for event in conflict_events:
            class_name = event.class_name
            details = event.details

            conflicting_bases = details.get("conflicting_bases", [])
            metaclasses = details.get("metaclasses", [])

            base_metaclasses: Dict[str, str] = {}
            for i, base in enumerate(conflicting_bases):
                if i < len(metaclasses):
                    base_metaclasses[base] = metaclasses[i]

            resolution_steps = self._generate_conflict_resolution_steps(
                class_name, base_metaclasses
            )

            conflict_info = ConflictInfo(
                class_name=class_name,
                bases=conflicting_bases,
                base_metaclasses=base_metaclasses,
                suggested_metaclass=self._suggest_combined_metaclass(base_metaclasses),
                resolution_steps=resolution_steps,
                severity="error",
            )

            self.result.conflicts.append(conflict_info)

            if class_name in self.classes:
                self.classes[class_name].has_conflict = True
                self.classes[class_name].conflict_details = event.error_message

        self._check_potential_conflicts()

    def _check_potential_conflicts(self) -> None:
        """Check for potential metaclass conflicts that haven't occurred yet."""
        for class_name, class_info in self.classes.items():
            if len(class_info.bases) > 1:
                base_metaclasses: Dict[str, str] = {}

                for base in class_info.bases:
                    if base in self.classes:
                        base_metaclasses[base] = self.classes[base].metaclass
                    else:
                        base_metaclasses[base] = "type"

                if len(set(base_metaclasses.values())) > 1:
                    resolution_steps = self._generate_conflict_resolution_steps(
                        class_name, base_metaclasses
                    )

                    conflict_info = ConflictInfo(
                        class_name=class_name,
                        bases=class_info.bases,
                        base_metaclasses=base_metaclasses,
                        suggested_metaclass=self._suggest_combined_metaclass(base_metaclasses),
                        resolution_steps=resolution_steps,
                        severity="warning",
                    )

                    existing_conflict = any(
                        c.class_name == class_name for c in self.result.conflicts
                    )
                    if not existing_conflict:
                        self.result.conflicts.append(conflict_info)

    def _generate_conflict_resolution_steps(
        self, class_name: str, base_metaclasses: Dict[str, str]
    ) -> List[str]:
        """Generate steps to resolve a metaclass conflict."""
        steps = []
        metaclass_set = set(base_metaclasses.values())

        steps.append(f"Identify the conflicting metaclasses: {list(metaclass_set)}")

        if "type" in metaclass_set:
            other_metaclasses = [m for m in metaclass_set if m != "type"]
            if len(other_metaclasses) == 1:
                single_meta = other_metaclasses[0]
                steps.append(
                    f"Option 1: Ensure all base classes use '{single_meta}' metaclass"
                )
                steps.append(
                    f"Option 2: Create a combined metaclass: "
                    f"class CombinedMeta({single_meta}, type): pass"
                )
        else:
            meta_list = list(metaclass_set)
            steps.append(
                f"Create a combined metaclass that inherits from all: "
                f"class CombinedMeta({', '.join(meta_list)}): pass"
            )

        steps.append(
            f"Apply the combined metaclass explicitly: "
            f"class {class_name}(..., metaclass=CombinedMeta):"
        )

        steps.append(
            "Verify the MRO is correct after resolving the conflict"
        )

        return steps

    def _suggest_combined_metaclass(self, base_metaclasses: Dict[str, str]) -> Optional[str]:
        """Suggest a name for the combined metaclass."""
        metaclass_set = set(base_metaclasses.values())

        if len(metaclass_set) == 2:
            meta_list = sorted(metaclass_set)
            if "type" in meta_list:
                other = [m for m in meta_list if m != "type"][0]
                return other
            return f"{'_'.join(meta_list)}_Combined"

        return "CombinedMeta"

    def _analyze_field_registration_order(self) -> None:
        """Analyze field registration order and detect issues."""
        for class_name, class_info in self.classes.items():
            if not class_info.fields:
                continue

            sorted_fields = sorted(class_info.fields, key=lambda f: f.order)
            expected_order = [f.name for f in sorted_fields]

            prepare_events = [
                e for e in self.events
                if e.class_name == class_name and e.event_type == EventType.PREPARE
            ]

            if prepare_events:
                returns = prepare_events[0].details.get("returns", "dict")
                if returns == "OrderedDict":
                    self.result.suggestions.append(
                        f"Class '{class_name}' uses OrderedDict in __prepare__, "
                        f"field order is preserved: {expected_order}"
                    )
                else:
                    self.result.warnings.append(
                        f"Class '{class_name}' fields order: {expected_order}. "
                        f"Use OrderedDict in __prepare__ to preserve definition order."
                    )

            duplicate_orders: Dict[int, List[str]] = defaultdict(list)
            for field in class_info.fields:
                duplicate_orders[field.order].append(field.name)

            for order, fields in duplicate_orders.items():
                if len(fields) > 1:
                    self.result.errors.append(
                        f"Class '{class_name}': Multiple fields have the same order {order}: {fields}"
                    )

    def _generate_suggestions(self) -> None:
        """Generate general suggestions based on analysis."""
        if self.result.conflicts:
            self.result.suggestions.append(
                "Consider reviewing metaclass design to avoid conflicts in multiple inheritance"
            )
            self.result.suggestions.append(
                "Use explicit metaclass specification when combining classes with different metaclasses"
            )

        descriptor_used = any(
            f.descriptor_type is not None
            for ci in self.classes.values()
            for f in ci.fields
        )

        if descriptor_used:
            self.result.suggestions.append(
                "Ensure all descriptors properly implement __set_name__ for correct initialization"
            )

        has_custom_prepare = any(
            e for e in self.events
            if e.event_type == EventType.PREPARE and e.details.get("returns") != "dict"
        )

        if has_custom_prepare:
            self.result.suggestions.append(
                "Custom __prepare__ implementations should document their namespace type requirements"
            )

    def _merge_snippet_info(self) -> None:
        """Merge information from Python snippets."""
        for snippet_class in self.snippet_classes:
            name = snippet_class.get("name")
            if not name:
                continue

            if name not in self.classes:
                self.classes[name] = ClassInfo(
                    name=name,
                    bases=snippet_class.get("bases", []),
                    metaclass=snippet_class.get("metaclass", "type"),
                    mro=[name, "object"],
                    source_file=snippet_class.get("source_file"),
                    defined_at=datetime.now(),
                )

            class_info = self.classes[name]

            if snippet_class.get("uses_metaclass"):
                self.result.warnings.append(
                    f"Class '{name}' in snippet uses custom metaclass: {class_info.metaclass}"
                )

            if snippet_class.get("uses_init_subclass"):
                self.result.suggestions.append(
                    f"Class '{name}' implements __init_subclass__ - verify subclass registration logic"
                )

            if snippet_class.get("has_descriptors"):
                self.result.suggestions.append(
                    f"Class '{name}' uses descriptors - check __set_name__ implementation"
                )

            snippet_fields = snippet_class.get("fields", [])
            existing_field_names = {f.name for f in class_info.fields}

            for idx, sf in enumerate(snippet_fields):
                field_name = sf.get("name")
                if field_name and field_name not in existing_field_names:
                    class_info.fields.append(
                        FieldInfo(
                            name=field_name,
                            value=sf.get("value"),
                            defined_in_class=name,
                            order=idx + 1,
                            descriptor_type="Descriptor" if sf.get("is_descriptor") else None,
                            set_name_called=False,
                        )
                    )

        self.result.classes = self.classes

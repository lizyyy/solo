from .parsers import parse_chemicals, parse_storage, parse_compatibility, parse_inbound
from .rules import (
    check_storage_capacity,
    check_dangerous_category_mixing,
    check_missing_labels,
    check_inbound_conflicts,
    Normalizer
)
from .placement import find_alternative_locations, generate_placement_plan
from .reports import generate_audit_report, export_violations, export_placement_plan

__version__ = "1.0.0"

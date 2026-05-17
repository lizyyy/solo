from enum import Enum
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field
from datetime import datetime


class FieldType(Enum):
    STRING = "string"
    INTEGER = "integer"
    FLOAT = "float"
    BOOLEAN = "boolean"
    NULL = "null"
    OBJECT = "object"
    ARRAY = "array"
    TIMESTAMP = "timestamp"
    UNKNOWN = "unknown"


@dataclass
class BadRecord:
    line_number: int
    raw_content: str
    error_message: str
    service_name: Optional[str] = None


@dataclass
class FieldOccurrence:
    service_name: str
    field_name: str
    field_type: FieldType
    sample_value: Any
    line_number: int
    sample_count: int = 1


@dataclass
class FieldInfo:
    field_name: str
    occurrences: Dict[str, List[FieldOccurrence]] = field(default_factory=dict)
    
    @property
    def services(self) -> List[str]:
        return list(self.occurrences.keys())
    
    @property
    def has_conflict(self) -> bool:
        types = set()
        for svc_occs in self.occurrences.values():
            for occ in svc_occs:
                types.add(occ.field_type)
        return len(types) > 1
    
    @property
    def type_summary(self) -> Dict[str, List[str]]:
        result: Dict[str, List[str]] = {}
        for svc, svc_occs in self.occurrences.items():
            for occ in svc_occs:
                type_str = occ.field_type.value
                if type_str not in result:
                    result[type_str] = []
                if svc not in result[type_str]:
                    result[type_str].append(svc)
        return result


@dataclass
class ServiceLogSample:
    service_name: str
    line_number: int
    raw_content: str
    parsed_fields: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AnalysisResult:
    fields: Dict[str, FieldInfo] = field(default_factory=dict)
    bad_records: List[BadRecord] = field(default_factory=list)
    total_records: int = 0
    total_fields: int = 0
    conflicting_fields: List[str] = field(default_factory=list)
    services: List[str] = field(default_factory=list)
    generated_at: datetime = field(default_factory=datetime.now)
    
    def add_occurrence(self, service_name: str, field_name: str, field_type: FieldType, 
                       value: Any, line_number: int):
        if field_name not in self.fields:
            self.fields[field_name] = FieldInfo(field_name=field_name)
        
        if service_name not in self.fields[field_name].occurrences:
            self.fields[field_name].occurrences[service_name] = []
        
        self.fields[field_name].occurrences[service_name].append(
            FieldOccurrence(
                service_name=service_name,
                field_name=field_name,
                field_type=field_type,
                sample_value=value,
                line_number=line_number
            )
        )
        
        if service_name not in self.services:
            self.services.append(service_name)

import os
import re
from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional
from datetime import datetime


@dataclass
class PDFMetadata:
    title: Optional[str] = None
    author: Optional[str] = None
    subject: Optional[str] = None
    keywords: Optional[str] = None
    creator: Optional[str] = None
    producer: Optional[str] = None
    creation_date: Optional[str] = None
    modification_date: Optional[str] = None
    custom_fields: Dict[str, str] = field(default_factory=dict)
    xmp_metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "title": self.title,
            "author": self.author,
            "subject": self.subject,
            "keywords": self.keywords,
            "creator": self.creator,
            "producer": self.producer,
            "creation_date": self.creation_date,
            "modification_date": self.modification_date,
            "custom_fields": self.custom_fields,
            "has_xmp": bool(self.xmp_metadata),
            "xmp_fields": list(self.xmp_metadata.keys()) if self.xmp_metadata else []
        }

    def is_empty(self) -> bool:
        return all(v is None or v == "" for k, v in self.__dict__.items() 
                   if k not in ['custom_fields', 'xmp_metadata']) and \
               not self.custom_fields and not self.xmp_metadata


@dataclass
class Annotation:
    page: int
    type: str
    author: Optional[str] = None
    contents: Optional[str] = None
    creation_date: Optional[str] = None
    modification_date: Optional[str] = None
    subject: Optional[str] = None
    is_hidden: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "page": self.page,
            "type": self.type,
            "author": self.author,
            "contents_preview": self.contents[:100] + "..." if self.contents and len(self.contents) > 100 else self.contents,
            "creation_date": self.creation_date,
            "modification_date": self.modification_date,
            "subject": self.subject,
            "is_hidden": self.is_hidden
        }


@dataclass
class Attachment:
    name: str
    size: int
    creation_date: Optional[str] = None
    modification_date: Optional[str] = None
    description: Optional[str] = None
    is_embedded: bool = False
    is_hidden: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "size": self.size,
            "creation_date": self.creation_date,
            "modification_date": self.modification_date,
            "description": self.description,
            "is_embedded": self.is_embedded,
            "is_hidden": self.is_hidden
        }


@dataclass
class SanitizationRule:
    clean_metadata: bool = True
    clean_annotations: bool = True
    clean_attachments: bool = True
    clean_javascript: bool = True
    clean_embedded_files: bool = True
    clean_custom_properties: bool = True
    metadata_fields_to_remove: List[str] = field(default_factory=lambda: [
        "author", "creator", "producer", "keywords", "subject",
        "creationdate", "moddate", "title"
    ])
    annotation_types_to_remove: List[str] = field(default_factory=lambda: [
        "Text", "Highlight", "Underline", "Squiggly", "StrikeOut",
        "Caret", "Stamp", "Ink", "FreeText", "Popup", "FileAttachment"
    ])
    preserve_fields: List[str] = field(default_factory=list)
    replacement_value: str = ""

    @classmethod
    def from_dict(cls, config: Dict[str, Any]) -> 'SanitizationRule':
        rule = cls()
        for key, value in config.items():
            if hasattr(rule, key):
                setattr(rule, key, value)
        return rule


class MetadataCleaner:
    def __init__(self, rule: Optional[SanitizationRule] = None):
        self.rule = rule or SanitizationRule()

    @staticmethod
    def parse_pdf_date(date_str: str) -> Optional[str]:
        if not date_str:
            return None
        try:
            match = re.match(r"D:(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})", date_str)
            if match:
                year, month, day, hour, minute, second = match.groups()
                return f"{year}-{month}-{day} {hour}:{minute}:{second}"
        except Exception:
            pass
        return date_str

    def should_remove_field(self, field_name: str) -> bool:
        if not self.rule.clean_metadata:
            return False
        if field_name.lower() in [f.lower() for f in self.rule.preserve_fields]:
            return False
        return field_name.lower() in [f.lower() for f in self.rule.metadata_fields_to_remove]

    def should_remove_annotation(self, annot_type: str) -> bool:
        if not self.rule.clean_annotations:
            return False
        return annot_type in self.rule.annotation_types_to_remove

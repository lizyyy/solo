import csv
import io
import json
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, date
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, TypeVar, Generic


T = TypeVar('T')


class ExportFormat(str, Enum):
    CSV = "csv"
    JSON = "json"
    MARKDOWN = "markdown"


@dataclass
class ExportResult:
    success: bool = True
    format: Optional[str] = None
    content: Optional[str] = None
    filename: Optional[str] = None
    record_count: int = 0
    error_message: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


class BaseExporter(ABC, Generic[T]):
    
    def __init__(self):
        self.records: List[T] = []
        self.fields: List[str] = []
        self.field_names: Dict[str, str] = {}
    
    @abstractmethod
    def get_fields(self) -> List[str]:
        pass
    
    @abstractmethod
    def get_field_display_names(self) -> Dict[str, str]:
        pass
    
    @abstractmethod
    def record_to_dict(self, record: T) -> Dict[str, Any]:
        pass
    
    def _json_serializer(self, obj: Any) -> Any:
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        if hasattr(obj, '__dict__'):
            return str(obj)
        return str(obj)
    
    def to_csv(self, include_headers: bool = True) -> str:
        output = io.StringIO()
        fields = self.get_fields()
        field_names = self.get_field_display_names()
        
        writer = csv.DictWriter(
            output,
            fieldnames=fields,
            quoting=csv.QUOTE_MINIMAL
        )
        
        if include_headers:
            header_row = {f: field_names.get(f, f) for f in fields}
            writer.writerow(header_row)
        
        for record in self.records:
            row = self.record_to_dict(record)
            writer.writerow(row)
        
        return output.getvalue()
    
    def to_json(self, indent: int = 2) -> str:
        data = [self.record_to_dict(record) for record in self.records]
        return json.dumps(data, default=self._json_serializer, indent=indent, ensure_ascii=False)
    
    def to_markdown(self, title: str = None, include_summary: bool = True) -> str:
        lines = []
        
        if title:
            lines.append(f"# {title}")
            lines.append("")
        
        if include_summary and self.records:
            lines.append(f"**导出时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
            lines.append(f"**记录数量**: {len(self.records)}")
            lines.append("")
        
        if not self.records:
            lines.append("*暂无数据*")
            return "\n".join(lines)
        
        fields = self.get_fields()
        field_names = self.get_field_display_names()
        
        headers = [field_names.get(f, f) for f in fields]
        lines.append("| " + " | ".join(headers) + " |")
        lines.append("| " + " | ".join(["---"] * len(fields)) + " |")
        
        for record in self.records:
            row = self.record_to_dict(record)
            row_values = []
            for f in fields:
                val = row.get(f, "")
                if val is None:
                    val = ""
                val_str = str(val).replace("\n", " ").replace("|", "/")
                row_values.append(val_str)
            lines.append("| " + " | ".join(row_values) + " |")
        
        return "\n".join(lines)
    
    def export(self, format: ExportFormat, **kwargs) -> ExportResult:
        try:
            if format == ExportFormat.CSV:
                content = self.to_csv(**kwargs)
            elif format == ExportFormat.JSON:
                content = self.to_json(**kwargs)
            elif format == ExportFormat.MARKDOWN:
                content = self.to_markdown(**kwargs)
            else:
                return ExportResult(
                    success=False,
                    format=format.value if hasattr(format, 'value') else str(format),
                    error_message=f"不支持的导出格式: {format}"
                )
            
            return ExportResult(
                success=True,
                format=format.value if hasattr(format, 'value') else str(format),
                content=content,
                record_count=len(self.records),
                metadata={
                    "exported_at": datetime.now().isoformat(),
                    "fields": self.get_fields()
                }
            )
        except Exception as e:
            return ExportResult(
                success=False,
                format=format.value if hasattr(format, 'value') else str(format),
                error_message=str(e)
            )


class Exporter(BaseExporter[Dict[str, Any]]):
    
    def __init__(self, records: List[Dict[str, Any]], 
                 fields: List[str] = None,
                 field_names: Dict[str, str] = None):
        super().__init__()
        self.records = records
        self._fields = fields or []
        self._field_names = field_names or {}
        
        if not self._fields and records:
            self._fields = list(records[0].keys())
    
    def get_fields(self) -> List[str]:
        return self._fields
    
    def get_field_display_names(self) -> Dict[str, str]:
        return self._field_names
    
    def record_to_dict(self, record: Dict[str, Any]) -> Dict[str, Any]:
        result = {}
        for field in self.get_fields():
            val = record.get(field)
            if isinstance(val, (datetime, date)):
                result[field] = val.isoformat()
            elif val is None:
                result[field] = ""
            else:
                result[field] = val
        return result


def export_to_csv(records: List[Dict[str, Any]], 
                  fields: List[str] = None,
                  field_names: Dict[str, str] = None,
                  include_headers: bool = True) -> ExportResult:
    exporter = Exporter(records, fields, field_names)
    return exporter.export(ExportFormat.CSV, include_headers=include_headers)


def export_to_json(records: List[Dict[str, Any]],
                   fields: List[str] = None,
                   field_names: Dict[str, str] = None,
                   indent: int = 2) -> ExportResult:
    exporter = Exporter(records, fields, field_names)
    return exporter.export(ExportFormat.JSON, indent=indent)


def export_to_markdown(records: List[Dict[str, Any]],
                       fields: List[str] = None,
                       field_names: Dict[str, str] = None,
                       title: str = None,
                       include_summary: bool = True) -> ExportResult:
    exporter = Exporter(records, fields, field_names)
    return exporter.export(ExportFormat.MARKDOWN, title=title, include_summary=include_summary)

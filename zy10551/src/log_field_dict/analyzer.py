import os
from typing import Optional
from .models import AnalysisResult, BadRecord
from .log_parser import LogParser
from .type_inferencer import TypeInferencer


class LogAnalyzer:
    def __init__(self, fixed_service_name: Optional[str] = None):
        self.fixed_service_name = fixed_service_name

    def analyze_file(self, file_path: str) -> AnalysisResult:
        result = AnalysisResult()
        
        with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
            for line_num, line in enumerate(f, 1):
                result.total_records += 1
                self._process_line(line, line_num, result)
        
        result.total_fields = len(result.fields)
        result.conflicting_fields = [
            field_name for field_name, field_info in result.fields.items()
            if field_info.has_conflict
        ]
        
        return result

    def analyze_directory(self, dir_path: str) -> AnalysisResult:
        result = AnalysisResult()
        
        for root, _, files in os.walk(dir_path):
            for file in files:
                if file.endswith(('.log', '.txt')):
                    file_path = os.path.join(root, file)
                    file_result = self.analyze_file(file_path)
                    self._merge_results(result, file_result)
        
        return result

    def _process_line(self, line: str, line_num: int, result: AnalysisResult):
        parsed, bad_record = LogParser.parse_line(line, line_num)
        
        if bad_record:
            result.bad_records.append(bad_record)
            return
        
        if not parsed:
            result.bad_records.append(BadRecord(
                line_number=line_num,
                raw_content=line,
                error_message="Parsed result is empty"
            ))
            return
        
        service_name = self.fixed_service_name or LogParser.extract_service_name(parsed, line)
        
        self._extract_fields(parsed, service_name, line_num, result)

    def _extract_fields(self, fields: dict, service_name: str, line_num: int, 
                        result: AnalysisResult, prefix: str = ""):
        for key, value in fields.items():
            field_name = f"{prefix}{key}" if prefix else key
            
            if isinstance(value, dict):
                self._extract_fields(value, service_name, line_num, result, f"{field_name}.")
            elif isinstance(value, list):
                if value and isinstance(value[0], dict):
                    self._extract_fields(value[0], service_name, line_num, result, f"{field_name}[].")
                field_type = TypeInferencer.infer(value)
                result.add_occurrence(service_name, field_name, field_type, value, line_num)
            else:
                field_type = TypeInferencer.infer(value)
                result.add_occurrence(service_name, field_name, field_type, value, line_num)

    def _merge_results(self, target: AnalysisResult, source: AnalysisResult):
        target.total_records += source.total_records
        target.bad_records.extend(source.bad_records)
        
        for field_name, field_info in source.fields.items():
            if field_name not in target.fields:
                target.fields[field_name] = field_info
            else:
                for svc, occurrences in field_info.occurrences.items():
                    if svc not in target.fields[field_name].occurrences:
                        target.fields[field_name].occurrences[svc] = []
                    target.fields[field_name].occurrences[svc].extend(occurrences)
        
        for svc in source.services:
            if svc not in target.services:
                target.services.append(svc)
        
        target.total_fields = len(target.fields)
        target.conflicting_fields = [
            field_name for field_name, field_info in target.fields.items()
            if field_info.has_conflict
        ]

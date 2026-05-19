import json
import yaml
import os
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
from .rules_engine import SensitiveMatch, SanitizationResult, RulesEngine


@dataclass
class CassetteData:
    format: str
    interactions: List[Dict]
    raw_data: Any
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "format": self.format,
            "interaction_count": len(self.interactions),
            "interactions": self.interactions
        }


class CassetteParser:
    def __init__(self, rules_engine: RulesEngine):
        self.rules_engine = rules_engine
        
    def parse_file(self, file_path: str) -> CassetteData:
        _, ext = os.path.splitext(file_path)
        ext = ext.lower()
        
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        if ext in ['.yaml', '.yml']:
            return self._parse_yaml(content)
        elif ext == '.json':
            return self._parse_json(content)
        else:
            raise ValueError(f"Unsupported file format: {ext}")
            
    def _parse_yaml(self, content: str) -> CassetteData:
        data = yaml.safe_load(content)
        return self._normalize_cassette(data, "yaml")
        
    def _parse_json(self, content: str) -> CassetteData:
        data = json.loads(content)
        return self._normalize_cassette(data, "json")
        
    def _normalize_cassette(self, data: Any, fmt: str) -> CassetteData:
        interactions = []
        
        if isinstance(data, list):
            for i, item in enumerate(data):
                interactions.append(self._normalize_interaction(item, i))
        elif isinstance(data, dict):
            if "interactions" in data:
                for i, item in enumerate(data["interactions"]):
                    interactions.append(self._normalize_interaction(item, i))
            elif "http_interactions" in data:
                for i, item in enumerate(data["http_interactions"]):
                    interactions.append(self._normalize_interaction(item, i))
            else:
                interactions.append(self._normalize_interaction(data, 0))
        
        return CassetteData(format=fmt, interactions=interactions, raw_data=data)
        
    def _normalize_interaction(self, item: Dict, index: int) -> Dict:
        request = item.get("request", {})
        response = item.get("response", {})
        
        return {
            "index": index,
            "request": {
                "method": request.get("method", ""),
                "uri": request.get("uri", ""),
                "headers": self._extract_headers(request.get("headers", {})),
                "body": self._extract_body(request.get("body", {}))
            },
            "response": {
                "status": response.get("status", {}),
                "headers": self._extract_headers(response.get("headers", {})),
                "body": self._extract_body(response.get("body", {}))
            }
        }
        
    def _extract_headers(self, headers: Any) -> Dict[str, str]:
        if isinstance(headers, dict):
            result = {}
            for k, v in headers.items():
                if isinstance(v, list) and len(v) > 0:
                    result[k] = str(v[0])
                else:
                    result[k] = str(v)
            return result
        return {}
        
    def _extract_body(self, body: Any) -> str:
        if isinstance(body, dict):
            if "string" in body:
                return str(body["string"])
            if "content" in body:
                return str(body["content"])
        elif isinstance(body, str):
            return body
        return json.dumps(body, ensure_ascii=False) if body else ""
        
    def scan_cassette(self, cassette: CassetteData) -> Tuple[List[SensitiveMatch], Dict[str, Any]]:
        all_matches = []
        scan_report = {
            "request_headers": 0,
            "request_body": 0,
            "response_headers": 0,
            "response_body": 0
        }
        
        for interaction in cassette.interactions:
            idx = interaction["index"]
            
            headers = interaction["request"]["headers"]
            for k, v in headers.items():
                path = f"interactions[{idx}].request.headers.{k}"
                matches = self.rules_engine.scan_value(v, path, "request_headers")
                all_matches.extend(matches)
                scan_report["request_headers"] += len(matches)
            
            body = interaction["request"]["body"]
            path = f"interactions[{idx}].request.body"
            matches = self.rules_engine.scan_value(body, path, "request_body")
            all_matches.extend(matches)
            scan_report["request_body"] += len(matches)
            
            headers = interaction["response"]["headers"]
            for k, v in headers.items():
                path = f"interactions[{idx}].response.headers.{k}"
                matches = self.rules_engine.scan_value(v, path, "response_headers")
                all_matches.extend(matches)
                scan_report["response_headers"] += len(matches)
            
            body = interaction["response"]["body"]
            path = f"interactions[{idx}].response.body"
            matches = self.rules_engine.scan_value(body, path, "response_body")
            all_matches.extend(matches)
            scan_report["response_body"] += len(matches)
        
        return all_matches, scan_report
        
    def sanitize_cassette(self, file_path: str, output_path: Optional[str] = None) -> Dict[str, Any]:
        cassette = self.parse_file(file_path)
        matches, scan_report = self.scan_cassette(cassette)
        
        sanitized_data = self.rules_engine.apply_masks(cassette.raw_data, matches)
        
        verify_engine = RulesEngine()
        is_clean, remaining = verify_engine.verify_clean(sanitized_data)
        
        result = {
            "input_file": os.path.basename(file_path),
            "output_file": os.path.basename(output_path) if output_path else None,
            "total_matches": len(matches),
            "scan_report": scan_report,
            "is_clean": is_clean,
            "remaining_leaks": len(remaining),
            "matches": [m.__dict__ for m in matches],
            "remaining_matches": [m.__dict__ for m in remaining],
            "mapping": self.rules_engine.get_mapping_report()
        }
        
        if output_path:
            _, ext = os.path.splitext(output_path)
            with open(output_path, 'w', encoding='utf-8') as f:
                if ext.lower() in ['.yaml', '.yml']:
                    yaml.dump(sanitized_data, f, default_flow_style=False, allow_unicode=True)
                else:
                    json.dump(sanitized_data, f, indent=2, ensure_ascii=False)
        
        return result

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, TextIO

import yaml

from .models import (
    APIEndpoint,
    CallLogEntry,
    DocFragment,
    ParseIssue,
    SDKExample,
    Scope,
    Severity,
    SourceLocation,
)


class BaseParser:
    def __init__(self, file_path: Path):
        self.file_path = file_path
        self.issues: List[ParseIssue] = []

    def _make_location(self, line_number: Optional[int] = None, content: Optional[str] = None) -> SourceLocation:
        return SourceLocation(
            file_path=str(self.file_path),
            line_number=line_number,
            raw_content=content,
        )

    def _add_issue(
        self,
        message: str,
        severity: Severity,
        line_number: Optional[int] = None,
        content: Optional[str] = None,
    ) -> None:
        self.issues.append(
            ParseIssue(
                message=message,
                severity=severity,
                location=self._make_location(line_number, content),
                parser=self.__class__.__name__,
            )
        )

    def parse(self) -> Tuple[Any, List[ParseIssue]]:
        raise NotImplementedError


class ScopeTableParser(BaseParser):
    def parse(self) -> Tuple[List[Scope], List[ParseIssue]]:
        scopes: List[Scope] = []
        content = self.file_path.read_text()

        if self.file_path.suffix in (".yaml", ".yml"):
            return self._parse_yaml(content)
        elif self.file_path.suffix == ".json":
            return self._parse_json(content)
        else:
            return self._parse_text(content)

    def _parse_yaml(self, content: str) -> Tuple[List[Scope], List[ParseIssue]]:
        scopes: List[Scope] = []
        try:
            data = yaml.safe_load(content)
            if isinstance(data, dict) and "scopes" in data:
                scope_list = data["scopes"]
            elif isinstance(data, list):
                scope_list = data
            else:
                scope_list = [data]

            for idx, item in enumerate(scope_list):
                if isinstance(item, str):
                    scopes.append(
                        Scope(
                            name=item,
                            location=self._make_location(idx + 1),
                        )
                    )
                elif isinstance(item, dict):
                    name = item.get("name") or item.get("scope")
                    if name:
                        scopes.append(
                            Scope(
                                name=name,
                                description=item.get("description"),
                                aliases=item.get("aliases", []),
                                includes=item.get("includes", []),
                                is_deprecated=item.get("deprecated", False),
                                location=self._make_location(idx + 1),
                            )
                        )
                    else:
                        self._add_issue(
                            f"Scope missing 'name' field: {item}",
                            Severity.WARNING,
                            idx + 1,
                        )
        except yaml.YAMLError as e:
            self._add_issue(f"YAML parse error: {e}", Severity.ERROR)
        return scopes, self.issues

    def _parse_json(self, content: str) -> Tuple[List[Scope], List[ParseIssue]]:
        scopes: List[Scope] = []
        try:
            data = json.loads(content)
            if isinstance(data, dict) and "scopes" in data:
                scope_list = data["scopes"]
            elif isinstance(data, list):
                scope_list = data
            else:
                scope_list = [data]

            for idx, item in enumerate(scope_list):
                if isinstance(item, str):
                    scopes.append(Scope(name=item, location=self._make_location()))
                elif isinstance(item, dict):
                    name = item.get("name") or item.get("scope")
                    if name:
                        scopes.append(
                            Scope(
                                name=name,
                                description=item.get("description"),
                                aliases=item.get("aliases", []),
                                includes=item.get("includes", []),
                                is_deprecated=item.get("deprecated", False),
                                location=self._make_location(),
                            )
                        )
        except json.JSONDecodeError as e:
            self._add_issue(f"JSON parse error: {e}", Severity.ERROR)
        return scopes, self.issues

    def _parse_text(self, content: str) -> Tuple[List[Scope], List[ParseIssue]]:
        scopes: List[Scope] = []
        for line_num, line in enumerate(content.splitlines(), 1):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = [p.strip() for p in line.split(",")]
            name = parts[0]
            if name:
                aliases = parts[1].split("|") if len(parts) > 1 and parts[1] else []
                includes = parts[2].split("|") if len(parts) > 2 and parts[2] else []
                scopes.append(
                    Scope(
                        name=name,
                        aliases=aliases,
                        includes=includes,
                        location=self._make_location(line_num, line),
                    )
                )
        return scopes, self.issues


class APIListParser(BaseParser):
    def parse(self) -> Tuple[List[APIEndpoint], List[ParseIssue]]:
        content = self.file_path.read_text()

        if self.file_path.suffix in (".yaml", ".yml"):
            return self._parse_openapi_yaml(content)
        elif self.file_path.suffix == ".json":
            return self._parse_json(content)
        else:
            return self._parse_text(content)

    def _parse_openapi_yaml(self, content: str) -> Tuple[List[APIEndpoint], List[ParseIssue]]:
        apis: List[APIEndpoint] = []
        try:
            data = yaml.safe_load(content)
            if "paths" in data:
                for path, methods in data["paths"].items():
                    for method, details in methods.items():
                        if method.upper() in ("GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"):
                            apis.append(self._make_endpoint(method, path, details))
        except yaml.YAMLError as e:
            self._add_issue(f"YAML parse error: {e}", Severity.ERROR)
        return apis, self.issues

    def _parse_json(self, content: str) -> Tuple[List[APIEndpoint], List[ParseIssue]]:
        apis: List[APIEndpoint] = []
        try:
            data = json.loads(content)
            if "paths" in data:
                for path, methods in data["paths"].items():
                    for method, details in methods.items():
                        if method.upper() in ("GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"):
                            apis.append(self._make_endpoint(method, path, details))
        except json.JSONDecodeError as e:
            self._add_issue(f"JSON parse error: {e}", Severity.ERROR)
        return apis, self.issues

    def _make_endpoint(self, method: str, path: str, details: Dict[str, Any]) -> APIEndpoint:
        scopes = []
        security = details.get("security", [])
        for sec in security:
            for sec_scheme, sec_scopes in sec.items():
                scopes.extend(sec_scopes)

        return APIEndpoint(
            method=method.upper(),
            path=path,
            required_scopes=list(dict.fromkeys(scopes)),
            description=details.get("summary") or details.get("description"),
            operation_id=details.get("operationId"),
            tags=details.get("tags", []),
            is_deprecated=details.get("deprecated", False),
            location=self._make_location(),
        )

    def _parse_text(self, content: str) -> Tuple[List[APIEndpoint], List[ParseIssue]]:
        apis: List[APIEndpoint] = []
        for line_num, line in enumerate(content.splitlines(), 1):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = [p.strip() for p in re.split(r"\s+", line, maxsplit=2)]
            if len(parts) >= 2:
                method = parts[0].upper()
                path = parts[1]
                scopes = parts[2].split(",") if len(parts) > 2 else []
                apis.append(
                    APIEndpoint(
                        method=method,
                        path=path,
                        required_scopes=[s.strip() for s in scopes if s.strip()],
                        location=self._make_location(line_num, line),
                    )
                )
            else:
                self._add_issue(
                    f"Invalid API format, expected METHOD PATH [SCOPES]: {line}",
                    Severity.WARNING,
                    line_num,
                    line,
                )
        return apis, self.issues


class SDKExampleParser(BaseParser):
    SDK_COMMENT_PATTERNS = {
        "python": [r"#\s*@scope:\s*(.+)", r"#\s*@api:\s*(.+)", r"#\s*API:\s*(.+)"],
        "javascript": [r"//\s*@scope:\s*(.+)", r"//\s*@api:\s*(.+)", r"//\s*API:\s*(.+)"],
        "java": [r"//\s*@scope:\s*(.+)", r"//\s*@api:\s*(.+)"],
        "go": [r"//\s*@scope:\s*(.+)", r"//\s*@api:\s*(.+)"],
    }

    def parse(self) -> Tuple[List[SDKExample], List[ParseIssue]]:
        examples: List[SDKExample] = []
        content = self.file_path.read_text()

        if self.file_path.suffix in (".yaml", ".yml", ".json"):
            return self._parse_structured(content)
        else:
            return self._parse_code(content)

    def _parse_structured(self, content: str) -> Tuple[List[SDKExample], List[ParseIssue]]:
        examples: List[SDKExample] = []
        try:
            if self.file_path.suffix in (".yaml", ".yml"):
                data = yaml.safe_load(content)
            else:
                data = json.loads(content)

            examples_data = data.get("examples", [data]) if isinstance(data, dict) else data

            for idx, item in enumerate(examples_data):
                if isinstance(item, dict):
                    examples.append(
                        SDKExample(
                            name=item.get("name", f"example_{idx}"),
                            language=item.get("language", "unknown"),
                            api_method=item.get("method", "").upper(),
                            api_path=item.get("path", ""),
                            used_scopes=item.get("scopes", []),
                            code=item.get("code"),
                            description=item.get("description"),
                            location=self._make_location(idx + 1),
                        )
                    )
        except (yaml.YAMLError, json.JSONDecodeError) as e:
            self._add_issue(f"Parse error: {e}", Severity.ERROR)
        return examples, self.issues

    def _parse_code(self, content: str) -> Tuple[List[SDKExample], List[ParseIssue]]:
        examples: List[SDKExample] = []
        language = self._detect_language()
        patterns = self.SDK_COMMENT_PATTERNS.get(language, self.SDK_COMMENT_PATTERNS["python"])

        current_scopes: List[str] = []
        current_api = {"method": "", "path": ""}
        example_start = 0

        def _save_example() -> None:
            if current_api["method"] and current_api["path"]:
                examples.append(
                    SDKExample(
                        name=f"{self.file_path.stem}_{len(examples) + 1}",
                        language=language,
                        api_method=current_api["method"],
                        api_path=current_api["path"],
                        used_scopes=current_scopes.copy(),
                        location=self._make_location(example_start),
                    )
                )

        for line_num, line in enumerate(content.splitlines(), 1):
            is_new_api = False
            for pattern in patterns:
                match = re.search(pattern, line)
                if match:
                    value = match.group(1).strip()
                    if "scope" in pattern.lower():
                        current_scopes = [s.strip() for s in value.split(",") if s.strip()]
                    elif "api" in pattern.lower():
                        if current_api["method"]:
                            _save_example()
                        parts = re.split(r"\s+", value, maxsplit=1)
                        if len(parts) >= 2:
                            current_api = {"method": parts[0].upper(), "path": parts[1]}
                            example_start = line_num
                            is_new_api = True

            if not is_new_api and current_api["method"] and (line.strip().startswith("def ") or line.strip().startswith("class ")):
                _save_example()
                current_api = {"method": "", "path": ""}

        _save_example()
        return examples, self.issues

    def _detect_language(self) -> str:
        ext_map = {
            ".py": "python",
            ".js": "javascript",
            ".ts": "javascript",
            ".java": "java",
            ".go": "go",
        }
        return ext_map.get(self.file_path.suffix, "unknown")


class DocFragmentParser(BaseParser):
    SCOPE_PATTERN = r"\b([a-z][a-z0-9_:]+(\.(read|write|admin))?)\b"
    API_PATTERN = r"(GET|POST|PUT|DELETE|PATCH)\s+(/[^\s]+)"

    def parse(self) -> Tuple[List[DocFragment], List[ParseIssue]]:
        fragments: List[DocFragment] = []
        content = self.file_path.read_text()

        if self.file_path.suffix in (".md", ".markdown"):
            return self._parse_markdown(content)
        else:
            return self._parse_plain(content)

    def _parse_markdown(self, content: str) -> Tuple[List[DocFragment], List[ParseIssue]]:
        fragments: List[DocFragment] = []
        lines = content.splitlines()
        current_title = self.file_path.stem
        current_section = ""
        current_content: List[str] = []
        current_line = 1

        for line_num, line in enumerate(lines, 1):
            if line.startswith("#"):
                if current_content:
                    fragments.append(self._make_fragment(current_title, "\n".join(current_content), current_section, current_line))
                    current_content = []
                current_title = line.lstrip("#").strip()
                current_section = current_title
                current_line = line_num
            else:
                current_content.append(line)

        if current_content:
            fragments.append(self._make_fragment(current_title, "\n".join(current_content), current_section, current_line))

        return fragments, self.issues

    def _make_fragment(self, title: str, content: str, section: str, line_num: int) -> DocFragment:
        scopes = self._extract_scopes(content)
        apis = self._extract_apis(content)
        return DocFragment(
            title=title,
            content=content,
            mentioned_scopes=scopes,
            mentioned_apis=apis,
            section=section,
            location=self._make_location(line_num),
        )

    def _parse_plain(self, content: str) -> Tuple[List[DocFragment], List[ParseIssue]]:
        scopes = self._extract_scopes(content)
        apis = self._extract_apis(content)
        fragment = DocFragment(
            title=self.file_path.stem,
            content=content,
            mentioned_scopes=scopes,
            mentioned_apis=apis,
            location=self._make_location(1),
        )
        return [fragment], self.issues

    def _extract_scopes(self, content: str) -> List[str]:
        matches = re.findall(self.SCOPE_PATTERN, content, re.IGNORECASE)
        return list(dict.fromkeys(m[0] for m in matches))

    def _extract_apis(self, content: str) -> List[str]:
        matches = re.findall(self.API_PATTERN, content)
        return [f"{m[0].upper()} {m[1]}" for m in matches]


class CallLogParser(BaseParser):
    def parse(self) -> Tuple[List[CallLogEntry], List[ParseIssue]]:
        entries: List[CallLogEntry] = []
        content = self.file_path.read_text()

        if self.file_path.suffix == ".json":
            return self._parse_json(content)
        else:
            return self._parse_text(content)

    def _parse_json(self, content: str) -> Tuple[List[CallLogEntry], List[ParseIssue]]:
        entries: List[CallLogEntry] = []
        try:
            data = json.loads(content)
            logs = data if isinstance(data, list) else data.get("logs", [])

            for idx, item in enumerate(logs):
                if isinstance(item, dict):
                    entries.append(
                        CallLogEntry(
                            timestamp=item.get("timestamp", item.get("time", "")),
                            method=item.get("method", "").upper(),
                            path=item.get("path", item.get("uri", "")),
                            used_scopes=item.get("scopes", item.get("scope", [])),
                            success=item.get("success", item.get("status", 200) < 400),
                            status_code=item.get("status_code", item.get("status")),
                            client_id=item.get("client_id"),
                            location=self._make_location(),
                        )
                    )
        except json.JSONDecodeError as e:
            self._add_issue(f"JSON parse error: {e}", Severity.ERROR)
        return entries, self.issues

    def _parse_text(self, content: str) -> Tuple[List[CallLogEntry], List[ParseIssue]]:
        entries: List[CallLogEntry] = []
        for line_num, line in enumerate(content.splitlines(), 1):
            line = line.strip()
            if not line:
                continue
            parts = line.split()
            if len(parts) >= 3:
                timestamp = parts[0]
                method = parts[1].upper()
                path = parts[2]
                scopes: List[str] = []
                for i in range(3, len(parts)):
                    if ":" in parts[i] or re.match(r"^[a-z][a-z0-9_:\.]+$", parts[i], re.IGNORECASE):
                        scopes.append(parts[i])

                entries.append(
                    CallLogEntry(
                        timestamp=timestamp,
                        method=method,
                        path=path,
                        used_scopes=scopes,
                        location=self._make_location(line_num, line),
                    )
                )
            else:
                self._add_issue(
                    f"Invalid log format: {line}",
                    Severity.WARNING,
                    line_num,
                    line,
                )
        return entries, self.issues

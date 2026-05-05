import json
import yaml
import ast
from pathlib import Path
from typing import Dict, List, Any, Optional


class ParseError(Exception):
    def __init__(self, message: str, file: str = None, line: int = None, suggestion: str = None):
        self.message = message
        self.file = file
        self.line = line
        self.suggestion = suggestion
        super().__init__(message)


class Parser:
    def __init__(self, samples_dir: Path):
        self.samples_dir = samples_dir

    def parse_yaml(self, filename: str) -> Dict[str, Any]:
        file_path = self.samples_dir / filename
        if not file_path.exists():
            raise ParseError(
                f"File not found: {filename}",
                file=str(file_path),
                suggestion="Create the file or check the path"
            )

        try:
            with open(file_path, 'r') as f:
                return yaml.safe_load(f) or {}
        except yaml.YAMLError as e:
            line = None
            if hasattr(e, 'problem_mark') and e.problem_mark:
                line = e.problem_mark.line + 1
            raise ParseError(
                f"Invalid YAML format: {str(e)}",
                file=str(file_path),
                line=line,
                suggestion="Check YAML syntax, ensure proper indentation (use 2 spaces)"
            )

    def parse_jsonl(self, filename: str) -> List[Dict[str, Any]]:
        file_path = self.samples_dir / filename
        if not file_path.exists():
            return []

        events = []
        with open(file_path, 'r') as f:
            for line_num, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue

                try:
                    event = json.loads(line)
                    events.append(event)
                except json.JSONDecodeError as e:
                    raise ParseError(
                        f"Invalid JSON format: {str(e)}",
                        file=str(file_path),
                        line=line_num,
                        suggestion="Each line must be a valid JSON object"
                    )

        return events

    def get_snippets(self) -> List[Dict[str, Any]]:
        snippets_dir = self.samples_dir / 'snippets'
        if not snippets_dir.exists():
            return []

        snippets = []
        for py_file in sorted(snippets_dir.glob('*.py')):
            try:
                snippet = self._parse_python_file(py_file)
                snippets.append(snippet)
            except ParseError:
                raise
            except Exception as e:
                raise ParseError(
                    f"Failed to parse Python file: {str(e)}",
                    file=str(py_file),
                    suggestion="Check for syntax errors in the Python file"
                )

        return snippets

    def _parse_python_file(self, file_path: Path) -> Dict[str, Any]:
        with open(file_path, 'r') as f:
            content = f.read()

        try:
            tree = ast.parse(content)
        except SyntaxError as e:
            raise ParseError(
                f"Syntax error: {e.msg}",
                file=str(file_path),
                line=e.lineno,
                suggestion=f"Fix syntax error at line {e.lineno}"
            )

        return {
            'file': str(file_path),
            'name': file_path.name,
            'content': content,
            'ast': tree,
            'lines': content.split('\n'),
        }

import json
import re
from typing import List, Dict, Optional, Tuple, Any
from pathlib import Path
from datetime import datetime

from .models import (
    QueryPlan,
    PlanSummary,
    SourceLocation,
    ParseError
)


class PlanParser:
    def __init__(self):
        self.errors: List[ParseError] = []

    def parse_file(self, file_path: str, plan_type: str = "unknown") -> Tuple[List[QueryPlan], List[ParseError]]:
        self.errors = []
        query_plans = []
        path = Path(file_path)

        if not path.exists():
            error = ParseError(
                source_location=SourceLocation(
                    file_path=file_path,
                    line_number=0,
                    raw_content=""
                ),
                error_message=f"File not found: {file_path}",
                error_type="FileNotFound"
            )
            self.errors.append(error)
            return [], self.errors

        if file_path.endswith('.json'):
            query_plans = self._parse_json_file(path, plan_type)
        elif file_path.endswith(('.csv', '.txt')):
            query_plans = self._parse_text_file(path, plan_type)
        else:
            error = ParseError(
                source_location=SourceLocation(
                    file_path=file_path,
                    line_number=0,
                    raw_content=""
                ),
                error_message=f"Unsupported file format: {file_path}",
                error_type="UnsupportedFormat"
            )
            self.errors.append(error)

        return query_plans, self.errors

    def _parse_json_file(self, path: Path, plan_type: str) -> List[QueryPlan]:
        query_plans = []
        try:
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
                f.seek(0)
                data = json.load(f)

            if isinstance(data, list):
                item_positions = self._find_json_item_positions(content)
                for idx, item in enumerate(data):
                    actual_line = item_positions[idx] if idx < len(item_positions) else idx + 1
                    try:
                        plan = self._parse_single_plan(item, str(path), actual_line, plan_type)
                        if plan:
                            query_plans.append(plan)
                    except Exception as e:
                        self._add_parse_error(path, actual_line, str(item), str(e), "ParseItemError")
            elif isinstance(data, dict):
                try:
                    plan = self._parse_single_plan(data, str(path), 1, plan_type)
                    if plan:
                        query_plans.append(plan)
                except Exception as e:
                    self._add_parse_error(path, 1, json.dumps(data), str(e), "ParseItemError")

        except json.JSONDecodeError as e:
            self._add_parse_error(path, e.lineno, "", f"JSON decode error: {e.msg}", "JSONDecodeError")

        return query_plans

    def _find_json_item_positions(self, content: str) -> List[int]:
        """查找JSON数组中每个对象的起始行号"""
        lines = content.split('\n')
        positions = []
        bracket_stack = []
        in_array = False

        for line_num, line in enumerate(lines, 1):
            for col, char in enumerate(line):
                if char == '[':
                    bracket_stack.append(']')
                    in_array = len(bracket_stack) == 1
                elif char == '{':
                    bracket_stack.append('}')
                    if in_array and len(bracket_stack) == 2:
                        positions.append(line_num)
                elif char in ('}', ']'):
                    if bracket_stack:
                        bracket_stack.pop()
                    if not bracket_stack:
                        in_array = False

        return positions

    def _parse_text_file(self, path: Path, plan_type: str) -> List[QueryPlan]:
        query_plans = []
        with open(path, 'r', encoding='utf-8') as f:
            lines = f.readlines()

        buffer = []
        start_line = 0

        for line_num, line in enumerate(lines, 1):
            stripped = line.strip()

            if stripped.startswith('{') or buffer:
                if not buffer:
                    start_line = line_num
                buffer.append(line)

                if self._is_json_complete(''.join(buffer)):
                    try:
                        data = json.loads(''.join(buffer))
                        plan = self._parse_single_plan(data, str(path), start_line, plan_type)
                        if plan:
                            query_plans.append(plan)
                    except json.JSONDecodeError as e:
                        self._add_parse_error(path, start_line, ''.join(buffer), f"JSON decode error: {e.msg}", "JSONDecodeError")
                    except Exception as e:
                        self._add_parse_error(path, start_line, ''.join(buffer), str(e), "ParseError")
                    buffer = []

        return query_plans

    def _is_json_complete(self, json_str: str) -> bool:
        stack = []
        for char in json_str:
            if char == '{':
                stack.append('}')
            elif char == '[':
                stack.append(']')
            elif char in ('}', ']'):
                if not stack or stack.pop() != char:
                    return False
        return len(stack) == 0

    def _parse_single_plan(self, data: Dict[str, Any], file_path: str, line_num: int, plan_type: str) -> Optional[QueryPlan]:
        query_template = data.get('query_template', data.get('sql', data.get('query', '')))
        parameter_set = data.get('parameter_set', data.get('parameters', data.get('params', {})))
        plan_json = data.get('plan', data.get('plan_json', data))

        if not query_template:
            self._add_parse_error(
                Path(file_path), line_num, json.dumps(data),
                "Missing query_template/sql/query field", "MissingField"
            )
            return None

        summary = self._extract_plan_summary(plan_json)

        return QueryPlan(
            query_template=query_template,
            parameter_set=parameter_set if isinstance(parameter_set, dict) else {},
            plan_json=plan_json,
            summary=summary,
            source_location=SourceLocation(
                file_path=file_path,
                line_number=line_num,
                raw_content=json.dumps(data, ensure_ascii=False)[:500]
            ),
            db_version=data.get('db_version', plan_type),
            generated_at=self._parse_datetime(data.get('generated_at', data.get('timestamp')))
        )

    def _extract_plan_summary(self, plan_json: Dict[str, Any]) -> PlanSummary:
        scan_type = "UNKNOWN"
        join_type = "NONE"
        estimated_rows = 0
        estimated_cost = 0.0
        used_indexes = []
        extra_info = {}

        plan = plan_json
        if 'Plan' in plan:
            plan = plan['Plan']

        if 'Node Type' in plan:
            scan_type = plan['Node Type']
        elif 'node_type' in plan:
            scan_type = plan['node_type']

        if 'Join Type' in plan:
            join_type = plan['Join Type']
        elif 'join_type' in plan:
            join_type = plan['join_type']

        if 'Plan Rows' in plan:
            estimated_rows = plan['Plan Rows']
        elif 'rows' in plan:
            estimated_rows = plan['rows']

        if 'Total Cost' in plan:
            estimated_cost = plan['Total Cost']
        elif 'cost' in plan:
            estimated_cost = plan['cost']

        if 'Index Name' in plan:
            used_indexes.append(plan['Index Name'])
        elif 'index_name' in plan:
            used_indexes.append(plan['index_name'])

        if 'Plans' in plan:
            for subplan in plan['Plans']:
                if 'Index Name' in subplan:
                    used_indexes.append(subplan['Index Name'])
                if 'Node Type' in subplan and scan_type == "UNKNOWN":
                    scan_type = subplan['Node Type']

        extra_info['original_plan_type'] = plan.get('Node Type', plan.get('node_type', 'UNKNOWN'))

        return PlanSummary(
            scan_type=scan_type,
            join_type=join_type,
            estimated_rows=estimated_rows,
            estimated_cost=estimated_cost,
            used_indexes=sorted(list(set(used_indexes))),
            extra_info=extra_info
        )

    def _parse_datetime(self, dt_str: Optional[str]) -> Optional[datetime]:
        if not dt_str:
            return None
        try:
            if isinstance(dt_str, datetime):
                return dt_str
            return datetime.fromisoformat(str(dt_str).replace('Z', '+00:00'))
        except:
            return None

    def _add_parse_error(self, path: Path, line_num: int, content: str, msg: str, error_type: str):
        self.errors.append(ParseError(
            source_location=SourceLocation(
                file_path=str(path),
                line_number=line_num,
                raw_content=content[:500]
            ),
            error_message=msg,
            error_type=error_type
        ))

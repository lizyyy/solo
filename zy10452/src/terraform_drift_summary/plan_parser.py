import re
import json
import uuid
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from .models import (
    DriftSummary, ResourceChange, ChangeAction, ChangeSeverity,
    ProcessingError, TeamMapping
)
from .config import CliConfig, load_team_mapping


class PlanParser:
    def __init__(self, config: CliConfig):
        self.config = config
        self.errors: List[ProcessingError] = []
        self.team_mappings: List[TeamMapping] = []
        if config.team_mapping_file:
            self.team_mappings = load_team_mapping(config.team_mapping_file)
        self.masked_count = 0

    def parse(self) -> DriftSummary:
        input_path = self.config.input_file
        content = self._read_file(input_path)
        
        if self._is_json_format(content):
            return self._parse_json_plan(content, input_path)
        else:
            return self._parse_text_plan(content, input_path)

    def _read_file(self, file_path: Path) -> str:
        try:
            with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
                return f.read()
        except Exception as e:
            self.errors.append(ProcessingError(
                error_type="FileReadError",
                message=str(e),
                source_file=str(file_path)
            ))
            raise

    def _is_json_format(self, content: str) -> bool:
        stripped = content.strip()
        return stripped.startswith('{') and stripped.endswith('}')

    def _parse_json_plan(self, content: str, source_file: Path) -> DriftSummary:
        try:
            data = json.loads(content)
        except json.JSONDecodeError as e:
            self.errors.append(ProcessingError(
                error_type="JSONParseError",
                message=f"JSON解析失败: {str(e)}",
                source_file=str(source_file),
                line_number=e.lineno
            ))
            raise

        changes: List[ResourceChange] = []
        
        resource_changes = data.get('resource_changes', [])
        for idx, rc in enumerate(resource_changes):
            try:
                change = self._extract_resource_change_from_json(rc, source_file, idx)
                if change:
                    if self.config.mask_sensitive:
                        change = self._mask_sensitive_fields(change)
                    change = self._assign_team(change)
                    change = self._calculate_severity(change)
                    changes.append(change)
            except Exception as e:
                self.errors.append(ProcessingError(
                    error_type="ResourceParseError",
                    message=str(e),
                    source_file=str(source_file),
                    raw_content=json.dumps(rc, indent=2)[:500]
                ))

        return self._build_summary(changes, source_file)

    def _extract_resource_change_from_json(
        self, rc: Dict[str, Any], source_file: Path, line_num: int
    ) -> Optional[ResourceChange]:
        address = rc.get('address', '')
        if not address:
            return None

        resource_type = rc.get('type', '')
        resource_name = rc.get('name', '')
        
        change_data = rc.get('change', {})
        actions = change_data.get('actions', [])
        
        action = self._map_action(actions)
        
        if action == ChangeAction.NO_OP and not self.config.show_noop:
            return None

        previous = change_data.get('before', {}) or {}
        planned = change_data.get('after', {}) or {}
        
        changed_fields = self._find_changed_fields(previous, planned)
        sensitive_fields = change_data.get('sensitive_fields', [])

        module_path = None
        if '.' in address:
            parts = address.split('.')
            if parts[0].startswith('module'):
                module_path = '.'.join(parts[:2])

        return ResourceChange(
            resource_address=address,
            resource_type=resource_type,
            resource_name=resource_name,
            module_path=module_path,
            action=action,
            previous_attributes=previous,
            planned_attributes=planned,
            changed_fields=changed_fields,
            sensitive_fields=sensitive_fields,
            line_number=line_num,
            source_file=str(source_file)
        )

    def _parse_text_plan(self, content: str, source_file: Path) -> DriftSummary:
        lines = content.split('\n')
        changes: List[ResourceChange] = []
        
        resource_blocks = self._extract_resource_blocks(lines, source_file)
        
        for block in resource_blocks:
            try:
                change = self._parse_resource_block(block, source_file)
                if change:
                    if self.config.mask_sensitive:
                        change = self._mask_sensitive_fields(change)
                    change = self._assign_team(change)
                    change = self._calculate_severity(change)
                    changes.append(change)
            except Exception as e:
                self.errors.append(ProcessingError(
                    error_type="TextParseError",
                    message=str(e),
                    source_file=str(source_file),
                    line_number=block.get('line_start'),
                    raw_content='\n'.join(block.get('lines', []))[:500]
                ))

        return self._build_summary(changes, source_file)

    def _extract_resource_blocks(
        self, lines: List[str], source_file: Path
    ) -> List[Dict[str, Any]]:
        blocks = []
        current_block = None
        action_pattern = re.compile(r'^\s*[~+-]\s+')
        
        for line_num, line in enumerate(lines, 1):
            if action_pattern.match(line):
                if current_block:
                    blocks.append(current_block)
                current_block = {
                    'line_start': line_num,
                    'lines': [line]
                }
            elif current_block and line.strip():
                current_block['lines'].append(line)
            elif current_block and not line.strip() and len(current_block['lines']) > 1:
                blocks.append(current_block)
                current_block = None
        
        if current_block:
            blocks.append(current_block)
        
        return blocks

    def _parse_resource_block(
        self, block: Dict[str, Any], source_file: Path
    ) -> Optional[ResourceChange]:
        lines = block['lines']
        if not lines:
            return None

        first_line = lines[0]
        action_match = re.match(r'^\s*([~+-])\s+(.+?)(?:\s+#\s*(.+))?$', first_line)
        
        if not action_match:
            return None

        action_char = action_match.group(1)
        resource_address = action_match.group(2).strip()
        
        action_map = {
            '+': ChangeAction.CREATE,
            '-': ChangeAction.DELETE,
            '~': ChangeAction.UPDATE
        }
        action = action_map.get(action_char, ChangeAction.UNKNOWN)

        if action == ChangeAction.NO_OP and not self.config.show_noop:
            return None

        if '.' in resource_address:
            parts = resource_address.split('.')
            if len(parts) >= 2:
                resource_type = parts[0]
                resource_name = '.'.join(parts[1:])
            else:
                resource_type = resource_address
                resource_name = resource_address
        else:
            resource_type = resource_address
            resource_name = resource_address

        module_path = None
        if resource_address.startswith('module.'):
            module_parts = resource_address.split('.')
            if len(module_parts) >= 2:
                module_path = f"module.{module_parts[1]}"

        changed_fields = []
        sensitive_fields = []
        
        for line in lines[1:]:
            field_match = re.match(r'^\s*([~+-])\s*([^=]+)(?:=|->)', line)
            if field_match:
                field_name = field_match.group(2).strip()
                changed_fields.append(field_name)
                
                if self._is_sensitive_field(field_name):
                    sensitive_fields.append(field_name)

        return ResourceChange(
            resource_address=resource_address,
            resource_type=resource_type,
            resource_name=resource_name,
            module_path=module_path,
            action=action,
            changed_fields=changed_fields,
            sensitive_fields=sensitive_fields,
            line_number=block['line_start'],
            source_file=str(source_file)
        )

    def _map_action(self, actions: List[str]) -> ChangeAction:
        if not actions:
            return ChangeAction.NO_OP
        if 'create' in actions:
            return ChangeAction.CREATE
        if 'delete' in actions:
            return ChangeAction.DELETE
        if 'update' in actions:
            return ChangeAction.UPDATE
        if 'read' in actions:
            return ChangeAction.READ
        return ChangeAction.UNKNOWN

    def _find_changed_fields(
        self, previous: Dict[str, Any], planned: Dict[str, Any], prefix: str = ''
    ) -> List[str]:
        changed = []
        all_keys = set(previous.keys()) | set(planned.keys())
        
        for key in all_keys:
            full_key = f"{prefix}{key}" if prefix else key
            prev_val = previous.get(key)
            planned_val = planned.get(key)
            
            if isinstance(prev_val, dict) and isinstance(planned_val, dict):
                nested_changed = self._find_changed_fields(prev_val, planned_val, f"{full_key}.")
                changed.extend(nested_changed)
            elif prev_val != planned_val:
                changed.append(full_key)
        
        return changed

    def _is_sensitive_field(self, field_name: str) -> bool:
        field_lower = field_name.lower()
        return any(sensitive in field_lower for sensitive in self.config.sensitive_fields)

    def _mask_sensitive_fields(self, change: ResourceChange) -> ResourceChange:
        for field in change.sensitive_fields:
            self._mask_nested_field(change.previous_attributes, field)
            self._mask_nested_field(change.planned_attributes, field)
            self.masked_count += 1
        return change

    def _mask_nested_field(self, data: Dict[str, Any], field_path: str):
        parts = field_path.split('.')
        current = data
        for i, part in enumerate(parts[:-1]):
            if part not in current:
                return
            current = current[part]
        if parts[-1] in current:
            current[parts[-1]] = '***MASKED***'

    def _assign_team(self, change: ResourceChange) -> ResourceChange:
        if not self.team_mappings:
            return change

        best_match = None
        best_priority = -1

        for mapping in self.team_mappings:
            for pattern in mapping.patterns:
                if pattern in change.resource_address or pattern in change.resource_type:
                    if mapping.priority > best_priority:
                        best_match = mapping.team_name
                        best_priority = mapping.priority

        if best_match:
            change.responsible_team = best_match
        return change

    def _calculate_severity(self, change: ResourceChange) -> ResourceChange:
        if change.action == ChangeAction.DELETE:
            change.severity = ChangeSeverity.CRITICAL
            change.requires_attention = True
        elif change.action == ChangeAction.CREATE:
            change.severity = ChangeSeverity.HIGH
        elif change.action == ChangeAction.UPDATE:
            critical_fields = ['instance_type', 'size', 'replicas', 'policy']
            if any(f in ' '.join(change.changed_fields) for f in critical_fields):
                change.severity = ChangeSeverity.HIGH
                change.requires_attention = True
            else:
                change.severity = ChangeSeverity.MEDIUM
        else:
            change.severity = ChangeSeverity.LOW
        return change

    def _build_summary(self, changes: List[ResourceChange], source_file: Path) -> DriftSummary:
        changes_by_action: Dict[ChangeAction, int] = {}
        changes_by_team: Dict[str, int] = {}
        changes_by_severity: Dict[ChangeSeverity, int] = {}
        requires_attention = 0

        for change in changes:
            changes_by_action[change.action] = changes_by_action.get(change.action, 0) + 1
            
            team = change.responsible_team or 'Unassigned'
            changes_by_team[team] = changes_by_team.get(team, 0) + 1
            
            changes_by_severity[change.severity] = changes_by_severity.get(change.severity, 0) + 1
            
            if change.requires_attention:
                requires_attention += 1

        return DriftSummary(
            summary_id=str(uuid.uuid4()),
            input_file=str(source_file),
            total_resources=len(changes),
            total_changes=len(changes),
            changes_by_action=changes_by_action,
            changes_by_team=changes_by_team,
            changes_by_severity=changes_by_severity,
            changes_requiring_attention=requires_attention,
            changes=changes,
            errors=self.errors,
            masked_fields_count=self.masked_count
        )

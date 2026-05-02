"""
JSON 文件解析器
"""

import json
from typing import List, Dict, Any, Optional
from pathlib import Path

from ..models import (
    ScriptNote, CostumeRule, PropRule, ProjectData,
    ContinuityIssue, AuditEntry, ShotStatus,
    IssueSeverity, IssueCategory
)


class JSONParser:
    """解析场记、规则等JSON文件"""
    
    def parse_script_notes(self, file_path: str) -> List[ScriptNote]:
        """
        解析场记 JSON 文件
        
        预期格式:
        {
            "script_notes": [
                {
                    "scene_id": "1-01",
                    "shot_number": "1",
                    "take": 1,
                    "status": "已拍摄",
                    "characters": ["李雷", "韩梅梅"],
                    "costumes": {
                        "李雷": "蓝色西装+白衬衫",
                        "韩梅梅": "红色连衣裙"
                    },
                    "props": ["旧照片", "怀表"],
                    "notes": "情绪到位",
                    "shot_date": "2026-05-01",
                    "camera_angle": "中景",
                    "lens": "50mm",
                    "duration": "00:02:30"
                }
            ]
        }
        """
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        notes_list = data.get('script_notes', [])
        if not isinstance(notes_list, list):
            notes_list = [notes_list] if notes_list else []
        
        result = []
        for note_data in notes_list:
            status_str = note_data.get('status', '已拍摄')
            try:
                status = ShotStatus(status_str)
            except ValueError:
                status = ShotStatus.SHOT
            
            note = ScriptNote(
                scene_id=note_data.get('scene_id', '').strip(),
                shot_number=note_data.get('shot_number', '').strip(),
                take=int(note_data.get('take', 1)),
                status=status,
                characters=note_data.get('characters', []),
                costumes=note_data.get('costumes', {}),
                props=note_data.get('props', []),
                notes=note_data.get('notes', ''),
                shot_date=note_data.get('shot_date') or None,
                camera_angle=note_data.get('camera_angle', ''),
                lens=note_data.get('lens', ''),
                duration=note_data.get('duration') or None
            )
            result.append(note)
        
        return result
    
    def parse_costume_rules(self, file_path: str) -> List[CostumeRule]:
        """
        解析服装规则 JSON 文件
        
        预期格式:
        {
            "costume_rules": [
                {
                    "character": "李雷",
                    "scene_id": "1-*",
                    "description": "蓝色西装+白衬衫",
                    "accessories": ["领带", "手表"],
                    "notes": "第一幕统一服装"
                }
            ]
        }
        """
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        rules_list = data.get('costume_rules', [])
        if not isinstance(rules_list, list):
            rules_list = [rules_list] if rules_list else []
        
        result = []
        for rule_data in rules_list:
            rule = CostumeRule(
                character=rule_data.get('character', '').strip(),
                scene_id=rule_data.get('scene_id', '').strip(),
                description=rule_data.get('description', '').strip(),
                accessories=rule_data.get('accessories', []),
                notes=rule_data.get('notes', '')
            )
            result.append(rule)
        
        return result
    
    def parse_prop_rules(self, file_path: str) -> List[PropRule]:
        """
        解析道具规则 JSON 文件
        
        预期格式:
        {
            "prop_rules": [
                {
                    "prop_name": "旧照片",
                    "scene_id": "1-01",
                    "required": true,
                    "state": "泛黄、有折痕",
                    "notes": "关键剧情道具"
                }
            ]
        }
        """
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        rules_list = data.get('prop_rules', [])
        if not isinstance(rules_list, list):
            rules_list = [rules_list] if rules_list else []
        
        result = []
        for rule_data in rules_list:
            rule = PropRule(
                prop_name=rule_data.get('prop_name', '').strip(),
                scene_id=rule_data.get('scene_id', '').strip(),
                required=rule_data.get('required', True),
                state=rule_data.get('state', ''),
                notes=rule_data.get('notes', '')
            )
            result.append(rule)
        
        return result
    
    def parse_project_data(self, data: Dict[str, Any]) -> ProjectData:
        """
        从字典解析项目数据 (用于加载已保存的项目)
        """
        project = ProjectData(
            project_name=data.get('project_name', '未命名项目'),
            production_day=data.get('production_day', '')
        )
        
        for entry_data in data.get('call_sheet_entries', []):
            entry = CallSheetEntry(
                scene_id=entry_data.get('scene_id', ''),
                shot_number=entry_data.get('shot_number', ''),
                description=entry_data.get('description', ''),
                characters=entry_data.get('characters', []),
                props=entry_data.get('props', []),
                scheduled_time=entry_data.get('scheduled_time'),
                location=entry_data.get('location', ''),
                page_count=entry_data.get('page_count', 0.0)
            )
            project.call_sheet_entries.append(entry)
        
        for note_data in data.get('script_notes', []):
            status_str = note_data.get('status', '已拍摄')
            try:
                status = ShotStatus(status_str)
            except ValueError:
                status = ShotStatus.SHOT
            
            note = ScriptNote(
                scene_id=note_data.get('scene_id', ''),
                shot_number=note_data.get('shot_number', ''),
                take=note_data.get('take', 1),
                status=status,
                characters=note_data.get('characters', []),
                costumes=note_data.get('costumes', {}),
                props=note_data.get('props', []),
                notes=note_data.get('notes', ''),
                shot_date=note_data.get('shot_date'),
                camera_angle=note_data.get('camera_angle', ''),
                lens=note_data.get('lens', ''),
                duration=note_data.get('duration')
            )
            project.script_notes.append(note)
        
        for issue_data in data.get('issues', []):
            try:
                category = IssueCategory(issue_data.get('category', '场次顺序'))
            except ValueError:
                category = IssueCategory.SCENE_ORDER
            
            try:
                severity = IssueSeverity(issue_data.get('severity', '中'))
            except ValueError:
                severity = IssueSeverity.MEDIUM
            
            issue = ContinuityIssue(
                issue_id=issue_data.get('issue_id', ''),
                category=category,
                severity=severity,
                scene_id=issue_data.get('scene_id', ''),
                shot_number=issue_data.get('shot_number'),
                description=issue_data.get('description', ''),
                details=issue_data.get('details', {}),
                related_shots=issue_data.get('related_shots', []),
                approved=issue_data.get('approved', False),
                approval_notes=issue_data.get('approval_notes', ''),
                approved_by=issue_data.get('approved_by', ''),
                approved_at=issue_data.get('approved_at')
            )
            project.issues.append(issue)
        
        for audit_data in data.get('audit_trail', []):
            entry = AuditEntry(
                action=audit_data.get('action', ''),
                timestamp=audit_data.get('timestamp', ''),
                user=audit_data.get('user', ''),
                details=audit_data.get('details', {})
            )
            project.audit_trail.append(entry)
        
        return project

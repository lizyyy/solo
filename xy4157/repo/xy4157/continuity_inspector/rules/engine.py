"""
连续性规则引擎 - 核心检查逻辑
"""

import re
import uuid
from typing import Dict, List, Set, Tuple, Any, Optional
from collections import defaultdict
from datetime import datetime

from ..models import (
    ProjectData, ContinuityIssue, IssueCategory, IssueSeverity,
    ShotStatus, ScriptNote, CallSheetEntry
)


class ContinuityEngine:
    """
    连续性检查引擎
    
    执行以下检查:
    1. 场次顺序检查
    2. 角色服装连续性检查
    3. 道具连续性检查
    4. 缺失截图检查
    5. 重复镜号检查
    6. 跨天补拍冲突检查
    7. 命名一致性检查
    """
    
    def __init__(self):
        self._issue_counter = 0
    
    def check_all(self, project: ProjectData) -> List[ContinuityIssue]:
        """执行所有连续性检查"""
        self.check_scene_order(project)
        self.check_costume_continuity(project)
        self.check_prop_continuity(project)
        self.check_missing_screenshots(project)
        self.check_duplicate_shots(project)
        self.check_reshoot_conflicts(project)
        self.check_naming_consistency(project)
        
        return project.issues
    
    def check_scene_order(self, project: ProjectData):
        """
        检查场次顺序是否合理
        
        检查内容:
        - 同一场戏的镜头是否按顺序排列
        - 是否有跳号或顺序混乱
        """
        if not project.call_sheet_entries:
            return
        
        scenes = defaultdict(list)
        for entry in project.call_sheet_entries:
            scenes[entry.scene_id].append(entry)
        
        for scene_id, entries in scenes.items():
            shot_numbers = []
            for entry in entries:
                shot_key = self._parse_shot_number(entry.shot_number)
                if shot_key:
                    shot_numbers.append((shot_key, entry.shot_number))
            
            if len(shot_numbers) < 2:
                continue
            
            sorted_shots = sorted(shot_numbers, key=lambda x: x[0])
            original_order = [s[0] for s in shot_numbers]
            expected_order = [s[0] for s in sorted_shots]
            
            if original_order != expected_order:
                issue = self._create_issue(
                    category=IssueCategory.SCENE_ORDER,
                    severity=IssueSeverity.MEDIUM,
                    scene_id=scene_id,
                    shot_number=None,
                    description=f"场次 {scene_id} 的镜头顺序可能存在问题",
                    details={
                        "original_order": [s[1] for s in shot_numbers],
                        "expected_order": [s[1] for s in sorted_shots]
                    },
                    related_shots=[e.shot_number for e in entries]
                )
                project.issues.append(issue)
    
    def check_costume_continuity(self, project: ProjectData):
        """
        检查角色服装连续性
        
        检查内容:
        - 同一场戏内同一角色的服装是否一致
        - 服装描述与服装规则是否匹配
        """
        if not project.script_notes:
            return
        
        scene_character_costumes = defaultdict(dict)
        for note in project.script_notes:
            scene_key = self._get_scene_key(note.scene_id)
            for character, costume in note.costumes.items():
                if character not in scene_character_costumes[scene_key]:
                    scene_character_costumes[scene_key][character] = []
                scene_character_costumes[scene_key][character].append({
                    "costume": costume,
                    "shot_number": note.shot_number,
                    "scene_id": note.scene_id,
                    "take": note.take
                })
        
        for scene_key, characters in scene_character_costumes.items():
            for character, costume_records in characters.items():
                if len(costume_records) < 2:
                    continue
                
                base_costume = costume_records[0]["costume"]
                for record in costume_records[1:]:
                    current_costume = record["costume"]
                    if not self._costumes_match(base_costume, current_costume):
                        issue = self._create_issue(
                            category=IssueCategory.COSTUME_CONTINUITY,
                            severity=IssueSeverity.HIGH,
                            scene_id=record["scene_id"],
                            shot_number=record["shot_number"],
                            description=f"角色 {character} 的服装可能存在跳变",
                            details={
                                "character": character,
                                "expected": base_costume,
                                "found": current_costume,
                                "scene": scene_key,
                                "shot": record["shot_number"]
                            },
                            related_shots=[r["shot_number"] for r in costume_records]
                        )
                        project.issues.append(issue)
        
        if project.costume_rules:
            self._check_costume_rules(project)
    
    def _check_costume_rules(self, project: ProjectData):
        """检查服装描述与服装规则是否匹配"""
        for note in project.script_notes:
            for character, costume in note.costumes.items():
                matching_rules = self._find_matching_rules(
                    project.costume_rules, character, note.scene_id
                )
                
                for rule in matching_rules:
                    if not self._costume_matches_rule(costume, rule):
                        issue = self._create_issue(
                            category=IssueCategory.COSTUME_CONTINUITY,
                            severity=IssueSeverity.HIGH,
                            scene_id=note.scene_id,
                            shot_number=note.shot_number,
                            description=f"角色 {character} 的服装不符合设定规则",
                            details={
                                "character": character,
                                "rule_description": rule.description,
                                "actual": costume,
                                "rule_scene": rule.scene_id,
                                "notes": rule.notes
                            }
                        )
                        project.issues.append(issue)
    
    def check_prop_continuity(self, project: ProjectData):
        """
        检查道具连续性
        
        检查内容:
        - 关键道具是否在指定场次出现
        - 同一场戏内道具状态是否一致
        """
        if not project.script_notes or not project.prop_rules:
            return
        
        for rule in project.prop_rules:
            if not rule.required:
                continue
            
            matching_notes = [
                note for note in project.script_notes
                if self._scene_matches_rule(note.scene_id, rule.scene_id)
            ]
            
            if not matching_notes:
                continue
            
            found_in_all = all(
                rule.prop_name in note.props for note in matching_notes
            )
            
            found_in_any = any(
                rule.prop_name in note.props for note in matching_notes
            )
            
            if not found_in_any:
                for note in matching_notes[:3]:
                    issue = self._create_issue(
                        category=IssueCategory.PROP_CONTINUITY,
                        severity=IssueSeverity.HIGH,
                        scene_id=note.scene_id,
                        shot_number=note.shot_number,
                        description=f"关键道具 '{rule.prop_name}' 未出现在拍摄记录中",
                        details={
                            "prop": rule.prop_name,
                            "expected_scene": rule.scene_id,
                            "required_state": rule.state,
                            "notes": rule.notes
                        },
                        related_shots=[n.shot_number for n in matching_notes]
                    )
                    project.issues.append(issue)
            
            elif not found_in_all:
                missing_shots = [
                    n.shot_number for n in matching_notes
                    if rule.prop_name not in n.props
                ]
                
                for shot in missing_shots[:3]:
                    note = next(n for n in matching_notes if n.shot_number == shot)
                    issue = self._create_issue(
                        category=IssueCategory.PROP_CONTINUITY,
                        severity=IssueSeverity.MEDIUM,
                        scene_id=note.scene_id,
                        shot_number=shot,
                        description=f"道具 '{rule.prop_name}' 在部分镜头中缺失",
                        details={
                            "prop": rule.prop_name,
                            "missing_in_shots": missing_shots,
                            "total_shots": len(matching_notes)
                        },
                        related_shots=[n.shot_number for n in matching_notes]
                    )
                    project.issues.append(issue)
    
    def check_missing_screenshots(self, project: ProjectData):
        """
        检查缺失截图
        
        检查内容:
        - 已拍摄的镜头是否有对应的截图
        - 截图文件命名是否符合规范
        """
        if not project.script_notes:
            return
        
        shot_set = set()
        for note in project.script_notes:
            if note.status == ShotStatus.SHOT:
                key = f"{note.scene_id}:{note.shot_number}"
                shot_set.add(key)
        
        screenshot_set = set()
        for screenshot in project.screenshots:
            if screenshot.scene_id and screenshot.shot_number:
                key = f"{screenshot.scene_id}:{screenshot.shot_number}"
                screenshot_set.add(key)
        
        missing_shots = shot_set - screenshot_set
        
        for shot_key in missing_shots:
            scene_id, shot_number = shot_key.split(':', 1)
            
            matching_notes = [
                n for n in project.script_notes
                if n.scene_id == scene_id and n.shot_number == shot_number
            ]
            
            if matching_notes:
                note = matching_notes[0]
                issue = self._create_issue(
                    category=IssueCategory.MISSING_SCREENSHOT,
                    severity=IssueSeverity.MEDIUM,
                    scene_id=scene_id,
                    shot_number=shot_number,
                    description=f"镜头缺少对应的截图",
                    details={
                        "scene": scene_id,
                        "shot": shot_number,
                        "characters": note.characters,
                        "status": note.status.value
                    }
                )
                project.issues.append(issue)
    
    def check_duplicate_shots(self, project: ProjectData):
        """
        检查重复镜号
        
        检查内容:
        - 同一场戏内是否有重复的镜号
        - 不同场次是否有相同的场次号
        """
        scene_shot_counts = defaultdict(lambda: defaultdict(int))
        shot_locations = defaultdict(list)
        
        for note in project.script_notes:
            key = f"{note.scene_id}:{note.shot_number}"
            scene_shot_counts[note.scene_id][note.shot_number] += 1
            shot_locations[key].append({
                "take": note.take,
                "status": note.status.value,
                "notes": note.notes
            })
        
        for scene_id, shots in scene_shot_counts.items():
            for shot_number, count in shots.items():
                if count > 1:
                    key = f"{scene_id}:{shot_number}"
                    locations = shot_locations.get(key, [])
                    
                    issue = self._create_issue(
                        category=IssueCategory.DUPLICATE_SHOT,
                        severity=IssueSeverity.HIGH,
                        scene_id=scene_id,
                        shot_number=shot_number,
                        description=f"镜号 {shot_number} 在场次 {scene_id} 中出现了 {count} 次",
                        details={
                            "occurrences": count,
                            "take_details": locations,
                            "scene": scene_id,
                            "shot": shot_number
                        }
                    )
                    project.issues.append(issue)
    
    def check_reshoot_conflicts(self, project: ProjectData):
        """
        检查跨天补拍冲突
        
        检查内容:
        - 补拍镜头的服装、道具是否与原始拍摄一致
        - 不同日期拍摄的同一场戏是否存在连续性问题
        """
        if not project.script_notes:
            return
        
        scene_groups = defaultdict(list)
        for note in project.script_notes:
            if note.shot_date:
                scene_groups[note.scene_id].append(note)
        
        for scene_id, notes in scene_groups.items():
            if len(notes) < 2:
                continue
            
            dates = sorted(set(n.shot_date for n in notes if n.shot_date))
            
            if len(dates) > 1:
                date_groups = defaultdict(list)
                for note in notes:
                    if note.shot_date:
                        date_groups[note.shot_date].append(note)
                
                base_date = dates[0]
                base_notes = date_groups[base_date]
                
                for other_date in dates[1:]:
                    other_notes = date_groups[other_date]
                    
                    for base_note in base_notes[:1]:
                        for character, base_costume in base_note.costumes.items():
                            for other_note in other_notes:
                                if character in other_note.costumes:
                                    other_costume = other_note.costumes[character]
                                    if not self._costumes_match(base_costume, other_costume):
                                        issue = self._create_issue(
                                            category=IssueCategory.RESHOOT_CONFLICT,
                                            severity=IssueSeverity.HIGH,
                                            scene_id=scene_id,
                                            shot_number=other_note.shot_number,
                                            description=f"跨天补拍 {other_date} 中角色 {character} 服装与 {base_date} 不一致",
                                            details={
                                                "original_date": base_date,
                                                "reshoot_date": other_date,
                                                "character": character,
                                                "original_costume": base_costume,
                                                "reshoot_costume": other_costume,
                                                "scene": scene_id
                                            },
                                            related_shots=[
                                                f"{n.shot_number} ({n.shot_date})"
                                                for n in notes
                                            ]
                                        )
                                        project.issues.append(issue)
    
    def check_naming_consistency(self, project: ProjectData):
        """
        检查命名一致性
        
        检查内容:
        - 通告单和场记中的场次号、镜号是否一致
        - 命名格式是否规范
        """
        if not project.call_sheet_entries or not project.script_notes:
            return
        
        call_sheet_keys = set()
        for entry in project.call_sheet_entries:
            key = f"{entry.scene_id}:{entry.shot_number}"
            call_sheet_keys.add(key)
        
        script_keys = set()
        for note in project.script_notes:
            key = f"{note.scene_id}:{note.shot_number}"
            script_keys.add(key)
        
        in_call_but_not_script = call_sheet_keys - script_keys
        in_script_but_not_call = script_keys - call_sheet_keys
        
        for key in in_call_but_not_script:
            scene_id, shot_number = key.split(':', 1)
            matching_entries = [
                e for e in project.call_sheet_entries
                if e.scene_id == scene_id and e.shot_number == shot_number
            ]
            
            if matching_entries:
                entry = matching_entries[0]
                issue = self._create_issue(
                    category=IssueCategory.NAMING_INCONSISTENCY,
                    severity=IssueSeverity.MEDIUM,
                    scene_id=scene_id,
                    shot_number=shot_number,
                    description=f"通告单中的镜头 {scene_id}:{shot_number} 未在场记中找到",
                    details={
                        "scene": scene_id,
                        "shot": shot_number,
                        "description": entry.description,
                        "characters": entry.characters,
                        "location": entry.location
                    }
                )
                project.issues.append(issue)
        
        for key in in_script_but_not_call:
            scene_id, shot_number = key.split(':', 1)
            matching_notes = [
                n for n in project.script_notes
                if n.scene_id == scene_id and n.shot_number == shot_number
            ]
            
            if matching_notes:
                note = matching_notes[0]
                issue = self._create_issue(
                    category=IssueCategory.NAMING_INCONSISTENCY,
                    severity=IssueSeverity.LOW,
                    scene_id=scene_id,
                    shot_number=shot_number,
                    description=f"场记中的镜头 {scene_id}:{shot_number} 未在通告单中找到 (可能是临时加拍)",
                    details={
                        "scene": scene_id,
                        "shot": shot_number,
                        "characters": note.characters,
                        "status": note.status.value,
                        "notes": note.notes
                    }
                )
                project.issues.append(issue)
    
    def _create_issue(self, category: IssueCategory, severity: IssueSeverity,
                      scene_id: str, shot_number: Optional[str], description: str,
                      details: Dict[str, Any] = None, related_shots: List[str] = None
                      ) -> ContinuityIssue:
        """创建连续性问题记录"""
        self._issue_counter += 1
        issue_id = f"ISS-{datetime.now().strftime('%Y%m%d')}-{self._issue_counter:04d}"
        
        return ContinuityIssue(
            issue_id=issue_id,
            category=category,
            severity=severity,
            scene_id=scene_id,
            shot_number=shot_number,
            description=description,
            details=details or {},
            related_shots=related_shots or [],
            approved=False,
            approval_notes="",
            approved_by="",
            approved_at=None
        )
    
    def _parse_shot_number(self, shot_str: str) -> Optional[Tuple]:
        """
        解析镜号为可比较的元组
        
        支持格式:
        - "1" → (1,)
        - "2A" → (2, 'A')
        - "10B" → (10, 'B')
        """
        if not shot_str:
            return None
        
        match = re.match(r'(\d+)([A-Za-z])?', str(shot_str).strip().upper())
        if match:
            num = int(match.group(1))
            suffix = match.group(2) or ''
            return (num, suffix)
        return (0, '')
    
    def _get_scene_key(self, scene_id: str) -> str:
        """获取场景的主键 (去除变体标识)"""
        if '-' in scene_id:
            main = scene_id.split('-')[0]
            return main
        return scene_id.split('.')[0] if '.' in scene_id else scene_id
    
    def _costumes_match(self, costume1: str, costume2: str) -> bool:
        """检查两个服装描述是否匹配"""
        norm1 = self._normalize_costume(costume1)
        norm2 = self._normalize_costume(costume2)
        return norm1 == norm2
    
    def _normalize_costume(self, costume: str) -> str:
        """标准化服装描述"""
        if not costume:
            return ''
        normalized = re.sub(r'[\s+\-，。；、]+', '', costume)
        normalized = re.sub(r'（[^）]*）', '', normalized)
        normalized = re.sub(r'\([^\)]*\)', '', normalized)
        return normalized.upper()
    
    def _costume_matches_rule(self, actual: str, rule) -> bool:
        """检查实际服装是否符合规则"""
        actual_norm = self._normalize_costume(actual)
        rule_norm = self._normalize_costume(rule.description)
        
        if actual_norm == rule_norm:
            return True
        
        if all(part in actual_norm for part in rule_norm.split('+') if part):
            return True
        
        return False
    
    def _find_matching_rules(self, rules, character: str, scene_id: str):
        """找到匹配的服装规则"""
        matching = []
        for rule in rules:
            if rule.character != character:
                continue
            if self._scene_matches_rule(scene_id, rule.scene_id):
                matching.append(rule)
        return matching
    
    def _scene_matches_rule(self, scene_id: str, rule_scene: str) -> bool:
        """检查场景ID是否匹配规则中的场景模式"""
        if rule_scene == '*' or rule_scene == '':
            return True
        
        if rule_scene.endswith('*'):
            prefix = rule_scene[:-1]
            return scene_id.startswith(prefix)
        
        return scene_id == rule_scene

from sqlalchemy.orm import Session
from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime
import re
import json

from .. import models, schemas


class ContinuityValidator:
    def __init__(self, db: Session):
        self.db = db
        self.issues = []
    
    def validate_all(self) -> List[Dict[str, Any]]:
        self.issues = []
        
        self._validate_costume_consistency()
        self._validate_prop_consistency()
        self._validate_timeline_consistency()
        self._validate_address_consistency()
        
        return self.issues
    
    def _parse_list_field(self, value: Optional[str]) -> List[str]:
        if not value:
            return []
        if isinstance(value, str):
            try:
                parsed = json.loads(value)
                if isinstance(parsed, list):
                    return [str(item).strip() for item in parsed if item]
            except:
                pass
            return [item.strip() for item in re.split(r'[,，、]', value) if item.strip()]
        return []
    
    def _create_issue(self, category: models.IssueCategory, title: str, 
                      description: str, affected_panels: List[Tuple[int, int]] = None,
                      severity: models.IssueSeverity = models.IssueSeverity.MEDIUM,
                      rule_name: str = None, confidence: int = 100) -> Dict[str, Any]:
        panel_refs = []
        chapter_refs = set()
        
        if affected_panels:
            for chap_num, panel_num in affected_panels:
                panel_refs.append(f"第{chap_num}章第{panel_num}格")
                chapter_refs.add(str(chap_num))
        
        issue = {
            "category": category,
            "severity": severity,
            "status": models.IssueStatus.OPEN,
            "title": title,
            "description": description,
            "affected_panels": "、".join(panel_refs) if panel_refs else None,
            "affected_chapters": "、".join(sorted(chapter_refs)) if chapter_refs else None,
            "rule_name": rule_name,
            "confidence": confidence
        }
        self.issues.append(issue)
        return issue
    
    def _validate_costume_consistency(self):
        characters = self.db.query(models.Character).all()
        
        character_defaults = {}
        for char in characters:
            defaults = set()
            if char.costume_default:
                defaults.update(self._parse_list_field(char.costume_default))
            if char.costume_variants:
                try:
                    variants = json.loads(char.costume_variants)
                    if isinstance(variants, dict):
                        for scene, items in variants.items():
                            if isinstance(items, list):
                                defaults.update(items)
                except:
                    pass
            character_defaults[char.name] = defaults
            
            if char.aliases:
                aliases = self._parse_list_field(char.aliases)
                for alias in aliases:
                    character_defaults[alias] = defaults
        
        all_panels = self.db.query(models.Panel).order_by(
            models.Panel.chapter_id,
            models.Panel.panel_number
        ).all()
        
        character_appearances: Dict[str, List[Dict]] = {}
        
        for panel in all_panels:
            chapter = self.db.query(models.Chapter).filter(
                models.Chapter.id == panel.chapter_id
            ).first()
            chap_num = chapter.chapter_number if chapter else 0
            
            present_chars = self._parse_list_field(panel.characters_present)
            costumes = self._parse_list_field(panel.costumes)
            
            for char_name in present_chars:
                if char_name not in character_appearances:
                    character_appearances[char_name] = []
                
                character_appearances[char_name].append({
                    "chapter": chap_num,
                    "panel": panel.panel_number,
                    "costumes": costumes,
                    "page": panel.page_number,
                    "location": panel.location
                })
        
        for char_name, appearances in character_appearances.items():
            if len(appearances) < 2:
                continue
            
            appearances.sort(key=lambda x: (x["chapter"], x["panel"]))
            
            baseline_costumes = None
            baseline_source = None
            
            for idx, app in enumerate(appearances):
                current_costumes = set(app["costumes"])
                
                if idx == 0:
                    if current_costumes:
                        baseline_costumes = current_costumes
                        baseline_source = (app["chapter"], app["panel"])
                    continue
                
                if not current_costumes:
                    continue
                
                if baseline_costumes is None:
                    baseline_costumes = current_costumes
                    baseline_source = (app["chapter"], app["panel"])
                    continue
                
                costume_diff = current_costumes.symmetric_difference(baseline_costumes)
                
                if costume_diff:
                    added = current_costumes - baseline_costumes
                    removed = baseline_costumes - current_costumes
                    
                    desc_parts = []
                    if added:
                        desc_parts.append(f"新增服装/配件: {', '.join(added)}")
                    if removed:
                        desc_parts.append(f"缺少服装/配件: {', '.join(removed)}")
                    
                    self._create_issue(
                        category=models.IssueCategory.COSTUME,
                        title=f"角色「{char_name}」服装不一致",
                        description="\n".join(desc_parts) + f"\n基准: 第{baseline_source[0]}章第{baseline_source[1]}格",
                        affected_panels=[
                            (app["chapter"], app["panel"]),
                            baseline_source
                        ],
                        severity=models.IssueSeverity.HIGH,
                        rule_name="costume_consistency",
                        confidence=90
                    )
    
    def _validate_prop_consistency(self):
        characters = self.db.query(models.Character).all()
        
        character_props = {}
        for char in characters:
            props = set()
            if char.props_default:
                props.update(self._parse_list_field(char.props_default))
            character_props[char.name] = props
            
            if char.aliases:
                aliases = self._parse_list_field(char.aliases)
                for alias in aliases:
                    character_props[alias] = props
        
        all_panels = self.db.query(models.Panel).order_by(
            models.Panel.chapter_id,
            models.Panel.panel_number
        ).all()
        
        prop_tracking: Dict[str, Dict] = {}
        
        for panel in all_panels:
            chapter = self.db.query(models.Chapter).filter(
                models.Chapter.id == panel.chapter_id
            ).first()
            chap_num = chapter.chapter_number if chapter else 0
            
            present_chars = self._parse_list_field(panel.characters_present)
            panel_props = self._parse_list_field(panel.props)
            
            for prop in panel_props:
                prop_lower = prop.lower()
                
                if prop_lower not in prop_tracking:
                    prop_tracking[prop_lower] = {
                        "name": prop,
                        "first_seen": (chap_num, panel.panel_number),
                        "holders": set(),
                        "appearances": []
                    }
                
                for char in present_chars:
                    prop_tracking[prop_lower]["holders"].add(char)
                prop_tracking[prop_lower]["appearances"].append({
                    "chapter": chap_num,
                    "panel": panel.panel_number,
                    "holders": set(present_chars)
                })
        
        for prop_name, prop_info in prop_tracking.items():
            if len(prop_info["holders"]) > 1:
                holders_list = list(prop_info["holders"])
                if len(holders_list) > 1:
                    self._create_issue(
                        category=models.IssueCategory.PROP,
                        title=f"道具「{prop_info['name']}」持有者变化",
                        description=f"该道具在不同格数中由不同角色持有: {', '.join(holders_list)}",
                        affected_panels=[
                            (app["chapter"], app["panel"]) 
                            for app in prop_info["appearances"][:5]
                        ],
                        severity=models.IssueSeverity.MEDIUM,
                        rule_name="prop_holder_consistency",
                        confidence=85
                    )
        
        for char_name, expected_props in character_props.items():
            if not expected_props:
                continue
            
            char_appearances = []
            for panel in all_panels:
                chapter = self.db.query(models.Chapter).filter(
                    models.Chapter.id == panel.chapter_id
                ).first()
                chap_num = chapter.chapter_number if chapter else 0
                
                present_chars = self._parse_list_field(panel.characters_present)
                if char_name in present_chars or any(
                    c.lower() == char_name.lower() for c in present_chars
                ):
                    char_appearances.append({
                        "chapter": chap_num,
                        "panel": panel.panel_number,
                        "props": self._parse_list_field(panel.props)
                    })
            
            for app in char_appearances:
                panel_props = set(p.lower() for p in app["props"])
                missing_props = []
                
                for expected in expected_props:
                    if expected.lower() not in panel_props:
                        missing_props.append(expected)
                
                if missing_props:
                    self._create_issue(
                        category=models.IssueCategory.PROP,
                        title=f"角色「{char_name}」缺少默认道具",
                        description=f"根据角色设定，该角色应携带: {', '.join(expected_props)}\n当前格数缺少: {', '.join(missing_props)}",
                        affected_panels=[(app["chapter"], app["panel"])],
                        severity=models.IssueSeverity.MEDIUM,
                        rule_name="prop_default_check",
                        confidence=70
                    )
    
    def _validate_timeline_consistency(self):
        all_panels = self.db.query(models.Panel).order_by(
            models.Panel.chapter_id,
            models.Panel.panel_number
        ).all()
        
        if not all_panels:
            return
        
        time_order = ["凌晨", "清晨", "早晨", "上午", "中午", "下午", "傍晚", "黄昏", "晚上", "深夜", "夜晚"]
        time_map = {t: idx for idx, t in enumerate(time_order)}
        
        previous = None
        
        for panel in all_panels:
            chapter = self.db.query(models.Chapter).filter(
                models.Chapter.id == panel.chapter_id
            ).first()
            chap_num = chapter.chapter_number if chapter else 0
            
            current_time = panel.time_of_day
            
            if previous and current_time and previous["time"]:
                curr_idx = None
                prev_idx = None
                
                for t_name, idx in time_map.items():
                    if t_name in current_time:
                        curr_idx = idx
                    if t_name in previous["time"]:
                        prev_idx = idx
                
                if curr_idx is not None and prev_idx is not None:
                    if curr_idx < prev_idx:
                        self._create_issue(
                            category=models.IssueCategory.TIMELINE,
                            title="时间线倒退",
                            description=f"时间变化异常: 从「{previous['time']}」倒退到「{current_time}」",
                            affected_panels=[
                                (previous["chapter"], previous["panel"]),
                                (chap_num, panel.panel_number)
                            ],
                            severity=models.IssueSeverity.HIGH,
                            rule_name="timeline_sequence",
                            confidence=95
                        )
            
            if previous:
                if (chap_num == previous["chapter"] and 
                    panel.panel_number != previous["panel"] + 1):
                    if panel.panel_number > previous["panel"] + 1:
                        self._create_issue(
                            category=models.IssueCategory.TIMELINE,
                            title=f"格数不连续",
                            description=f"第{chap_num}章中，从第{previous['panel']}格跳到第{panel.panel_number}格，中间可能缺格",
                            affected_panels=[
                                (chap_num, previous["panel"]),
                                (chap_num, panel.panel_number)
                            ],
                            severity=models.IssueSeverity.LOW,
                            rule_name="panel_sequence",
                            confidence=100
                        )
            
            previous = {
                "chapter": chap_num,
                "panel": panel.panel_number,
                "time": current_time,
                "location": panel.location
            }
    
    def _validate_address_consistency(self):
        characters = self.db.query(models.Character).all()
        
        name_mapping = {}
        for char in characters:
            name_mapping[char.name] = char.name
            if char.full_name:
                name_mapping[char.full_name] = char.name
            
            if char.aliases:
                aliases = self._parse_list_field(char.aliases)
                for alias in aliases:
                    name_mapping[alias] = char.name
        
        all_dialogues = self.db.query(models.Dialogue).order_by(
            models.Dialogue.chapter_id,
            models.Dialogue.panel_number,
            models.Dialogue.id
        ).all()
        
        speaker_analysis: Dict[str, Dict] = {}
        
        for dialogue in all_dialogues:
            chapter = self.db.query(models.Chapter).filter(
                models.Chapter.id == dialogue.chapter_id
            ).first()
            chap_num = chapter.chapter_number if chapter else 0
            
            speaker = dialogue.speaker
            address_to = dialogue.address_to
            
            if speaker:
                normalized_speaker = speaker
                for alias, real_name in name_mapping.items():
                    if alias in speaker or speaker in alias:
                        normalized_speaker = real_name
                        break
                
                if normalized_speaker not in speaker_analysis:
                    speaker_analysis[normalized_speaker] = {
                        "actual_names": set(),
                        "addresses": set(),
                        "appearances": []
                    }
                
                if speaker != normalized_speaker:
                    speaker_analysis[normalized_speaker]["actual_names"].add(speaker)
                
                if address_to:
                    speaker_analysis[normalized_speaker]["addresses"].add(address_to)
                
                speaker_analysis[normalized_speaker]["appearances"].append({
                    "chapter": chap_num,
                    "panel": dialogue.panel_number,
                    "speaker": speaker,
                    "address_to": address_to,
                    "content": dialogue.content[:50]
                })
        
        for real_name, data in speaker_analysis.items():
            if len(data["actual_names"]) > 1:
                name_variants = list(data["actual_names"])
                self._create_issue(
                    category=models.IssueCategory.ADDRESS,
                    title=f"说话者「{real_name}」称呼不一致",
                    description=f"同一角色被以不同方式称呼: {', '.join(name_variants)}",
                    affected_panels=[
                        (app["chapter"], app["panel"] or 0)
                        for app in data["appearances"][:5]
                    ],
                    severity=models.IssueSeverity.MEDIUM,
                    rule_name="speaker_naming_consistency",
                    confidence=80
                )
        
        address_to_analysis: Dict[str, set] = {}
        for dialogue in all_dialogues:
            if dialogue.address_to:
                addr = dialogue.address_to
                if addr not in address_to_analysis:
                    address_to_analysis[addr] = set()
                
                chapter = self.db.query(models.Chapter).filter(
                    models.Chapter.id == dialogue.chapter_id
                ).first()
                chap_num = chapter.chapter_number if chapter else 0
                
                address_to_analysis[addr].add(
                    f"第{chap_num}章第{dialogue.panel_number or '?'}格"
                )
        
        for addr, appearances in address_to_analysis.items():
            is_known = False
            for char in characters:
                if (addr == char.name or 
                    addr == char.full_name or
                    (char.aliases and addr in self._parse_list_field(char.aliases))):
                    is_known = True
                    break
            
            if not is_known and len(appearances) > 0:
                pass


def run_validation(db: Session) -> Tuple[int, List[Dict]]:
    validator = ContinuityValidator(db)
    issues = validator.validate_all()
    
    for issue_data in issues:
        issue = models.Issue(
            category=issue_data["category"],
            severity=issue_data["severity"],
            status=issue_data["status"],
            title=issue_data["title"],
            description=issue_data["description"],
            affected_panels=issue_data["affected_panels"],
            affected_chapters=issue_data["affected_chapters"],
            rule_name=issue_data["rule_name"],
            confidence=issue_data["confidence"]
        )
        db.add(issue)
    
    db.commit()
    
    return len(issues), issues

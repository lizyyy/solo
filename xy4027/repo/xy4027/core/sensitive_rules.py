import re
import json
import os
from typing import List, Dict, Any, Optional, Tuple, Pattern
from dataclasses import dataclass, field
from enum import Enum

from models.database import RuleType, RiskLevel


@dataclass
class RuleMatch:
    rule_type: RuleType
    rule_name: str
    matched_text: str
    start_char: int
    end_char: int
    context_before: str
    context_after: str
    risk_level: RiskLevel


@dataclass
class RuleDefinition:
    name: str
    rule_type: RuleType
    pattern: str
    is_regex: bool
    risk_level: RiskLevel
    is_active: bool = True
    description: str = ""
    
    def matches(self, text: str) -> List[Tuple[int, int, str]]:
        if not self.is_active:
            return []
        
        matches: List[Tuple[int, int, str]] = []
        
        if self.is_regex:
            try:
                regex = re.compile(self.pattern, re.IGNORECASE)
                for match in regex.finditer(text):
                    matches.append((match.start(), match.end(), match.group()))
            except re.error:
                pass
        else:
            pattern_lower = self.pattern.lower()
            text_lower = text.lower()
            pos = 0
            while pos < len(text_lower):
                idx = text_lower.find(pattern_lower, pos)
                if idx == -1:
                    break
                matches.append((idx, idx + len(self.pattern), text[idx:idx + len(self.pattern)]))
                pos = idx + 1
        
        return matches


class BuiltinRuleSet:
    
    PHONE_PATTERNS = [
        r"1[3-9]\d{9}",
        r"\+?86[- ]?1[3-9]\d{9}",
        r"\+861[3-9]\d{9}",
        r"1[3-9]\d[- ]?\d{4}[- ]?\d{4}",
        r"\d{3}[- ]?\d{4}[- ]?\d{4}",
        r"\(\d{2,4}\)[- ]?\d{6,8}",
        r"\d{6,8}[- ]?\d{3,4}",
    ]
    
    EMAIL_PATTERNS = [
        r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
        r"[a-zA-Z0-9._%+-]+\s*[@＠]\s*[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}",
    ]
    
    ID_CARD_PATTERNS = [
        r"\d{17}[\dXx]",
        r"\d{6}[\d\*]{8}\d{3}[\dXx]?",
        r"\d{6}\s*\d{8}\s*\d{3}[\dXx]?",
    ]
    
    BANK_CARD_PATTERNS = [
        r"\d{16,19}",
        r"\d{4}[- ]\d{4}[- ]\d{4}[- ]\d{4}",
        r"\d{4}[- ]\d{4}[- ]\d{4}[- ]\d{4}[- ]\d{3}",
    ]
    
    ADDRESS_KEYWORDS = [
        "市", "省", "区", "县", "镇", "乡", "村", "路", "街", "号",
        "号楼", "单元", "室", "公寓", "大厦", "小区", "花园", "广场",
        "北京", "上海", "广州", "深圳", "杭州", "南京", "成都", "武汉",
        "西安", "重庆", "天津", "苏州", "郑州", "长沙", "东莞", "青岛",
        "地址", "住址", "居住地", "户籍地", "邮寄地址", "收货地址"
    ]
    
    COMMON_NAMES = [
        "张三", "李四", "王五", "赵六", "陈七", "刘八", "周九", "吴十",
        "经理", "总监", "总裁", "老板", "客户", "先生", "女士", "小姐",
        "同学", "同事", "朋友", "家人", "亲戚"
    ]


class RuleEngineError(Exception):
    pass


class SensitiveRuleEngine:
    
    def __init__(self, rules_config_path: Optional[str] = None):
        self.builtin_rules: List[RuleDefinition] = self._create_builtin_rules()
        self.custom_rules: List[RuleDefinition] = []
        self.rules_config_path = rules_config_path
        
        if rules_config_path and os.path.exists(rules_config_path):
            self.load_rules_from_file(rules_config_path)
    
    def _create_builtin_rules(self) -> List[RuleDefinition]:
        rules: List[RuleDefinition] = []
        
        for pattern in BuiltinRuleSet.PHONE_PATTERNS:
            rules.append(RuleDefinition(
                name="手机号",
                rule_type=RuleType.PHONE,
                pattern=pattern,
                is_regex=True,
                risk_level=RiskLevel.HIGH,
                description="中国大陆手机号格式"
            ))
        
        for pattern in BuiltinRuleSet.EMAIL_PATTERNS:
            rules.append(RuleDefinition(
                name="邮箱地址",
                rule_type=RuleType.EMAIL,
                pattern=pattern,
                is_regex=True,
                risk_level=RiskLevel.HIGH,
                description="电子邮箱格式"
            ))
        
        for pattern in BuiltinRuleSet.ID_CARD_PATTERNS:
            rules.append(RuleDefinition(
                name="身份证号",
                rule_type=RuleType.ID_CARD,
                pattern=pattern,
                is_regex=True,
                risk_level=RiskLevel.HIGH,
                description="中国大陆身份证号格式"
            ))
        
        for pattern in BuiltinRuleSet.BANK_CARD_PATTERNS:
            rules.append(RuleDefinition(
                name="银行卡号",
                rule_type=RuleType.BANK_CARD,
                pattern=pattern,
                is_regex=True,
                risk_level=RiskLevel.HIGH,
                description="银行卡号格式"
            ))
        
        for keyword in BuiltinRuleSet.ADDRESS_KEYWORDS:
            rules.append(RuleDefinition(
                name="地址关键词",
                rule_type=RuleType.ADDRESS,
                pattern=keyword,
                is_regex=False,
                risk_level=RiskLevel.MEDIUM,
                description=f"地址相关关键词: {keyword}"
            ))
        
        return rules
    
    def add_custom_rule(self, name: str, pattern: str, is_regex: bool = False,
                        risk_level: RiskLevel = RiskLevel.MEDIUM, 
                        rule_type: RuleType = RuleType.CUSTOM) -> RuleDefinition:
        if not pattern.strip():
            raise RuleEngineError("规则模式不能为空")
        
        if is_regex:
            try:
                re.compile(pattern)
            except re.error as e:
                raise RuleEngineError(f"正则表达式无效: {str(e)}")
        
        rule = RuleDefinition(
            name=name,
            rule_type=rule_type,
            pattern=pattern,
            is_regex=is_regex,
            risk_level=risk_level
        )
        self.custom_rules.append(rule)
        return rule
    
    def get_all_rules(self) -> List[RuleDefinition]:
        return self.builtin_rules + self.custom_rules
    
    def get_active_rules(self) -> List[RuleDefinition]:
        return [r for r in self.get_all_rules() if r.is_active]
    
    def scan_text(self, text: str) -> List[RuleMatch]:
        if not text or not text.strip():
            return []
        
        matches: List[RuleMatch] = []
        rules = self.get_active_rules()
        
        for rule in rules:
            rule_matches = rule.matches(text)
            for start_char, end_char, matched_text in rule_matches:
                context_before = self._extract_context(text, start_char, before=True)
                context_after = self._extract_context(text, end_char, before=False)
                
                is_duplicate = False
                for existing in matches:
                    if (existing.start_char <= start_char < existing.end_char or
                        start_char <= existing.start_char < end_char):
                        is_duplicate = True
                        break
                
                if not is_duplicate:
                    matches.append(RuleMatch(
                        rule_type=rule.rule_type,
                        rule_name=rule.name,
                        matched_text=matched_text,
                        start_char=start_char,
                        end_char=end_char,
                        context_before=context_before,
                        context_after=context_after,
                        risk_level=rule.risk_level
                    ))
        
        matches.sort(key=lambda x: x.start_char)
        return matches
    
    def scan_segments(self, segments: List[Dict]) -> List[Dict]:
        all_hits: List[Dict] = []
        hit_id_map: Dict[str, int] = {}
        
        for seg_idx, segment in enumerate(segments):
            text = segment.get("text", "")
            seg_start = segment.get("start_time", 0.0)
            seg_end = segment.get("end_time", 0.0)
            seg_duration = seg_end - seg_start
            
            matches = self.scan_text(text)
            
            for match in matches:
                char_start = match.start_char
                char_end = match.end_char
                text_len = len(text)
                
                if text_len > 0:
                    rel_start = char_start / text_len
                    rel_end = char_end / text_len
                else:
                    rel_start = 0.0
                    rel_end = 1.0
                
                hit_start = seg_start + rel_start * seg_duration
                hit_end = seg_start + rel_end * seg_duration
                hit_end = min(hit_end, seg_end)
                
                hit_key = f"{hit_start:.3f}_{hit_end:.3f}_{match.matched_text}"
                
                if hit_key in hit_id_map:
                    existing_idx = hit_id_map[hit_key]
                    all_hits[existing_idx]["is_duplicate"] = True
                    continue
                
                hit_data = {
                    "segment_id": segment.get("id"),
                    "rule_type": match.rule_type,
                    "rule_name": match.rule_name,
                    "start_time": hit_start,
                    "end_time": hit_end,
                    "matched_text": match.matched_text,
                    "context_before": match.context_before,
                    "context_after": match.context_after,
                    "risk_level": match.risk_level,
                    "is_duplicate": False,
                    "segment_text": text
                }
                
                hit_id_map[hit_key] = len(all_hits)
                all_hits.append(hit_data)
        
        return all_hits
    
    def _extract_context(self, text: str, pos: int, before: bool, length: int = 20) -> str:
        if not text:
            return ""
        
        if before:
            start = max(0, pos - length)
            return text[start:pos].strip()
        else:
            end = min(len(text), pos + length)
            return text[pos:end].strip()
    
    def load_rules_from_file(self, file_path: str) -> Tuple[int, List[str]]:
        if not os.path.exists(file_path):
            raise RuleEngineError(f"规则文件不存在: {file_path}")
        
        errors: List[str] = []
        loaded_count = 0
        
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except json.JSONDecodeError as e:
            raise RuleEngineError(f"规则文件格式错误（无效JSON）: {str(e)}")
        
        if not isinstance(data, dict):
            raise RuleEngineError("规则文件格式错误: 根节点必须是对象")
        
        rules_data = data.get("rules", [])
        if not isinstance(rules_data, list):
            raise RuleEngineError("规则文件格式错误: 'rules' 必须是数组")
        
        for idx, rule_data in enumerate(rules_data):
            try:
                name = rule_data.get("name", f"自定义规则_{idx}")
                pattern = rule_data.get("pattern", "")
                is_regex = rule_data.get("is_regex", False)
                
                risk_level_str = rule_data.get("risk_level", "medium").lower()
                if risk_level_str == "high":
                    risk_level = RiskLevel.HIGH
                elif risk_level_str == "low":
                    risk_level = RiskLevel.LOW
                else:
                    risk_level = RiskLevel.MEDIUM
                
                rule_type_str = rule_data.get("rule_type", "custom").lower()
                if rule_type_str == "phone":
                    rule_type = RuleType.PHONE
                elif rule_type_str == "email":
                    rule_type = RuleType.EMAIL
                elif rule_type_str == "id_card":
                    rule_type = RuleType.ID_CARD
                elif rule_type_str == "bank_card":
                    rule_type = RuleType.BANK_CARD
                elif rule_type_str == "address":
                    rule_type = RuleType.ADDRESS
                else:
                    rule_type = RuleType.CUSTOM
                
                if not pattern.strip():
                    errors.append(f"规则 [{idx}]: 模式不能为空，已跳过")
                    continue
                
                if is_regex:
                    try:
                        re.compile(pattern)
                    except re.error as e:
                        errors.append(f"规则 [{idx}]: 正则表达式无效 - {str(e)}，已跳过")
                        continue
                
                self.add_custom_rule(
                    name=name,
                    pattern=pattern,
                    is_regex=is_regex,
                    risk_level=risk_level,
                    rule_type=rule_type
                )
                loaded_count += 1
                
            except Exception as e:
                errors.append(f"规则 [{idx}]: 加载失败 - {str(e)}")
        
        return loaded_count, errors
    
    def save_rules_to_file(self, file_path: str) -> int:
        rules_data: List[Dict] = []
        
        for rule in self.custom_rules:
            rules_data.append({
                "name": rule.name,
                "rule_type": rule.rule_type.value,
                "pattern": rule.pattern,
                "is_regex": rule.is_regex,
                "risk_level": rule.risk_level.value,
                "is_active": rule.is_active,
                "description": rule.description
            })
        
        output = {
            "version": "1.0",
            "created_at": "",
            "rules": rules_data
        }
        
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
        
        return len(rules_data)

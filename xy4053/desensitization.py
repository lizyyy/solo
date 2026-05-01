import re
from typing import List, Dict, Any, Tuple, Optional
from config import settings, RiskLevel, CaseStatus
from datetime import datetime


class DesensitizationRule:
    def __init__(self, name: str, pattern: str, description: str, confidence: float = 1.0):
        self.name = name
        self.pattern = re.compile(pattern, re.IGNORECASE)
        self.description = description
        self.confidence = confidence


class DesensitizationEngine:
    def __init__(self):
        self.rules = self._init_rules()
        self.common_words = self._get_common_words()
    
    def _get_common_words(self) -> set:
        return {
            "来访者", "求助者", "患者", "咨询者", "客户", "用户",
            "工作", "压力", "焦虑", "抑郁", "失眠", "情绪", "问题",
            "咨询", "治疗", "干预", "评估", "督导",
            "两周", "最近", "近期", "经常", "感到", "觉得", "因为",
            "睡眠", "质量", "下降", "紧张", "不安", "痛苦", "关系",
            "系统", "模式", "过程", "支持", "帮助", "学习",
            "轻度", "中度", "重度", "急性", "慢性",
            "心理", "精神", "认知", "行为", "情绪",
            "社会", "家庭", "人际", "职业", "学业"
        }
    
    def _init_rules(self) -> List[DesensitizationRule]:
        return [
            DesensitizationRule(
                "phone_number",
                r"\b1[3-9]\d{9}\b|\b0\d{2,3}-?\d{7,8}\b",
                "电话号码检测",
                confidence=1.0
            ),
            DesensitizationRule(
                "id_card",
                r"\b\d{17}[\dXx]\b|\b\d{15}\b",
                "身份证号检测",
                confidence=1.0
            ),
            DesensitizationRule(
                "email",
                r"\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b",
                "邮箱地址检测",
                confidence=1.0
            ),
            DesensitizationRule(
                "wechat",
                r"微信[：:]\s*[a-zA-Z0-9_-]+|微信号[：:]\s*[a-zA-Z0-9_-]+",
                "微信号检测",
                confidence=0.95
            ),
            DesensitizationRule(
                "qq_number",
                r"QQ[：:]\s*\d{5,12}|QQ号[：:]\s*\d{5,12}",
                "QQ号检测",
                confidence=0.95
            ),
            DesensitizationRule(
                "explicit_name",
                r"(?:姓名|名字|来访者姓名|患者姓名|求助者姓名)[：:]\s*[\u4e00-\u9fa5]{2,4}",
                "明确标识的姓名检测",
                confidence=0.95
            ),
            DesensitizationRule(
                "referrer_name",
                r"(?:来访者|求助者|患者|咨询者)(?:是|叫|为|：|:)?\s*[\u4e00-\u9fa5]{2,4}(?:[，。,;\s]|$|因|，|。)",
                "来访者/求助者姓名检测",
                confidence=0.9
            ),
            DesensitizationRule(
                "school_name",
                r"[\u4e00-\u9fa5]{2,}(?:大学|学院|中学|小学|幼儿园|学校|职高|技校)",
                "学校名称检测",
                confidence=0.9
            ),
            DesensitizationRule(
                "company_name",
                r"[\u4e00-\u9fa5]{2,}(?:公司|企业|集团|股份|有限|责任|工作室)",
                "公司/单位名称检测",
                confidence=0.9
            ),
            DesensitizationRule(
                "address",
                r"[\u4e00-\u9fa5]{2,}(?:省|市|区|县|镇|乡|村|街道|路|巷|号|楼|单元|室)[\u4e00-\u9fa5\d]*",
                "地址信息检测",
                confidence=0.85
            ),
        ]
    
    def check_text(self, text: str) -> Tuple[bool, List[Dict[str, Any]]]:
        if not text or not text.strip():
            return True, []
        
        found_sensitive = []
        
        for rule in self.rules:
            matches = rule.pattern.findall(text)
            for match in matches:
                if match and len(match) > 0:
                    if self._is_common_word(match):
                        continue
                    
                    found_sensitive.append({
                        "rule_name": rule.name,
                        "description": rule.description,
                        "matched_text": match,
                        "confidence": rule.confidence,
                        "position": text.find(match) if match in text else -1
                    })
        
        found_sensitive = self._remove_duplicates(found_sensitive)
        
        return len(found_sensitive) == 0, found_sensitive
    
    def _is_common_word(self, text: str) -> bool:
        clean_text = re.sub(r'[^\u4e00-\u9fa5]', '', text).strip()
        if clean_text in self.common_words:
            return True
        
        for word in self.common_words:
            if clean_text == word:
                return True
        
        return False
    
    def _remove_duplicates(self, items: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        seen = set()
        result = []
        for item in items:
            key = (item["matched_text"], item["position"])
            if key not in seen:
                seen.add(key)
                result.append(item)
        return result
    
    def check_case_content(self, case_data: Dict[str, Any]) -> Tuple[bool, Dict[str, Any]]:
        fields_to_check = [
            "presenting_problem",
            "background_info", 
            "assessment_process",
            "intervention_strategy"
        ]
        
        all_passed = True
        check_results = {}
        
        for field in fields_to_check:
            if field in case_data and case_data[field]:
                passed, sensitive = self.check_text(case_data[field])
                check_results[field] = {
                    "passed": passed,
                    "sensitive_items": sensitive
                }
                if not passed:
                    all_passed = False
            else:
                check_results[field] = {
                    "passed": True,
                    "sensitive_items": []
                }
        
        return all_passed, check_results


class ScaleValidator:
    def __init__(self):
        self.valid_ranges = settings.VALID_SCALE_RANGES
    
    def validate_score(self, scale_name: str, score: float) -> Tuple[bool, str]:
        if scale_name not in self.valid_ranges:
            return False, f"未知的量表名称: {scale_name}"
        
        min_score, max_score = self.valid_ranges[scale_name]
        
        if score < min_score or score > max_score:
            return False, f"{scale_name}分数 {score} 超出有效范围 [{min_score}, {max_score}]"
        
        return True, f"{scale_name}分数 {score} 在有效范围内"
    
    def validate_all_scores(self, scores: Dict[str, float]) -> Tuple[bool, Dict[str, Any]]:
        all_passed = True
        results = {}
        
        for scale_name, score in scores.items():
            if score is not None:
                passed, message = self.validate_score(scale_name, score)
                results[scale_name] = {
                    "passed": passed,
                    "message": message,
                    "score": score
                }
                if not passed:
                    all_passed = False
        
        return all_passed, results


class RiskLevelValidator:
    def __init__(self):
        self.risk_triggers = settings.RISK_TRIGGERS
    
    def validate_risk_match(self, risk_level: str, triggers: List[str]) -> Tuple[bool, Dict[str, Any]]:
        if risk_level not in self.risk_triggers:
            return False, {
                "error": f"未知的风险等级: {risk_level}",
                "matched_triggers": [],
                "expected_triggers": []
            }
        
        expected_triggers = self.risk_triggers[risk_level]
        matched_triggers = []
        
        for trigger in triggers:
            for expected in expected_triggers:
                if expected in trigger or trigger in expected:
                    matched_triggers.append(trigger)
                    break
        
        if risk_level in [RiskLevel.HIGH, RiskLevel.CRISIS] and len(matched_triggers) == 0:
            return False, {
                "error": f"高风险/危机等级必须匹配至少一个触发因素",
                "matched_triggers": matched_triggers,
                "expected_triggers": expected_triggers
            }
        
        return True, {
            "message": "风险等级与触发因素匹配验证通过",
            "matched_triggers": matched_triggers,
            "expected_triggers": expected_triggers
        }
    
    def suggest_risk_level(self, triggers: List[str]) -> str:
        for risk_level in [RiskLevel.CRISIS, RiskLevel.HIGH, RiskLevel.MEDIUM, RiskLevel.LOW]:
            expected_triggers = self.risk_triggers[risk_level]
            for trigger in triggers:
                for expected in expected_triggers:
                    if expected in trigger or trigger in expected:
                        return risk_level
        
        return RiskLevel.LOW


desensitization_engine = DesensitizationEngine()
scale_validator = ScaleValidator()
risk_validator = RiskLevelValidator()

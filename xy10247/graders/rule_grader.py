from typing import List

from graders.config import RULE_CONFIG, COLOR_CATEGORIES
from graders.models import ExtractedFeatures, RuleResult, SeverityLevel


class RuleGrader:
    def __init__(self):
        self.config = RULE_CONFIG
    
    def _calculate_area_score(self, lesion_ratio: float) -> float:
        if lesion_ratio <= self.config['mild_max_ratio']:
            return 0.2
        elif lesion_ratio <= self.config['moderate_max_ratio']:
            return 0.5
        elif lesion_ratio <= self.config['severe_max_ratio']:
            return 0.8
        else:
            return 0.95
    
    def _calculate_color_score(self, color_feature) -> float:
        color_name = color_feature.color_category
        
        if color_name in COLOR_CATEGORIES:
            return COLOR_CATEGORIES[color_name]["weight"]
        return 0.4
    
    def _get_area_rule(self, lesion_ratio: float) -> tuple:
        rules = []
        
        if lesion_ratio <= self.config['mild_max_ratio']:
            rules.append(f"病斑比例 {lesion_ratio:.2%} ≤ {self.config['mild_max_ratio']:.0%}，符合轻度区间")
            grade = SeverityLevel.MILD
        elif lesion_ratio <= self.config['moderate_max_ratio']:
            rules.append(f"病斑比例 {lesion_ratio:.2%} 在 {self.config['mild_max_ratio']:.0%}-{self.config['moderate_max_ratio']:.0%} 之间，符合中度区间")
            grade = SeverityLevel.MODERATE
        elif lesion_ratio <= self.config['severe_max_ratio']:
            rules.append(f"病斑比例 {lesion_ratio:.2%} 在 {self.config['moderate_max_ratio']:.0%}-{self.config['severe_max_ratio']:.0%} 之间，符合严重区间")
            grade = SeverityLevel.SEVERE
        else:
            rules.append(f"病斑比例 {lesion_ratio:.2%} > {self.config['severe_max_ratio']:.0%}，符合极严重区间")
            grade = SeverityLevel.CRITICAL
        
        return rules, grade
    
    def _get_color_rule(self, color_feature) -> str:
        color_name = color_feature.color_category
        brown_idx = color_feature.brown_index
        yellow_idx = color_feature.yellow_index
        
        if color_name in ["褐色", "浅褐色"]:
            return f"病斑颜色为{color_name}（褐色指数 {brown_idx:.2f}），颜色越深病情越重"
        elif color_name == "黄褐色":
            return f"病斑颜色为{color_name}（褐黄指数较高 {yellow_idx:.2f}），属于中期病变"
        elif color_name == "枯黄":
            return f"病斑颜色为{color_name}（枯黄指数 {yellow_idx:.2f}），处于枯亡期病变"
        elif color_name == "黄色":
            return f"病斑颜色为{color_name}（黄色指数 {yellow_idx:.2f}），属于初期病变"
        else:
            return f"病斑颜色为{color_name}，需要结合面积综合判断"
    
    def _build_explanation(self, area_rules: List[str], color_rule: str,
                          area_score: float, color_score: float,
                          final_score: float) -> str:
        lines = []
        lines.append("【分级理由】")
        lines.append(f"1. 面积分析：")
        for rule in area_rules:
            lines.append(f"   - {rule}")
        lines.append(f"   面积得分：{area_score:.2f}")
        lines.append("")
        lines.append(f"2. 颜色分析：")
        lines.append(f"   - {color_rule}")
        lines.append(f"   颜色得分：{color_score:.2f}")
        lines.append("")
        lines.append(f"3. 综合评分：")
        lines.append(f"   - 面积权重 {self.config['area_weight']:.1%} × {area_score:.2f} + 颜色权重 {self.config['color_weight']:.1%} × {color_score:.2f}")
        lines.append(f"   - 综合得分：{final_score:.2f}")
        
        return "\n".join(lines)
    
    def grade(self, features: ExtractedFeatures) -> RuleResult:
        lesion_ratio = features.area_features.lesion_ratio
        color_feature = features.color_features
        
        area_score = self._calculate_area_score(lesion_ratio)
        color_score = self._calculate_color_score(color_feature)
        
        final_score = (
            area_score * self.config['area_weight'] +
            color_score * self.config['color_weight']
        )
        
        area_rules, base_grade = self._get_area_rule(lesion_ratio)
        color_rule = self._get_color_rule(color_feature)
        
        rules_applied = area_rules + [color_rule]
        
        explanation = self._build_explanation(
            area_rules, color_rule, area_score, color_score, final_score
        )
        
        if final_score <= 0.25:
            final_grade = SeverityLevel.MILD
        elif final_score <= 0.5:
            final_grade = SeverityLevel.MODERATE
        elif final_score <= 0.75:
            final_grade = SeverityLevel.SEVERE
        else:
            final_grade = SeverityLevel.CRITICAL
        
        return RuleResult(
            grade=final_grade,
            score=final_score,
            rules_applied=rules_applied,
            explanation=explanation
        )

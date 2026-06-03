from typing import Tuple, Optional, Dict, Any
from datetime import datetime
import hashlib
import pandas as pd


BORDER_RULES = {
    "negative_score": {
        "rule_id": "BR001",
        "name": "负数分数处理",
        "description": "旧表中负数分数被当成缺失值处理。检测到负数时：1. 标记为待复核 2. 不参与自动匹配 3. 分配给学生助教",
        "action": "flag_for_review",
        "assignee": "student_assistant",
        "severity": "high"
    },
    "missing_score": {
        "rule_id": "BR002",
        "name": "缺失分数处理",
        "description": "分数为空或非数字时：1. 标记为缺失 2. 保留原始值用于追溯 3. 不参与自动匹配",
        "action": "flag_missing",
        "severity": "medium"
    },
    "out_of_range_rank": {
        "rule_id": "BR003",
        "name": "排名异常处理",
        "description": "排名为0、负数或超出样本总数时：1. 标记为边界样本 2. 需人工确认",
        "action": "flag_borderline",
        "severity": "medium"
    },
    "duplicate_student": {
        "rule_id": "BR004",
        "name": "重复学生处理",
        "description": "同一学号重复出现时：1. 保留最新版本 2. 创建历史记录 3. 不重复计数",
        "action": "version_track",
        "severity": "low"
    },
    "remark_conflict": {
        "rule_id": "BR005",
        "name": "备注冲突处理",
        "description": "同一学生备注不一致时：1. 保留所有版本 2. 标记冲突 3. 需人工确认",
        "action": "flag_conflict",
        "severity": "medium"
    }
}


def detect_score_issues(score_value: Any) -> Tuple[bool, Optional[str], Dict]:
    """
    检测分数是否存在边界问题
    
    返回: (has_issue, issue_type, details)
    """
    details = {"original_value": str(score_value), "cleaned_value": None}
    
    if pd.isna(score_value) or score_value == "" or score_value is None:
        details["cleaned_value"] = None
        return True, "missing_score", details
    
    try:
        score = float(score_value)
        details["cleaned_value"] = score
        
        if score < 0:
            return True, "negative_score", details
            
        return False, None, details
        
    except (ValueError, TypeError):
        details["cleaned_value"] = None
        return True, "missing_score", details


def detect_rank_issues(rank_value: Any, total_samples: int) -> Tuple[bool, Optional[str], Dict]:
    """
    检测排名是否存在边界问题
    """
    details = {"original_value": str(rank_value), "cleaned_value": None}
    
    if pd.isna(rank_value) or rank_value == "" or rank_value is None:
        return True, "missing_score", details
    
    try:
        rank = int(rank_value)
        details["cleaned_value"] = rank
        
        if rank <= 0 or rank > total_samples * 1.5:
            return True, "out_of_range_rank", details
            
        return False, None, details
        
    except (ValueError, TypeError):
        return True, "missing_score", details


def generate_record_hash(student_id: str, source: str = "") -> str:
    """
    生成记录唯一哈希，用于去重检测
    """
    content = f"{student_id}:{source}"
    return hashlib.md5(content.encode()).hexdigest()[:16]


def compare_versions(old_data: Dict, new_data: Dict) -> Dict:
    """
    比较两个版本的数据差异
    
    返回: 差异字段和改前改后值
    """
    changes = {}
    
    for key in set(list(old_data.keys()) + list(new_data.keys())):
        old_val = old_data.get(key)
        new_val = new_data.get(key)
        
        if old_val != new_val:
            changes[key] = {
                "before": old_val,
                "after": new_val
            }
    
    return changes


def apply_border_rule(issue_type: str, data: Dict) -> Dict:
    """
    应用边界规则处理数据
    """
    rule = BORDER_RULES.get(issue_type, {
        "action": "flag_for_review",
        "assignee": "student_assistant",
        "severity": "medium"
    })
    
    result = {
        "issue_type": issue_type,
        "rule_applied": rule.get("rule_id", "UNKNOWN"),
        "action": rule.get("action", "flag_for_review"),
        "is_borderline": True,
        "needs_review": True,
        "review_assignee": rule.get("assignee", "student_assistant"),
        "severity": rule.get("severity", "medium"),
        "processed_at": datetime.utcnow().isoformat()
    }
    
    return result


def resolve_negative_score(original_value: str, resolution: str, resolved_by: str) -> Dict:
    """
    处理负数分数的复核决议
    
    可用决议:
    - "keep_negative": 保留负数（表示特殊情况）
    - "convert_positive": 转为正数
    - "mark_missing": 标记为缺失
    - "custom_value": 使用自定义值
    """
    resolutions = {
        "keep_negative": {
            "action": "保留负数",
            "description": "确认负数为有效标记（如缺考、作弊等）",
            "score_value": float(original_value)
        },
        "convert_positive": {
            "action": "转为正数",
            "description": "将负数绝对值作为分数",
            "score_value": abs(float(original_value))
        },
        "mark_missing": {
            "action": "标记为缺失",
            "description": "将负数视为无效数据，标记为缺失",
            "score_value": None
        },
        "custom_value": {
            "action": "使用自定义值",
            "description": "使用人工复核后的值",
            "score_value": None
        }
    }
    
    result = resolutions.get(resolution, resolutions["mark_missing"])
    result.update({
        "original_value": original_value,
        "resolution": resolution,
        "resolved_by": resolved_by,
        "resolved_at": datetime.utcnow().isoformat()
    })
    
    return result

""".gitattributes 解析器"""
import fnmatch
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from git_lfs_migrator.models import GitAttributeRule


GITATTRIBUTES_PATTERN = re.compile(
    r"^"
    r"(\S+)"
    r"\s+"
    r"(.+)"
    r"$"
)


def parse_gitattributes(content: str) -> List[GitAttributeRule]:
    """
    解析 .gitattributes 文件内容
    
    Args:
        content: .gitattributes 文件的完整内容
    
    Returns:
        GitAttributeRule 列表
    """
    rules: List[GitAttributeRule] = []
    
    for line_num, line in enumerate(content.split("\n"), start=1):
        original_line = line
        line = line.strip()
        
        if not line or line.startswith("#"):
            continue
        
        match = GITATTRIBUTES_PATTERN.match(line)
        if not match:
            continue
        
        pattern = match.group(1)
        attributes_str = match.group(2)
        
        lfs_enabled = False
        other_attributes: Dict[str, str] = {}
        
        for attr in attributes_str.split():
            attr = attr.strip()
            if attr == "filter=lfs":
                lfs_enabled = True
            elif attr == "diff=lfs":
                lfs_enabled = True
            elif attr == "merge=lfs":
                lfs_enabled = True
            elif attr == "-text":
                pass
            elif attr == "text":
                pass
            elif "=" in attr:
                key, value = attr.split("=", 1)
                other_attributes[key] = value
            else:
                other_attributes[attr] = ""
        
        rule = GitAttributeRule(
            pattern=pattern,
            lfs_enabled=lfs_enabled,
            other_attributes=other_attributes,
            line_number=line_num,
            raw_line=original_line,
        )
        rules.append(rule)
    
    return rules


def validate_gitattributes_pattern(pattern: str) -> Tuple[bool, str]:
    """
    验证 .gitattributes 模式是否有效
    
    Args:
        pattern: 要验证的模式
    
    Returns:
        (是否有效, 错误消息)
    """
    if not pattern:
        return False, "Pattern cannot be empty"
    
    if pattern.startswith("/"):
        pattern = pattern[1:]
    
    invalid_chars = set('<>:"|?*')
    for char in pattern:
        if ord(char) < 32:
            return False, f"Invalid character in pattern: control character"
    
    try:
        fnmatch.fnmatch("test.txt", pattern)
    except Exception as e:
        return False, f"Invalid glob pattern: {e}"
    
    return True, ""


def find_matching_rule(
    path: str,
    rules: List[GitAttributeRule],
) -> Optional[GitAttributeRule]:
    """
    查找匹配指定路径的 .gitattributes 规则
    
    Args:
        path: 文件路径
        rules: 规则列表
    
    Returns:
        匹配的规则（最后一个匹配的优先），如果没有匹配则返回 None
    """
    matching_rules: List[GitAttributeRule] = []
    
    for rule in rules:
        pattern = rule.pattern
        
        if pattern.startswith("/"):
            pattern = pattern[1:]
            if fnmatch.fnmatch(path, pattern):
                matching_rules.append(rule)
        elif "/" in pattern:
            if fnmatch.fnmatch(path, pattern):
                matching_rules.append(rule)
            else:
                parts = path.split("/")
                for i in range(len(parts)):
                    subpath = "/".join(parts[i:])
                    if fnmatch.fnmatch(subpath, pattern):
                        matching_rules.append(rule)
                        break
        else:
            basename = path.split("/")[-1]
            if fnmatch.fnmatch(basename, pattern):
                matching_rules.append(rule)
    
    if matching_rules:
        return matching_rules[-1]
    
    return None


def check_rule_conflicts(rules: List[GitAttributeRule]) -> List[Dict[str, str]]:
    """
    检查规则冲突
    
    Args:
        rules: 规则列表
    
    Returns:
        冲突列表
    """
    conflicts: List[Dict[str, str]] = []
    
    for i, rule1 in enumerate(rules):
        for j, rule2 in enumerate(rules[i + 1:], start=i + 1):
            if _patterns_may_overlap(rule1.pattern, rule2.pattern):
                if rule1.lfs_enabled != rule2.lfs_enabled:
                    conflicts.append({
                        "rule1_pattern": rule1.pattern,
                        "rule1_line": str(rule1.line_number),
                        "rule1_lfs": str(rule1.lfs_enabled),
                        "rule2_pattern": rule2.pattern,
                        "rule2_line": str(rule2.line_number),
                        "rule2_lfs": str(rule2.lfs_enabled),
                        "conflict_type": "LFS status mismatch",
                    })
    
    return conflicts


def _patterns_may_overlap(pattern1: str, pattern2: str) -> bool:
    """检查两个模式是否可能重叠"""
    patterns = [pattern1, pattern2]
    for i in range(2):
        p = patterns[i].replace("*", "").replace("?", "")
        if not p or p == "/" or p == "**":
            return True
    
    test_cases = [
        "test.txt",
        "dir/test.txt",
        "a/b/c/test.txt",
    ]
    
    for test in test_cases:
        try:
            match1 = fnmatch.fnmatch(test, pattern1)
            match2 = fnmatch.fnmatch(test, pattern2)
            if match1 and match2:
                return True
        except Exception:
            pass
    
    return False

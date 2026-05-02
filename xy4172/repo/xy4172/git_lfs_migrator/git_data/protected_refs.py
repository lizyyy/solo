"""保护分支和标签解析器"""
import re
from pathlib import Path
from typing import Dict, List, Optional, Set

from git_lfs_migrator.models import ProtectedBranch


DEFAULT_PROTECTED_PATTERNS = [
    r"^main$",
    r"^master$",
    r"^develop$",
    r"^release/.*$",
    r"^hotfix/.*$",
    r"^v\d+\.\d+\.\d+$",
    r"^v\d+\.\d+$",
]


def parse_protected_refs(content: str) -> List[ProtectedBranch]:
    """
    解析保护分支表
    
    格式支持:
    - 每行一个引用名
    - 支持注释 (#)
    - 支持 is_tag: 标记来区分标签
    
    示例:
    main
    master
    v1.0.0  # is_tag: true
    release/1.0
    
    Args:
        content: 保护分支表内容
    
    Returns:
        ProtectedBranch 列表
    """
    protected: List[ProtectedBranch] = []
    
    for line in content.split("\n"):
        original_line = line
        line = line.strip()
        
        if not line or line.startswith("#"):
            continue
        
        is_tag = False
        ref_name = line
        
        if "#" in line:
            line, comment = line.split("#", 1)
            line = line.strip()
            ref_name = line
            
            comment = comment.strip()
            if "is_tag" in comment.lower():
                if ":" in comment:
                    _, value = comment.split(":", 1)
                    is_tag = value.strip().lower() in ["true", "yes", "1"]
                else:
                    is_tag = True
        
        if ref_name:
            protected.append(ProtectedBranch(
                name=ref_name,
                ref=f"refs/tags/{ref_name}" if is_tag else f"refs/heads/{ref_name}",
                is_tag=is_tag,
            ))
    
    return protected


def detect_protected_branches(
    repo_path: Path,
    additional_patterns: Optional[List[str]] = None,
) -> List[ProtectedBranch]:
    """
    自动检测保护分支和标签
    
    Args:
        repo_path: 仓库路径
        additional_patterns: 额外的保护模式正则表达式列表
    
    Returns:
        ProtectedBranch 列表
    """
    from git_lfs_migrator.git_data.parser import GitDataParser
    
    parser = GitDataParser(repo_path)
    protected: List[ProtectedBranch] = []
    
    patterns = list(DEFAULT_PROTECTED_PATTERNS)
    if additional_patterns:
        patterns.extend(additional_patterns)
    
    tags = parser.get_tags()
    for tag in tags:
        for pattern in patterns:
            if re.match(pattern, tag):
                protected.append(ProtectedBranch(
                    name=tag,
                    ref=f"refs/tags/{tag}",
                    is_tag=True,
                ))
                break
    
    branches = parser.get_branches()
    for branch in branches:
        for pattern in patterns:
            if re.match(pattern, branch):
                protected.append(ProtectedBranch(
                    name=branch,
                    ref=f"refs/heads/{branch}",
                    is_tag=False,
                ))
                break
    
    seen: Set[str] = set()
    unique_protected: List[ProtectedBranch] = []
    for p in protected:
        if p.ref not in seen:
            seen.add(p.ref)
            unique_protected.append(p)
    
    return unique_protected


def get_protected_refs_from_gitlab_ci(content: str) -> List[ProtectedBranch]:
    """
    从 .gitlab-ci.yml 内容中解析保护分支
    
    Args:
        content: .gitlab-ci.yml 内容
    
    Returns:
        ProtectedBranch 列表
    """
    protected: List[ProtectedBranch] = []
    
    protected_keywords = [
        "protected",
        "only: [main",
        "only: [master",
        "except:",
    ]
    
    lines = content.split("\n")
    in_only_section = False
    in_except_section = False
    current_refs: List[str] = []
    
    for i, line in enumerate(lines):
        stripped = line.strip()
        
        if "only:" in stripped and ":" in stripped.split("only:")[0] if "only:" in stripped else False:
            in_only_section = True
            in_except_section = False
            current_refs = []
        elif "except:" in stripped:
            in_except_section = True
            in_only_section = False
            current_refs = []
        elif stripped and not stripped.startswith("-") and not stripped.startswith("#"):
            if in_only_section or in_except_section:
                if stripped.endswith(":"):
                    in_only_section = False
                    in_except_section = False
        
        if in_only_section:
            if stripped.startswith("-"):
                ref_name = stripped[1:].strip().strip("'\"")
                if ref_name:
                    is_tag = ref_name.startswith("v") or "tag" in ref_name.lower()
                    current_refs.append(ref_name)
    
    for ref in current_refs:
        is_tag = ref.startswith("v") or "/tags/" in ref
        protected.append(ProtectedBranch(
            name=ref,
            ref=f"refs/tags/{ref}" if is_tag else f"refs/heads/{ref}",
            is_tag=is_tag,
        ))
    
    return protected

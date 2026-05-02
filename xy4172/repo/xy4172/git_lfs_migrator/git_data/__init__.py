"""Git 数据解析模块 - 解析 git rev-list、文件大小清单、.gitattributes 等"""
from .parser import GitDataParser, detect_file_type, is_lfs_pointer
from .rev_list import parse_rev_list_output, get_full_rev_list
from .file_sizes import parse_file_sizes_output, get_file_sizes_from_git
from .gitattributes import parse_gitattributes, validate_gitattributes_pattern
from .protected_refs import parse_protected_refs, detect_protected_branches

__all__ = [
    "GitDataParser",
    "detect_file_type",
    "is_lfs_pointer",
    "parse_rev_list_output",
    "get_full_rev_list",
    "parse_file_sizes_output",
    "get_file_sizes_from_git",
    "parse_gitattributes",
    "validate_gitattributes_pattern",
    "parse_protected_refs",
    "detect_protected_branches",
]

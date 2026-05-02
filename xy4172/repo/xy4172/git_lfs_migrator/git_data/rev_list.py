"""rev-list 输出解析器"""
from pathlib import Path
from typing import List, Optional


def parse_rev_list_output(output: str) -> List[str]:
    """
    解析 git rev-list 命令的输出
    
    Args:
        output: git rev-list 输出的原始字符串
    
    Returns:
        提交哈希列表
    """
    commits = []
    for line in output.split("\n"):
        line = line.strip()
        if line and len(line) == 40:
            commits.append(line)
    return commits


def get_full_rev_list(
    repo_path: Path,
    include_tags: bool = True,
    include_remotes: bool = False,
    since: Optional[str] = None,
    until: Optional[str] = None,
) -> List[str]:
    """
    获取完整的 rev-list（所有提交）
    
    Args:
        repo_path: 仓库路径
        include_tags: 是否包含标签
        include_remotes: 是否包含远程分支
        since: 起始日期 (e.g., "2023-01-01")
        until: 结束日期
    
    Returns:
        提交哈希列表
    """
    from git_lfs_migrator.git_data.parser import GitDataParser
    
    parser = GitDataParser(repo_path)
    args = ["rev-list", "--all"]
    
    if include_tags:
        args.append("--tags")
    if include_remotes:
        args.append("--remotes")
    if since:
        args.extend(["--since", since])
    if until:
        args.extend(["--until", until])
    
    output = parser.run_git_command(args)
    return parse_rev_list_output(output)

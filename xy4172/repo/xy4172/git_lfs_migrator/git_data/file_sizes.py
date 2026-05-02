"""文件大小清单解析器"""
from pathlib import Path
from typing import Dict, List, Optional

from git_lfs_migrator.models import FileType, GitFile, LFSStatus


def parse_file_sizes_output(output: str) -> Dict[str, GitFile]:
    """
    解析文件大小清单输出
    
    格式示例:
    1024    path/to/file1.bin
    20480   path/to/image.png
    
    Args:
        output: 文件大小清单输出
    
    Returns:
        文件路径到 GitFile 的映射
    """
    result: Dict[str, GitFile] = {}
    
    for line in output.split("\n"):
        line = line.strip()
        if not line:
            continue
        
        parts = line.split()
        if len(parts) < 2:
            continue
        
        try:
            size = int(parts[0])
            path = " ".join(parts[1:])
            
            git_file = GitFile(
                path=path,
                size=size,
                hash="",
                blob_hash="",
                commit_hash="",
                file_type=_guess_file_type(path),
                lfs_status=LFSStatus.NOT_IN_LFS,
            )
            result[path] = git_file
        except ValueError:
            continue
    
    return result


def _guess_file_type(path: str) -> FileType:
    """根据扩展名猜测文件类型"""
    binary_extensions = {
        ".bin", ".exe", ".dll", ".so", ".dylib",
        ".png", ".jpg", ".jpeg", ".gif", ".bmp", ".tiff", ".webp",
        ".mp3", ".mp4", ".avi", ".mov", ".mkv", ".wav", ".flac",
        ".zip", ".tar", ".gz", ".bz2", ".7z", ".rar",
        ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
        ".jar", ".war", ".ear",
        ".a", ".lib", ".obj", ".o",
        ".ttf", ".otf", ".woff", ".woff2", ".eot",
        ".ico", ".icns",
        ".class", ".pyc",
    }
    
    lower_path = path.lower()
    for ext in binary_extensions:
        if lower_path.endswith(ext):
            return FileType.BINARY
    
    return FileType.UNKNOWN


def get_file_sizes_from_git(repo_path: Path, commit: str = "HEAD") -> Dict[str, GitFile]:
    """
    从 Git 获取指定提交的文件大小
    
    Args:
        repo_path: 仓库路径
        commit: 提交引用（默认 HEAD）
    
    Returns:
        文件路径到 GitFile 的映射
    """
    from git_lfs_migrator.git_data.parser import GitDataParser
    
    parser = GitDataParser(repo_path)
    return parser.get_file_sizes_in_commit(commit)


def format_human_readable_size(size: int) -> str:
    """
    将字节数格式化为可读格式
    
    Args:
        size: 字节数
    
    Returns:
        格式化的字符串，如 "1.5 MB"
    """
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if size < 1024:
            return f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} PB"

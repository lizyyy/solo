"""Git 数据核心解析器"""
import fnmatch
import os
import re
import subprocess
from pathlib import Path
from typing import Dict, List, Optional

from git_lfs_migrator.models import FileType, GitFile, LFSStatus, ScanResult


LFS_POINTER_PATTERN = re.compile(
    r"^version https://git-lfs\.github\.com/spec/v1\n"
    r"oid sha256:[0-9a-f]{64}\n"
    r"size \d+\n",
    re.MULTILINE,
)


def is_lfs_pointer(content: bytes) -> bool:
    """检测内容是否为 LFS 指针文件"""
    try:
        text = content.decode("utf-8", errors="strict")
        return bool(LFS_POINTER_PATTERN.match(text))
    except (UnicodeDecodeError, UnicodeError):
        return False


def detect_file_type(content: bytes) -> FileType:
    """检测文件类型（文本/二进制）"""
    if b"\x00" in content:
        return FileType.BINARY
    
    try:
        content.decode("utf-8", errors="strict")
        return FileType.TEXT
    except (UnicodeDecodeError, UnicodeError):
        pass
    
    try:
        content.decode("latin-1", errors="strict")
        text_ratio = sum(1 for b in content if 32 <= b <= 126 or b in (9, 10, 13))
        if text_ratio / len(content) > 0.95:
            return FileType.TEXT
    except (UnicodeDecodeError, UnicodeError):
        pass
    
    return FileType.BINARY


class GitDataParser:
    """Git 数据核心解析器"""
    
    def __init__(self, repo_path: Path):
        self.repo_path = repo_path
        self.git_dir = repo_path / ".git"
        self._validate_git_repo()
    
    def _validate_git_repo(self) -> None:
        """验证是否为有效的 Git 仓库"""
        if not self.git_dir.exists():
            raise ValueError(f"Not a valid Git repository: {self.repo_path}")
    
    def run_git_command(self, args: List[str], cwd: Optional[Path] = None) -> str:
        """运行 Git 命令并返回输出"""
        cmd = ["git"] + args
        result = subprocess.run(
            cmd,
            cwd=cwd or self.repo_path,
            capture_output=True,
            text=True,
            check=False,
        )
        if result.returncode != 0:
            raise RuntimeError(f"Git command failed: {result.stderr}")
        return result.stdout.strip()
    
    def get_current_branch(self) -> str:
        """获取当前分支名"""
        return self.run_git_command(["branch", "--show-current"])
    
    def get_all_commits(self) -> List[str]:
        """获取所有提交的哈希列表"""
        output = self.run_git_command(["rev-list", "--all"])
        return [line.strip() for line in output.split("\n") if line.strip()]
    
    def get_file_sizes_in_commit(self, commit_hash: str) -> Dict[str, GitFile]:
        """获取指定提交中的所有文件及其大小"""
        result: Dict[str, GitFile] = {}
        
        try:
            ls_files_output = self.run_git_command(
                ["ls-tree", "-r", "-l", commit_hash]
            )
            
            for line in ls_files_output.split("\n"):
                if not line.strip():
                    continue
                
                parts = line.split()
                if len(parts) < 5:
                    continue
                
                mode = parts[0]
                type_ = parts[1]
                blob_hash = parts[2]
                size_str = parts[3]
                path = " ".join(parts[4:])
                
                if type_ != "blob" or size_str == "-":
                    continue
                
                try:
                    size = int(size_str)
                except ValueError:
                    continue
                
                git_file = GitFile(
                    path=path,
                    size=size,
                    hash=blob_hash,
                    blob_hash=blob_hash,
                    commit_hash=commit_hash,
                    file_type=FileType.UNKNOWN,
                    lfs_status=LFSStatus.NOT_IN_LFS,
                )
                result[path] = git_file
                
        except Exception as e:
            raise RuntimeError(f"Failed to get file sizes for commit {commit_hash}: {e}")
        
        return result
    
    def get_blob_content(self, blob_hash: str) -> bytes:
        """获取 blob 的内容"""
        try:
            result = subprocess.run(
                ["git", "show", blob_hash],
                cwd=self.repo_path,
                capture_output=True,
                check=False,
            )
            return result.stdout
        except Exception as e:
            raise RuntimeError(f"Failed to get blob content: {e}")
    
    def analyze_file(self, git_file: GitFile) -> GitFile:
        """分析文件：检测类型和 LFS 状态"""
        try:
            content = self.get_blob_content(git_file.blob_hash)
            
            git_file.file_type = detect_file_type(content)
            
            if is_lfs_pointer(content):
                git_file.lfs_status = LFSStatus.POINTER_FILE
            else:
                git_file.lfs_status = LFSStatus.NOT_IN_LFS
                
        except Exception:
            pass
        
        return git_file
    
    def get_all_files(self, include_history: bool = True) -> Dict[str, GitFile]:
        """获取所有文件（包括历史）"""
        all_files: Dict[str, GitFile] = {}
        commits = self.get_all_commits() if include_history else [self.get_current_branch()]
        
        for commit in commits:
            commit_files = self.get_file_sizes_in_commit(commit)
            for path, file_info in commit_files.items():
                if path in all_files:
                    existing = all_files[path]
                    existing.path_variants.add(path)
                    if existing.blob_hash != file_info.blob_hash:
                        existing.in_history = True
                else:
                    all_files[path] = self.analyze_file(file_info)
        
        return all_files
    
    def get_submodules(self) -> List[Dict[str, str]]:
        """获取子模块信息"""
        submodules: List[Dict[str, str]] = []
        gitmodules_file = self.repo_path / ".gitmodules"
        
        if not gitmodules_file.exists():
            return submodules
        
        try:
            output = self.run_git_command(["config", "--file", ".gitmodules", "--list"])
            current_submodule: Dict[str, str] = {}
            current_path: Optional[str] = None
            
            for line in output.split("\n"):
                if not line.strip():
                    continue
                
                if "=" in line:
                    key, value = line.split("=", 1)
                    key_parts = key.split(".")
                    
                    if len(key_parts) >= 3 and key_parts[0] == "submodule":
                        submodule_name = key_parts[1]
                        field = key_parts[2]
                        
                        if field == "path":
                            if current_path is not None:
                                submodules.append(current_submodule)
                            current_path = value
                            current_submodule = {"path": value, "name": submodule_name}
                        elif field == "url":
                            current_submodule["url"] = value
                        elif field == "branch":
                            current_submodule["branch"] = value
            
            if current_path is not None:
                submodules.append(current_submodule)
                
        except Exception:
            pass
        
        return submodules
    
    def get_tags(self) -> List[str]:
        """获取所有标签"""
        try:
            output = self.run_git_command(["tag", "-l"])
            return [line.strip() for line in output.split("\n") if line.strip()]
        except Exception:
            return []
    
    def get_branches(self) -> List[str]:
        """获取所有分支"""
        try:
            output = self.run_git_command(["branch", "-a"])
            branches = []
            for line in output.split("\n"):
                line = line.strip()
                if line and not line.startswith("*"):
                    branches.append(line.replace("remotes/origin/", ""))
            return list(set(branches))
        except Exception:
            return []
    
    def full_scan(self, include_history: bool = True) -> ScanResult:
        """执行完整扫描"""
        files = self.get_all_files(include_history=include_history)
        
        total_size = sum(f.size for f in files.values())
        binary_files = sum(1 for f in files.values() if f.file_type == FileType.BINARY)
        large_files = sum(1 for f in files.values() if f.size > 100 * 1024)
        
        return ScanResult(
            git_dir=self.git_dir,
            rev_list=self.get_all_commits(),
            file_sizes=files,
            total_files=len(files),
            total_size=total_size,
            binary_files=binary_files,
            large_files=large_files,
        )

import os
import re
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Dict, Optional, Set


@dataclass
class LFSFile:
    oid: str
    size: int
    path: str
    commit_hash: str
    commit_author: str
    commit_date: str
    commit_message: str


@dataclass
class ScanResult:
    lfs_files: List[LFSFile] = field(default_factory=list)
    total_size: int = 0
    unique_oids: Set[str] = field(default_factory=set)
    errors: List[str] = field(default_factory=list)


class GitScanner:
    LFS_POINTER_PATTERN = re.compile(
        r"^version https://git-lfs\.github\.com/spec/v1\n"
        r"oid sha256:([0-9a-f]{64})\n"
        r"size (\d+)\n",
        re.MULTILINE
    )

    def __init__(self, repo_path: str):
        self.repo_path = Path(repo_path).resolve()
        if not (self.repo_path / ".git").exists():
            raise ValueError(f"不是有效的Git仓库: {repo_path}")

    def _run_git_command(self, args: List[str], cwd: Optional[Path] = None) -> str:
        try:
            result = subprocess.run(
                ["git"] + args,
                cwd=str(cwd or self.repo_path),
                capture_output=True,
                text=True,
                check=True
            )
            return result.stdout
        except subprocess.CalledProcessError as e:
            raise RuntimeError(f"Git命令执行失败: {e.stderr}")

    def is_lfs_pointer(self, content: str) -> Optional[tuple]:
        match = self.LFS_POINTER_PATTERN.match(content)
        if match:
            return match.group(1), int(match.group(2))
        return None

    def get_all_commits(self, since: Optional[str] = None, until: Optional[str] = None) -> List[str]:
        args = ["rev-list", "--all"]
        if since:
            args.extend(["--since", since])
        if until:
            args.extend(["--until", until])
        
        output = self._run_git_command(args)
        return [line for line in output.strip().split("\n") if line]

    def get_commit_info(self, commit_hash: str) -> Dict:
        output = self._run_git_command([
            "show", "-s",
            "--format=%an|%ae|%ad|%s",
            commit_hash
        ])
        parts = output.strip().split("|", 3)
        return {
            "author": parts[0] if len(parts) > 0 else "",
            "email": parts[1] if len(parts) > 1 else "",
            "date": parts[2] if len(parts) > 2 else "",
            "message": parts[3] if len(parts) > 3 else ""
        }

    def get_tree_files(self, tree_hash: str) -> List[tuple]:
        output = self._run_git_command(["ls-tree", "-r", tree_hash])
        files = []
        for line in output.strip().split("\n"):
            if line:
                parts = line.split()
                if len(parts) >= 4:
                    blob_hash = parts[2]
                    path = " ".join(parts[3:])
                    files.append((blob_hash, path))
        return files

    def get_blob_content(self, blob_hash: str) -> str:
        try:
            return self._run_git_command(["cat-file", "-p", blob_hash])
        except RuntimeError:
            return ""

    def scan_history(self, since: Optional[str] = None, until: Optional[str] = None,
                     path_filter: Optional[str] = None) -> ScanResult:
        result = ScanResult()
        
        try:
            commits = self.get_all_commits(since, until)
        except RuntimeError as e:
            result.errors.append(f"获取提交列表失败: {e}")
            return result

        for commit_hash in commits:
            try:
                commit_info = self.get_commit_info(commit_hash)
                tree_hash = self._run_git_command(["show", "-s", "--format=%T", commit_hash]).strip()
                files = self.get_tree_files(tree_hash)

                for blob_hash, file_path in files:
                    if path_filter and path_filter not in file_path:
                        continue

                    content = self.get_blob_content(blob_hash)
                    lfs_info = self.is_lfs_pointer(content)
                    
                    if lfs_info:
                        oid, size = lfs_info
                        lfs_file = LFSFile(
                            oid=oid,
                            size=size,
                            path=file_path,
                            commit_hash=commit_hash,
                            commit_author=commit_info["author"],
                            commit_date=commit_info["date"],
                            commit_message=commit_info["message"]
                        )
                        result.lfs_files.append(lfs_file)
                        result.total_size += size
                        result.unique_oids.add(oid)

            except Exception as e:
                result.errors.append(f"处理提交 {commit_hash[:8]} 时出错: {str(e)}")
                continue

        return result

    def scan_current(self, path_filter: Optional[str] = None) -> ScanResult:
        result = ScanResult()
        
        try:
            output = self._run_git_command(["ls-files", "-s"])
            for line in output.strip().split("\n"):
                if not line:
                    continue
                parts = line.split()
                if len(parts) < 4:
                    continue
                blob_hash = parts[1]
                file_path = " ".join(parts[3:])
                
                if path_filter and path_filter not in file_path:
                    continue

                content = self.get_blob_content(blob_hash)
                lfs_info = self.is_lfs_pointer(content)
                
                if lfs_info:
                    oid, size = lfs_info
                    lfs_file = LFSFile(
                        oid=oid,
                        size=size,
                        path=file_path,
                        commit_hash="WORKING",
                        commit_author="",
                        commit_date="",
                        commit_message="工作区文件"
                    )
                    result.lfs_files.append(lfs_file)
                    result.total_size += size
                    result.unique_oids.add(oid)

        except Exception as e:
            result.errors.append(f"扫描工作区失败: {str(e)}")

        return result

import subprocess
import re
from pathlib import Path
from typing import List, Optional, Tuple, Dict
from .models import SubmoduleInfo, SubmoduleStatus, GitCommit


class GitCommandError(Exception):
    pass


class GitReader:
    def __init__(self, repo_root: Path):
        self.repo_root = repo_root.resolve()
        self._git_env = {"GIT_OPTIONAL_LOCKS": "0"}

    def _run_git(self, args: List[str], cwd: Optional[Path] = None) -> str:
        cmd = ["git"] + args
        try:
            result = subprocess.run(
                cmd,
                cwd=str(cwd or self.repo_root),
                capture_output=True,
                text=True,
                check=False,
                env=self._git_env,
            )
            if result.returncode != 0:
                raise GitCommandError(
                    f"Git command failed: {' '.join(cmd)}\nstdout: {result.stdout}\nstderr: {result.stderr}"
                )
            return result.stdout.strip()
        except FileNotFoundError:
            raise GitCommandError("Git executable not found in PATH")

    def is_git_repo(self) -> bool:
        try:
            self._run_git(["rev-parse", "--is-inside-work-tree"])
            return True
        except GitCommandError:
            return False

    def get_root_path(self) -> Path:
        return Path(self._run_git(["rev-parse", "--show-toplevel"])).resolve()

    def get_current_branch(self, cwd: Optional[Path] = None) -> Optional[str]:
        try:
            branch = self._run_git(["rev-parse", "--abbrev-ref", "HEAD"], cwd=cwd)
            return branch if branch != "HEAD" else None
        except GitCommandError:
            return None

    def get_head_commit(self, cwd: Optional[Path] = None) -> Optional[str]:
        try:
            return self._run_git(["rev-parse", "HEAD"], cwd=cwd)
        except GitCommandError:
            return None

    def get_commit_info(self, commit_hash: str, cwd: Optional[Path] = None) -> Optional[GitCommit]:
        if not commit_hash:
            return None
        try:
            output = self._run_git(
                [
                    "show",
                    "-s",
                    "--format=%H%n%h%n%s%n%an%n%ai",
                    commit_hash,
                ],
                cwd=cwd,
            )
            lines = output.split("\n")
            if len(lines) >= 5:
                return GitCommit(
                    hash=lines[0],
                    short_hash=lines[1],
                    message=lines[2],
                    author=lines[3],
                    date=lines[4],
                )
        except GitCommandError:
            pass
        return None

    def is_detached_head(self, cwd: Optional[Path] = None) -> bool:
        try:
            return self._run_git(["rev-parse", "--abbrev-ref", "HEAD"], cwd=cwd) == "HEAD"
        except GitCommandError:
            return True

    def has_local_changes(self, cwd: Optional[Path] = None) -> bool:
        try:
            self._run_git(["diff", "--quiet", "HEAD"], cwd=cwd)
            return False
        except GitCommandError:
            return True

    def count_commits_between(self, old: str, new: str, cwd: Optional[Path] = None) -> int:
        if not old or not new:
            return 0
        try:
            output = self._run_git(
                ["rev-list", "--count", f"{old}..{new}"],
                cwd=cwd,
            )
            return int(output) if output.isdigit() else 0
        except (GitCommandError, ValueError):
            return 0

    def parse_gitmodules(self) -> List[Dict]:
        gitmodules = self.repo_root / ".gitmodules"
        if not gitmodules.exists():
            return []

        entries = []
        content = gitmodules.read_text()
        pattern = r'\[submodule\s+"([^"]+)"\]\s+path\s*=\s*([^\n]+)\s+url\s*=\s*([^\n]+)(?:\s+branch\s*=\s*([^\n]+))?'
        matches = re.findall(pattern, content, re.MULTILINE)

        for name, path, url, branch in matches:
            entries.append(
                {
                    "name": name.strip(),
                    "path": path.strip(),
                    "url": url.strip(),
                    "branch": branch.strip() if branch else None,
                }
            )
        return entries

    def get_submodule_status(self) -> List[Tuple[str, str, str]]:
        try:
            output = self._run_git(["submodule", "status", "--recursive"])
            results = []
            for line in output.split("\n"):
                if not line.strip():
                    continue
                match = re.match(r'^([ -+U])([0-9a-fA-F]+)\s+(\S+)', line)
                if match:
                    status_char, commit, path = match.groups()
                    results.append((status_char, commit, path))
        except GitCommandError:
            return []
        return results

    def is_submodule_initialized(self, path: str) -> bool:
        submodule_path = self.repo_root / path
        git_dir = submodule_path / ".git"
        return git_dir.exists()

    def read_submodules(self, recursive: bool = True) -> List[SubmoduleInfo]:
        submodules: List[SubmoduleInfo] = []
        gitmodules_entries = self.parse_gitmodules()
        status_map = {
            path: (status_char, commit)
            for status_char, commit, path in self.get_submodule_status()
        }

        for entry in gitmodules_entries:
            path = entry["path"]
            name = entry["name"]
            status_char, current_commit = status_map.get(path, ("-", None))

            submodule = SubmoduleInfo(
                path=path,
                name=name,
                url=entry["url"],
                branch=entry["branch"],
            )

            if status_char == "-":
                submodule.status = SubmoduleStatus.UNINITIALIZED
            else:
                submodule.current_commit = current_commit
                submodule_path = self.repo_root / path

                if submodule_path.exists() and self.is_submodule_initialized(path):
                    submodule.current_commit_info = self.get_commit_info(
                        current_commit, cwd=submodule_path
                    )
                    submodule.is_detached = self.is_detached_head(cwd=submodule_path)
                    submodule.has_local_changes = self.has_local_changes(cwd=submodule_path)

                    if submodule.has_local_changes:
                        submodule.status = SubmoduleStatus.DIRTY
                    elif submodule.is_detached:
                        submodule.status = SubmoduleStatus.DETACHED
                    else:
                        submodule.status = SubmoduleStatus.CLEAN

                    if recursive:
                        nested_reader = GitReader(submodule_path)
                        if nested_reader.is_git_repo():
                            nested = nested_reader.read_submodules(recursive=True)
                            for n in nested:
                                n.is_nested = True
                                n.parent_path = path
                                n.path = f"{path}/{n.path}"
                                n.name = f"{name}/{n.name}"
                            submodules.extend(nested)
                else:
                    submodule.status = SubmoduleStatus.MISSING

            submodules.append(submodule)

        return submodules

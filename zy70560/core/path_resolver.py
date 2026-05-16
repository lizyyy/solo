import sys
import os
from pathlib import Path
from typing import List, Optional, Dict, Any


class PathResolver:
    def __init__(self):
        self.project_root: Optional[Path] = None
        self.custom_sys_path: List[Path] = []
        self._errors: List[Dict[str, Any]] = []
    
    def set_project_root(self, path: Path) -> None:
        if not path.exists():
            self._add_error(str(path), "项目路径不存在")
            raise FileNotFoundError(f"项目路径不存在: {path}")
        self.project_root = path.resolve()
    
    def set_custom_sys_path(self, paths: List[str]) -> None:
        self.custom_sys_path = []
        for p in paths:
            try:
                resolved = Path(p).resolve()
                if resolved.exists():
                    self.custom_sys_path.append(resolved)
                else:
                    self._add_error(p, "自定义路径不存在")
            except Exception as e:
                self._add_error(p, f"路径解析错误: {str(e)}")
    
    def get_effective_paths(self) -> List[Path]:
        if self.custom_sys_path:
            return self.custom_sys_path
        paths = []
        if self.project_root:
            paths.append(self.project_root)
        for p in sys.path:
            if not p:
                p = "."
            try:
                path = Path(p).resolve()
                if path.exists() and path not in paths:
                    paths.append(path)
            except Exception:
                pass
        return paths
    
    def _add_error(self, raw_input: str, reason: str) -> None:
        self._errors.append({
            "raw_input": raw_input,
            "reason": reason,
            "position": len(self._errors)
        })
    
    def get_errors(self) -> List[Dict[str, Any]]:
        return self._errors

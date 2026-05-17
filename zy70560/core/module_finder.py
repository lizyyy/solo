import os
import sys
from pathlib import Path
from typing import List, Dict, Any, Optional


class ModuleCandidate:
    def __init__(self, name: str, path: Path, module_type: str, priority: int = 0):
        self.name = name
        self.path = path
        self.module_type = module_type
        self.priority = priority
        self.is_builtin = False
        self.is_stdlib = False
        self.errors: List[str] = []
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "path": str(self.path),
            "module_type": self.module_type,
            "priority": self.priority,
            "is_builtin": self.is_builtin,
            "is_stdlib": self.is_stdlib,
            "errors": self.errors,
            "exists": self.path.exists()
        }


class ModuleFinder:
    def __init__(self):
        self._errors: List[Dict[str, Any]] = []
        self.stdlib_path = Path(os.__file__).parent
    
    def find_modules(self, module_name: str, project_root: Path,
                     search_paths: List[Path]) -> List[ModuleCandidate]:
        candidates = []
        seen_paths = set()
        
        for priority, search_path in enumerate(search_paths):
            try:
                found = self._find_in_path(module_name, search_path, priority)
                for candidate in found:
                    path_key = str(candidate.path.resolve())
                    if path_key not in seen_paths:
                        seen_paths.add(path_key)
                        self._check_syntax_and_errors(candidate)
                        self._check_stdlib_or_builtin(candidate)
                        candidates.append(candidate)
            except Exception as e:
                self._add_error(str(search_path), f"搜索路径出错: {str(e)}",
                              search_path, priority)
        
        builtin = self._check_builtin_module(module_name, len(candidates))
        if builtin:
            candidates.append(builtin)
        
        return sorted(candidates, key=lambda x: (x.priority, not x.is_stdlib, x.path))
    
    def _find_in_path(self, module_name: str, search_path: Path,
                      priority: int) -> List[ModuleCandidate]:
        candidates = []
        parts = module_name.split(".")
        
        current_path = search_path
        for i, part in enumerate(parts[:-1]):
            pkg_init = current_path / part / "__init__.py"
            pkg_dir = current_path / part
            if pkg_init.exists():
                current_path = pkg_dir
            elif pkg_dir.exists() and pkg_dir.is_dir():
                current_path = pkg_dir
            else:
                return candidates
        
        final_part = parts[-1]
        
        module_file = current_path / f"{final_part}.py"
        if module_file.exists():
            candidates.append(ModuleCandidate(
                module_name, module_file, "file", priority
            ))
        
        package_dir = current_path / final_part
        package_init = package_dir / "__init__.py"
        if package_init.exists():
            candidates.append(ModuleCandidate(
                module_name, package_init, "package", priority
            ))
        
        return candidates
    
    def _check_stdlib_or_builtin(self, candidate: ModuleCandidate) -> None:
        try:
            path_str = str(candidate.path.resolve())
            stdlib_str = str(self.stdlib_path)
            if path_str.startswith(stdlib_str) and "site-packages" not in path_str:
                candidate.is_stdlib = True
        except Exception:
            pass
    
    def _check_builtin_module(self, module_name: str, priority: int) -> Optional[ModuleCandidate]:
        if module_name in sys.builtin_module_names:
            candidate = ModuleCandidate(
                module_name, Path("<builtin>"), "builtin", priority
            )
            candidate.is_builtin = True
            return candidate
        return None
    
    def find_from_file(self, module_name: str, file_path: Path,
                        search_paths: List[Path]) -> List[ModuleCandidate]:
        candidates = []
        seen_paths = set()
        
        if file_path.name == f"{module_name}.py":
            candidate = ModuleCandidate(
                module_name, file_path, "file", 0
            )
            self._check_syntax_and_errors(candidate)
            self._check_stdlib_or_builtin(candidate)
            candidates.append(candidate)
            seen_paths.add(str(file_path.resolve()))
        
        for priority, search_path in enumerate(search_paths):
            try:
                found = self._find_in_path(module_name, search_path, priority)
                for candidate in found:
                    path_key = str(candidate.path.resolve())
                    if path_key not in seen_paths:
                        seen_paths.add(path_key)
                        self._check_syntax_and_errors(candidate)
                        self._check_stdlib_or_builtin(candidate)
                        candidates.append(candidate)
            except Exception as e:
                self._add_error(str(search_path), f"搜索路径出错: {str(e)}",
                              search_path, priority)
        
        builtin = self._check_builtin_module(module_name, len(candidates))
        if builtin:
            candidates.append(builtin)
        
        return sorted(candidates, key=lambda x: (x.priority, not x.is_stdlib, x.path))
    
    def _check_syntax_and_errors(self, candidate: ModuleCandidate) -> None:
        if candidate.path.suffix == '.py' and candidate.path.exists():
            try:
                import ast
                with open(candidate.path, 'r', encoding='utf-8') as f:
                    source = f.read()
                ast.parse(source, filename=str(candidate.path))
            except SyntaxError as e:
                candidate.errors.append(f"语法错误: 第 {e.lineno} 行, {e.msg}")
            except Exception as e:
                candidate.errors.append(f"解析错误: {str(e)}")
    
    def _add_error(self, raw_input: str, reason: str,
                   location: Path, position: int) -> None:
        self._errors.append({
            "raw_input": raw_input,
            "reason": reason,
            "location": str(location),
            "position": position
        })
    
    def get_errors(self) -> List[Dict[str, Any]]:
        return self._errors

import fnmatch
import os
from pathlib import Path
from typing import List, Optional, Set, Tuple

from .config import SyncConfig
from .models import FileInfo, FileType, Manifest, SourceSide, compute_sha256


class IgnoreMatcher:
    def __init__(self, patterns: List[str]):
        self.patterns = patterns
        self._compiled_patterns = self._compile_patterns()
    
    def _compile_patterns(self) -> List[Tuple[str, bool]]:
        compiled = []
        for pattern in self.patterns:
            is_dir_only = pattern.endswith('/') or pattern.endswith('\\')
            clean_pattern = pattern.rstrip('/\\')
            compiled.append((clean_pattern, is_dir_only))
        return compiled
    
    def matches(self, relative_path: str, is_dir: bool = False) -> bool:
        normalized_path = relative_path.replace('\\', '/')
        path_parts = normalized_path.split('/')
        
        for pattern, is_dir_only in self._compiled_patterns:
            if is_dir_only and not is_dir:
                continue
            
            if fnmatch.fnmatch(normalized_path, pattern):
                return True
            
            for part in path_parts:
                if fnmatch.fnmatch(part, pattern):
                    return True
            
            if pattern.startswith('*.') and normalized_path.endswith(pattern[1:]):
                return True
        
        return False


class FileScanner:
    def __init__(self, config: SyncConfig):
        self.config = config
        self.ignore_matcher = IgnoreMatcher(config.ignore_patterns)
    
    def _is_ignored(self, relative_path: str, is_dir: bool = False) -> bool:
        return self.ignore_matcher.matches(relative_path, is_dir)
    
    def _is_extension_allowed(self, file_path: str) -> bool:
        if not self.config.allowed_extensions:
            return True
        ext = Path(file_path).suffix.lower().lstrip('.')
        return self.config.is_extension_allowed(ext)
    
    def _check_symlink_escapes_root(self, symlink_path: str, root_dir: str) -> Tuple[bool, Optional[str]]:
        try:
            if not os.path.islink(symlink_path):
                return False, None
            
            target = os.readlink(symlink_path)
            
            if os.path.isabs(target):
                resolved_target = target
            else:
                symlink_dir = os.path.dirname(symlink_path)
                resolved_target = os.path.abspath(os.path.join(symlink_dir, target))
            
            root_abs = os.path.abspath(root_dir)
            if not resolved_target.startswith(root_abs.rstrip(os.sep) + os.sep):
                if resolved_target != root_abs:
                    return True, resolved_target
            
            return False, resolved_target
        except (OSError, ValueError):
            return False, None
    
    def _create_file_info(
        self,
        relative_path: str,
        absolute_path: str,
        source_side: SourceSide,
        root_dir: str,
    ) -> Optional[FileInfo]:
        try:
            is_symlink = os.path.islink(absolute_path)
            
            if is_symlink:
                escapes, target = self._check_symlink_escapes_root(absolute_path, root_dir)
                if escapes:
                    return FileInfo(
                        relative_path=relative_path,
                        absolute_path=absolute_path,
                        size=0,
                        mtime=0.0,
                        sha256="",
                        file_type=FileType.SYMLINK,
                        source_side=source_side,
                        is_symlink=True,
                        symlink_target=target,
                    )
            
            if os.path.isdir(absolute_path):
                return None
            
            stat = os.stat(absolute_path)
            size = stat.st_size
            mtime = stat.st_mtime
            
            sha256 = compute_sha256(absolute_path)
            
            return FileInfo(
                relative_path=relative_path,
                absolute_path=absolute_path,
                size=size,
                mtime=mtime,
                sha256=sha256,
                file_type=FileType.FILE,
                source_side=source_side,
                is_symlink=is_symlink,
                symlink_target=os.readlink(absolute_path) if is_symlink else None,
            )
        except (OSError, PermissionError, IOError):
            return None
    
    def scan_directory(
        self,
        root_dir: str,
        source_side: SourceSide,
        follow_symlinks: bool = False,
    ) -> Manifest:
        root_path = Path(root_dir).resolve()
        manifest = Manifest(
            source_side=source_side,
            root_dir=str(root_path),
        )
        
        for dirpath, dirnames, filenames in os.walk(root_path, followlinks=follow_symlinks):
            dirpath_path = Path(dirpath)
            
            for dirname in list(dirnames):
                full_path = dirpath_path / dirname
                rel_path = str(full_path.relative_to(root_path))
                
                if self._is_ignored(rel_path, is_dir=True):
                    dirnames.remove(dirname)
                    continue
                
                if full_path.is_symlink():
                    escapes, _ = self._check_symlink_escapes_root(str(full_path), str(root_path))
                    if escapes:
                        file_info = FileInfo(
                            relative_path=rel_path,
                            absolute_path=str(full_path),
                            size=0,
                            mtime=0.0,
                            sha256="",
                            file_type=FileType.SYMLINK,
                            source_side=source_side,
                            is_symlink=True,
                            symlink_target=os.readlink(str(full_path)),
                        )
                        manifest.add_file(file_info)
            
            for filename in filenames:
                full_path = dirpath_path / filename
                rel_path = str(full_path.relative_to(root_path))
                
                if self._is_ignored(rel_path, is_dir=False):
                    continue
                
                if not self._is_extension_allowed(str(full_path)):
                    continue
                
                file_info = self._create_file_info(
                    relative_path=rel_path,
                    absolute_path=str(full_path),
                    source_side=source_side,
                    root_dir=str(root_path),
                )
                
                if file_info:
                    manifest.add_file(file_info)
        
        return manifest
    
    def scan_left(self) -> Manifest:
        return self.scan_directory(self.config.left_dir, SourceSide.LEFT)
    
    def scan_right(self) -> Manifest:
        return self.scan_directory(self.config.right_dir, SourceSide.RIGHT)
    
    def scan_both(self) -> Tuple[Manifest, Manifest]:
        left_manifest = self.scan_left()
        right_manifest = self.scan_right()
        return left_manifest, right_manifest

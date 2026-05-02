import shutil
from pathlib import Path
from typing import Optional


class ImportStore:
    
    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self.imports_dir = data_dir / "imports"
        self.imports_dir.mkdir(parents=True, exist_ok=True)
    
    def store_imported_file(self, source_path: Path, task_name: Optional[str] = None) -> Path:
        if task_name:
            dest_dir = self.imports_dir / task_name
            dest_dir.mkdir(parents=True, exist_ok=True)
            dest_path = dest_dir / source_path.name
        else:
            dest_path = self.imports_dir / source_path.name
        
        if dest_path.exists():
            dest_path = self._get_unique_path(dest_path)
        
        shutil.copy2(source_path, dest_path)
        return dest_path
    
    def _get_unique_path(self, path: Path) -> Path:
        counter = 1
        while True:
            new_path = path.parent / f"{path.stem}_{counter}{path.suffix}"
            if not new_path.exists():
                return new_path
            counter += 1
    
    def get_stored_files(self, task_name: Optional[str] = None) -> list:
        if task_name:
            target_dir = self.imports_dir / task_name
        else:
            target_dir = self.imports_dir
        
        if not target_dir.exists():
            return []
        
        files = []
        for item in target_dir.iterdir():
            if item.is_file():
                files.append(item)
        
        return sorted(files, key=lambda f: f.stat().st_mtime, reverse=True)

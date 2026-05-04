import os
import hashlib
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Callable
from concurrent.futures import ThreadPoolExecutor, as_completed

IMAGE_EXTENSIONS = {
    '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.tif',
    '.webp', '.raw', '.nef', '.cr2', '.arw', '.dng', '.orf',
    '.rw2', '.pef', '.sr2', '.heic', '.heif', '.avif',
}


def get_file_hash(file_path: str, hash_type: str = 'md5', 
                  chunk_size: int = 8192) -> str:
    if hash_type == 'md5':
        hasher = hashlib.md5()
    elif hash_type == 'sha256':
        hasher = hashlib.sha256()
    else:
        raise ValueError(f"Unsupported hash type: {hash_type}")
    
    with open(file_path, 'rb') as f:
        while chunk := f.read(chunk_size):
            hasher.update(chunk)
    
    return hasher.hexdigest()


class FileScanner:
    def __init__(self, extensions: List[str] = None, 
                 compute_hash: bool = True,
                 hash_type: str = 'md5',
                 progress_callback: Optional[Callable[[int, int], None]] = None):
        if extensions is None:
            self.extensions = IMAGE_EXTENSIONS
        else:
            self.extensions = {ext.lower() for ext in extensions}
        
        self.compute_hash = compute_hash
        self.hash_type = hash_type
        self.progress_callback = progress_callback

    def scan_directory(self, directory: str) -> List[Dict[str, Any]]:
        directory = os.path.abspath(directory)
        if not os.path.isdir(directory):
            raise NotADirectoryError(f"Directory not found: {directory}")
        
        files = []
        for root, _, filenames in os.walk(directory):
            for filename in filenames:
                file_path = os.path.join(root, filename)
                if self._should_include(filename):
                    files.append(file_path)
        
        files.sort()
        return self._process_files(files, directory)

    def _should_include(self, filename: str) -> bool:
        if not self.extensions:
            return True
        ext = os.path.splitext(filename)[1].lower()
        return ext in self.extensions

    def _process_files(self, file_paths: List[str], base_dir: str) -> List[Dict[str, Any]]:
        total = len(file_paths)
        processed = 0
        results = []
        
        for file_path in file_paths:
            try:
                file_info = self._get_file_info(file_path, base_dir)
                results.append(file_info)
            except (OSError, PermissionError) as e:
                continue
            
            processed += 1
            if self.progress_callback:
                self.progress_callback(processed, total)
        
        return results

    def _get_file_info(self, file_path: str, base_dir: str) -> Dict[str, Any]:
        stat = os.stat(file_path)
        relative_path = os.path.relpath(file_path, base_dir)
        
        info = {
            'path': file_path,
            'relative_path': relative_path,
            'filename': os.path.basename(file_path),
            'size': stat.st_size,
            'modified_at': datetime.fromtimestamp(stat.st_mtime),
        }
        
        if self.compute_hash:
            try:
                info[f'hash_{self.hash_type}'] = get_file_hash(file_path, self.hash_type)
            except (OSError, PermissionError):
                info[f'hash_{self.hash_type}'] = None
        
        return info


class ParallelFileScanner(FileScanner):
    def __init__(self, max_workers: int = 4, **kwargs):
        super().__init__(**kwargs)
        self.max_workers = max_workers

    def _process_files(self, file_paths: List[str], base_dir: str) -> List[Dict[str, Any]]:
        total = len(file_paths)
        processed = 0
        results = []
        
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            futures = {
                executor.submit(self._get_file_info_safe, fp, base_dir): fp 
                for fp in file_paths
            }
            
            for future in as_completed(futures):
                result = future.result()
                if result:
                    results.append(result)
                
                processed += 1
                if self.progress_callback:
                    self.progress_callback(processed, total)
        
        return results

    def _get_file_info_safe(self, file_path: str, base_dir: str) -> Optional[Dict[str, Any]]:
        try:
            return self._get_file_info(file_path, base_dir)
        except (OSError, PermissionError):
            return None

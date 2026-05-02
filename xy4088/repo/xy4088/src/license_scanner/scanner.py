import hashlib
import os
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Set, Dict

from .models import Asset, AssetType


IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.tiff', '.tif', '.ico', '.heic', '.raw'}
FONT_EXTENSIONS = {'.ttf', '.otf', '.woff', '.woff2', '.eot', '.fon', '.pfb'}
AUDIO_EXTENSIONS = {'.mp3', '.wav', '.ogg', '.flac', '.aac', '.wma', '.m4a', '.aiff', '.au'}
VIDEO_EXTENSIONS = {'.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv', '.wmv', '.m4v'}
DOCUMENT_EXTENSIONS = {'.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.rtf', '.odt', '.ods', '.odp'}


def get_asset_type(extension: str) -> AssetType:
    ext_lower = extension.lower()
    if ext_lower in IMAGE_EXTENSIONS:
        return AssetType.IMAGE
    elif ext_lower in FONT_EXTENSIONS:
        return AssetType.FONT
    elif ext_lower in AUDIO_EXTENSIONS:
        return AssetType.AUDIO
    elif ext_lower in VIDEO_EXTENSIONS:
        return AssetType.VIDEO
    elif ext_lower in DOCUMENT_EXTENSIONS:
        return AssetType.DOCUMENT
    else:
        return AssetType.OTHER


def compute_file_hash(file_path: str, chunk_size: int = 8192) -> str:
    sha256 = hashlib.sha256()
    with open(file_path, 'rb') as f:
        while chunk := f.read(chunk_size):
            sha256.update(chunk)
    return sha256.hexdigest()


class DirectoryScanner:
    def __init__(self, 
                 exclude_patterns: Optional[List[str]] = None,
                 include_extensions: Optional[List[str]] = None,
                 exclude_extensions: Optional[List[str]] = None):
        self.exclude_patterns = exclude_patterns or [
            'node_modules', '.git', '__pycache__', '.DS_Store',
            'Thumbs.db', '.idea', '.vscode', 'venv', '.venv', 'env'
        ]
        self.include_extensions = include_extensions
        self.exclude_extensions = exclude_extensions or ['.pyc', '.pyo', '.pyd', '.exe', '.dll', '.so', '.dylib']

    def _should_skip(self, path: Path, root_path: Path) -> bool:
        rel_path = path.relative_to(root_path)
        
        for pattern in self.exclude_patterns:
            if pattern in rel_path.parts:
                return True
            if str(rel_path).startswith(pattern):
                return True
        
        if path.is_file():
            ext = path.suffix.lower()
            if self.exclude_extensions and ext in self.exclude_extensions:
                return True
            if self.include_extensions and ext not in [e.lower() for e in self.include_extensions]:
                return True
        
        return False

    def scan_directory(self, directory_path: str) -> List[Asset]:
        root_path = Path(directory_path).resolve()
        
        if not root_path.exists():
            raise ValueError(f"Directory not found: {directory_path}")
        
        if not root_path.is_dir():
            raise ValueError(f"Not a directory: {directory_path}")
        
        assets: List[Asset] = []
        
        for root, dirs, files in os.walk(root_path):
            dirs[:] = [d for d in dirs if not self._should_skip(Path(root) / d, root_path)]
            
            for file_name in files:
                file_path = Path(root) / file_name
                
                if self._should_skip(file_path, root_path):
                    continue
                
                try:
                    asset = self._create_asset(file_path)
                    assets.append(asset)
                except (PermissionError, OSError):
                    continue
        
        return assets

    def _create_asset(self, file_path: Path) -> Asset:
        stat = file_path.stat()
        extension = file_path.suffix.lower()
        asset_type = get_asset_type(extension)
        
        file_hash = compute_file_hash(str(file_path))
        
        modified_time = datetime.fromtimestamp(stat.st_mtime)
        created_time = None
        try:
            created_time = datetime.fromtimestamp(stat.st_birthtime)
        except (AttributeError, OSError):
            pass
        
        return Asset(
            file_path=str(file_path),
            file_name=file_path.name,
            file_size=stat.st_size,
            file_hash=file_hash,
            asset_type=asset_type,
            extension=extension,
            modified_time=modified_time,
            created_time=created_time,
            metadata={
                'owner': getattr(stat, 'st_uid', None),
                'permissions': oct(stat.st_mode)[-3:] if hasattr(stat, 'st_mode') else None
            }
        )


def scan_project(directory: str, 
                 exclude_patterns: Optional[List[str]] = None) -> List[Asset]:
    scanner = DirectoryScanner(exclude_patterns=exclude_patterns)
    return scanner.scan_directory(directory)

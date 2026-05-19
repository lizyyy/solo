import os
import hashlib
from pathlib import Path
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field

MAGIC_BYTES = {
    b'\xca\xfe\xba\xbe': 'Mach-O Fat Binary (32-bit)',
    b'\xfe\xed\xfa\xce': 'Mach-O 32-bit',
    b'\xfe\xed\xfa\xcf': 'Mach-O 64-bit',
    b'\xcf\xfa\xed\xfe': 'Mach-O 64-bit (ARM64)',
    b'\xce\xfa\xed\xfe': 'Mach-O 32-bit (ARM)',
    b'\x7fELF': 'ELF Executable',
    b'MZ': 'PE/COFF Executable (Windows)',
    b'\x4d\x5a': 'PE/COFF Executable (Windows)',
    b'\xed\xab\xee\xdb': 'iOS/macOS Fat File',
    b'\x00\x00\x01\x00': 'Windows ICO',
    b'\x89PNG\r\n\x1a\n': 'PNG Image',
    b'\xff\xd8\xff': 'JPEG Image',
    b'GIF87a': 'GIF Image',
    b'GIF89a': 'GIF Image',
    b'PK\x03\x04': 'ZIP Archive',
    b'PK\x05\x06': 'ZIP Archive (Empty)',
    b'PK\x07\x08': 'ZIP Archive (Spanned)',
    b'Rar!\x1a\x07\x00': 'RAR Archive',
    b'Rar!\x1a\x07\x01\x00': 'RAR Archive (v5)',
    b'\x1f\x8b': 'GZIP Compressed',
    b'BZh': 'BZIP2 Compressed',
    b'\xfd7zXZ\x00': 'XZ Compressed',
    b'OggS': 'OGG Media',
    b'fLaC': 'FLAC Audio',
    b'ID3': 'MP3 Audio',
    b'\x1aE\xdf\xa3': 'MKV/WebM Media',
    b'\x00\x00\x00 ftyp': 'MP4/MOV Media',
    b'\x00\x00\x00\x18ftyp': 'MP4 Media',
    b'RIFF': 'RIFF/WAV/AVI',
    b'\x25PDF': 'PDF Document',
    b'\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1': 'Microsoft Office (OLE)',
    b'PK\x03\x04': 'Microsoft Office (OpenXML)',
    b'\x00\x61\x73\x6d': 'WebAssembly Binary',
    b':%\x16s': 'Java Class File',
    b'\x4a\x56\x41\x20': 'Java KeyStore',
    b'\xca\xfe\x00\x00': 'Java Pack200',
}

@dataclass
class FileInfo:
    file_path: str
    file_name: str
    file_size: int
    magic_bytes: str = ""
    file_type: str = "Unknown"
    sha256: str = ""
    md5: str = ""
    signature_info: Dict[str, Any] = field(default_factory=dict)
    risk_level: str = "unknown"
    risk_reasons: List[str] = field(default_factory=list)
    parse_errors: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "file_path": self.file_path,
            "file_name": self.file_name,
            "file_size": self.file_size,
            "magic_bytes": self.magic_bytes,
            "file_type": self.file_type,
            "sha256": self.sha256,
            "md5": self.md5,
            "signature_info": self.signature_info,
            "risk_level": self.risk_level,
            "risk_reasons": self.risk_reasons,
            "parse_errors": self.parse_errors
        }

class FileParser:
    def __init__(self, max_file_size: int = 100 * 1024 * 1024):
        self.max_file_size = max_file_size

    def parse_file(self, file_path: str) -> Optional[FileInfo]:
        path = Path(file_path)
        if not path.exists() or not path.is_file():
            return None

        try:
            file_size = path.stat().st_size
            file_info = FileInfo(
                file_path=str(path.resolve()),
                file_name=path.name,
                file_size=file_size
            )

            if file_size > self.max_file_size:
                file_info.parse_errors.append(f"File exceeds max size ({self.max_file_size} bytes)")
                return file_info

            self._identify_magic_bytes(path, file_info)
            self._compute_hashes(path, file_info)

            return file_info

        except Exception as e:
            return FileInfo(
                file_path=str(path.resolve()),
                file_name=path.name,
                file_size=0,
                parse_errors=[f"Parse error: {str(e)}"]
            )

    def _identify_magic_bytes(self, path: Path, file_info: FileInfo) -> None:
        try:
            with open(path, 'rb') as f:
                header = f.read(32)
                if not header:
                    file_info.parse_errors.append("Empty file")
                    return

                file_info.magic_bytes = header.hex()[:32]

                for magic, ftype in sorted(MAGIC_BYTES.items(), key=lambda x: len(x[0]), reverse=True):
                    if header.startswith(magic):
                        file_info.file_type = ftype
                        return

                if self._is_text_file(path):
                    file_info.file_type = "Text/ASCII"

        except Exception as e:
            file_info.parse_errors.append(f"Magic bytes read error: {str(e)}")

    def _is_text_file(self, path: Path) -> bool:
        try:
            with open(path, 'rb') as f:
                chunk = f.read(1024)
                if not chunk:
                    return False
                return b'\x00' not in chunk
        except:
            return False

    def _compute_hashes(self, path: Path, file_info: FileInfo) -> None:
        try:
            sha256 = hashlib.sha256()
            md5 = hashlib.md5()
            
            with open(path, 'rb') as f:
                while chunk := f.read(8192):
                    sha256.update(chunk)
                    md5.update(chunk)
            
            file_info.sha256 = sha256.hexdigest()
            file_info.md5 = md5.hexdigest()
        except Exception as e:
            file_info.parse_errors.append(f"Hash computation error: {str(e)}")

    def scan_directory(self, dir_path: str, recursive: bool = True, follow_symlinks: bool = False) -> List[FileInfo]:
        results = []
        base_path = Path(dir_path).resolve()

        if not base_path.exists():
            return results

        pattern = '**/*' if recursive else '*'
        
        for path in sorted(base_path.glob(pattern), key=lambda p: str(p)):
            try:
                if not follow_symlinks and path.is_symlink():
                    continue
                if path.is_file():
                    file_info = self.parse_file(str(path))
                    if file_info:
                        results.append(file_info)
            except Exception as e:
                pass

        return results

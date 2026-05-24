import json
import os
from pathlib import Path
from typing import Optional, Dict, Any, List
from datetime import datetime
import hashlib
import base64

from .models import (
    Manifest, RegionCopy, BackupFile, Chunk, Checksum,
    ChecksumAlgorithm, ChecksumFormat, ChunkStatus, FileStatus
)


class ManifestParseError(Exception):
    pass


class ManifestParser:
    SUPPORTED_FORMATS = ['.json', '.yaml', '.yml']

    def __init__(self):
        pass

    def parse(self, manifest_path: str) -> Manifest:
        path = Path(manifest_path)
        if not path.exists():
            raise ManifestParseError(f"Manifest file not found: {manifest_path}")

        suffix = path.suffix.lower()
        if suffix not in self.SUPPORTED_FORMATS:
            raise ManifestParseError(
                f"Unsupported manifest format: {suffix}. "
                f"Supported formats: {', '.join(self.SUPPORTED_FORMATS)}"
            )

        if suffix == '.json':
            return self._parse_json(path)
        else:
            return self._parse_yaml(path)

    def _parse_json(self, path: Path) -> Manifest:
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return self._build_manifest(data, path)
        except json.JSONDecodeError as e:
            raise ManifestParseError(f"Invalid JSON in manifest: {e}")
        except Exception as e:
            raise ManifestParseError(f"Failed to parse manifest: {e}")

    def _parse_yaml(self, path: Path) -> Manifest:
        try:
            import yaml
            with open(path, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f)
            return self._build_manifest(data, path)
        except ImportError:
            raise ManifestParseError(
                "PyYAML is required for YAML manifest support. "
                "Install with: pip install pyyaml"
            )
        except Exception as e:
            raise ManifestParseError(f"Failed to parse YAML manifest: {e}")

    def _build_manifest(self, data: Dict[str, Any], path: Path) -> Manifest:
        try:
            manifest_id = data.get('manifest_id', data.get('id', f"manifest-{int(datetime.now().timestamp())}"))
            version = data.get('version', '1.0')
            created_at = self._parse_datetime(data.get('created_at', datetime.now().isoformat()))
            source = data.get('source', str(path))

            manifest = Manifest(
                manifest_id=manifest_id,
                version=version,
                created_at=created_at,
                source=source,
                checksum_algorithms=self._parse_algorithms(data.get('checksum_algorithms', [])),
                metadata=data.get('metadata', {})
            )

            regions_data = data.get('regions', {})
            if not regions_data:
                region_data = {
                    'region': data.get('region', 'default'),
                    'bucket': data.get('bucket', 'default'),
                    'files': data.get('files', [])
                }
                regions_data = {'default': region_data}

            for region_name, region_data in regions_data.items():
                region = self._parse_region(region_name, region_data)
                manifest.regions[region_name] = region

            manifest.total_files = sum(len(r.files) for r in manifest.regions.values())
            manifest.total_chunks = sum(len(r.get_all_chunks()) for r in manifest.regions.values())
            manifest.total_size = sum(
                f.total_size for r in manifest.regions.values() for f in r.files.values()
            )

            return manifest

        except KeyError as e:
            raise ManifestParseError(f"Missing required field in manifest: {e}")
        except Exception as e:
            raise ManifestParseError(f"Failed to build manifest: {e}")

    def _parse_region(self, region_name: str, data: Dict[str, Any]) -> RegionCopy:
        region = RegionCopy(
            region=data.get('region', region_name),
            bucket=data.get('bucket', 'unknown'),
            last_sync=self._parse_datetime(data.get('last_sync'))
        )

        files_data = data.get('files', [])
        for file_data in files_data:
            backup_file = self._parse_file(file_data)
            region.files[backup_file.file_id] = backup_file

        return region

    def _parse_file(self, data: Dict[str, Any]) -> BackupFile:
        file_id = data.get('file_id', data.get('id', data.get('name', 'unknown')))
        file_name = data.get('file_name', data.get('name', file_id))
        total_size = data.get('total_size', data.get('size', 0))
        expected_chunks = data.get('expected_chunks', data.get('parts', data.get('chunk_count', 1)))

        chunks_data = data.get('chunks', data.get('parts', []))
        chunks = [self._parse_chunk(c, i + 1) for i, c in enumerate(chunks_data)]

        checksums = self._parse_checksums(data.get('checksums', data.get('hash', {})))

        return BackupFile(
            file_id=file_id,
            file_name=file_name,
            total_size=total_size,
            chunks=chunks,
            expected_chunks=expected_chunks,
            checksums=checksums,
            metadata=data.get('metadata', {})
        )

    def _parse_chunk(self, data: Dict[str, Any], default_part: int) -> Chunk:
        chunk_id = data.get('chunk_id', data.get('id', data.get('etag', f"part-{default_part}")))
        part_number = data.get('part_number', data.get('part', default_part))
        size = data.get('size', data.get('length', 0))
        etag = data.get('etag', data.get('ETag'))

        checksums = self._parse_checksums(data.get('checksums', data.get('hash', {})))

        return Chunk(
            chunk_id=chunk_id,
            part_number=part_number,
            size=size,
            checksums=checksums,
            etag=etag
        )

    def _parse_checksums(self, data: Any) -> List[Checksum]:
        checksums = []

        if isinstance(data, dict):
            for algo, value in data.items():
                if isinstance(value, dict):
                    checksums.append(Checksum(
                        algorithm=self._parse_algorithm(algo),
                        format=ChecksumFormat(value.get('format', 'hex')),
                        value=value.get('value', '')
                    ))
                else:
                    checksums.append(Checksum(
                        algorithm=self._parse_algorithm(algo),
                        format=ChecksumFormat.HEX,
                        value=str(value)
                    ))
        elif isinstance(data, list):
            for item in data:
                if isinstance(item, dict):
                    checksums.append(Checksum(
                        algorithm=self._parse_algorithm(item.get('algorithm', 'md5')),
                        format=ChecksumFormat(item.get('format', 'hex')),
                        value=item.get('value', '')
                    ))
        elif isinstance(data, str):
            checksums.append(Checksum(
                algorithm=ChecksumAlgorithm.MD5,
                format=ChecksumFormat.HEX,
                value=data
            ))

        return checksums

    def _parse_algorithm(self, algo: str) -> ChecksumAlgorithm:
        algo_lower = algo.lower().replace('-', '').replace('_', '')
        mapping = {
            'md5': ChecksumAlgorithm.MD5,
            'sha1': ChecksumAlgorithm.SHA1,
            'sha256': ChecksumAlgorithm.SHA256,
            'sha512': ChecksumAlgorithm.SHA512,
            'crc32': ChecksumAlgorithm.CRC32,
            'crc64': ChecksumAlgorithm.CRC64,
        }
        return mapping.get(algo_lower, ChecksumAlgorithm.MD5)

    def _parse_algorithms(self, algos: List[str]) -> List[ChecksumAlgorithm]:
        return [self._parse_algorithm(a) for a in algos]

    def _parse_datetime(self, value: Any) -> Optional[datetime]:
        if not value:
            return None
        if isinstance(value, datetime):
            return value
        try:
            return datetime.fromisoformat(str(value).replace('Z', '+00:00'))
        except:
            return None


class ObjectListParser:
    def __init__(self):
        pass

    def parse(self, list_path: str) -> List[Dict[str, Any]]:
        path = Path(list_path)
        if not path.exists():
            raise ManifestParseError(f"Object list file not found: {list_path}")

        suffix = path.suffix.lower()
        if suffix == '.json':
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if isinstance(data, list):
                    return data
                return data.get('objects', data.get('files', []))
        elif suffix in ['.txt', '.lst']:
            objects = []
            with open(path, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#'):
                        objects.append({'key': line, 'name': line})
            return objects
        else:
            raise ManifestParseError(f"Unsupported object list format: {suffix}")

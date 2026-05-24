import json
import hashlib
from pathlib import Path
from typing import Dict
from datetime import datetime, timedelta


class ExampleGenerator:
    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        self.chunks_dir = output_dir / "chunks"
        self.chunks_dir.mkdir(parents=True, exist_ok=True)

    def generate_all(self, include_bad_data: bool = False) -> Dict[str, str]:
        paths = {}

        chunk_data_map = self._generate_chunk_files()

        paths["good_manifest"] = self._generate_good_manifest(chunk_data_map)
        paths["chunks_info"] = self._write_chunks_info(chunk_data_map)

        if include_bad_data:
            paths["bad_manifest"] = self._generate_bad_manifest()
            paths["bad_chunks_info"] = self._generate_bad_chunk_files()

        return paths

    def _generate_chunk_files(self) -> Dict[str, Dict[str, any]]:
        chunk_data_map = {}

        test_data = {
            "chunk-001": b"Hello World! This is chunk 1 data for testing checksum validation. " * 1000,
            "chunk-002": b"Sample content for chunk 2 with different checksum. " * 1000,
            "chunk-003": b"Third chunk final part of the backup data archive. " * 500,
            "config-chunk-001": b"Configuration backup data with settings. " * 200
        }

        for chunk_id, data in test_data.items():
            chunk_path = self.chunks_dir / chunk_id
            with open(chunk_path, 'wb') as f:
                f.write(data)

            md5_hash = hashlib.md5(data).hexdigest()
            sha256_hash = hashlib.sha256(data).hexdigest()

            chunk_data_map[chunk_id] = {
                "chunk_id": chunk_id,
                "path": str(chunk_path),
                "size": len(data),
                "md5": md5_hash,
                "sha256": sha256_hash
            }

        return chunk_data_map

    def _write_chunks_info(self, chunk_data_map: Dict[str, Dict[str, any]]) -> str:
        chunk_info = list(chunk_data_map.values())

        path = self.output_dir / "chunks_info.json"
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(chunk_info, f, indent=2, ensure_ascii=False)
        return str(path)

    def _generate_good_manifest(self, chunk_data_map: Dict[str, Dict[str, any]]) -> str:
        chunk_001 = chunk_data_map["chunk-001"]
        chunk_002 = chunk_data_map["chunk-002"]
        chunk_003 = chunk_data_map["chunk-003"]
        config_chunk = chunk_data_map["config-chunk-001"]

        total_size_db = chunk_001["size"] + chunk_002["size"] + chunk_003["size"]

        db_file = {
            "file_id": "database-full-20240115",
            "file_name": "database_dump.sql",
            "total_size": total_size_db,
            "expected_chunks": 3,
            "checksums": {
                "md5": "manifest-level-md5-placeholder",
                "sha256": "manifest-level-sha256-placeholder"
            },
            "chunks": [
                {
                    "chunk_id": "chunk-001",
                    "part_number": 1,
                    "size": chunk_001["size"],
                    "etag": "etag-abc123",
                    "checksums": {
                        "md5": chunk_001["md5"],
                        "sha256": chunk_001["sha256"]
                    }
                },
                {
                    "chunk_id": "chunk-002",
                    "part_number": 2,
                    "size": chunk_002["size"],
                    "etag": "etag-def456",
                    "checksums": {
                        "md5": chunk_002["md5"],
                        "sha256": chunk_002["sha256"]
                    }
                },
                {
                    "chunk_id": "chunk-003",
                    "part_number": 3,
                    "size": chunk_003["size"],
                    "etag": "etag-ghi789",
                    "checksums": {
                        "md5": chunk_003["md5"],
                        "sha256": chunk_003["sha256"]
                    }
                }
            ]
        }

        config_file = {
            "file_id": "config-archive-20240115",
            "file_name": "configs.tar.gz",
            "total_size": config_chunk["size"],
            "expected_chunks": 1,
            "checksums": {
                "md5": config_chunk["md5"]
            },
            "chunks": [
                {
                    "chunk_id": "config-chunk-001",
                    "part_number": 1,
                    "size": config_chunk["size"],
                    "checksums": {
                        "md5": config_chunk["md5"]
                    }
                }
            ]
        }

        cn_south_db_file = {
            "file_id": "database-full-20240115",
            "file_name": "database_dump.sql",
            "total_size": total_size_db,
            "expected_chunks": 3,
            "checksums": {
                "md5": "manifest-level-md5-placeholder"
            },
            "chunks": [
                {
                    "chunk_id": "chunk-001",
                    "part_number": 1,
                    "size": chunk_001["size"],
                    "checksums": {
                        "md5": chunk_001["md5"]
                    }
                },
                {
                    "chunk_id": "chunk-002",
                    "part_number": 2,
                    "size": chunk_002["size"],
                    "checksums": {
                        "md5": chunk_002["md5"]
                    }
                },
                {
                    "chunk_id": "chunk-003",
                    "part_number": 3,
                    "size": chunk_003["size"],
                    "checksums": {
                        "md5": chunk_003["md5"]
                    }
                }
            ]
        }

        cn_south_config_file = {
            "file_id": "config-archive-20240115",
            "file_name": "configs.tar.gz",
            "total_size": config_chunk["size"],
            "expected_chunks": 1,
            "checksums": {
                "md5": config_chunk["md5"]
            },
            "chunks": [
                {
                    "chunk_id": "config-chunk-001",
                    "part_number": 1,
                    "size": config_chunk["size"],
                    "checksums": {
                        "md5": config_chunk["md5"]
                    }
                }
            ]
        }

        manifest = {
            "manifest_id": "backup-2024-01-15-001",
            "version": "1.0",
            "created_at": (datetime.now() - timedelta(hours=2)).isoformat(),
            "source": "automated-backup",
            "checksum_algorithms": ["md5", "sha256"],
            "regions": {
                "cn-north-1": {
                    "region": "cn-north-1",
                    "bucket": "backup-primary",
                    "last_sync": datetime.now().isoformat(),
                    "files": [db_file, config_file]
                },
                "cn-south-1": {
                    "region": "cn-south-1",
                    "bucket": "backup-replica",
                    "last_sync": (datetime.now() - timedelta(minutes=30)).isoformat(),
                    "files": [cn_south_db_file, cn_south_config_file]
                }
            },
            "metadata": {
                "backup_type": "full",
                "schedule": "daily",
                "encryption": "AES-256"
            }
        }

        path = self.output_dir / "manifest_good.json"
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, indent=2, ensure_ascii=False)
        return str(path)

    def _generate_bad_manifest(self) -> str:
        manifest = {
            "manifest_id": "backup-2024-01-15-bad",
            "version": "1.0",
            "created_at": datetime.now().isoformat(),
            "source": "test-bad-data",
            "regions": {
                "cn-north-1": {
                    "region": "cn-north-1",
                    "bucket": "backup-primary",
                    "files": [
                        {
                            "file_id": "incomplete-file",
                            "file_name": "incomplete_data.bin",
                            "total_size": 5242880,
                            "expected_chunks": 3,
                            "checksums": {
                                "md5": "invalid-md5-hash"
                            },
                            "chunks": [
                                {
                                    "chunk_id": "bad-chunk-001",
                                    "part_number": 1,
                                    "size": 1048576,
                                    "checksums": {
                                        "md5": "wrong-checksum-value"
                                    }
                                },
                                {
                                    "chunk_id": "bad-chunk-002",
                                    "part_number": 2,
                                    "size": 2097152,
                                    "checksums": {
                                        "md5": "another-bad-hash"
                                    }
                                }
                            ]
                        }
                    ]
                },
                "cn-south-1": {
                    "region": "cn-south-1",
                    "bucket": "backup-replica",
                    "files": [
                        {
                            "file_id": "only-in-replica",
                            "file_name": "orphan_file.txt",
                            "total_size": 1024,
                            "expected_chunks": 1,
                            "chunks": []
                        }
                    ]
                }
            }
        }

        path = self.output_dir / "manifest_bad.json"
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, indent=2, ensure_ascii=False)
        return str(path)

    def _generate_bad_chunk_files(self) -> str:
        bad_chunk_path = self.chunks_dir / "bad-chunk-001"
        with open(bad_chunk_path, 'wb') as f:
            f.write(b"This is corrupted data with wrong checksum")

        return str(bad_chunk_path)

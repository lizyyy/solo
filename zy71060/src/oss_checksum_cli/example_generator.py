import json
import os
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

        paths["good_manifest"] = self._generate_good_manifest()
        paths["chunks_info"] = self._generate_chunk_files()

        if include_bad_data:
            paths["bad_manifest"] = self._generate_bad_manifest()
            paths["bad_chunks_info"] = self._generate_bad_chunk_files()

        return paths

    def _generate_good_manifest(self) -> str:
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
                    "files": [
                        {
                            "file_id": "database-full-20240115",
                            "file_name": "database_dump.sql",
                            "total_size": 10485760,
                            "expected_chunks": 3,
                            "checksums": {
                                "md5": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6",
                                "sha256": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2"
                            },
                            "chunks": [
                                {
                                    "chunk_id": "chunk-001",
                                    "part_number": 1,
                                    "size": 4194304,
                                    "etag": "etag-abc123",
                                    "checksums": {
                                        "md5": "5d41402abc4b2a76b9719d911017c592",
                                        "sha256": "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
                                    }
                                },
                                {
                                    "chunk_id": "chunk-002",
                                    "part_number": 2,
                                    "size": 4194304,
                                    "etag": "etag-def456",
                                    "checksums": {
                                        "md5": "7d793037a0760186574b0282f2f435e7",
                                        "sha256": "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08"
                                    }
                                },
                                {
                                    "chunk_id": "chunk-003",
                                    "part_number": 3,
                                    "size": 2097152,
                                    "etag": "etag-ghi789",
                                    "checksums": {
                                        "md5": "098f6bcd4621d373cade4e832627b4f6",
                                        "sha256": "9e107d9d372bb6826bd81d3542a419d61f6bf1c31c194853af32e43035c31530"
                                    }
                                }
                            ]
                        },
                        {
                            "file_id": "config-archive-20240115",
                            "file_name": "configs.tar.gz",
                            "total_size": 1048576,
                            "expected_chunks": 1,
                            "checksums": {
                                "md5": "6f5902ac237024bdd0c176cb93063dc4"
                            },
                            "chunks": [
                                {
                                    "chunk_id": "config-chunk-001",
                                    "part_number": 1,
                                    "size": 1048576,
                                    "checksums": {
                                        "md5": "6f5902ac237024bdd0c176cb93063dc4"
                                    }
                                }
                            ]
                        }
                    ]
                },
                "cn-south-1": {
                    "region": "cn-south-1",
                    "bucket": "backup-replica",
                    "last_sync": (datetime.now() - timedelta(minutes=30)).isoformat(),
                    "files": [
                        {
                            "file_id": "database-full-20240115",
                            "file_name": "database_dump.sql",
                            "total_size": 10485760,
                            "expected_chunks": 3,
                            "checksums": {
                                "md5": "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6"
                            },
                            "chunks": [
                                {
                                    "chunk_id": "chunk-001",
                                    "part_number": 1,
                                    "size": 4194304,
                                    "checksums": {
                                        "md5": "5d41402abc4b2a76b9719d911017c592"
                                    }
                                },
                                {
                                    "chunk_id": "chunk-002",
                                    "part_number": 2,
                                    "size": 4194304,
                                    "checksums": {
                                        "md5": "7d793037a0760186574b0282f2f435e7"
                                    }
                                },
                                {
                                    "chunk_id": "chunk-003",
                                    "part_number": 3,
                                    "size": 2097152,
                                    "checksums": {
                                        "md5": "098f6bcd4621d373cade4e832627b4f6"
                                    }
                                }
                            ]
                        }
                    ]
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

    def _generate_chunk_files(self) -> str:
        chunk_info = []

        test_data = {
            "chunk-001": b"Hello World! This is chunk 1 data for testing checksum validation.",
            "chunk-002": b"Sample content for chunk 2 with different checksum.",
            "chunk-003": b"Third chunk final part of the backup data archive.",
            "config-chunk-001": b"Configuration backup data with settings."
        }

        for chunk_id, data in test_data.items():
            chunk_path = self.chunks_dir / chunk_id
            with open(chunk_path, 'wb') as f:
                f.write(data)

            md5_hash = hashlib.md5(data).hexdigest()
            sha256_hash = hashlib.sha256(data).hexdigest()

            chunk_info.append({
                "chunk_id": chunk_id,
                "path": str(chunk_path),
                "size": len(data),
                "md5": md5_hash,
                "sha256": sha256_hash
            })

        path = self.output_dir / "chunks_info.json"
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(chunk_info, f, indent=2, ensure_ascii=False)
        return str(path)

    def _generate_bad_chunk_files(self) -> str:
        bad_chunk_path = self.chunks_dir / "bad-chunk-001"
        with open(bad_chunk_path, 'wb') as f:
            f.write(b"This is corrupted data with wrong checksum")

        return str(bad_chunk_path)

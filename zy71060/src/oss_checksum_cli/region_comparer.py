from typing import List, Dict, Any, Tuple, Optional
from collections import defaultdict
from datetime import datetime

from .models import (
    Manifest, RegionCopy, BackupFile, Chunk, Checksum,
    ValidationIssue, ChecksumAlgorithm, ChunkStatus, FileStatus
)
from .checksum_utils import ChecksumConverter


class RegionComparer:
    def __init__(self):
        self.converter = ChecksumConverter()

    def compare_regions(self, manifest: Manifest) -> Tuple[Dict[str, Any], List[ValidationIssue]]:
        issues: List[ValidationIssue] = []
        regions = manifest.get_regions()

        if len(regions) < 2:
            return {"note": "Only one region available, skipping comparison"}, issues

        comparison_result = {
            "regions": regions,
            "files_comparison": {},
            "chunks_comparison": {},
            "summary": {
                "total_files_checked": 0,
                "files_with_differences": 0,
                "total_chunks_checked": 0,
                "chunks_with_differences": 0,
                "missing_in_regions": defaultdict(int)
            }
        }

        all_file_ids = set()
        for region in regions:
            region_copy = manifest.regions[region]
            all_file_ids.update(region_copy.files.keys())

        for file_id in all_file_ids:
            file_result, file_issues = self._compare_file_across_regions(
                file_id, manifest, regions
            )
            comparison_result["files_comparison"][file_id] = file_result
            issues.extend(file_issues)

            if file_result["has_differences"]:
                comparison_result["summary"]["files_with_differences"] += 1

            comparison_result["summary"]["total_files_checked"] += 1

        comparison_result["chunks_comparison"] = self._compare_chunks(manifest, regions)

        for region in regions:
            region_copy = manifest.regions[region]
            for file in region_copy.files.values():
                comparison_result["summary"]["total_chunks_checked"] += len(file.chunks)

        comparison_result["summary"]["chunks_with_differences"] = sum(
                    1 for c in comparison_result["chunks_comparison"].values()
                    if c["has_differences"]
                )

        return comparison_result, issues

    def _compare_file_across_regions(
        self,
        file_id: str,
        manifest: Manifest,
        regions: List[str]
    ) -> Tuple[Dict[str, Any], List[ValidationIssue]]:
        issues: List[ValidationIssue] = []
        file_info = {
            "file_id": file_id,
            "present_in": [],
            "missing_in": [],
            "size_consistent": True,
            "chunk_count_consistent": True,
            "has_differences": False,
            "details": {}
        }

        file_sizes = {}
        chunk_counts = {}

        for region in regions:
            region_copy = manifest.regions[region]
            if file_id in region_copy.files:
                file = region_copy.files[file_id]
                file_info["present_in"].append(region)
                file_sizes[region] = file.total_size
                chunk_counts[region] = len(file.chunks)
                file_info["details"][region] = {
                    "file_name": file.file_name,
                    "total_size": file.total_size,
                    "chunk_count": len(file.chunks),
                    "status": file.status.value
                }
            else:
                file_info["missing_in"].append(region)

        if file_info["missing_in"]:
            file_info["has_differences"] = True
            for region in file_info["missing_in"]:
                issues.append(ValidationIssue(
                    severity="error",
                    code="file_missing_in_region",
                    message=f"File '{file_id}' missing in region '{region}'",
                    file_id=file_id,
                    region=region,
                    details={
                        "present_in": file_info["present_in"],
                        "missing_in": file_info["missing_in"]
                    }
                ))

        unique_sizes = set(file_sizes.values())
        if len(unique_sizes) > 1:
            file_info["size_consistent"] = False
            file_info["has_differences"] = True
            issues.append(ValidationIssue(
                severity="error",
                code="file_size_inconsistent",
                message=f"File size inconsistent across regions",
                file_id=file_id,
                details={"sizes_by_region": file_sizes}
            ))

        unique_chunk_counts = set(chunk_counts.values())
        if len(unique_chunk_counts) > 1:
            file_info["chunk_count_consistent"] = False
            file_info["has_differences"] = True
            issues.append(ValidationIssue(
                severity="warning",
                code="file_chunk_count_inconsistent",
                message=f"File chunk count inconsistent across regions",
                file_id=file_id,
                details={"chunk_counts_by_region": chunk_counts}
            ))

        return file_info, issues

    def _compare_chunks(
        self,
        manifest: Manifest,
        regions: List[str]
    ) -> Dict[str, Any]:
        chunks_comparison = {}

        all_chunk_keys = set()
        chunk_locations: Dict[str, List[Tuple[str, str, Chunk]]] = defaultdict(list)

        for region in regions:
            region_copy = manifest.regions[region]
            for file_id, file in region_copy.files.items():
                for chunk in file.chunks:
                    chunk_key = f"{file_id}:{chunk.part_number}"
                    all_chunk_keys.add(chunk_key)
                    chunk_locations[chunk_key].append((region, file_id, chunk))

        for chunk_key in all_chunk_keys:
            locations = chunk_locations[chunk_key]
            chunks_comparison[chunk_key] = self._compare_single_chunk(chunk_key, locations)

        return chunks_comparison

    def _compare_single_chunk(
        self,
        chunk_key: str,
        locations: List[Tuple[str, str, Chunk]]
    ) -> Dict[str, Any]:
        result = {
            "chunk_key": chunk_key,
            "present_in": [],
            "missing_in": [],
            "size_consistent": True,
            "checksum_consistent": True,
            "has_differences": False,
            "details": {}
        }

        present_regions = set()
        sizes = {}
        checksums_by_algo: Dict[ChecksumAlgorithm, Dict[str, str]] = defaultdict(dict)

        for region, file_id, chunk in locations:
            present_regions.add(region)
            sizes[region] = chunk.size
            result["details"][region] = {
                "chunk_id": chunk.chunk_id,
                "size": chunk.size,
                "status": chunk.status.value,
                "checksums": {cs.algorithm.value: cs.value for cs in chunk.checksums}
            }

            for cs in chunk.checksums:
                checksums_by_algo[cs.algorithm][region] = cs.value

        all_regions = set(r for r, _, _ in locations)

        sizes_set = set(sizes.values())
        if len(sizes_set) > 1:
            result["size_consistent"] = False
            result["has_differences"] = True

        for algo, region_checksums in checksums_by_algo.items():
            unique_checksums = set(region_checksums.values())
            if len(unique_checksums) > 1:
                result["checksum_consistent"] = False
                result["has_differences"] = True
                break

        if len(present_regions) < len(all_regions):
            result["has_differences"] = True

        return result

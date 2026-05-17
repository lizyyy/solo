#!/usr/bin/env python3
import argparse
import hashlib
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple


class ArtifactChecker:
    def __init__(self, input_dir: str, output_dir: str, verbose: bool = False):
        self.input_dir = Path(input_dir).resolve()
        self.output_dir = Path(output_dir).resolve()
        self.verbose = verbose
        self.regions: List[str] = []
        self.artifacts: Dict[str, Dict[str, dict]] = {}
        self.errors: List[dict] = []
        self.skipped: List[dict] = []
        
    def validate_inputs(self) -> bool:
        if not self.input_dir.exists():
            self._add_error("输入目录不存在", str(self.input_dir))
            return False
        
        if not self.input_dir.is_dir():
            self._add_error("输入路径不是目录", str(self.input_dir))
            return False
            
        region_dirs = [d for d in self.input_dir.iterdir() if d.is_dir()]
        if not region_dirs:
            self._add_error("输入目录下没有区域子目录", str(self.input_dir))
            return False
            
        self.regions = sorted([d.name for d in region_dirs])
        
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        return True
        
    def scan_directory(self) -> None:
        for region in self.regions:
            region_path = self.input_dir / region
            if self.verbose:
                print(f"扫描区域: {region} -> {region_path}")
                
            for root, _, files in os.walk(region_path):
                for filename in files:
                    file_path = Path(root) / filename
                    rel_path = file_path.relative_to(region_path)
                    artifact_key = str(rel_path)
                    
                    try:
                        file_stat = file_path.stat()
                        file_info = {
                            "filename": filename,
                            "relative_path": str(rel_path),
                            "full_path": str(file_path),
                            "size": file_stat.st_size,
                            "size_human": self._human_size(file_stat.st_size),
                            "mtime": file_stat.st_mtime,
                            "mtime_human": datetime.fromtimestamp(file_stat.st_mtime).isoformat(),
                            "region": region,
                        }
                        
                        if artifact_key not in self.artifacts:
                            self.artifacts[artifact_key] = {}
                        self.artifacts[artifact_key][region] = file_info
                        
                    except Exception as e:
                        self._add_skipped(str(file_path), region, str(e))
    
    def calculate_hashes(self, hash_alg: str = "sha256") -> None:
        if self.verbose:
            print(f"\n使用算法计算哈希: {hash_alg}")
            
        hash_func = getattr(hashlib, hash_alg, None)
        if not hash_func:
            self._add_error("不支持的哈希算法", hash_alg)
            return
            
        for artifact_key, regions in self.artifacts.items():
            for region, file_info in regions.items():
                file_path = Path(file_info["full_path"])
                try:
                    file_hash = self._compute_file_hash(file_path, hash_func)
                    file_info["hash"] = file_hash
                    file_info["hash_alg"] = hash_alg
                except Exception as e:
                    self._add_skipped(str(file_path), region, f"哈希计算失败: {e}")
                    file_info["hash_error"] = str(e)
    
    def compare_regions(self) -> Dict[str, dict]:
        results = {
            "consistent": [],
            "size_mismatch": [],
            "hash_mismatch": [],
            "missing_regions": [],
            "partial": []
        }
        
        num_regions = len(self.regions)
        
        for artifact_key, regions in self.artifacts.items():
            artifact_result = {
                "artifact_key": artifact_key,
                "regions_present": list(regions.keys()),
                "regions_missing": [r for r in self.regions if r not in regions],
                "files": list(regions.values())
            }
            
            if len(regions) < num_regions:
                results["missing_regions"].append(artifact_result)
                continue
                
            sizes = set(f["size"] for f in regions.values() if "size" in f)
            if len(sizes) > 1:
                results["size_mismatch"].append(artifact_result)
                continue
                
            hashes = set(f["hash"] for f in regions.values() if "hash" in f)
            if len(hashes) > 1:
                results["hash_mismatch"].append(artifact_result)
                continue
                
            if len(regions) == num_regions:
                results["consistent"].append(artifact_result)
            else:
                results["partial"].append(artifact_result)
                
        return results
    
    def generate_reports(self, results: Dict[str, dict]) -> None:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        self._generate_terminal_summary(results)
        self._generate_machine_readable(results, timestamp)
        self._generate_human_report(results, timestamp)
        
    def _generate_terminal_summary(self, results: Dict[str, dict]) -> None:
        print("\n" + "="*80)
        print("制品校验和报告摘要")
        print("="*80)
        print(f"扫描区域: {', '.join(self.regions)}")
        print(f"发现制品: {len(self.artifacts)}")
        print(f"一致通过: {len(results['consistent'])}")
        print(f"大小不一致: {len(results['size_mismatch'])}")
        print(f"哈希不一致: {len(results['hash_mismatch'])}")
        print(f"区域缺失: {len(results['missing_regions'])}")
        print(f"跳过记录: {len(self.skipped)}")
        print(f"错误数量: {len(self.errors)}")
        print("="*80)
        
        if results["size_mismatch"]:
            print("\n[警告] 大小不一致的文件:")
            for item in results["size_mismatch"][:5]:
                print(f"  - {item['artifact_key']}")
            if len(results["size_mismatch"]) > 5:
                print(f"  ... 还有 {len(results['size_mismatch']) - 5} 个")
                
        if results["hash_mismatch"]:
            print("\n[错误] 哈希不一致的文件:")
            for item in results["hash_mismatch"][:5]:
                print(f"  - {item['artifact_key']}")
            if len(results["hash_mismatch"]) > 5:
                print(f"  ... 还有 {len(results['hash_mismatch']) - 5} 个")
                
        if results["missing_regions"]:
            print("\n[注意] 部分区域缺失的文件:")
            for item in results["missing_regions"][:5]:
                missing = ", ".join(item["regions_missing"])
                print(f"  - {item['artifact_key']} (缺失: {missing})")
            if len(results["missing_regions"]) > 5:
                print(f"  ... 还有 {len(results['missing_regions']) - 5} 个")
                
    def _generate_machine_readable(self, results: Dict[str, dict], timestamp: str) -> None:
        output_file = self.output_dir / f"checksum_results_{timestamp}.json"
        
        report = {
            "timestamp": datetime.now().isoformat(),
            "input_directory": str(self.input_dir),
            "output_directory": str(self.output_dir),
            "regions": self.regions,
            "summary": {
                "total_artifacts": len(self.artifacts),
                "consistent": len(results["consistent"]),
                "size_mismatch": len(results["size_mismatch"]),
                "hash_mismatch": len(results["hash_mismatch"]),
                "missing_regions": len(results["missing_regions"]),
                "skipped": len(self.skipped),
                "errors": len(self.errors)
            },
            "results": results,
            "skipped_records": self.skipped,
            "errors": self.errors
        }
        
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2, ensure_ascii=False)
            
        print(f"\n机器可读结果已保存: {output_file}")
        
    def _generate_human_report(self, results: Dict[str, dict], timestamp: str) -> None:
        output_file = self.output_dir / f"checksum_report_{timestamp}.md"
        
        lines = []
        lines.append("# 多地上传制品一致性校验报告")
        lines.append("")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"**输入目录**: `{self.input_dir}`")
        lines.append(f"**校验区域**: {len(self.regions)} 个 ({', '.join(self.regions)})")
        lines.append("")
        
        lines.append("## 执行摘要")
        lines.append("")
        lines.append("| 状态 | 数量 |")
        lines.append("|------|------|")
        lines.append(f"| 一致通过 | {len(results['consistent'])} |")
        lines.append(f"| 大小不一致 | {len(results['size_mismatch'])} |")
        lines.append(f"| 哈希不一致 | {len(results['hash_mismatch'])} |")
        lines.append(f"| 区域缺失 | {len(results['missing_regions'])} |")
        lines.append(f"| 跳过记录 | {len(self.skipped)} |")
        lines.append(f"| 处理错误 | {len(self.errors)} |")
        lines.append("")
        
        if results["hash_mismatch"]:
            lines.append("## 哈希不一致（关键问题）")
            lines.append("")
            for item in results["hash_mismatch"]:
                lines.append(f"### {item['artifact_key']}")
                lines.append("")
                lines.append("| 区域 | 文件路径 | 大小 | 哈希 |")
                lines.append("|------|----------|------|------|")
                for f in item["files"]:
                    lines.append(f"| {f['region']} | `{f['full_path']}` | {f['size_human']} | `{f.get('hash', 'N/A')[:16]}...` |")
                lines.append("")
                
        if results["size_mismatch"]:
            lines.append("## 大小不一致")
            lines.append("")
            for item in results["size_mismatch"]:
                lines.append(f"### {item['artifact_key']}")
                lines.append("")
                lines.append("| 区域 | 文件路径 | 大小 |")
                lines.append("|------|----------|------|")
                for f in item["files"]:
                    lines.append(f"| {f['region']} | `{f['full_path']}` | {f['size_human']} |")
                lines.append("")
                
        if results["missing_regions"]:
            lines.append("## 部分区域缺失")
            lines.append("")
            lines.append("| 文件 | 存在区域 | 缺失区域 |")
            lines.append("|------|----------|----------|")
            for item in results["missing_regions"]:
                present = ", ".join(item["regions_present"])
                missing = ", ".join(item["regions_missing"])
                lines.append(f"| {item['artifact_key']} | {present} | **{missing}** |")
            lines.append("")
            
        if self.skipped:
            lines.append("## 跳过的记录")
            lines.append("")
            lines.append("| 文件路径 | 区域 | 原因 |")
            lines.append("|----------|------|------|")
            for s in self.skipped:
                lines.append(f"| `{s['file_path']}` | {s['region']} | {s['reason']} |")
            lines.append("")
            
        if self.errors:
            lines.append("## 处理错误")
            lines.append("")
            lines.append("| 错误类型 | 位置 |")
            lines.append("|----------|------|")
            for e in self.errors:
                lines.append(f"| {e['type']} | `{e['location']}` |")
            lines.append("")
            
        lines.append("## 一致通过文件列表")
        lines.append("")
        for item in results["consistent"][:50]:
            lines.append(f"- `{item['artifact_key']}`")
        if len(results["consistent"]) > 50:
            lines.append(f"- ... 还有 {len(results['consistent']) - 50} 个文件")
        lines.append("")
        
        with open(output_file, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
            
        print(f"人员可读报告已保存: {output_file}")
        
    def _compute_file_hash(self, file_path: Path, hash_func, block_size: int = 65536) -> str:
        hasher = hash_func()
        with open(file_path, "rb") as f:
            for block in iter(lambda: f.read(block_size), b""):
                hasher.update(block)
        return hasher.hexdigest()
        
    def _human_size(self, size_bytes: int) -> str:
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if size_bytes < 1024.0:
                return f"{size_bytes:.2f} {unit}"
            size_bytes /= 1024.0
        return f"{size_bytes:.2f} PB"
        
    def _add_error(self, error_type: str, location: str) -> None:
        self.errors.append({
            "type": error_type,
            "location": location,
            "timestamp": datetime.now().isoformat()
        })
        
    def _add_skipped(self, file_path: str, region: str, reason: str) -> None:
        self.skipped.append({
            "file_path": file_path,
            "region": region,
            "reason": reason,
            "timestamp": datetime.now().isoformat()
        })


def main():
    parser = argparse.ArgumentParser(
        description="制品校验和CLI - 验证多地上传的发布制品一致性",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  %(prog)s --input ./artifacts --output ./reports
  %(prog)s --input ./artifacts --output ./reports --hash md5
  %(prog)s --input ./artifacts --output ./reports --verbose
        """
    )
    
    parser.add_argument(
        "--input", "-i",
        required=True,
        help="制品根目录，包含各区域子目录"
    )
    
    parser.add_argument(
        "--output", "-o",
        default="./checksum_reports",
        help="报告输出目录 (默认: ./checksum_reports)"
    )
    
    parser.add_argument(
        "--hash", "-H",
        default="sha256",
        choices=["md5", "sha1", "sha256", "sha512"],
        help="哈希算法 (默认: sha256)"
    )
    
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="显示详细输出"
    )
    
    args = parser.parse_args()
    
    checker = ArtifactChecker(args.input, args.output, args.verbose)
    
    if not checker.validate_inputs():
        print("输入验证失败!", file=sys.stderr)
        for error in checker.errors:
            print(f"  - {error['type']}: {error['location']}", file=sys.stderr)
        sys.exit(1)
        
    if args.verbose:
        print(f"发现 {len(checker.regions)} 个区域: {', '.join(checker.regions)}")
        
    print("开始扫描目录...")
    checker.scan_directory()
    
    print(f"计算文件哈希 ({args.hash})...")
    checker.calculate_hashes(args.hash)
    
    print("对比区域一致性...")
    results = checker.compare_regions()
    
    print("生成报告...")
    checker.generate_reports(results)
    
    has_errors = len(results["hash_mismatch"]) > 0 or len(results["size_mismatch"]) > 0
    sys.exit(1 if has_errors else 0)


if __name__ == "__main__":
    main()

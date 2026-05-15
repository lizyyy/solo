from pathlib import Path
from datetime import datetime
import json
from typing import Dict, List, Any
from .config import OUTPUT_DIR, VERSION_HISTORY_DIR


class ReportGenerator:
    def __init__(self):
        self.formatters = {
            "json": self._format_json,
            "markdown": self._format_markdown
        }

    def generate_report(self, scan_results: List[Dict[str, Any]],
                        output_format: str = "json",
                        include_anomalies: bool = True) -> Dict[str, Any]:

        report_id = datetime.now().strftime("%Y%m%d_%H%M%S")

        summary = self._generate_summary(scan_results)

        report = {
            "report_id": report_id,
            "generated_at": datetime.now().isoformat(),
            "summary": summary,
            "results": scan_results
        }

        self._freeze_version(report_id, report)

        formatter = self.formatters.get(output_format.lower(), self._format_json)
        output_path = formatter(report, report_id)

        return {
            "report_id": report_id,
            "output_path": str(output_path),
            "summary": summary
        }

    def _generate_summary(self, scan_results: List[Dict[str, Any]]) -> Dict[str, Any]:
        total = len(scan_results)
        valid = sum(1 for r in scan_results if r.get("is_valid"))
        invalid = total - valid
        has_error = sum(1 for r in scan_results if r.get("error"))
        has_bom = sum(1 for r in scan_results if r.get("has_bom"))

        encoding_stats = {}
        for r in scan_results:
            enc = r.get("encoding") or "unknown"
            encoding_stats[enc] = encoding_stats.get(enc, 0) + 1

        high_confidence = sum(1 for r in scan_results if r.get("confidence", 0) >= 0.9)
        low_confidence = sum(1 for r in scan_results if r.get("confidence", 0) < 0.5)

        return {
            "total_files": total,
            "valid_encoding": valid,
            "invalid_encoding": invalid,
            "has_error": has_error,
            "has_bom": has_bom,
            "high_confidence": high_confidence,
            "low_confidence": low_confidence,
            "encoding_distribution": encoding_stats
        }

    def _format_json(self, report: Dict[str, Any], report_id: str) -> Path:
        output_path = OUTPUT_DIR / f"report_{report_id}.json"
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        return output_path

    def _format_markdown(self, report: Dict[str, Any], report_id: str) -> Path:
        output_path = OUTPUT_DIR / f"report_{report_id}.md"

        summary = report["summary"]
        results = report["results"]

        content = f"""# 文件编码巡检报告

**报告ID**: {report_id}  
**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}  

## 执行摘要

| 指标 | 数值 |
|------|------|
| 总文件数 | {summary['total_files']} |
| 编码有效 | {summary['valid_encoding']} |
| 编码异常 | {summary['invalid_encoding']} |
| 包含错误 | {summary['has_error']} |
| 含BOM标记 | {summary['has_bom']} |
| 高置信度(≥0.9) | {summary['high_confidence']} |
| 低置信度(<0.5) | {summary['low_confidence']} |

## 编码分布

"""
        for enc, count in summary["encoding_distribution"].items():
            content += f"- **{enc}**: {count} 个文件\n"

        content += "\n## 详细检测结果\n\n"

        for i, result in enumerate(results, 1):
            status_icon = "✅" if result.get("is_valid") else "❌"
            content += f"""### {i}. {status_icon} {result['file_name']}

- **文件路径**: {result['file_path']}
- **检测编码**: {result.get('encoding', '未知')}
- **置信度**: {result.get('confidence', 0):.2f}
- **语言**: {result.get('language', '未知')}
- **文件大小**: {result.get('file_size', 0)} bytes
- **含BOM**: {'是' if result.get('has_bom') else '否'}
- **状态**: {'有效' if result.get('is_valid') else '异常'}
"""
            if result.get('error'):
                content += f"- **错误信息**: {result['error']}\n"
            content += "\n---\n\n"

        output_path.write_text(content, encoding="utf-8")
        return output_path

    def _freeze_version(self, report_id: str, report: Dict[str, Any]):
        version_info = {
            "report_id": report_id,
            "frozen_at": datetime.now().isoformat(),
            "freeze_note": "版本冻结通知：巡检执行完成，结果已归档",
            "checksum": hash(json.dumps(report, sort_keys=True, ensure_ascii=False))
        }

        version_path = VERSION_HISTORY_DIR / f"version_{report_id}.json"
        with open(version_path, "w", encoding="utf-8") as f:
            json.dump(version_info, f, ensure_ascii=False, indent=2)

    def get_version_history(self, limit: int = 10) -> List[Dict[str, Any]]:
        version_files = sorted(VERSION_HISTORY_DIR.glob("version_*.json"), reverse=True)
        result = []

        for file_path in version_files[:limit]:
            with open(file_path, "r", encoding="utf-8") as f:
                result.append(json.load(f))

        return result

    def export_for_download(self, report_id: str) -> Dict[str, Any]:
        json_path = OUTPUT_DIR / f"report_{report_id}.json"
        md_path = OUTPUT_DIR / f"report_{report_id}.md"

        result = {
            "report_id": report_id,
            "formats": []
        }

        if json_path.exists():
            result["formats"].append({
                "format": "json",
                "path": str(json_path),
                "size": json_path.stat().st_size
            })

        if md_path.exists():
            result["formats"].append({
                "format": "markdown",
                "path": str(md_path),
                "size": md_path.stat().st_size
            })

        return result

import json
import yaml
from datetime import datetime
from pathlib import Path
from typing import Optional
from .core import ValidationResult, FileInfo


class ReportGenerator:
    def __init__(self, result: ValidationResult):
        self.result = result
        self.timestamp = datetime.now()

    def _format_file_info(self, info: FileInfo) -> dict:
        return {
            "path": info.path,
            "exists": info.exists,
            "size_bytes": info.size,
            "size_human": self._human_size(info.size),
            "sha256": info.sha256,
            "modified_at": info.modified_at.isoformat() if info.modified_at else None
        }

    def _human_size(self, size: int) -> str:
        for unit in ["B", "KB", "MB", "GB"]:
            if size < 1024:
                return f"{size:.2f} {unit}"
            size /= 1024
        return f"{size:.2f} TB"

    def generate_terminal_summary(self) -> str:
        lines = []
        lines.append("=" * 70)
        lines.append("  SQLite备份一致性检查报告")
        lines.append("=" * 70)
        lines.append(f"检查时间: {self.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")

        lines.append("【文件信息】")
        lines.append(f"  数据库文件: {self.result.db_file.path}")
        lines.append(f"    存在: {'是' if self.result.db_file.exists else '否'}")
        if self.result.db_file.exists:
            lines.append(f"    大小: {self._human_size(self.result.db_file.size)}")
            lines.append(f"    页面大小: 4096 字节")
            lines.append(f"    总页数: {self.result.page_count}")
            lines.append(f"    SHA256: {self.result.db_file.sha256[:16]}...")
        
        if self.result.wal_file:
            lines.append(f"  WAL文件: {self.result.wal_file.path}")
            lines.append(f"    存在: {'是' if self.result.wal_file.exists else '否'}")
            if self.result.wal_file.exists:
                lines.append(f"    大小: {self._human_size(self.result.wal_file.size)}")
                lines.append(f"    SHA256: {self.result.wal_file.sha256[:16]}...")
        else:
            lines.append(f"  WAL文件: 未提供")
        lines.append("")

        lines.append("【检查结果】")
        status_icon = "✅" if self.result.is_valid else "❌"
        lines.append(f"  整体状态: {status_icon} {'通过' if self.result.is_valid else '未通过'}")
        lines.append("")

        if self.result.errors:
            lines.append("【错误详情】")
            for i, err in enumerate(self.result.errors, 1):
                lines.append(f"  {i}. [{err['type']}] {err['message']}")
                lines.append(f"     位置: {err['location']}")
            lines.append("")

        if self.result.warnings:
            lines.append("【警告信息】")
            for i, warn in enumerate(self.result.warnings, 1):
                lines.append(f"  {i}. [{warn['type']}] {warn['message']}")
                lines.append(f"     位置: {warn['location']}")
            lines.append("")

        if not self.result.wal_file:
            lines.append("【WAL文件提示】")
            lines.append("  ⚠️  未检测到WAL文件。如果数据库处于活跃状态，")
            lines.append("     最新事务可能只在WAL文件中。请确保同时备份！")
            lines.append("")

        lines.append("=" * 70)
        return "\n".join(lines)

    def generate_machine_readable(self, format: str = "json") -> str:
        data = {
            "metadata": {
                "version": "1.0.0",
                "generated_at": self.timestamp.isoformat(),
                "check_type": "sqlite_backup_consistency"
            },
            "summary": {
                "is_valid": self.result.is_valid,
                "page_count": self.result.page_count,
                "valid_pages": self.result.valid_pages,
                "error_count": len(self.result.errors),
                "warning_count": len(self.result.warnings)
            },
            "files": {
                "database": self._format_file_info(self.result.db_file),
                "wal": self._format_file_info(self.result.wal_file) if self.result.wal_file else None
            },
            "errors": self.result.errors,
            "warnings": self.result.warnings,
            "pages": [
                {
                    "page_number": p.page_number,
                    "offset": p.offset,
                    "size": p.size,
                    "checksum_valid": p.checksum_valid,
                    "error": p.error
                }
                for p in self.result.pages
            ]
        }

        if format == "yaml":
            return yaml.dump(data, allow_unicode=True, default_flow_style=False)
        return json.dumps(data, ensure_ascii=False, indent=2)

    def generate_human_report(self) -> str:
        lines = []
        lines.append("# SQLite备份一致性检查报告")
        lines.append("")
        lines.append(f"> 生成时间: {self.timestamp.strftime('%Y年%m月%d日 %H:%M:%S')}")
        lines.append("")

        lines.append("## 一、概述")
        lines.append("")
        status = "✅ 检查通过" if self.result.is_valid else "❌ 检查未通过"
        lines.append(f"**整体状态**: {status}")
        lines.append("")
        
        summary_items = [
            f"- 数据库文件: {Path(self.result.db_file.path).name}",
            f"- 文件总页数: {self.result.page_count} 页",
            f"- 有效页面数: {self.result.valid_pages} 页",
        ]
        if self.result.wal_file:
            summary_items.append(f"- WAL文件: 已配对检查")
        else:
            summary_items.append(f"- WAL文件: 未提供")
        
        lines.extend(summary_items)
        lines.append("")

        lines.append("## 二、文件信息")
        lines.append("")
        lines.append("### 数据库文件")
        lines.append("")
        lines.append(f"- **路径**: `{self.result.db_file.path}`")
        lines.append(f"- **存在**: {'是' if self.result.db_file.exists else '否'}")
        if self.result.db_file.exists:
            lines.append(f"- **大小**: {self._human_size(self.result.db_file.size)}")
            lines.append(f"- **SHA256**: `{self.result.db_file.sha256}`")
            modified = self.result.db_file.modified_at.strftime('%Y-%m-%d %H:%M:%S') if self.result.db_file.modified_at else "N/A"
            lines.append(f"- **修改时间**: {modified}")
        lines.append("")

        if self.result.wal_file:
            lines.append("### WAL文件")
            lines.append("")
            lines.append(f"- **路径**: `{self.result.wal_file.path}`")
            lines.append(f"- **存在**: {'是' if self.result.wal_file.exists else '否'}")
            if self.result.wal_file.exists:
                lines.append(f"- **大小**: {self._human_size(self.result.wal_file.size)}")
                lines.append(f"- **SHA256**: `{self.result.wal_file.sha256}`")
                modified = self.result.wal_file.modified_at.strftime('%Y-%m-%d %H:%M:%S') if self.result.wal_file.modified_at else "N/A"
                lines.append(f"- **修改时间**: {modified}")
            lines.append("")

        if self.result.errors:
            lines.append("## 三、错误信息")
            lines.append("")
            for i, err in enumerate(self.result.errors, 1):
                lines.append(f"### {i}. {err['type'].replace('_', ' ').title()}")
                lines.append("")
                lines.append(f"- **消息**: {err['message']}")
                lines.append(f"- **位置**: `{err['location']}`")
                lines.append("")

        if self.result.warnings:
            lines.append("## 四、警告信息")
            lines.append("")
            for i, warn in enumerate(self.result.warnings, 1):
                lines.append(f"### {i}. {warn['type'].replace('_', ' ').title()}")
                lines.append("")
                lines.append(f"- **消息**: {warn['message']}")
                lines.append(f"- **位置**: `{warn['location']}`")
                lines.append("")

        lines.append("## 五、检查说明")
        lines.append("")
        lines.append("本工具执行以下检查:")
        lines.append("")
        lines.append("1. **文件头验证** - 确认文件是有效的SQLite格式")
        lines.append("2. **文件完整性** - 验证文件大小与页面计数匹配")
        lines.append("3. **SQLite完整性检查** - 使用 `PRAGMA integrity_check` 执行深度检查")
        lines.append("4. **WAL文件配对** - 检测并验证WAL文件是否存在")
        lines.append("")

        lines.append("## 六、建议")
        lines.append("")
        if self.result.is_valid:
            lines.append("- ✅ 备份文件完整可用，可以正常恢复")
            lines.append("- 建议保留此报告作为备份验证记录")
            if not self.result.wal_file:
                lines.append("- ⚠️  **注意**: 未检测到WAL文件。如果数据库备份时处于活跃状态，")
                lines.append("  最新事务可能只存在于WAL文件中。请确认备份策略！")
        else:
            if not self.result.wal_file:
                lines.append("- ⚠️ **重要**: 缺少WAL文件。SQLite在活跃时会将事务写入WAL文件，")
                lines.append("  恢复时必须同时提供 `.db` 和 `.db-wal` 文件才能保证数据完整。")
                lines.append("")
            if len(self.result.errors) > 0:
                lines.append("- ❌ 存在致命错误，数据库可能无法正常打开")
                lines.append("- 请尝试寻找其他备份版本")
                lines.append("- 可以尝试使用 `.dump` 命令恢复部分数据")
                lines.append("")
            lines.append("- 参考SQLite官方文档: https://www.sqlite.org/howtocorrupt.html")

        lines.append("")
        lines.append("---")
        lines.append("*此报告由 sqlite-backup-checker 工具自动生成*")

        return "\n".join(lines)

    def save_reports(self, output_dir: str, base_name: str = "backup_check") -> dict:
        out_dir = Path(output_dir)
        out_dir.mkdir(parents=True, exist_ok=True)

        files = {}

        terminal_path = out_dir / f"{base_name}_summary.txt"
        with open(terminal_path, "w", encoding="utf-8") as f:
            f.write(self.generate_terminal_summary())
        files["summary"] = str(terminal_path)

        json_path = out_dir / f"{base_name}_result.json"
        with open(json_path, "w", encoding="utf-8") as f:
            f.write(self.generate_machine_readable("json"))
        files["json"] = str(json_path)

        yaml_path = out_dir / f"{base_name}_result.yaml"
        with open(yaml_path, "w", encoding="utf-8") as f:
            f.write(self.generate_machine_readable("yaml"))
        files["yaml"] = str(yaml_path)

        md_path = out_dir / f"{base_name}_report.md"
        with open(md_path, "w", encoding="utf-8") as f:
            f.write(self.generate_human_report())
        files["markdown"] = str(md_path)

        return files

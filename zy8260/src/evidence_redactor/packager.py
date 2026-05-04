import csv
import json
import shutil
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from evidence_redactor.models import (
    CaseConfig,
    ManifestLoader,
    ParticipantsLoader,
    RedactRulesLoader,
    RoleType,
    VisibilityLevel,
)
from evidence_redactor.redactor import RedactorEngine


class Packager:
    def __init__(self, config: CaseConfig, verbose: bool = False):
        self.config = config
        self.verbose = verbose
        self.warnings: list[str] = []
        self.total_redactions = 0
        self.package_info: dict[str, Any] = {}
        self.redaction_mappings: dict[str, list[dict[str, Any]]] = {}

    def pack(self) -> dict[str, Any]:
        if self.verbose:
            print("开始打包流程...")

        self.config.output_path.mkdir(parents=True, exist_ok=True)

        manifest_loader = ManifestLoader(self.config.manifest_path)
        evidence_items = manifest_loader.get_evidence_items()

        participants_loader = ParticipantsLoader(self.config.participants_path)
        participants = participants_loader.get_participants()

        rules_loader = RedactRulesLoader(self.config.rules_path)
        rules = rules_loader.get_enabled_rules()

        duplicates = participants_loader.get_duplicate_names()
        if duplicates:
            for name, ids in duplicates.items():
                self.warnings.append(
                    f"[警告] 同名当事人: {name} (ID: {', '.join(ids)}) - 请确认是否为同一人"
                )

        unauthorized = participants_loader.get_unauthorized_witnesses()
        if unauthorized:
            self.warnings.append(
                f"[警告] 发现 {len(unauthorized)} 名未授权证人，其姓名将在原告/被告包中脱敏"
            )

        roles = [RoleType.PLAINTIFF, RoleType.DEFENDANT, RoleType.JUDGE]

        for role in roles:
            if self.verbose:
                print(f"\n处理 {self._role_name(role)} 包...")

            role_dir = self.config.output_path / f"{role.value}_package"
            role_dir.mkdir(parents=True, exist_ok=True)

            redactor = RedactorEngine(
                rules=rules,
                participants=participants,
                role=role,
                verbose=self.verbose,
            )

            file_count = 0
            for item in evidence_items:
                if self._is_visible_to_role(item.visibility, role):
                    src_path = self.config.evidence_dir / item.filename
                    dst_path = role_dir / item.filename

                    if src_path.exists():
                        if self._needs_redaction(src_path):
                            _, result = redactor.redact_file(src_path, dst_path)
                            if self.verbose:
                                print(f"  脱敏处理: {item.filename} ({result.get('replacements', 0)} 处替换)")
                        else:
                            shutil.copy2(src_path, dst_path)
                            if self.verbose:
                                print(f"  复制: {item.filename}")
                        file_count += 1
                    else:
                        self.warnings.append(f"[警告] 文件不存在，跳过: {item.filename}")

            mapping = redactor.get_redaction_mapping()
            self.redaction_mappings[role.value] = mapping
            stats = redactor.get_statistics()
            self.total_redactions += stats["total"]

            manifest_file = role_dir / "MANIFEST.txt"
            self._write_manifest(manifest_file, role, evidence_items, file_count, stats)

            zip_path = self._create_zip(role_dir, role)

            self.package_info[role.value] = {
                "path": str(zip_path),
                "file_count": file_count,
                "redactions": stats["total"],
            }

        self._save_redaction_mapping()

        return {
            "packages": self.package_info,
            "total_redactions": self.total_redactions,
            "warnings": self.warnings,
            "redaction_mappings": self.redaction_mappings,
        }

    def _role_name(self, role: RoleType) -> str:
        names = {
            RoleType.PLAINTIFF: "原告",
            RoleType.DEFENDANT: "被告",
            RoleType.JUDGE: "法官",
        }
        return names.get(role, role.value)

    def _is_visible_to_role(self, visibility: VisibilityLevel, role: RoleType) -> bool:
        if visibility == VisibilityLevel.ALL:
            return True
        if visibility == VisibilityLevel.JUDGE_ONLY and role == RoleType.JUDGE:
            return True
        if visibility == VisibilityLevel.PLAINTIFF_ONLY and role == RoleType.PLAINTIFF:
            return True
        if visibility == VisibilityLevel.DEFENDANT_ONLY and role == RoleType.DEFENDANT:
            return True
        return False

    def _needs_redaction(self, path: Path) -> bool:
        ext = path.suffix.lower()
        return ext in [".txt", ".csv", ".json"]

    def _write_manifest(
        self,
        path: Path,
        role: RoleType,
        evidence_items: list[Any],
        file_count: int,
        stats: dict[str, Any],
    ):
        lines = [
            "=" * 60,
            f"案件证据材料清单 - {self._role_name(role)}专用",
            "=" * 60,
            "",
            f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            f"文件总数: {file_count}",
            f"脱敏处理: {stats['total']} 处",
            "",
            "-" * 60,
            "文件列表:",
            "-" * 60,
        ]

        for item in evidence_items:
            if self._is_visible_to_role(item.visibility, role):
                lines.append(f"\n  [{item.id}] {item.filename}")
                lines.append(f"      类别: {item.category}")
                if item.description:
                    lines.append(f"      描述: {item.description}")

        lines.extend([
            "",
            "=" * 60,
            "脱敏统计:",
            "=" * 60,
        ])

        by_type = stats.get("by_type", {})
        type_names = {
            "id_card": "身份证号",
            "phone": "手机号",
            "address": "住址",
            "witness_name": "证人姓名",
            "role_name": "当事人姓名",
            "unknown": "其他",
        }

        for rule_type, count in by_type.items():
            lines.append(f"  - {type_names.get(rule_type, rule_type)}: {count} 处")

        with open(path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

    def _create_zip(self, source_dir: Path, role: RoleType) -> Path:
        timestamp = datetime.now().strftime("%Y%m%d")
        zip_name = f"{role.value}_package_{timestamp}.zip"
        zip_path = self.config.output_path / zip_name

        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for item in source_dir.rglob("*"):
                if item.is_file():
                    arcname = item.relative_to(source_dir)
                    zf.write(item, arcname)

        if self.verbose:
            print(f"  创建压缩包: {zip_name}")

        return zip_path

    def _save_redaction_mapping(self):
        mapping_path = self.config.output_path / "redaction_mapping.json"
        
        output = {
            "generated_at": datetime.now().isoformat(),
            "packages": {},
        }

        for role, mappings in self.redaction_mappings.items():
            output["packages"][role] = {
                "count": len(mappings),
                "mappings": mappings,
            }

        with open(mapping_path, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=2)

        if self.verbose:
            print(f"\n保存脱敏映射日志: {mapping_path}")

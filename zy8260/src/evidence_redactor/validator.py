import re
from pathlib import Path
from typing import Any

from evidence_redactor.models import (
    CaseConfig,
    EvidenceItem,
    Participant,
    ManifestLoader,
    ParticipantsLoader,
)


class Validator:
    def __init__(self, config: CaseConfig, verbose: bool = False):
        self.config = config
        self.verbose = verbose
        self.errors: list[str] = []
        self.warnings: list[str] = []
        self.passed_checks: int = 0

    def validate(self) -> dict[str, Any]:
        if self.verbose:
            print("开始执行验证检查...")

        self._validate_manifest_file()
        self._validate_evidence_directory()
        self._validate_participants_file()
        self._check_file_consistency()
        self._check_duplicate_names()
        self._check_cross_references()
        self._check_rule_coverage()

        return {
            "passed": self.passed_checks,
            "warnings": len(self.warnings),
            "errors": len(self.errors),
            "error_list": self.errors.copy(),
            "warning_list": self.warnings.copy(),
        }

    def _validate_manifest_file(self):
        if self.verbose:
            print(f"  检查案件清单: {self.config.manifest_path}")

        if not self.config.manifest_path.exists():
            self.errors.append(f"案件清单文件不存在: {self.config.manifest_path}")
            return

        try:
            loader = ManifestLoader(self.config.manifest_path)
            case_info = loader.get_case_info()
            evidence_items = loader.get_evidence_items()

            if not case_info:
                self.warnings.append("案件清单中缺少案件基本信息")
            else:
                if not case_info.get("case_id"):
                    self.warnings.append("案件清单中缺少案号 (case_id)")
                if not case_info.get("case_name"):
                    self.warnings.append("案件清单中缺少案件名称 (case_name)")

            if not evidence_items:
                self.warnings.append("案件清单中未列出任何证据文件")
            else:
                for item in evidence_items:
                    if not item.filename:
                        self.errors.append(f"证据项 {item.id} 缺少文件名")

            self.passed_checks += 1

        except Exception as e:
            self.errors.append(f"解析案件清单文件失败: {e}")

    def _validate_evidence_directory(self):
        if self.verbose:
            print(f"  检查证据目录: {self.config.evidence_dir}")

        if not self.config.evidence_dir.exists():
            self.errors.append(f"证据目录不存在: {self.config.evidence_dir}")
            return

        if not self.config.evidence_dir.is_dir():
            self.errors.append(f"证据路径不是目录: {self.config.evidence_dir}")
            return

        evidence_files = list(self.config.evidence_dir.glob("*"))
        if not evidence_files:
            self.warnings.append("证据目录为空")

        supported_types = {".txt", ".csv", ".json"}
        for f in evidence_files:
            if f.is_file():
                ext = f.suffix.lower()
                if ext not in supported_types:
                    self.warnings.append(f"发现不支持的文件类型: {f.name}")

        self.passed_checks += 1

    def _validate_participants_file(self):
        if not self.config.participants_path:
            if self.verbose:
                print("  未提供参与者文件，跳过检查")
            self.passed_checks += 1
            return

        if self.verbose:
            print(f"  检查参与者文件: {self.config.participants_path}")

        if not self.config.participants_path.exists():
            self.errors.append(f"参与者文件不存在: {self.config.participants_path}")
            return

        try:
            loader = ParticipantsLoader(self.config.participants_path)
            participants = loader.get_participants()

            if not participants:
                self.warnings.append("参与者文件中没有记录")
            else:
                for p in participants:
                    if not p.name:
                        self.errors.append(f"参与者 {p.id} 缺少姓名")
                    if not p.role:
                        self.warnings.append(f"参与者 {p.name} ({p.id}) 未指定角色")

            self.passed_checks += 1

        except Exception as e:
            self.errors.append(f"解析参与者文件失败: {e}")

    def _check_file_consistency(self):
        if self.verbose:
            print("  检查文件一致性...")

        if not self.config.manifest_path.exists() or not self.config.evidence_dir.exists():
            return

        try:
            manifest_loader = ManifestLoader(self.config.manifest_path)
            listed_files = set(manifest_loader.get_all_filenames())

            actual_files = set()
            for f in self.config.evidence_dir.iterdir():
                if f.is_file():
                    actual_files.add(f.name)

            missing_files = listed_files - actual_files
            extra_files = actual_files - listed_files

            if missing_files:
                for f in sorted(missing_files):
                    self.errors.append(f"清单中列出但文件不存在: {f}")

            if extra_files:
                for f in sorted(extra_files):
                    self.warnings.append(f"存在但未列入清单的文件: {f}")

            self.passed_checks += 1

        except Exception as e:
            self.errors.append(f"检查文件一致性失败: {e}")

    def _check_duplicate_names(self):
        if not self.config.participants_path:
            return

        if self.verbose:
            print("  检查同名当事人...")

        try:
            loader = ParticipantsLoader(self.config.participants_path)
            duplicates = loader.get_duplicate_names()

            if duplicates:
                for name, ids in duplicates.items():
                    self.warnings.append(
                        f"发现同名当事人: {name} (ID: {', '.join(ids)})"
                    )
                    self.warnings.append(
                        f"  建议: 请确认这些是否为同一人，如是请合并；如不是请补充区分标识"
                    )

            self.passed_checks += 1

        except Exception as e:
            self.errors.append(f"检查同名当事人失败: {e}")

    def _check_cross_references(self):
        if not self.config.participants_path:
            return

        if self.verbose:
            print("  检查交叉引用...")

        try:
            loader = ParticipantsLoader(self.config.participants_path)
            participants = loader.get_participants()

            participant_ids = {p.id for p in participants}

            for p in participants:
                if p.cross_references:
                    for ref in p.cross_references:
                        if ref not in participant_ids:
                            self.warnings.append(
                                f"参与者 {p.name} ({p.id}) 引用了不存在的参与者: {ref}"
                            )

            self.passed_checks += 1

        except Exception as e:
            self.errors.append(f"检查交叉引用失败: {e}")

    def _check_rule_coverage(self):
        if not self.config.rules_path or not self.config.participants_path:
            return

        if self.verbose:
            print("  检查规则覆盖...")

        try:
            from evidence_redactor.models import RedactRulesLoader

            rules_loader = RedactRulesLoader(self.config.rules_path)
            participants_loader = ParticipantsLoader(self.config.participants_path)

            participants = participants_loader.get_participants()
            missing_warnings = rules_loader.get_missing_rule_warnings(participants)

            for w in missing_warnings:
                self.warnings.append(w)

            unauthorized = participants_loader.get_unauthorized_witnesses()
            if unauthorized:
                self.warnings.append(
                    f"发现 {len(unauthorized)} 名未授权证人，其姓名将在非法官包中脱敏"
                )

            self.passed_checks += 1

        except ImportError:
            self.warnings.append("无法导入规则检查模块，跳过规则覆盖检查")
        except Exception as e:
            self.errors.append(f"检查规则覆盖失败: {e}")

from __future__ import annotations
import json
import uuid
from copy import deepcopy
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .engine import PriceEngine
from .models import (
    Conflict,
    ConflictSeverity,
    DirtyRecord,
    HistoryRecord,
    PriceRule,
    RuleStatus,
    RuleVersion,
    SampleOrder,
    ValidationResult,
)
from .storage import FileStorage


class RuleManager:
    def __init__(self, storage: Optional[FileStorage] = None):
        self.storage = storage or FileStorage()
        self.engine = PriceEngine()

    def import_rules(
        self,
        file_path: Path,
        actor: Optional[str] = None,
        auto_validate: bool = True,
        strict: bool = True,
    ) -> Tuple[int, int, List[str], List[str]]:
        rules_data = self._load_json_file(file_path)
        if not isinstance(rules_data, list):
            raise ValueError("导入文件根节点必须是规则数组")
        success_count = 0
        skip_count = 0
        messages: List[str] = []
        dirty_records: List[DirtyRecord] = []
        for idx, raw in enumerate(rules_data):
            try:
                rule = self._parse_rule(raw)
                existing = self.storage.load_rule(rule.id)
                if existing:
                    rule.version = existing.version + 1
                else:
                    rule.version = 1
                rule.updated_at = datetime.now()
                self.storage.save_rule(rule)
                self._snapshot_version(rule, "update" if existing else "create", actor)
                if existing:
                    messages.append(f"更新规则: {rule.id} - {rule.name} (v{rule.version})")
                else:
                    messages.append(f"新增规则: {rule.id} - {rule.name} (v{rule.version})")
                success_count += 1
                self._record_history("rule_import", {
                    "rule_id": rule.id,
                    "rule_name": rule.name,
                    "action": "update" if existing else "create",
                    "version": rule.version,
                }, actor=actor)
            except Exception as e:
                skip_count += 1
                dirty = DirtyRecord(
                    id=str(uuid.uuid4()),
                    source=str(file_path),
                    raw_data=json.dumps(raw, ensure_ascii=False),
                    error=str(e),
                    timestamp=datetime.now(),
                    retries=0,
                )
                dirty_records.append(dirty)
                self.storage.save_dirty(dirty)
                messages.append(f"跳过第 {idx + 1} 条: {e}")
        if dirty_records:
            messages.append(f"共有 {len(dirty_records)} 条脏数据已保存到脏数据池，可通过 retry-dirty 重试处理")
        if auto_validate and success_count > 0:
            vr = self.validate_pending()
            if not vr.success:
                messages.append("验证发现问题：")
                for err in vr.errors:
                    messages.append(f"  错误: {err}")
                for w in vr.warnings:
                    messages.append(f"  警告: {w}")
        return success_count, skip_count, messages, [d.id for d in dirty_records]

    def import_samples(self, file_path: Path, actor: Optional[str] = None) -> Tuple[int, List[str]]:
        samples_data = self._load_json_file(file_path)
        if not isinstance(samples_data, list):
            raise ValueError("导入文件根节点必须是样例数组")
        count = 0
        messages: List[str] = []
        for idx, raw in enumerate(samples_data):
            try:
                sample = SampleOrder(**raw)
                self.storage.save_sample(sample)
                count += 1
                messages.append(f"导入样例: {sample.id} - {sample.name}")
                self._record_history("sample_import", {
                    "sample_id": sample.id,
                    "sample_name": sample.name,
                }, actor=actor)
            except Exception as e:
                messages.append(f"跳过第 {idx + 1} 条样例: {e}")
        return count, messages

    def list_rules(self, include_inactive: bool = False) -> List[PriceRule]:
        return self.storage.load_all_rules(include_inactive=include_inactive)

    def get_rule(self, rule_id: str) -> Optional[PriceRule]:
        return self.storage.load_rule(rule_id)

    def list_samples(self) -> List[SampleOrder]:
        return self.storage.load_all_samples()

    def get_sample(self, sample_id: str) -> Optional[SampleOrder]:
        return self.storage.load_sample(sample_id)

    def detect_conflicts(self) -> List[Conflict]:
        rules = self.storage.load_all_rules()
        return self.engine.detect_conflicts(rules)

    def validate_pending(
        self,
        fail_on_critical: bool = True,
        fail_on_sample: bool = True,
    ) -> ValidationResult:
        rules = self.storage.load_all_rules()
        samples = self.storage.load_all_samples()
        pending_rules = [r for r in rules if r.status == RuleStatus.PENDING]
        existing = [r for r in rules if r.status != RuleStatus.PENDING]
        return self.engine.validate_changes(
            new_or_updated_rules=pending_rules,
            existing_rules=existing,
            samples=samples,
            fail_on_critical=fail_on_critical,
            fail_on_sample_failure=fail_on_sample,
        )

    def approve_rules(self, rule_ids: List[str], actor: Optional[str] = None) -> Tuple[List[str], List[str]]:
        messages: List[str] = []
        approved: List[str] = []
        for rid in rule_ids:
            rule = self.storage.load_rule(rid)
            if not rule:
                messages.append(f"规则不存在: {rid}")
                continue
            if rule.status == RuleStatus.APPROVED:
                messages.append(f"规则已审批通过: {rule.name}")
                approved.append(rid)
                continue
            existing = self.storage.load_all_rules()
            other_rules = [r for r in existing if r.id != rid]
            vr = self.engine.validate_changes(
                new_or_updated_rules=[rule],
                existing_rules=other_rules,
                samples=self.storage.load_all_samples(),
            )
            if not vr.success:
                messages.append(f"规则 {rule.name} 验证失败，无法审批:")
                for err in vr.errors:
                    messages.append(f"  - {err}")
                continue
            self._snapshot_version(rule, "approve", actor)
            rule.status = RuleStatus.APPROVED
            rule.updated_at = datetime.now()
            self.storage.save_rule(rule)
            approved.append(rid)
            messages.append(f"已审批通过: {rule.name}")
            self._record_history("rule_approve", {
                "rule_id": rule.id,
                "rule_name": rule.name,
                "version": rule.version,
            }, actor=actor)
        return approved, messages

    def publish_rules(self, rule_ids: List[str], actor: Optional[str] = None) -> Tuple[List[str], List[str]]:
        messages: List[str] = []
        published: List[str] = []
        for rid in rule_ids:
            rule = self.storage.load_rule(rid)
            if not rule:
                messages.append(f"规则不存在: {rid}")
                continue
            if rule.status == RuleStatus.ACTIVE:
                messages.append(f"规则已发布: {rule.name}")
                published.append(rid)
                continue
            if rule.status not in {RuleStatus.APPROVED, RuleStatus.ACTIVE}:
                messages.append(f"规则 {rule.name} 状态为 {rule.status.value}，需先审批通过")
                continue
            self._snapshot_version(rule, "publish", actor)
            rule.status = RuleStatus.ACTIVE
            rule.updated_at = datetime.now()
            self.storage.save_rule(rule)
            published.append(rid)
            messages.append(f"已发布: {rule.name}")
            self._record_history("rule_publish", {
                "rule_id": rule.id,
                "rule_name": rule.name,
                "version": rule.version,
            }, actor=actor)
        return published, messages

    def rollback_rule(self, rule_id: str, target_version: Optional[int] = None, actor: Optional[str] = None) -> Tuple[bool, str]:
        versions = self.storage.list_versions(rule_id)
        if not versions:
            return False, f"规则 {rule_id} 没有历史版本"
        current = self.storage.load_rule(rule_id)
        if not current:
            return False, f"规则 {rule_id} 不存在"
        if target_version is None:
            if len(versions) < 2:
                return False, f"规则 {rule_id} 只有一个版本，无法回滚"
            target_version = versions[1]
        if target_version not in versions:
            return False, f"目标版本 v{target_version} 不存在"
        version_snapshot = self.storage.load_version(rule_id, target_version)
        if not version_snapshot:
            return False, f"无法加载版本 v{target_version}"
        self._snapshot_version(current, "rollback", actor)
        restored = deepcopy(version_snapshot.data)
        restored.status = RuleStatus.REVERTED if current.status == RuleStatus.ACTIVE else current.status
        restored.version = current.version + 1
        restored.updated_at = datetime.now()
        self.storage.save_rule(restored)
        self._record_history("rule_rollback", {
            "rule_id": rule_id,
            "rule_name": restored.name,
            "from_version": current.version,
            "to_version": target_version,
            "new_version": restored.version,
        }, actor=actor)
        return True, f"已回滚到版本 v{target_version}，新版本号 v{restored.version}"

    def list_versions(self, rule_id: str) -> List[int]:
        return self.storage.list_versions(rule_id)

    def playback_samples(self, sample_ids: Optional[List[str]] = None) -> Tuple[int, int, List[Dict[str, Any]]]:
        rules = self.storage.load_all_rules()
        all_samples = self.storage.load_all_samples()
        if sample_ids:
            samples = [s for s in all_samples if s.id in sample_ids]
        else:
            samples = all_samples
        passed = 0
        failed = 0
        results: List[Dict[str, Any]] = []
        for sample in samples:
            pr = self.engine.calculate_sample(sample, rules)
            results.append(pr.model_dump())
            if pr.passed:
                passed += 1
            else:
                failed += 1
        return passed, failed, results

    def retry_dirty(self, dirty_ids: Optional[List[str]] = None, actor: Optional[str] = None) -> Tuple[int, int, List[str]]:
        all_dirty = self.storage.load_all_dirty()
        if dirty_ids:
            to_retry = [d for d in all_dirty if d.id in dirty_ids]
        else:
            to_retry = all_dirty
        success_count = 0
        remain_count = 0
        messages: List[str] = []
        for dirty in to_retry:
            try:
                raw = json.loads(dirty.raw_data)
                rule = self._parse_rule(raw)
                existing = self.storage.load_rule(rule.id)
                if existing:
                    rule.version = existing.version + 1
                rule.updated_at = datetime.now()
                self.storage.save_rule(rule)
                self.storage.delete_dirty(dirty.id)
                success_count += 1
                messages.append(f"重试成功: {rule.id} - {rule.name}")
                self._record_history("dirty_retry", {
                    "dirty_id": dirty.id,
                    "rule_id": rule.id,
                    "retries_before": dirty.retries,
                }, actor=actor)
            except Exception as e:
                remain_count += 1
                dirty.retries += 1
                dirty.error = str(e)
                dirty.timestamp = datetime.now()
                self.storage.save_dirty(dirty)
                messages.append(f"重试失败 [{dirty.retries}次]: {e}")
        return success_count, remain_count, messages

    def export_report(self, validation_result: ValidationResult, format: str = "json") -> str:
        if format == "json":
            return json.dumps(validation_result.model_dump(), ensure_ascii=False, indent=2, default=str)
        if format == "markdown":
            return self._render_markdown_report(validation_result)
        raise ValueError(f"不支持的报告格式: {format}")

    def _render_markdown_report(self, vr: ValidationResult) -> str:
        lines = []
        lines.append("# 价格规则发布门禁报告")
        lines.append("")
        status = "✅ 通过" if vr.success else "❌ 未通过"
        lines.append(f"**状态**: {status}")
        lines.append("")
        if vr.errors:
            lines.append("## 错误")
            for err in vr.errors:
                lines.append(f"- ❌ {err}")
            lines.append("")
        if vr.warnings:
            lines.append("## 警告")
            for w in vr.warnings:
                lines.append(f"- ⚠️ {w}")
            lines.append("")
        if vr.conflicts:
            lines.append("## 冲突检测")
            for c in vr.conflicts:
                sev_icon = {
                    ConflictSeverity.LOW: "🔵",
                    ConflictSeverity.MEDIUM: "🟡",
                    ConflictSeverity.HIGH: "🟠",
                    ConflictSeverity.CRITICAL: "🔴",
                }.get(c.severity, "⚪")
                lines.append(f"### {sev_icon} {c.id} [{c.severity.value.upper()}]")
                lines.append(f"- 规则: {', '.join(c.rule_ids)}")
                lines.append(f"- 影响 SKU: {', '.join(c.affected_skus)[:100]}")
                lines.append(f"- 描述: {c.description}")
                if c.suggestion:
                    lines.append(f"- 建议: {c.suggestion}")
                lines.append("")
        if vr.sample_results:
            lines.append("## 样例回放")
            total = len(vr.sample_results)
            passed = sum(1 for r in vr.sample_results if r.get("passed"))
            lines.append(f"通过: {passed}/{total}")
            lines.append("")
            for r in vr.sample_results:
                icon = "✅" if r.get("passed") else "❌"
                lines.append(f"- {icon} {r.get('sample_id')}: 预期 {r.get('expected'):.2f} / 实际 {r.get('actual'):.2f}")
                if r.get("message"):
                    lines.append(f"  - {r.get('message')}")
            lines.append("")
        return "\n".join(lines)

    def list_dirty(self) -> List[DirtyRecord]:
        return self.storage.load_all_dirty()

    def list_history(self, limit: int = 100) -> List[HistoryRecord]:
        return self.storage.load_history(limit=limit)

    def _load_json_file(self, path: Path) -> Any:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    def _parse_rule(self, raw: Dict[str, Any]) -> PriceRule:
        return PriceRule(**raw)

    def _snapshot_version(self, rule: PriceRule, action: str, actor: Optional[str]) -> None:
        version = RuleVersion(
            rule_id=rule.id,
            version=rule.version,
            data=deepcopy(rule),
            snapshot_at=datetime.now(),
            action=action,
            actor=actor,
        )
        self.storage.save_version(version)

    def _record_history(self, type_: str, details: Dict[str, Any], actor: Optional[str] = None) -> None:
        record = HistoryRecord(
            id=str(uuid.uuid4()),
            type=type_,
            timestamp=datetime.now(),
            details=details,
        )
        if actor:
            record.details["actor"] = actor
        self.storage.save_history(record)

    def backup(self, name: Optional[str] = None) -> Path:
        return self.storage.backup(name)

    def restore(self, backup_path: Path) -> None:
        self.storage.restore(backup_path)

    def reset(self) -> None:
        self.storage.reset()

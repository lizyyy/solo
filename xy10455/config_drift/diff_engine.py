from typing import Any, List

from .config_loader import _is_sensitive_key, flatten_config
from .models import ConfigDiff, DiffType, RiskLevel


class DiffEngine:
    def __init__(self, default_config: dict, sensitive_keys: List[str] = None):
        self.default_config = default_config
        self.flat_default = flatten_config(default_config)
        self.sensitive_keys = sensitive_keys or []

    def detect_diffs(self, tenant_config: dict, source_files: dict = None) -> List[ConfigDiff]:
        flat_tenant = flatten_config(tenant_config)
        source_files = source_files or {}
        diffs: List[ConfigDiff] = []

        all_keys = set(self.flat_default.keys()) | set(flat_tenant.keys())

        for key in all_keys:
            in_default = key in self.flat_default
            in_tenant = key in flat_tenant

            if in_default and not in_tenant:
                diffs.append(self._create_diff(
                    key=key,
                    diff_type=DiffType.REMOVED,
                    default_val=self.flat_default[key],
                    tenant_val=None,
                    source_file=source_files.get(key),
                ))
            elif not in_default and in_tenant:
                diffs.append(self._create_diff(
                    key=key,
                    diff_type=DiffType.ADDED,
                    default_val=None,
                    tenant_val=flat_tenant[key],
                    source_file=source_files.get(key),
                ))
            else:
                default_val = self.flat_default[key]
                tenant_val = flat_tenant[key]

                default_type = type(default_val).__name__
                tenant_type = type(tenant_val).__name__

                if default_type != tenant_type:
                    diffs.append(self._create_diff(
                        key=key,
                        diff_type=DiffType.TYPE_CHANGED,
                        default_val=default_val,
                        tenant_val=tenant_val,
                        default_type=default_type,
                        tenant_type=tenant_type,
                        source_file=source_files.get(key),
                    ))
                elif default_val != tenant_val:
                    is_sensitive = _is_sensitive_key(key) or any(sk in key.lower() for sk in self.sensitive_keys)

                    if is_sensitive:
                        diffs.append(self._create_diff(
                            key=key,
                            diff_type=DiffType.SENSITIVE_SWITCH,
                            default_val=default_val,
                            tenant_val=tenant_val,
                            is_sensitive=True,
                            source_file=source_files.get(key),
                        ))
                    else:
                        diffs.append(self._create_diff(
                            key=key,
                            diff_type=DiffType.VALUE_CHANGED,
                            default_val=default_val,
                            tenant_val=tenant_val,
                            source_file=source_files.get(key),
                        ))

        return diffs

    def _create_diff(
        self,
        key: str,
        diff_type: DiffType,
        default_val: Any,
        tenant_val: Any,
        default_type: str = None,
        tenant_type: str = None,
        is_sensitive: bool = False,
        source_file: str = None,
    ) -> ConfigDiff:
        description = self._get_description(diff_type, key, default_val, tenant_val, default_type, tenant_type)
        risk_level = self._assess_risk(diff_type, key, is_sensitive)
        is_sensitive = is_sensitive or _is_sensitive_key(key)

        return ConfigDiff(
            key=key,
            diff_type=diff_type,
            default_value=default_val,
            tenant_value=tenant_val,
            default_type=default_type,
            tenant_type=tenant_type,
            is_sensitive=is_sensitive,
            description=description,
            risk_level=risk_level,
            source_file=source_file,
        )

    def _get_description(
        self,
        diff_type: DiffType,
        key: str,
        default_val: Any,
        tenant_val: Any,
        default_type: str,
        tenant_type: str,
    ) -> str:
        if diff_type == DiffType.ADDED:
            return f"新增配置项: {key} = {tenant_val}"
        elif diff_type == DiffType.REMOVED:
            return f"删除配置项: {key} (默认值: {default_val})"
        elif diff_type == DiffType.TYPE_CHANGED:
            return f"类型变化: {key} 从 {default_type}({default_val}) 变为 {tenant_type}({tenant_val})"
        elif diff_type == DiffType.SENSITIVE_SWITCH:
            return f"敏感开关偏离: {key} 从 {default_val} 变为 {tenant_val}"
        elif diff_type == DiffType.EXPIRED_OVERRIDE:
            return f"过期覆盖: {key} 从 {default_val} 变为 {tenant_val}"
        else:
            return f"值变化: {key} 从 {default_val} 变为 {tenant_val}"

    def _assess_risk(self, diff_type: DiffType, key: str, is_sensitive: bool) -> RiskLevel:
        if is_sensitive or diff_type == DiffType.SENSITIVE_SWITCH:
            return RiskLevel.HIGH
        elif diff_type == DiffType.TYPE_CHANGED:
            return RiskLevel.HIGH
        elif diff_type == DiffType.EXPIRED_OVERRIDE:
            return RiskLevel.HIGH
        elif diff_type == DiffType.REMOVED:
            return RiskLevel.MEDIUM
        elif diff_type == DiffType.ADDED:
            return RiskLevel.LOW
        else:
            return RiskLevel.MEDIUM

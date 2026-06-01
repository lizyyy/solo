"""参数管理模块 - 支持版本控制和人工调优保留"""
import json
import uuid
from datetime import datetime
from typing import Any, Dict, Optional
from copy import deepcopy

from .config import DEFAULT_PARAMS, PARAMS_DIR
from .database import get_db, PARAMS_TABLE, PARAM_VERSIONS_TABLE


class ParameterManager:
    """参数管理器 - 确保人工调优的参数不被默认值覆盖"""

    def __init__(self):
        self.db = get_db()
        self._ensure_default_params()

    def _ensure_default_params(self):
        """确保默认参数已初始化，且不覆盖已人工设置的参数"""
        cursor = self.db.conn.cursor()
        for key, value in self._flatten_dict(DEFAULT_PARAMS).items():
            cursor.execute(
                f"SELECT param_key, is_overridden FROM {PARAMS_TABLE} WHERE param_key = ?",
                (key,)
            )
            row = cursor.fetchone()
            if row is None:
                cursor.execute(
                    f"INSERT INTO {PARAMS_TABLE} VALUES (?, ?, ?, ?, ?, ?)",
                    (
                        str(uuid.uuid4()),
                        key,
                        json.dumps(value, ensure_ascii=False),
                        0,
                        datetime.now().isoformat(),
                        datetime.now().isoformat()
                    )
                )
                self._record_version(key, None, value, "初始化默认参数")
            elif not row['is_overridden']:
                pass
        self.db.conn.commit()

    def _flatten_dict(self, d: Dict, parent_key: str = '', sep: str = '.') -> Dict[str, Any]:
        """将嵌套字典扁平化为点分隔的键"""
        items = {}
        for k, v in d.items():
            new_key = f"{parent_key}{sep}{k}" if parent_key else k
            if isinstance(v, dict):
                items.update(self._flatten_dict(v, new_key, sep=sep))
            else:
                items[new_key] = v
        return items

    def _unflatten_dict(self, flat_dict: Dict[str, Any], sep: str = '.') -> Dict[str, Any]:
        """将扁平字典还原为嵌套字典"""
        result = {}
        for key, value in flat_dict.items():
            parts = key.split(sep)
            current = result
            for part in parts[:-1]:
                if part not in current:
                    current[part] = {}
                current = current[part]
            current[parts[-1]] = value
        return result

    def _record_version(self, param_key: str, old_value: Any, new_value: Any,
                        reason: str, operator: str = "system"):
        """记录参数版本变更"""
        cursor = self.db.conn.cursor()
        cursor.execute(
            f"SELECT MAX(version) as max_v FROM {PARAM_VERSIONS_TABLE} WHERE param_key = ?",
            (param_key,)
        )
        row = cursor.fetchone()
        next_version = (row['max_v'] or 0) + 1
        cursor.execute(
            f"INSERT INTO {PARAM_VERSIONS_TABLE} VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                str(uuid.uuid4()),
                param_key,
                json.dumps(old_value, ensure_ascii=False) if old_value is not None else None,
                json.dumps(new_value, ensure_ascii=False),
                reason,
                operator,
                datetime.now().isoformat(),
                next_version
            )
        )

    def get_param(self, key: str) -> Any:
        """获取单个参数值"""
        cursor = self.db.conn.cursor()
        cursor.execute(
            f"SELECT param_value, is_overridden FROM {PARAMS_TABLE} WHERE param_key = ?",
            (key,)
        )
        row = cursor.fetchone()
        if row:
            value = json.loads(row['param_value'])
            return value
        raise KeyError(f"参数不存在: {key}")

    def get_all_params(self) -> Dict[str, Any]:
        """获取所有参数（嵌套结构）"""
        cursor = self.db.conn.cursor()
        cursor.execute(f"SELECT param_key, param_value, is_overridden FROM {PARAMS_TABLE}")
        rows = cursor.fetchall()
        flat = {}
        for row in rows:
            flat[row['param_key']] = json.loads(row['param_value'])
        return self._unflatten_dict(flat)

    def get_effective_weights(self) -> Dict[str, float]:
        """获取计算使用的权重参数"""
        params = self.get_all_params()
        return params.get('weights', DEFAULT_PARAMS['weights'])

    def get_thresholds(self) -> Dict[str, float]:
        """获取阈值参数"""
        params = self.get_all_params()
        return params.get('thresholds', DEFAULT_PARAMS['thresholds'])

    def set_param(self, key: str, value: Any, reason: str = "人工调优",
                  operator: str = "周姐") -> Dict[str, Any]:
        """设置参数（会标记为已覆盖，不被默认值冲掉）"""
        cursor = self.db.conn.cursor()
        cursor.execute(
            f"SELECT param_value FROM {PARAMS_TABLE} WHERE param_key = ?",
            (key,)
        )
        row = cursor.fetchone()
        old_value = json.loads(row['param_value']) if row else None
        with self.db.transaction():
            if row:
                cursor.execute(
                    f"UPDATE {PARAMS_TABLE} SET param_value = ?, is_overridden = 1, updated_at = ? WHERE param_key = ?",
                    (
                        json.dumps(value, ensure_ascii=False),
                        datetime.now().isoformat(),
                        key
                    )
                )
            else:
                cursor.execute(
                    f"INSERT INTO {PARAMS_TABLE} VALUES (?, ?, ?, 1, ?, ?)",
                    (
                        str(uuid.uuid4()),
                        key,
                        json.dumps(value, ensure_ascii=False),
                        datetime.now().isoformat(),
                        datetime.now().isoformat()
                    )
                )
            self._record_version(key, old_value, value, reason, operator)
        self.db.log_audit(
            "set_param",
            {"key": key, "old_value": old_value, "new_value": value, "reason": reason},
            operator=operator
        )
        return {"key": key, "old_value": old_value, "new_value": value, "reason": reason}

    def set_params_batch(self, updates: Dict[str, Any], reason: str = "人工调优",
                         operator: str = "周姐") -> list:
        """批量设置参数"""
        results = []
        for key, value in updates.items():
            results.append(self.set_param(key, value, reason, operator))
        return results

    def get_param_history(self, key: str) -> list:
        """获取参数的历史版本"""
        cursor = self.db.conn.cursor()
        cursor.execute(
            f"SELECT * FROM {PARAM_VERSIONS_TABLE} WHERE param_key = ? ORDER BY version DESC",
            (key,)
        )
        rows = cursor.fetchall()
        history = []
        for row in rows:
            history.append({
                "version": row['version'],
                "param_key": row['param_key'],
                "old_value": json.loads(row['old_value']) if row['old_value'] else None,
                "new_value": json.loads(row['new_value']),
                "reason": row['reason'],
                "operator": row['operator'],
                "created_at": row['created_at']
            })
        return history

    def get_param_version(self, key: str, version: int) -> Any:
        """获取指定版本的参数值"""
        cursor = self.db.conn.cursor()
        cursor.execute(
            f"SELECT new_value FROM {PARAM_VERSIONS_TABLE} WHERE param_key = ? AND version = ?",
            (key, version)
        )
        row = cursor.fetchone()
        if row:
            return json.loads(row['new_value'])
        return None

    def get_current_version_tag(self) -> str:
        """获取当前参数的版本标签（用于计算追溯）"""
        cursor = self.db.conn.cursor()
        cursor.execute(
            f"SELECT param_key, updated_at FROM {PARAMS_TABLE} WHERE is_overridden = 1 ORDER BY updated_at DESC LIMIT 1"
        )
        row = cursor.fetchone()
        if row:
            return f"custom_{row['updated_at'].replace(':', '-').replace('.', '_')}"
        return "default_v1"

    def export_params(self, file_path: Optional[str] = None) -> str:
        """导出当前参数到文件"""
        params = self.get_all_params()
        if file_path is None:
            file_path = str(PARAMS_DIR / f"params_{self.get_current_version_tag()}.json")
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(params, f, ensure_ascii=False, indent=2)
        return file_path

    def compare_with_defaults(self) -> Dict[str, Dict]:
        """对比当前参数与默认值的差异"""
        current = self.get_all_params()
        default = deepcopy(DEFAULT_PARAMS)
        diffs = {}
        self._compare_dict(current, default, diffs)
        return diffs

    def _compare_dict(self, current: Dict, default: Dict, diffs: Dict, prefix: str = ''):
        """递归对比字典差异"""
        for k in set(list(current.keys()) + list(default.keys())):
            key_path = f"{prefix}.{k}" if prefix else k
            if k not in current:
                diffs[key_path] = {"status": "missing", "default": default[k], "current": None}
            elif k not in default:
                diffs[key_path] = {"status": "extra", "default": None, "current": current[k]}
            elif isinstance(current[k], dict) and isinstance(default[k], dict):
                self._compare_dict(current[k], default[k], diffs, key_path)
            elif current[k] != default[k]:
                diffs[key_path] = {"status": "modified", "default": default[k], "current": current[k]}

    def reset_to_default(self, key: Optional[str] = None, operator: str = "system"):
        """重置参数为默认值"""
        flat_defaults = self._flatten_dict(DEFAULT_PARAMS)
        if key:
            if key in flat_defaults:
                self.set_param(key, flat_defaults[key], "重置为默认值", operator)
        else:
            for k, v in flat_defaults.items():
                cursor = self.db.conn.cursor()
                cursor.execute(
                    f"SELECT is_overridden FROM {PARAMS_TABLE} WHERE param_key = ?",
                    (k,)
                )
                row = cursor.fetchone()
                if row and row['is_overridden']:
                    self.set_param(k, v, "重置为默认值", operator)

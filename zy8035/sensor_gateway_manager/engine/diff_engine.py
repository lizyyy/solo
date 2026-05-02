import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from ..adapters.serial_adapter import (
    MockSerialAdapter, DeviceOfflineError, ReadOnlyRegisterError, TypeMismatchError
)


@dataclass
class WriteResult:
    success: List[int] = field(default_factory=list)
    failed: List[Dict[str, Any]] = field(default_factory=list)
    skipped: List[Dict[str, Any]] = field(default_factory=list)


class DiffEngine:
    DIFF_MATCH = 'match'
    DIFF_MISMATCH = 'mismatch'
    DIFF_MISSING = 'missing'
    DIFF_READONLY = 'readonly'
    DIFF_TYPE_ERR = 'type_error'

    def __init__(self, adapter: MockSerialAdapter):
        self.adapter = adapter

    def take_snapshot(self) -> Dict[str, Any]:
        return self.adapter.get_snapshot()

    def compute_diff(self, snapshot: Dict[str, Any], target_config: Dict[str, Any]) -> List[Dict[str, Any]]:
        diff_results = []
        snapshot_regs = {r['address']: r for r in snapshot.get('registers', [])}
        target_regs = {r['address']: r for r in target_config.get('registers', [])}

        all_addrs = sorted(set(snapshot_regs.keys()) | set(target_regs.keys()))

        for addr in all_addrs:
            snap_reg = snapshot_regs.get(addr)
            tgt_reg = target_regs.get(addr)

            if snap_reg is None and tgt_reg is not None:
                diff_results.append({
                    "address": addr,
                    "name": tgt_reg['name'],
                    "diff_type": self.DIFF_MISSING,
                    "current_value": None,
                    "target_value": tgt_reg['value'],
                    "target_type": tgt_reg['type'],
                    "target_readonly": tgt_reg.get('readonly', False),
                    "writable": not tgt_reg.get('readonly', False)
                })
            elif tgt_reg is None and snap_reg is not None:
                diff_results.append({
                    "address": addr,
                    "name": snap_reg['name'],
                    "diff_type": self.DIFF_MISMATCH,
                    "current_value": snap_reg['value'],
                    "target_value": None,
                    "current_type": snap_reg['type'],
                    "writable": not snap_reg.get('readonly', False)
                })
            elif snap_reg and tgt_reg:
                current_val = snap_reg['value']
                target_val = tgt_reg['value']
                current_type = snap_reg['type']
                target_type = tgt_reg['type']

                if current_val == target_val:
                    diff_results.append({
                        "address": addr,
                        "name": snap_reg['name'],
                        "diff_type": self.DIFF_MATCH,
                        "current_value": current_val,
                        "target_value": target_val,
                        "writable": not snap_reg.get('readonly', False)
                    })
                else:
                    if current_type != target_type:
                        diff_results.append({
                            "address": addr,
                            "name": snap_reg['name'],
                            "diff_type": self.DIFF_TYPE_ERR,
                            "current_value": current_val,
                            "target_value": target_val,
                            "current_type": current_type,
                            "target_type": target_type,
                            "writable": False
                        })
                    elif snap_reg.get('readonly', False):
                        diff_results.append({
                            "address": addr,
                            "name": snap_reg['name'],
                            "diff_type": self.DIFF_READONLY,
                            "current_value": current_val,
                            "target_value": target_val,
                            "writable": False
                        })
                    else:
                        diff_results.append({
                            "address": addr,
                            "name": snap_reg['name'],
                            "diff_type": self.DIFF_MISMATCH,
                            "current_value": current_val,
                            "target_value": target_val,
                            "writable": True
                        })

        return diff_results

    def selective_write(self, diff_list: List[Dict[str, Any]], selected_addrs: List[int],
                        retry: int = 3, backoff: float = 0.5) -> WriteResult:
        writes = []
        for d in diff_list:
            if d['address'] in selected_addrs and d.get('writable', False) and d.get('diff_type') == self.DIFF_MISMATCH:
                writes.append({'address': d['address'], 'value': d['target_value']})

        if not writes:
            return WriteResult()

        result = self.adapter.batch_write(writes, retry=retry, backoff=backoff)
        return WriteResult(
            success=result.get('success', []),
            failed=result.get('failed', []),
            skipped=result.get('skipped', [])
        )

    def rollback(self, snapshot: Dict[str, Any]):
        self.adapter.restore_snapshot(snapshot)
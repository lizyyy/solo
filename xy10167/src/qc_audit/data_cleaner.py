from datetime import datetime
from typing import Dict, List, Any, Optional
import re

from .models import Batch, Sample, RecheckRecord, SamplingRule


class DataCleaner:
    def __init__(self):
        self.warnings: List[Dict] = []

    def _warn(self, level: str, code: str, message: str, context: Dict = None):
        self.warnings.append({
            "timestamp": datetime.now().isoformat(),
            "level": level,
            "code": code,
            "message": message,
            "context": context or {},
        })

    def parse_bool(self, value: Any, field_name: str, context: Dict = None) -> Optional[bool]:
        if value is None:
            self._warn("error", "null_value", f"{field_name} 为空", context)
            return None
        
        if isinstance(value, bool):
            return value
        
        s = str(value).strip().lower()
        if s in {"false", "no", "n", "0", "否", "不合格", "fail", "f"}:
            return True
        if s in {"true", "yes", "y", "1", "是", "合格", "pass", "p"}:
            return False
        
        self._warn("error", "invalid_bool", f"{field_name} '{value}' 无法解析为布尔值", context)
        return None

    def _get_first_non_none(self, raw: Dict, *keys: str) -> Any:
        for key in keys:
            if key in raw and raw[key] is not None:
                return raw[key]
        return None

    def parse_int(self, value: Any, field_name: str, min_val: int = 0,
                  context: Dict = None) -> Optional[int]:
        if value is None:
            self._warn("error", "null_value", f"{field_name} 为空", context)
            return None
        
        if isinstance(value, int):
            if value < min_val:
                self._warn("warning", "value_out_of_range", 
                          f"{field_name} {value} 小于最小值 {min_val}", context)
            return value
        
        try:
            result = int(float(value))
            if result < min_val:
                self._warn("warning", "value_out_of_range",
                          f"{field_name} {result} 小于最小值 {min_val}", context)
            return result
        except (ValueError, TypeError):
            self._warn("error", "invalid_int", f"{field_name} '{value}' 无法解析为整数", context)
            return None

    def parse_float(self, value: Any, field_name: str,
                    context: Dict = None) -> Optional[float]:
        if value is None:
            self._warn("error", "null_value", f"{field_name} 为空", context)
            return None
        
        if isinstance(value, float):
            return value
        
        s = str(value).strip()
        if s.endswith('%'):
            try:
                return float(s[:-1]) / 100.0
            except ValueError:
                pass
        
        try:
            return float(s)
        except (ValueError, TypeError):
            self._warn("error", "invalid_float", f"{field_name} '{value}' 无法解析为浮点数", context)
            return None

    def parse_datetime(self, value: Any, field_name: str,
                       context: Dict = None) -> Optional[datetime]:
        if value is None:
            self._warn("warning", "null_value", f"{field_name} 为空，将使用默认值", context)
            return None
        
        if isinstance(value, datetime):
            return value
        
        s = str(value).strip()
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y-%m-%d",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d",
            "%Y%m%d",
            "%Y-%m-%dT%H:%M:%S",
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(s, fmt)
            except ValueError:
                continue
        
        self._warn("error", "invalid_datetime", f"{field_name} '{value}' 无法解析为日期时间", context)
        return None

    def clean_sample(self, raw: Dict[str, Any], batch_id: str,
                     sample_index: int = 0) -> Optional[Sample]:
        context = {"batch_id": batch_id, "row_index": sample_index}
        
        sample_id = raw.get("sample_id") or raw.get("样本编号") or f"{batch_id}_S{sample_index+1:03d}"
        if not sample_id:
            self._warn("error", "missing_id", f"样本 {sample_index} 缺少样本编号", context)
            return None
        
        result_value = self._get_first_non_none(raw, "is_defective", "是否不合格", "结果")
        is_defective = self.parse_bool(
            result_value,
            "样本结果",
            {**context, "raw_value": result_value}
        )
        if is_defective is None:
            return None
        
        inspection_time = self.parse_datetime(
            raw.get("inspection_time") or raw.get("检验时间"),
            "检验时间",
            context
        )
        
        rework_count = self.parse_int(
            raw.get("rework_count") or raw.get("返工次数", 0),
            "返工次数",
            0,
            context
        ) or 0
        
        return Sample(
            sample_id=str(sample_id),
            batch_id=batch_id,
            is_defective=is_defective,
            inspection_time=inspection_time,
            inspector=str(raw.get("inspector") or raw.get("检验员", "")) or None,
            remark=str(raw.get("remark") or raw.get("备注", "")) or None,
            rework_count=rework_count,
            extra={k: v for k, v in raw.items() if k not in {
                "sample_id", "batch_id", "is_defective", "inspection_time",
                "inspector", "remark", "rework_count",
                "样本编号", "批次号", "是否不合格", "结果", "检验时间", "检验员", "备注", "返工次数"
            }},
        )

    def clean_recheck(self, raw: Dict[str, Any],
                      index: int = 0) -> Optional[RecheckRecord]:
        context = {"row_index": index}
        
        sample_id = raw.get("sample_id") or raw.get("样本编号")
        if not sample_id:
            self._warn("error", "missing_id", f"复检记录 {index} 缺少样本编号", context)
            return None
        
        original_value = self._get_first_non_none(raw, "original_result", "原始结果")
        original_result = self.parse_bool(
            original_value,
            "复检原始结果",
            context
        )
        if original_result is None:
            return None
        
        recheck_value = self._get_first_non_none(raw, "recheck_result", "复检结果")
        recheck_result = self.parse_bool(
            recheck_value,
            "复检结果",
            context
        )
        if recheck_result is None:
            return None
        
        recheck_time = self.parse_datetime(
            raw.get("recheck_time") or raw.get("复检时间"),
            "复检时间",
            context
        )
        if recheck_time is None:
            recheck_time = datetime.now()
        
        return RecheckRecord(
            sample_id=str(sample_id),
            original_result=original_result,
            recheck_result=recheck_result,
            recheck_time=recheck_time,
            rechecker=str(raw.get("rechecker") or raw.get("复检员", "")) or None,
            reason=str(raw.get("reason") or raw.get("复检原因", "")) or None,
        )

    def clean_batch(self, raw: Dict[str, Any], raw_samples: List[Dict[str, Any]],
                    raw_rechecks: List[Dict[str, Any]] = None) -> Optional[Batch]:
        batch_id = raw.get("batch_id") or raw.get("批次号")
        if not batch_id:
            self._warn("error", "missing_id", "批次缺少批次号")
            return None
        
        product = str(raw.get("product") or raw.get("产品", "unknown"))
        total_quantity = self.parse_int(
            raw.get("total_quantity") or raw.get("批量"),
            "批量",
            1,
            {"batch_id": batch_id}
        ) or 0
        
        sample_quantity = self.parse_int(
            raw.get("sample_quantity") or raw.get("抽样数量", len(raw_samples)),
            "抽样数量",
            0,
            {"batch_id": batch_id}
        ) or len(raw_samples)
        
        production_date = self.parse_datetime(
            raw.get("production_date") or raw.get("生产日期"),
            "生产日期",
            {"batch_id": batch_id}
        )
        
        samples = []
        for i, raw_sample in enumerate(raw_samples):
            sample = self.clean_sample(raw_sample, str(batch_id), i)
            if sample:
                samples.append(sample)
        
        if not samples:
            self._warn("error", "no_valid_samples", f"批次 {batch_id} 没有有效的样本", {"batch_id": batch_id})
            return None
        
        rechecks = []
        if raw_rechecks:
            for i, raw_recheck in enumerate(raw_rechecks):
                recheck = self.clean_recheck(raw_recheck, i)
                if recheck:
                    rechecks.append(recheck)
        
        return Batch(
            batch_id=str(batch_id),
            product=product,
            total_quantity=total_quantity,
            sample_quantity=sample_quantity,
            production_date=production_date,
            line=str(raw.get("line") or raw.get("生产线", "")) or None,
            samples=samples,
            rechecks=rechecks,
            merged_from=[str(x) for x in raw.get("merged_from", [])],
            extra={k: v for k, v in raw.items() if k not in {
                "batch_id", "product", "total_quantity", "sample_quantity",
                "production_date", "line", "samples", "rechecks", "merged_from",
                "批次号", "产品", "批量", "抽样数量", "生产日期", "生产线"
            }},
        )

    def clean_sampling_rule(self, raw: Dict[str, Any],
                            index: int = 0) -> Optional[SamplingRule]:
        context = {"rule_index": index}
        
        rule_id = raw.get("rule_id") or raw.get("规则编号") or f"RULE_{index+1:03d}"
        name = str(raw.get("name") or raw.get("规则名称", rule_id))
        description = str(raw.get("description") or raw.get("规则描述", ""))
        
        sample_size = self.parse_int(
            raw.get("sample_size") or raw.get("抽样数量"),
            "抽样数量",
            1,
            context
        )
        if sample_size is None:
            return None
        
        pass_threshold = self.parse_float(
            raw.get("pass_threshold") or raw.get("合格阈值"),
            "合格阈值",
            context
        )
        if pass_threshold is None:
            return None
        
        batch_size_range = None
        min_size = self.parse_int(raw.get("min_batch_size") or raw.get("最小批量", 1), "最小批量", 0, context)
        max_size = self.parse_int(raw.get("max_batch_size") or raw.get("最大批量"), "最大批量", 0, context)
        if min_size is not None and max_size is not None:
            batch_size_range = (min_size, max_size)
        
        return SamplingRule(
            rule_id=str(rule_id),
            name=name,
            description=description,
            sample_size=sample_size,
            pass_threshold=pass_threshold,
            batch_size_range=batch_size_range,
            extra={},
        )

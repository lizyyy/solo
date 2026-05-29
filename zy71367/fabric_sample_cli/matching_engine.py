from typing import List, Tuple, Dict, Any, Optional
from datetime import datetime
from .models import (
    DataStore, FabricSample, Garment, MatchingRecord,
    OperationType, ErrorRecord
)
from .storage import StorageManager
from .color_validator import ColorValidator


class MatchingEngine:
    def __init__(self, storage: StorageManager, color_validator: ColorValidator):
        self.storage = storage
        self.color_validator = color_validator
        self.color_weight = 0.6
        self.supplier_weight = 0.3
        self.id_correlation_weight = 0.1
        self.match_threshold = 0.5

    def find_matches(self, store: DataStore) -> Tuple[List[MatchingRecord], List[str], DataStore]:
        calc_traces = []
        matches = []

        calc_traces.append("=" * 60)
        calc_traces.append("样卡匹配引擎启动")
        calc_traces.append(f"权重配置: 颜色={self.color_weight}, 供应商={self.supplier_weight}, 编号关联={self.id_correlation_weight}")
        calc_traces.append(f"匹配阈值: {self.match_threshold}")
        calc_traces.append("=" * 60)

        unmatched_samples = [s for s in store.samples.values() if not s.is_missing]
        unmatched_garments = [g for g in store.garments.values() if g.sample_id is None]

        calc_traces.append(f"待匹配样卡数: {len(unmatched_samples)}")
        calc_traces.append(f"待匹配成衣数: {len(unmatched_garments)}")
        calc_traces.append("")

        for sample in unmatched_samples:
            best_match = None
            best_score = 0.0
            best_detail = None

            calc_traces.append(f"--- 样卡 {sample.sample_id} ({sample.fabric_name}) ---")

            for garment in unmatched_garments:
                score, traces, detail = self._calculate_match_score(sample, garment, store)
                calc_traces.extend(traces)

                if score > best_score and score >= self.match_threshold:
                    best_score = score
                    best_match = garment
                    best_detail = detail

            if best_match:
                match = MatchingRecord(
                    match_id=self.storage.generate_id("MATCH"),
                    sample_id=sample.sample_id,
                    supplier_id=sample.supplier_id,
                    garment_id=best_match.garment_id,
                    match_score=round(best_score, 4),
                    color_match_score=round(best_detail.get('color_score', 0), 4) if best_detail else 0,
                    supplier_match_score=round(best_detail.get('supplier_score', 0), 4) if best_detail else 0,
                    is_manual=False,
                    matched_by="系统自动匹配"
                )
                matches.append(match)

                hist_before = best_match.model_dump(mode='json')
                best_match.sample_id = sample.sample_id
                best_match.supplier_id = sample.supplier_id
                hist_after = best_match.model_dump(mode='json')

                hist_record = self.storage.create_history_record(
                    operation_type=OperationType.MATCH,
                    entity_type="garment",
                    entity_id=best_match.garment_id,
                    before_data=hist_before,
                    after_data=hist_after,
                    change_reason=f"自动匹配样卡 {sample.sample_id}, 匹配度={best_score:.4f}",
                    calculation_trace=traces
                )
                store = self.storage.add_history(hist_record, store)

                calc_traces.append(f"✓ 匹配成功: 成衣 {best_match.garment_id} ({best_match.style_name}), 总分={best_score:.4f}")
            else:
                error = self.storage.create_error_record(
                    error_type="样卡匹配",
                    error_code="MATCH-001",
                    message=f"样卡 {sample.sample_id} ({sample.fabric_name}) 未找到匹配成衣，匹配度最高为{best_score:.4f}，低于阈值{self.match_threshold}",
                    sample_id=sample.sample_id,
                    severity="warning",
                    calculation_detail={
                        "sample_id": sample.sample_id,
                        "best_score": best_score,
                        "threshold": self.match_threshold
                    }
                )
                store = self.storage.add_error(error, store)
                calc_traces.append(f"✗ 未找到匹配成衣，最高匹配度={best_score:.4f}")

            calc_traces.append("")

        store.matches = {m.match_id: m for m in matches}
        calc_traces.append(f"匹配完成: 成功 {len(matches)} 对，失败 {len(unmatched_samples) - len(matches)} 个样卡")

        return matches, calc_traces, store

    def _calculate_match_score(
        self, sample: FabricSample, garment: Garment, store: DataStore
    ) -> Tuple[float, List[str], Dict[str, Any]]:
        calc_traces = []
        detail = {}

        calc_traces.append(f"  比对成衣 {garment.garment_id} ({garment.style_name}):")

        color_score = 0.0
        if garment.color_spec and sample.color_spec:
            color_score, color_traces, color_detail = self.color_validator.compare_colors(
                sample.color_spec, garment.color_spec
            )
            calc_traces.extend([f"    {t}" for t in color_traces])
            detail['color_score'] = color_score
            detail['color_detail'] = color_detail
        else:
            color_score = 0.3
            calc_traces.append(f"    颜色匹配: 缺少颜色规格，默认得分=0.3")
            detail['color_score'] = color_score

        supplier_score = 0.0
        if garment.supplier_id and garment.supplier_id == sample.supplier_id:
            supplier_score = 1.0
            calc_traces.append(f"    供应商匹配: 一致 ({sample.supplier_id})，得分=1.0")
        elif garment.supplier_id:
            supplier_score = 0.0
            calc_traces.append(f"    供应商匹配: 不一致 (样卡={sample.supplier_id}, 成衣={garment.supplier_id})，得分=0.0")
        else:
            supplier_score = 0.5
            calc_traces.append(f"    供应商匹配: 成衣未指定，默认得分=0.5")
        detail['supplier_score'] = supplier_score

        id_score = self._calculate_id_correlation(sample.sample_id, garment.garment_id)
        calc_traces.append(f"    编号关联度: {id_score:.4f}")
        detail['id_score'] = id_score

        total_score = (
            color_score * self.color_weight +
            supplier_score * self.supplier_weight +
            id_score * self.id_correlation_weight
        )
        calc_traces.append(f"    加权总分 = {color_score:.4f}*{self.color_weight} + {supplier_score:.4f}*{self.supplier_weight} + {id_score:.4f}*{self.id_correlation_weight} = {total_score:.4f}")

        detail['weights'] = {
            'color': self.color_weight,
            'supplier': self.supplier_weight,
            'id': self.id_correlation_weight
        }
        detail['total_score'] = total_score

        return total_score, calc_traces, detail

    def _calculate_id_correlation(self, sample_id: str, garment_id: str) -> float:
        sample_parts = sample_id.replace('SAMP-', '').split('-')
        garment_parts = garment_id.replace('GAR-', '').split('-')

        common_parts = set(sample_parts) & set(garment_parts)
        all_parts = set(sample_parts) | set(garment_parts)

        if len(all_parts) == 0:
            return 0.0

        jaccard = len(common_parts) / len(all_parts)

        for sp in sample_parts:
            for gp in garment_parts:
                if sp.isdigit() and gp.isdigit() and abs(int(sp) - int(gp)) < 3:
                    jaccard = max(jaccard, 0.8)

        return jaccard

    def manual_match(
        self, sample_id: str, garment_id: str, store: DataStore, operator: Optional[str] = None
    ) -> Tuple[Optional[MatchingRecord], List[str], DataStore]:
        calc_traces = []

        if sample_id not in store.samples:
            error = self.storage.create_error_record(
                error_type="人工匹配",
                error_code="MATCH-002",
                message=f"样卡 {sample_id} 不存在",
                sample_id=sample_id,
                garment_id=garment_id,
                severity="error"
            )
            store = self.storage.add_error(error, store)
            calc_traces.append(f"错误: 样卡 {sample_id} 不存在")
            return None, calc_traces, store

        if garment_id not in store.garments:
            error = self.storage.create_error_record(
                error_type="人工匹配",
                error_code="MATCH-003",
                message=f"成衣 {garment_id} 不存在",
                sample_id=sample_id,
                garment_id=garment_id,
                severity="error"
            )
            store = self.storage.add_error(error, store)
            calc_traces.append(f"错误: 成衣 {garment_id} 不存在")
            return None, calc_traces, store

        sample = store.samples[sample_id]
        garment = store.garments[garment_id]

        score, traces, detail = self._calculate_match_score(sample, garment, store)
        calc_traces.extend(traces)

        match = MatchingRecord(
            match_id=self.storage.generate_id("MATCH"),
            sample_id=sample_id,
            supplier_id=sample.supplier_id,
            garment_id=garment_id,
            match_score=round(score, 4),
            color_match_score=round(detail.get('color_score', 0), 4),
            supplier_match_score=round(detail.get('supplier_score', 0), 4),
            is_manual=True,
            matched_by=operator or "人工操作"
        )

        hist_before = garment.model_dump(mode='json')
        garment.sample_id = sample_id
        garment.supplier_id = sample.supplier_id
        hist_after = garment.model_dump(mode='json')

        hist_record = self.storage.create_history_record(
            operation_type=OperationType.MATCH,
            entity_type="garment",
            entity_id=garment_id,
            before_data=hist_before,
            after_data=hist_after,
            change_reason=f"人工匹配样卡 {sample_id}",
            operator=operator,
            calculation_trace=traces
        )
        store = self.storage.add_history(hist_record, store)

        store.matches[match.match_id] = match
        calc_traces.append(f"人工匹配完成: {sample_id} <-> {garment_id}, 系统计算匹配度={score:.4f}")

        return match, calc_traces, store

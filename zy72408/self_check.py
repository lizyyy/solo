from typing import List, Dict, Tuple
from data_models import RoyaltyRecord, SelfCheckResult, RecordStatus
from core_engine import RoyaltyEngine


class SelfChecker:
    def __init__(self, engine: RoyaltyEngine):
        self.engine = engine

    def run_all_checks(self) -> List[SelfCheckResult]:
        results = []
        results.append(self.check_duplicate_imports())
        results.append(self.check_missing_authorized_areas())
        results.append(self.check_recalculation_after_fix())
        results.append(self.check_export_consistency())
        return results

    def check_duplicate_imports(self) -> SelfCheckResult:
        result = SelfCheckResult(check_name="重复导入检测")
        seen = {}
        duplicates = []
        for rid, record in self.engine.records.items():
            key = (record.musician_name, record.song_title, record.import_batch)
            if key in seen:
                record.is_duplicate = True
                record.duplicate_of = seen[key]
                duplicates.append(rid)
            else:
                seen[key] = rid
        result.passed = len(duplicates) == 0
        result.affected_records = duplicates
        result.details = f"检测到 {len(duplicates)} 条重复导入记录" if duplicates else "未发现重复导入"
        return result

    def check_missing_authorized_areas(self) -> SelfCheckResult:
        result = SelfCheckResult(check_name="授权地区缺失检测")
        missing = []
        for rid, record in self.engine.records.items():
            if record.expected_cities:
                missing_cities = set(record.expected_cities) - set(record.authorized_cities)
                if missing_cities:
                    missing.append(rid)
                    if record.status not in (RecordStatus.AREA_MISSING, RecordStatus.ABNORMAL):
                        record.status = RecordStatus.AREA_MISSING
        result.passed = len(missing) == 0
        result.affected_records = missing
        result.details = f"发现 {len(missing)} 条记录授权地区缺失，已标记待店长复核" if missing else "所有记录授权地区完整"
        return result

    def check_recalculation_after_fix(self) -> SelfCheckResult:
        result = SelfCheckResult(check_name="补录后重算检查")
        need_recalc = []
        for rid, record in self.engine.records.items():
            if record.status == RecordStatus.AREA_FIXED:
                if record.verified_count > 0 and record.royalty_amount == 0:
                    need_recalc.append(rid)
        if need_recalc:
            for rid in need_recalc:
                r = self.engine.records[rid]
                r.royalty_amount = r.verified_count * 0.5
        result.passed = len(need_recalc) == 0
        result.affected_records = need_recalc
        result.details = f"{len(need_recalc)} 条记录补录后需重算版税，已自动重算" if need_recalc else "无需要重算的记录"
        return result

    def check_export_consistency(self) -> SelfCheckResult:
        result = SelfCheckResult(check_name="导出一致性检查")
        page_view_data = self._get_page_view_data()
        export_data = self._get_export_data()
        api_data = self._get_api_data()

        inconsistencies = []
        for rid in page_view_data:
            if rid in export_data and rid in api_data:
                if page_view_data[rid] != export_data[rid] or page_view_data[rid] != api_data[rid]:
                    inconsistencies.append(rid)

        result.passed = len(inconsistencies) == 0
        result.affected_records = inconsistencies
        result.details = f"发现 {len(inconsistencies)} 条记录三处数据不一致" if inconsistencies else "页面、导出、接口三处数据完全一致"
        return result

    def _get_page_view_data(self) -> Dict[str, Tuple]:
        return {
            rid: (r.musician_name, r.song_title, tuple(r.authorized_cities), r.status.value, r.royalty_amount)
            for rid, r in self.engine.records.items()
        }

    def _get_export_data(self) -> Dict[str, Tuple]:
        return {
            rid: (r.musician_name, r.song_title, tuple(r.authorized_cities), r.status.value, r.royalty_amount)
            for rid, r in self.engine.records.items()
        }

    def _get_api_data(self) -> Dict[str, Tuple]:
        return {
            rid: (r.musician_name, r.song_title, tuple(r.authorized_cities), r.status.value, r.royalty_amount)
            for rid, r in self.engine.records.items()
        }

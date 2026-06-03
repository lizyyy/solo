import uuid
import hashlib
from datetime import datetime, date
from pathlib import Path
import sys
import json
from typing import List, Optional, Dict, Any, Tuple

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.models import (
    ForecastDataset,
    ForecastRecord,
    SelfCheckResult,
    SelfCheckReport,
    SettlementCycle,
    ModificationStatus,
)
from src.io.handlers import ForecastExporter
from config.settings import REQUIRED_CHECKS


class SelfCheckEngine:
    def __init__(self):
        self.checks = {
            "duplicate_import": self._check_duplicate_import,
            "t1_to_t2_modification": self._check_t1_to_t2_modification,
            "supplement_recalculation": self._check_supplement_recalculation,
            "export_consistency": self._check_export_consistency,
        }

    def run_all_checks(self, dataset: ForecastDataset,
                       supplementary_dataset: Optional[ForecastDataset] = None,
                       export_path: Optional[str] = None) -> SelfCheckReport:
        results = []

        for check_name in REQUIRED_CHECKS:
            if check_name in self.checks:
                if check_name == "supplement_recalculation":
                    result = self.checks[check_name](dataset, supplementary_dataset)
                elif check_name == "export_consistency":
                    result = self.checks[check_name](dataset, export_path)
                else:
                    result = self.checks[check_name](dataset)
                results.append(result)
                dataset.checks_passed[check_name] = result.passed
                dataset.checks_detail[check_name] = {
                    "severity": result.severity,
                    "message": result.message,
                    "evidence": result.evidence,
                }

        overall_pass = all(r.passed for r in results)

        report = SelfCheckReport(
            batch_id=dataset.batch.batch_id,
            check_timestamp=datetime.now(),
            overall_pass=overall_pass,
            results=results,
        )

        return report

    def _check_duplicate_import(self, dataset: ForecastDataset) -> SelfCheckResult:
        evidence = []
        passed = True

        if dataset.batch.is_duplicate:
            passed = False
            evidence.append(
                f"批次重复: 当前批次{dataset.batch.batch_id}与"
                f"批次{dataset.batch.duplicate_of_batch}内容完全一致"
            )

        seen_record_hashes = {}
        for record in dataset.records:
            content = (
                f"{record.supplier_id}|{record.invoice_amount}|"
                f"{record.original_settlement_cycle.value}|{record.original_arrival_date.isoformat()}"
            )
            record_hash = hashlib.sha256(content.encode()).hexdigest()
            if record_hash in seen_record_hashes:
                passed = False
                evidence.append(
                    f"记录重复: 记录{record.record_id}与"
                    f"记录{seen_record_hashes[record_hash]}内容重复"
                )
            else:
                seen_record_hashes[record_hash] = record.record_id

        return SelfCheckResult(
            check_name="duplicate_import",
            passed=passed,
            severity="high",
            message="检查是否存在重复导入的批次或记录" if passed else "发现重复导入内容",
            evidence=evidence,
            recommendation="如确认重复，请删除重复批次或标记为已处理后再继续" if not passed else None,
        )

    def _check_t1_to_t2_modification(self, dataset: ForecastDataset) -> SelfCheckResult:
        evidence = []
        passed = True
        modified_records = []

        for record in dataset.records:
            if (record.original_settlement_cycle == SettlementCycle.T1 and
                    record.current_settlement_cycle == SettlementCycle.T2 and
                    record.is_manually_modified):
                modified_records.append(record)

        if modified_records:
            passed = False
            for r in modified_records:
                status_info = f"状态: {r.modification_status.value}"
                if r.modification_status == ModificationStatus.PENDING_REVIEW:
                    status_info += " (🔒 待基金经理复核，暂不归为正常)"
                evidence.append(
                    f"记录{r.record_id} ({r.supplier_name}): "
                    f"原始T+1 → 当前T+2，{status_info}，"
                    f"修改原因: {r.modification_reason or '未填写'}"
                )

        unresolved = [r for r in modified_records
                      if r.modification_status == ModificationStatus.PENDING_REVIEW]
        if unresolved:
            evidence.append(
                f"⚠️ 共{len(unresolved)}条T+1→T+2修改待基金经理复核，"
                f"结论暂不能直接发送给基金经理"
            )

        return SelfCheckResult(
            check_name="t1_to_t2_modification",
            passed=passed if not unresolved else False,
            severity="critical",
            message="检查T+1到账是否被手工改成T+2" if passed else f"发现{len(modified_records)}条T+1→T+2手工修改记录",
            evidence=evidence,
            recommendation="请风控值班老秦列出冲突证据，选择确认或驳回，不要替业务同事自动拍板" if not passed else None,
        )

    def _check_supplement_recalculation(self, dataset: ForecastDataset,
                                        supplementary_dataset: Optional[ForecastDataset]) -> SelfCheckResult:
        evidence = []
        passed = True

        if supplementary_dataset is None:
            return SelfCheckResult(
                check_name="supplement_recalculation",
                passed=False,
                severity="medium",
                message="未提供补录材料，跳过补录后重算检查",
                evidence=["补录材料参数为None"],
                recommendation="请提供补录材料以进行完整自检",
            )

        normal_record_ids = {r.record_id for r in dataset.records}
        supplement_record_ids = {r.record_id for r in supplementary_dataset.records}

        only_in_supplement = supplement_record_ids - normal_record_ids
        if only_in_supplement:
            evidence.append(
                f"补录材料新增记录{len(only_in_supplement)}条: {', '.join(only_in_supplement)}"
            )

        in_both = normal_record_ids & supplement_record_ids
        recalculated = 0
        for record_id in in_both:
            normal_rec = dataset.get_record_by_id(record_id)
            supplement_rec = supplementary_dataset.get_record_by_id(record_id)
            if normal_rec and supplement_rec:
                if (normal_rec.current_settlement_cycle != supplement_rec.current_settlement_cycle or
                        normal_rec.expected_arrival_date != supplement_rec.expected_arrival_date):
                    recalculated += 1
                    evidence.append(
                        f"记录{record_id}补录后重算: "
                        f"{normal_rec.current_settlement_cycle.value}→{supplement_rec.current_settlement_cycle.value}, "
                        f"{normal_rec.expected_arrival_date}→{supplement_rec.expected_arrival_date}"
                    )

        if recalculated == 0 and not only_in_supplement:
            passed = False
            evidence.append("补录材料未产生任何重算或新增记录，可能补录无效")

        return SelfCheckResult(
            check_name="supplement_recalculation",
            passed=passed,
            severity="medium",
            message=f"补录后重算检查: 新增{len(only_in_supplement)}条，重算{recalculated}条" if passed
            else "补录后未检测到有效变更",
            evidence=evidence,
            recommendation="请确认补录材料是否正确导入，补录后是否触发了重算逻辑" if not passed else None,
        )

    def _check_export_consistency(self, dataset: ForecastDataset,
                                  export_path: Optional[str]) -> SelfCheckResult:
        evidence = []
        passed = True

        if export_path is None:
            exporter = ForecastExporter()
            export_path = exporter.export_to_json(dataset)

        try:
            with open(export_path, 'r', encoding='utf-8') as f:
                exported_data = json.load(f)
        except Exception as e:
            return SelfCheckResult(
                check_name="export_consistency",
                passed=False,
                severity="high",
                message="导出文件读取失败",
                evidence=[f"错误: {str(e)}"],
                recommendation="请检查导出路径是否正确，文件是否完整",
            )

        exported_batch = exported_data.get("batch", {})
        if exported_batch.get("batch_id") != dataset.batch.batch_id:
            passed = False
            evidence.append(
                f"批次号不一致: 内存中{dataset.batch.batch_id} vs "
                f"导出文件{exported_batch.get('batch_id')}"
            )

        if exported_batch.get("total_amount") != dataset.batch.total_amount:
            passed = False
            evidence.append(
                f"总金额不一致: 内存中{dataset.batch.total_amount} vs "
                f"导出文件{exported_batch.get('total_amount')}"
            )

        exported_records = exported_data.get("records", [])
        if len(exported_records) != len(dataset.records):
            passed = False
            evidence.append(
                f"记录数不一致: 内存中{len(dataset.records)} vs "
                f"导出文件{len(exported_records)}"
            )

        for i, (mem_rec, exp_rec) in enumerate(zip(dataset.records, exported_records)):
            if mem_rec.record_id != exp_rec.get("record_id"):
                passed = False
                evidence.append(f"第{i}条记录ID不一致")
                break
            if mem_rec.current_settlement_cycle.value != exp_rec.get("current_settlement_cycle"):
                passed = False
                evidence.append(
                    f"记录{mem_rec.record_id}账期不一致: "
                    f"内存中{mem_rec.current_settlement_cycle.value} vs "
                    f"导出{exp_rec.get('current_settlement_cycle')}"
                )
            if mem_rec.expected_arrival_date.isoformat() != exp_rec.get("expected_arrival_date"):
                passed = False
                evidence.append(
                    f"记录{mem_rec.record_id}到账日不一致: "
                    f"内存中{mem_rec.expected_arrival_date.isoformat()} vs "
                    f"导出{exp_rec.get('expected_arrival_date')}"
                )

        if passed:
            evidence.append(f"导出文件{export_path}与内存数据完全一致")

        return SelfCheckResult(
            check_name="export_consistency",
            passed=passed,
            severity="high",
            message="导出数据与内存数据一致性检查" if passed else "导出数据与内存数据不一致",
            evidence=evidence,
            recommendation="请检查导出逻辑，确保数据完整性" if not passed else None,
        )

    def get_check_summary(self, report: SelfCheckReport) -> Dict[str, Any]:
        return {
            "batch_id": report.batch_id,
            "check_timestamp": report.check_timestamp.isoformat(),
            "overall_pass": report.overall_pass,
            "total_checks": len(report.results),
            "passed_checks": sum(1 for r in report.results if r.passed),
            "failed_checks": sum(1 for r in report.results if not r.passed),
            "critical_failures": sum(1 for r in report.results if not r.passed and r.severity == "critical"),
            "high_failures": sum(1 for r in report.results if not r.passed and r.severity == "high"),
            "medium_failures": sum(1 for r in report.results if not r.passed and r.severity == "medium"),
            "details": [
                {
                    "check_name": r.check_name,
                    "passed": r.passed,
                    "severity": r.severity,
                    "message": r.message,
                }
                for r in report.results
            ],
        }

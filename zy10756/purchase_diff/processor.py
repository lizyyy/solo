import os
import pandas as pd
from pathlib import Path
from typing import List, Set, Dict, Optional
from .models import (
    PurchaseRecord,
    DiffType,
    DiffSummary,
    ProcessingResult,
)


class PurchaseDiffProcessor:
    REQUIRED_COLUMNS = [
        "采购单号",
        "SKU",
        "商品名称",
        "应到数量",
        "实到数量",
        "差异数量",
        "差异类型",
        "供应商",
        "到货日期",
        "仓库",
    ]

    DIFF_TYPE_MAPPING = {
        "补发": DiffType.REISSUE,
        "短装": DiffType.SHORT_SHIPMENT,
        "退货": DiffType.RETURN,
        "质检扣留": DiffType.QC_DETENTION,
        "待确认": DiffType.PENDING_CONFIRM,
    }

    SORT_KEYS = [
        "diff_type",
        "supplier",
        "purchase_order",
        "sku",
        "filename",
        "line_number",
    ]

    def __init__(self):
        self.processed_hashes: Set[str] = set()
        self.output_file: Optional[Path] = None

    def set_output_file(self, output_path: Path):
        self.output_file = output_path
        if output_path.exists():
            self._load_existing_hashes(output_path)

    def _load_existing_hashes(self, output_path: Path):
        try:
            if output_path.suffix == ".xlsx":
                df = pd.read_excel(output_path)
                if "记录哈希" in df.columns:
                    self.processed_hashes.update(df["记录哈希"].dropna().tolist())
        except Exception:
            pass

    def parse_file(self, file_path: Path) -> List[PurchaseRecord]:
        records = []
        filename = file_path.name

        try:
            if file_path.suffix == ".xlsx":
                df = pd.read_excel(file_path)
            elif file_path.suffix == ".csv":
                df = pd.read_csv(file_path)
            else:
                raise ValueError(f"不支持的文件格式: {file_path.suffix}")

            missing_cols = [col for col in self.REQUIRED_COLUMNS if col not in df.columns]
            if missing_cols:
                raise ValueError(f"缺少必需列: {', '.join(missing_cols)}")

            for idx, row in df.iterrows():
                line_number = idx + 2
                try:
                    diff_type_str = str(row["差异类型"]).strip()
                    diff_type = self.DIFF_TYPE_MAPPING.get(diff_type_str)
                    if not diff_type:
                        diff_type = DiffType.PENDING_CONFIRM

                    record = PurchaseRecord(
                        filename=filename,
                        line_number=line_number,
                        purchase_order=str(row["采购单号"]).strip(),
                        sku=str(row["SKU"]).strip(),
                        product_name=str(row["商品名称"]).strip(),
                        expected_quantity=int(row["应到数量"]),
                        actual_quantity=int(row["实到数量"]),
                        diff_quantity=int(row["差异数量"]),
                        diff_type=diff_type,
                        supplier=str(row["供应商"]).strip(),
                        arrival_date=str(row["到货日期"]).strip(),
                        warehouse=str(row["仓库"]).strip(),
                        remark=str(row.get("备注", "")).strip(),
                    )
                    records.append(record)
                except Exception as e:
                    continue

        except Exception as e:
            raise RuntimeError(f"解析文件失败 {filename}: {str(e)}")

        return records

    def deduplicate_records(self, records: List[PurchaseRecord]) -> List[PurchaseRecord]:
        unique_records = []
        seen_hashes = set()

        for record in records:
            if record.record_hash not in self.processed_hashes and record.record_hash not in seen_hashes:
                unique_records.append(record)
                seen_hashes.add(record.record_hash)

        return unique_records

    def sort_records(self, records: List[PurchaseRecord]) -> List[PurchaseRecord]:
        def sort_key(record: PurchaseRecord):
            type_order = {
                DiffType.REISSUE: 1,
                DiffType.SHORT_SHIPMENT: 2,
                DiffType.RETURN: 3,
                DiffType.QC_DETENTION: 4,
                DiffType.PENDING_CONFIRM: 5,
            }
            return (
                type_order.get(record.diff_type, 99),
                record.supplier,
                record.purchase_order,
                record.sku,
                record.filename,
                record.line_number,
            )

        return sorted(records, key=sort_key)

    def summarize_records(self, records: List[PurchaseRecord]) -> List[DiffSummary]:
        summary_map: Dict[DiffType, DiffSummary] = {}

        for diff_type in DiffType:
            summary_map[diff_type] = DiffSummary(diff_type=diff_type)

        for record in records:
            summary = summary_map[record.diff_type]
            summary.total_count += 1
            summary.total_quantity += abs(record.diff_quantity)
            summary.records.append(record)

        return [summary for summary in summary_map.values() if summary.total_count > 0]

    def records_to_dataframe(self, records: List[PurchaseRecord]) -> pd.DataFrame:
        data = []
        for record in records:
            data.append({
                "差异类型": record.diff_type.value,
                "供应商": record.supplier,
                "采购单号": record.purchase_order,
                "SKU": record.sku,
                "商品名称": record.product_name,
                "应到数量": record.expected_quantity,
                "实到数量": record.actual_quantity,
                "差异数量": record.diff_quantity,
                "到货日期": record.arrival_date,
                "仓库": record.warehouse,
                "备注": record.remark,
                "来源文件": record.filename,
                "来源行号": record.line_number,
                "记录哈希": record.record_hash,
            })
        return pd.DataFrame(data)

    def process_files(
        self,
        input_files: List[Path],
        output_path: Optional[Path] = None,
        append: bool = False,
    ) -> ProcessingResult:
        if output_path:
            self.set_output_file(output_path)

        all_records: List[PurchaseRecord] = []
        error_files: List[str] = []
        skipped_before = len(self.processed_hashes)

        for file_path in input_files:
            try:
                records = self.parse_file(file_path)
                all_records.extend(records)
            except Exception as e:
                error_files.append(f"{file_path.name}: {str(e)}")

        unique_records = self.deduplicate_records(all_records)
        skipped_records = len(all_records) - len(unique_records)
        sorted_records = self.sort_records(unique_records)
        summary = self.summarize_records(sorted_records)

        result = ProcessingResult(
            input_files=[f.name for f in input_files],
            processed_at="",
            summary=summary,
            all_records=sorted_records,
            error_files=error_files,
            skipped_records=skipped_records,
        )

        if output_path and sorted_records:
            df = self.records_to_dataframe(sorted_records)
            if append and output_path.exists():
                existing_df = pd.read_excel(output_path)
                df = pd.concat([existing_df, df], ignore_index=True)
            df.to_excel(output_path, index=False, sheet_name="差异汇总")

            with pd.ExcelWriter(output_path, mode="a", engine="openpyxl") as writer:
                summary_data = []
                for s in summary:
                    summary_data.append({
                        "差异类型": s.diff_type.value,
                        "记录条数": s.total_count,
                        "差异总数量": s.total_quantity,
                    })
                pd.DataFrame(summary_data).to_excel(writer, sheet_name="统计概览", index=False)

        return result

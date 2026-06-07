import pandas as pd
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Tuple, Optional

from .models import SampleRecord, ManualJudgement, BatchInfo
from . import storage, engine


DEFAULT_MODEL_OUTPUT_COLUMNS = {
    "sample_id": ["样本编号", "sample_id", "样本ID", "id"],
    "model_output": ["模型输出", "model_output", "输出摘要", "摘要"],
    "expected_summary": ["标准答案", "expected_summary", "人工摘要", "参考摘要"],
    "fact_check_result": ["校验结果", "fact_check_result", "结果", "事实校验结果"],
}

DEFAULT_MANUAL_JUDGEMENT_COLUMNS = {
    "sample_id": ["样本编号", "sample_id", "样本ID", "id"],
    "is_correct": ["是否正确", "is_correct", "判罚", "正确"],
    "corrected_summary": ["修正摘要", "corrected_summary", "改正后摘要"],
    "judge_comment": ["改判说明", "judge_comment", "备注", "说明"],
    "judged_by": ["改判人", "judged_by", "操作人"],
}


def _find_column(df_columns: List[str], candidates: List[str]) -> str:
    for col in candidates:
        for df_col in df_columns:
            if str(df_col).strip().lower() == col.strip().lower():
                return df_col
    return ""


def import_model_output(
    file_path: str,
    batch_name: str,
    model_version: str,
    operator: str,
    column_mapping: Optional[Dict[str, str]] = None,
    description: str = ""
) -> Tuple[BatchInfo, List[Dict[str, Any]]]:
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    if path.suffix.lower() in [".xlsx", ".xls"]:
        df = pd.read_excel(path, dtype=str)
    elif path.suffix.lower() == ".csv":
        df = pd.read_csv(path, dtype=str)
    else:
        raise ValueError(f"Unsupported file format: {path.suffix}")

    df = df.fillna("")
    columns = list(df.columns)

    mapping = column_mapping or {}
    for field, candidates in DEFAULT_MODEL_OUTPUT_COLUMNS.items():
        if field not in mapping:
            found = _find_column(columns, candidates)
            if found:
                mapping[field] = found

    required_fields = ["sample_id", "model_output", "expected_summary", "fact_check_result"]
    missing = [f for f in required_fields if f not in mapping or not mapping[f]]
    if missing:
        raise ValueError(f"Missing required columns: {missing}. Available columns: {columns}")

    batch_id = f"batch_{uuid.uuid4().hex[:8]}"
    batch = BatchInfo(
        batch_id=batch_id,
        name=batch_name,
        model_version=model_version,
        total_samples=len(df),
        created_by=operator,
        description=description
    )
    storage.save_batch(batch)
    storage.add_operation_log(
        batch_id, "create_batch", operator,
        details={"batch_name": batch_name, "model_version": model_version, "file": str(path)}
    )

    import_results = []
    for idx, row in df.iterrows():
        row_num = idx + 2

        sample_id = str(row[mapping["sample_id"]]).strip()
        if not sample_id:
            import_results.append({
                "row": row_num,
                "sample_id": "",
                "status": "skipped",
                "reason": "样本编号为空"
            })
            continue

        try:
            sample = SampleRecord(
                sample_id=sample_id,
                model_version=model_version,
                original_row_number=row_num,
                model_output=str(row[mapping["model_output"]]).strip(),
                expected_summary=str(row[mapping["expected_summary"]]).strip(),
                fact_check_result=str(row[mapping["fact_check_result"]]).strip(),
                raw_data={col: str(row[col]).strip() for col in columns},
                imported_at=datetime.now()
            )

            record = engine.create_verification_record(batch_id, sample, operator)
            import_results.append({
                "row": row_num,
                "sample_id": sample_id,
                "status": "success",
                "record_id": record.id,
                "conflict_type": record.conflict_type,
                "verification_status": record.status
            })
        except Exception as e:
            import_results.append({
                "row": row_num,
                "sample_id": sample_id,
                "status": "error",
                "reason": str(e)
            })

    return batch, import_results


def import_manual_judgements(
    file_path: str,
    batch_id: str,
    operator: str,
    column_mapping: Optional[Dict[str, str]] = None
) -> List[Dict[str, Any]]:
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    batch = storage.get_batch(batch_id)
    if not batch:
        raise ValueError(f"Batch not found: {batch_id}")

    if path.suffix.lower() in [".xlsx", ".xls"]:
        df = pd.read_excel(path, dtype=str)
    elif path.suffix.lower() == ".csv":
        df = pd.read_csv(path, dtype=str)
    else:
        raise ValueError(f"Unsupported file format: {path.suffix}")

    df = df.fillna("")
    columns = list(df.columns)

    mapping = column_mapping or {}
    for field, candidates in DEFAULT_MANUAL_JUDGEMENT_COLUMNS.items():
        if field not in mapping:
            found = _find_column(columns, candidates)
            if found:
                mapping[field] = found

    required_fields = ["sample_id", "is_correct"]
    missing = [f for f in required_fields if f not in mapping or not mapping[f]]
    if missing:
        raise ValueError(f"Missing required columns: {missing}. Available columns: {columns}")

    storage.add_operation_log(
        batch_id, "import_manual_judgements", operator,
        details={"file": str(path)}
    )

    results = []
    for idx, row in df.iterrows():
        row_num = idx + 2

        sample_id = str(row[mapping["sample_id"]]).strip()
        if not sample_id:
            results.append({
                "row": row_num,
                "sample_id": "",
                "status": "skipped",
                "reason": "样本编号为空"
            })
            continue

        record = storage.get_verification_record(batch_id, sample_id)
        if not record:
            results.append({
                "row": row_num,
                "sample_id": sample_id,
                "status": "skipped",
                "reason": "未找到对应校验记录"
            })
            continue

        is_correct_val = str(row[mapping["is_correct"]]).strip().lower()
        is_correct = is_correct_val in ["是", "正确", "true", "1", "yes", "y"]

        corrected_summary = ""
        if "corrected_summary" in mapping and mapping["corrected_summary"]:
            corrected_summary = str(row[mapping["corrected_summary"]]).strip()

        judge_comment = ""
        if "judge_comment" in mapping and mapping["judge_comment"]:
            judge_comment = str(row[mapping["judge_comment"]]).strip()

        judged_by = operator
        if "judged_by" in mapping and mapping["judged_by"]:
            val = str(row[mapping["judged_by"]]).strip()
            if val:
                judged_by = val

        try:
            judgement = ManualJudgement(
                sample_id=sample_id,
                judge_row_number=row_num,
                is_correct=is_correct,
                corrected_summary=corrected_summary or None,
                judge_comment=judge_comment or None,
                judged_by=judged_by,
                raw_data={col: str(row[col]).strip() for col in columns}
            )

            updated = engine.attach_manual_judgement(record.id, judgement, operator)
            results.append({
                "row": row_num,
                "sample_id": sample_id,
                "status": "success",
                "new_status": updated.status
            })
        except Exception as e:
            results.append({
                "row": row_num,
                "sample_id": sample_id,
                "status": "error",
                "reason": str(e)
            })

    return results

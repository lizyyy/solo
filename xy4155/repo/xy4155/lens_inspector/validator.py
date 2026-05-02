"""镜头瑕疵分拣台 - 数据校验模块"""

import os
import re
from pathlib import Path
from typing import List, Dict, Optional, Tuple, Set
from datetime import datetime

import pandas as pd

from .models import LensNote


SUPPORTED_IMAGE_FORMATS = {".jpg", ".jpeg", ".png", ".tiff", ".tif", ".bmp"}


class ValidationError(Exception):
    def __init__(self, message: str, errors: List[str] = None):
        super().__init__(message)
        self.errors = errors or []


class DataValidator:
    @staticmethod
    def validate_image_directory(directory: str) -> Tuple[List[Path], List[str]]:
        dir_path = Path(directory)
        if not dir_path.exists():
            raise ValidationError(f"目录不存在: {directory}")
        if not dir_path.is_dir():
            raise ValidationError(f"路径不是目录: {directory}")

        image_files = []
        errors = []

        for file_path in dir_path.iterdir():
            if file_path.is_file():
                ext = file_path.suffix.lower()
                if ext in SUPPORTED_IMAGE_FORMATS:
                    image_files.append(file_path)
                else:
                    errors.append(f"不支持的文件格式: {file_path.name}")

        if not image_files:
            raise ValidationError(
                f"目录中没有找到支持的图片文件: {directory}\n"
                f"支持的格式: {', '.join(SUPPORTED_IMAGE_FORMATS)}"
            )

        return sorted(image_files), errors

    @staticmethod
    def extract_lens_id_from_filename(filename: str) -> Optional[str]:
        patterns = [
            r"^LENS-(\d+)",
            r"^LENS(\d+)",
            r"^lens[_-]?(\d+)",
            r"^(\d{6,})[-_]",
            r"^([A-Z]{2,3}\d{4,})",
        ]

        for pattern in patterns:
            match = re.match(pattern, filename, re.IGNORECASE)
            if match:
                return match.group(1).upper()

        base_name = os.path.splitext(filename)[0]
        parts = re.split(r"[-_\s]", base_name)
        for part in parts:
            if re.match(r"^\d{6,}$", part):
                return part
            if re.match(r"^[A-Z]{2,3}\d{4,}$", part):
                return part.upper()

        return base_name[:12] if len(base_name) > 0 else None

    @staticmethod
    def group_images_by_lens(image_files: List[Path]) -> Dict[str, List[Path]]:
        grouped: Dict[str, List[Path]] = {}
        ungrouped: List[Path] = []

        for file_path in image_files:
            lens_id = DataValidator.extract_lens_id_from_filename(file_path.name)
            if lens_id:
                if lens_id not in grouped:
                    grouped[lens_id] = []
                grouped[lens_id].append(file_path)
            else:
                ungrouped.append(file_path)

        if ungrouped:
            default_group = "UNKNOWN_LENS"
            if default_group not in grouped:
                grouped[default_group] = []
            grouped[default_group].extend(ungrouped)

        return grouped

    @staticmethod
    def validate_notes_csv(csv_path: str) -> Tuple[pd.DataFrame, List[str]]:
        file_path = Path(csv_path)
        if not file_path.exists():
            raise ValidationError(f"CSV文件不存在: {csv_path}")
        if not file_path.is_file():
            raise ValidationError(f"路径不是文件: {csv_path}")

        try:
            df = pd.read_csv(csv_path, encoding="utf-8")
        except UnicodeDecodeError:
            df = pd.read_csv(csv_path, encoding="gbk")
        except Exception as e:
            raise ValidationError(f"无法读取CSV文件: {e}")

        required_columns = ["lens_id"]
        optional_columns = ["body_id", "notes", "inspector", "received_date"]

        errors = []
        lower_columns = {col.lower(): col for col in df.columns}

        for req_col in required_columns:
            if req_col.lower() not in lower_columns:
                errors.append(f"缺少必要列: {req_col}")

        if errors:
            raise ValidationError("CSV格式错误", errors)

        if "lens_id" in lower_columns:
            df.rename(columns={lower_columns["lens_id"]: "lens_id"}, inplace=True)

        if df["lens_id"].isna().any():
            errors.append("存在空的lens_id")

        duplicated_lens = df[df.duplicated("lens_id")]["lens_id"].tolist()
        if duplicated_lens:
            errors.append(f"存在重复的lens_id: {duplicated_lens}")

        if "received_date" in df.columns:
            try:
                df["received_date"] = pd.to_datetime(df["received_date"])
            except Exception as e:
                errors.append(f"日期列格式错误: {e}")

        return df, errors

    @staticmethod
    def parse_lens_notes(df: pd.DataFrame) -> Dict[str, LensNote]:
        notes_dict: Dict[str, LensNote] = {}

        for _, row in df.iterrows():
            lens_id = str(row.get("lens_id", "")).strip()
            if not lens_id:
                continue

            body_id = row.get("body_id")
            if pd.notna(body_id):
                body_id = str(body_id).strip()
            else:
                body_id = None

            notes = str(row.get("notes", "")) if pd.notna(row.get("notes")) else ""
            inspector = (
                str(row.get("inspector", ""))
                if pd.notna(row.get("inspector"))
                else ""
            )

            received_date = None
            if "received_date" in row.index and pd.notna(row["received_date"]):
                if isinstance(row["received_date"], datetime):
                    received_date = row["received_date"]
                else:
                    try:
                        received_date = pd.to_datetime(row["received_date"]).to_pydatetime()
                    except:
                        pass

            metadata = {}
            for col in row.index:
                if col not in ["lens_id", "body_id", "notes", "inspector", "received_date"]:
                    if pd.notna(row[col]):
                        metadata[col] = row[col]

            notes_dict[lens_id] = LensNote(
                lens_id=lens_id,
                body_id=body_id,
                notes=notes,
                inspector=inspector,
                received_date=received_date,
                metadata=metadata,
            )

        return notes_dict

    @staticmethod
    def validate_session(
        image_dir: str, notes_csv: Optional[str] = None
    ) -> Tuple[Dict[str, List[Path]], Dict[str, LensNote], List[str]]:
        images, image_errors = DataValidator.validate_image_directory(image_dir)
        grouped_images = DataValidator.group_images_by_lens(images)

        notes_dict: Dict[str, LensNote] = {}
        all_errors = image_errors.copy()

        if notes_csv and Path(notes_csv).exists():
            try:
                df, csv_errors = DataValidator.validate_notes_csv(notes_csv)
                notes_dict = DataValidator.parse_lens_notes(df)
                all_errors.extend(csv_errors)

                image_lens_ids = set(grouped_images.keys())
                note_lens_ids = set(notes_dict.keys())
                missing_in_notes = image_lens_ids - note_lens_ids
                missing_in_images = note_lens_ids - image_lens_ids

                if missing_in_notes:
                    all_errors.append(
                        f"图片中存在但备注中没有的镜头: {sorted(missing_in_notes)}"
                    )
                if missing_in_images:
                    all_errors.append(
                        f"备注中存在但图片中没有的镜头: {sorted(missing_in_images)}"
                    )
            except ValidationError as e:
                all_errors.extend(e.errors)
                raise ValidationError(f"CSV验证失败: {e}", all_errors)

        return grouped_images, notes_dict, all_errors

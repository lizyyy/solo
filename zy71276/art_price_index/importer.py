import os
import csv
import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from uuid import uuid5, NAMESPACE_URL
import pandas as pd

from .models import (
    AuctionRecord,
    Artist,
    Medium,
    RecordState,
    Issue,
    IssueType,
    IssueSeverity,
    ProcessingResult,
    ProcessingStatus,
)


class DirectoryImporter:
    def __init__(
        self,
        directory_path: str,
        file_patterns: List[str] = None,
        encoding: str = "utf-8",
    ):
        self.directory_path = Path(directory_path)
        self.file_patterns = file_patterns or ["*.csv", "*.xlsx", "*.xls", "*.json"]
        self.encoding = encoding
        self.artists: Dict[str, Artist] = {}
        self.media: Dict[str, Medium] = {}
        self.column_mappings = {
            "artist": ["artist", "artist_name", "作者", "艺术家"],
            "title": ["title", "artwork_title", "作品名称", "拍品名称"],
            "medium": ["medium", "材质", "媒介", "medium_type"],
            "date": [
                "auction_date",
                "date",
                "成交日期",
                "拍卖日期",
                "sale_date",
                "transaction_date",
            ],
            "price": [
                "price",
                "hammer_price",
                "成交价",
                "成交价格",
                "sold_price",
                "final_price",
            ],
            "currency": ["currency", "币种", "货币", "price_currency"],
            "lot_number": ["lot", "lot_number", "拍品号", "lot_id"],
            "auction_house": [
                "auction_house",
                "拍卖行",
                "auction_company",
                "house",
            ],
            "dimensions": ["dimensions", "尺寸", "size"],
            "estimate_low": ["estimate_low", "low_estimate", "估价低"],
            "estimate_high": ["estimate_high", "high_estimate", "估价高"],
            "location": ["location", "地点", "auction_location"],
        }

    def _find_files(self) -> List[Path]:
        files = []
        for pattern in self.file_patterns:
            files.extend(self.directory_path.rglob(pattern))
        return sorted(files)

    def _detect_columns(self, df: pd.DataFrame) -> Dict[str, str]:
        detected = {}
        df_columns_lower = {col.lower(): col for col in df.columns}

        for standard_name, possible_names in self.column_mappings.items():
            for possible in possible_names:
                possible_lower = possible.lower()
                if possible_lower in df_columns_lower:
                    detected[standard_name] = df_columns_lower[possible_lower]
                    break
        return detected

    def _get_or_create_artist(self, name: str) -> Artist:
        if not name:
            name = "Unknown Artist"
        artist_id = str(uuid5(NAMESPACE_URL, f"artist:{name.strip().lower()}"))
        if artist_id not in self.artists:
            self.artists[artist_id] = Artist(artist_id=artist_id, name=name.strip())
        self.artists[artist_id].total_auctions += 1
        return self.artists[artist_id]

    def _get_or_create_medium(self, name: str) -> Medium:
        if not name:
            name = "Unknown Medium"
        medium_id = str(uuid5(NAMESPACE_URL, f"medium:{name.strip().lower()}"))
        if medium_id not in self.media:
            self.media[medium_id] = Medium(medium_id=medium_id, name=name.strip())
        self.media[medium_id].total_records += 1
        return self.media[medium_id]

    def _parse_date(self, date_value: Any) -> Tuple[Optional[datetime], Optional[Issue]]:
        if pd.isna(date_value) or date_value == "":
            return None, Issue(
                issue_type=IssueType.MISSING_FIELD,
                severity=IssueSeverity.WARNING,
                message="拍卖日期缺失",
                field="auction_date",
                impact="无法按时间序列分析，记录可能被排除",
                suggestion="补充拍卖日期或检查源数据格式",
            )

        if isinstance(date_value, datetime):
            return date_value, None

        date_str = str(date_value).strip()
        date_formats = [
            "%Y-%m-%d",
            "%Y/%m/%d",
            "%d-%m-%Y",
            "%d/%m/%Y",
            "%Y年%m月%d日",
            "%Y.%m.%d",
            "%b %d, %Y",
            "%B %d, %Y",
            "%Y-%m-%d %H:%M:%S",
        ]

        for fmt in date_formats:
            try:
                return datetime.strptime(date_str, fmt), None
            except ValueError:
                continue

        return None, Issue(
            issue_type=IssueType.INVALID_DATE,
            severity=IssueSeverity.ERROR,
            message=f"无法解析日期格式: {date_str}",
            field="auction_date",
            impact="无法按时间序列分析，记录将被排除",
            suggestion="使用标准日期格式 (YYYY-MM-DD)",
        )

    def _parse_price(self, price_value: Any) -> Tuple[Optional[float], Optional[Issue]]:
        if pd.isna(price_value) or price_value == "" or price_value is None:
            return None, Issue(
                issue_type=IssueType.MISSING_FIELD,
                severity=IssueSeverity.ERROR,
                message="成交价缺失",
                field="price",
                impact="无法计算价格指数，记录将被排除",
                suggestion="补充成交价格",
            )

        if isinstance(price_value, (int, float)):
            return float(price_value), None

        price_str = str(price_value).strip()
        price_str = price_str.replace(",", "").replace(" ", "")
        price_str = price_str.replace("¥", "").replace("￥", "")
        price_str = price_str.replace("$", "").replace("€", "").replace("£", "")

        try:
            return float(price_str), None
        except ValueError:
            return None, Issue(
                issue_type=IssueType.INVALID_PRICE,
                severity=IssueSeverity.ERROR,
                message=f"无法解析价格格式: {price_value}",
                field="price",
                impact="无法计算价格指数，记录将被排除",
                suggestion="使用纯数字格式或常见货币格式",
            )

    def _parse_currency(self, currency_value: Any, price_value: Any = None) -> str:
        if pd.isna(currency_value) or currency_value == "":
            if price_value:
                price_str = str(price_value)
                if "¥" in price_str or "￥" in price_str:
                    return "CNY"
                elif "$" in price_str:
                    return "USD"
                elif "€" in price_str:
                    return "EUR"
                elif "£" in price_str:
                    return "GBP"
            return "UNKNOWN"

        curr = str(currency_value).strip().upper()
        currency_map = {
            "人民币": "CNY",
            "CNY": "CNY",
            "RMB": "CNY",
            "美元": "USD",
            "USD": "USD",
            "HKD": "HKD",
            "港币": "HKD",
            "欧元": "EUR",
            "EUR": "EUR",
            "英镑": "GBP",
            "GBP": "GBP",
            "日元": "JPY",
            "JPY": "JPY",
            "KRW": "KRW",
            "韩元": "KRW",
        }
        return currency_map.get(curr, curr)

    def _import_csv(self, file_path: Path) -> Tuple[List[AuctionRecord], List[Issue]]:
        records = []
        issues = []

        try:
            encodings_to_try = [self.encoding, "gbk", "gb2312", "latin1"]
            df = None
            last_error = None

            for enc in encodings_to_try:
                try:
                    df = pd.read_csv(file_path, encoding=enc, low_memory=False)
                    break
                except UnicodeDecodeError as e:
                    last_error = e
                    continue

            if df is None:
                raise last_error or Exception("无法解析CSV文件编码")

        except Exception as e:
            issues.append(
                Issue(
                    issue_type=IssueType.CORRUPT_FILE,
                    severity=IssueSeverity.CRITICAL,
                    message=f"CSV文件读取失败: {str(e)}",
                    field="file",
                    impact="整个文件无法导入",
                    suggestion="检查文件是否损坏或格式正确",
                )
            )
            return records, issues

        return self._process_dataframe(df, file_path.name)

    def _import_excel(self, file_path: Path) -> Tuple[List[AuctionRecord], List[Issue]]:
        records = []
        issues = []

        try:
            df = pd.read_excel(file_path, engine="openpyxl")
        except Exception as e:
            try:
                df = pd.read_excel(file_path, engine="xlrd")
            except Exception as e2:
                issues.append(
                    Issue(
                        issue_type=IssueType.CORRUPT_FILE,
                        severity=IssueSeverity.CRITICAL,
                        message=f"Excel文件读取失败: {str(e)}",
                        field="file",
                        impact="整个文件无法导入",
                        suggestion="检查文件是否损坏或格式正确，确保安装了openpyxl或xlrd",
                    )
                )
                return records, issues

        return self._process_dataframe(df, file_path.name)

    def _import_json(self, file_path: Path) -> Tuple[List[AuctionRecord], List[Issue]]:
        records = []
        issues = []

        try:
            with open(file_path, "r", encoding=self.encoding) as f:
                data = json.load(f)

            if isinstance(data, list):
                df = pd.DataFrame(data)
            elif isinstance(data, dict):
                df = pd.DataFrame([data])
            else:
                raise ValueError("JSON格式不正确，需要数组或对象")
        except Exception as e:
            issues.append(
                Issue(
                    issue_type=IssueType.CORRUPT_FILE,
                    severity=IssueSeverity.CRITICAL,
                    message=f"JSON文件读取失败: {str(e)}",
                    field="file",
                    impact="整个文件无法导入",
                    suggestion="检查JSON语法是否正确",
                )
            )
            return records, issues

        return self._process_dataframe(df, file_path.name)

    def _process_dataframe(
        self, df: pd.DataFrame, source_file: str
    ) -> Tuple[List[AuctionRecord], List[Issue]]:
        records = []
        issues = []
        columns = self._detect_columns(df)

        for idx, row in df.iterrows():
            record = AuctionRecord(source_file=source_file)
            record.lot_number = str(row.get(columns.get("lot_number", ""), ""))
            record.artwork_title = str(row.get(columns.get("title", ""), ""))
            record.auction_house = str(row.get(columns.get("auction_house", ""), ""))
            record.dimensions = str(row.get(columns.get("dimensions", ""), ""))
            record.location = str(row.get(columns.get("location", ""), ""))

            artist_name = str(row.get(columns.get("artist", ""), ""))
            if artist_name and artist_name != "nan":
                record.artist_name = artist_name
                record.artist = self._get_or_create_artist(artist_name)

            medium_name = str(row.get(columns.get("medium", ""), ""))
            if medium_name and medium_name != "nan":
                record.medium_name = medium_name
                record.medium = self._get_or_create_medium(medium_name)

            auction_date, date_issue = self._parse_date(
                row.get(columns.get("date", ""))
            )
            if date_issue:
                record.add_issue(date_issue)
                issues.append(date_issue)
            record.auction_date = auction_date

            original_price, price_issue = self._parse_price(
                row.get(columns.get("price", ""))
            )
            if price_issue:
                record.add_issue(price_issue)
                issues.append(price_issue)
            record.original_price = original_price

            currency = self._parse_currency(
                row.get(columns.get("currency", "")), row.get(columns.get("price", ""))
            )
            record.original_currency = currency
            if currency == "UNKNOWN":
                currency_issue = Issue(
                    issue_type=IssueType.UNKNOWN_CURRENCY,
                    severity=IssueSeverity.WARNING,
                    message="无法识别币种",
                    field="currency",
                    impact="无法进行币种归一化，价格可能不可比",
                    suggestion="明确标注币种 (USD, CNY, EUR等)",
                )
                record.add_issue(currency_issue)
                issues.append(currency_issue)

            est_low, _ = self._parse_price(row.get(columns.get("estimate_low", "")))
            est_high, _ = self._parse_price(row.get(columns.get("estimate_high", "")))
            record.estimate_low = est_low
            record.estimate_high = est_high

            if not record.has_errors():
                record.state = RecordState.IMPORTED

            records.append(record)

        return records, issues

    def import_directory(self) -> ProcessingResult:
        result = ProcessingResult(status=ProcessingStatus.PROCESSING)
        files = self._find_files()
        result.total_files = len(files)

        all_records: List[AuctionRecord] = []

        for file_path in files:
            file_result = {
                "file_name": file_path.name,
                "file_path": str(file_path),
                "status": "processing",
                "records_imported": 0,
                "records_failed": 0,
                "issues": [],
            }

            try:
                if file_path.suffix.lower() == ".csv":
                    records, issues = self._import_csv(file_path)
                elif file_path.suffix.lower() in (".xlsx", ".xls"):
                    records, issues = self._import_excel(file_path)
                elif file_path.suffix.lower() == ".json":
                    records, issues = self._import_json(file_path)
                else:
                    file_result["status"] = "skipped"
                    file_result["issues"].append(
                        {
                            "type": "unsupported_format",
                            "message": f"不支持的文件格式: {file_path.suffix}",
                        }
                    )
                    result.file_results.append(file_result)
                    continue

                failed_count = sum(1 for r in records if r.has_errors())
                file_result["records_imported"] = len(records) - failed_count
                file_result["records_failed"] = failed_count
                file_result["issues"] = [i.to_dict() for i in issues]

                if failed_count == len(records) and len(records) > 0:
                    file_result["status"] = "failed"
                    result.failed_files += 1
                elif failed_count > 0:
                    file_result["status"] = "partial"
                    result.successful_files += 1
                else:
                    file_result["status"] = "success"
                    result.successful_files += 1

                all_records.extend(records)
                result.issues.extend(issues)

            except Exception as e:
                file_result["status"] = "failed"
                file_result["issues"].append(
                    {
                        "type": "file_processing_error",
                        "message": f"文件处理异常: {str(e)}",
                    }
                )
                result.failed_files += 1
                result.issues.append(
                    Issue(
                        issue_type=IssueType.PARSE_ERROR,
                        severity=IssueSeverity.CRITICAL,
                        message=f"文件 {file_path.name} 处理异常: {str(e)}",
                        field="file",
                        impact="该文件所有记录无法导入",
                        suggestion="检查文件内容格式是否一致",
                    )
                )

            result.file_results.append(file_result)

        result.records = all_records
        result.total_records = len(all_records)
        result.valid_records = sum(1 for r in all_records if not r.has_errors())
        result.excluded_records = sum(1 for r in all_records if r.has_errors())
        result.artists = self.artists
        result.media = self.media

        for record in all_records:
            state = record.state.value
            result.records_by_state[state] = result.records_by_state.get(state, 0) + 1

        if result.failed_files == 0:
            result.status = ProcessingStatus.COMPLETED
        elif result.successful_files > 0:
            result.status = ProcessingStatus.PARTIAL
        else:
            result.status = ProcessingStatus.FAILED

        result.completed_at = datetime.now()
        return result

import os
import glob
import pandas as pd
from datetime import datetime
from typing import Dict, List, Any, Optional
from pathlib import Path
import logging
from models import (
    Policy, SignRecord, VisitRecord, FeeRecord,
    SurrenderApplication, VisitStatus
)


logger = logging.getLogger(__name__)


class DataVersionManager:
    def __init__(self):
        self.versions = {}
        self.data_store = {}

    def get_latest_version(self, data_type: str) -> int:
        return self.versions.get(data_type, 0)

    def add_version(self, data_type: str, source_file: str, record_count: int) -> int:
        version = self.get_latest_version(data_type) + 1
        if data_type not in self.versions:
            self.versions[data_type] = 0
        self.versions[data_type] = version
        
        if data_type not in self.data_store:
            self.data_store[data_type] = {}
        
        self.data_store[data_type][f"v{version}"] = {
            "version": version,
            "import_time": datetime.now(),
            "source_file": source_file,
            "record_count": record_count,
            "records": []
        }
        return version

    def get_data(self, data_type: str, version: str = None) -> List:
        if data_type not in self.data_store:
            return []
        
        if version is None:
            latest_v = self.get_latest_version(data_type)
            version = f"v{latest_v}"
        
        return self.data_store[data_type].get(version, {}).get("records", [])

    def get_all_versions(self, data_type: str) -> Dict:
        return self.data_store.get(data_type, {})


class DataLoader:
    def __init__(self, config):
        self.config = config
        self.version_manager = DataVersionManager()
        self._ensure_directories()

    def _ensure_directories(self):
        paths = self.config.paths
        for key, path in paths.items():
            if key != "db_path":
                Path(path).mkdir(parents=True, exist_ok=True)

    def load_all_data(self) -> Dict[str, List]:
        logger.info("开始加载所有数据...")
        
        result = {
            "policies": self.load_policies(),
            "sign_records": self.load_sign_records(),
            "visit_records": self.load_visit_records(),
            "fee_records": self.load_fee_records(),
            "surrender_apps": self.load_surrender_applications(),
        }
        
        logger.info(f"数据加载完成: 保单{len(result['policies'])}条, "
                   f"签收{len(result['sign_records'])}条, "
                   f"回访{len(result['visit_records'])}条, "
                   f"扣费{len(result['fee_records'])}条, "
                   f"退保申请{len(result['surrender_apps'])}条")
        
        return result

    def _find_files(self, pattern: str) -> List[str]:
        input_dir = self.config.paths.get("input_dir", "./data/input")
        full_pattern = os.path.join(input_dir, pattern)
        files = glob.glob(full_pattern)
        return sorted(files, key=os.path.getmtime, reverse=True)

    def _read_excel_safe(self, file_path: str, sheet_name: str = "Sheet1") -> pd.DataFrame:
        try:
            df = pd.read_excel(file_path, sheet_name=sheet_name, dtype=str)
            df = df.where(pd.notnull(df), None)
            return df
        except Exception as e:
            logger.error(f"读取文件失败 {file_path}: {e}")
            return pd.DataFrame()

    def load_policies(self) -> List[Policy]:
        source_config = self.config.data_sources.get("policy", {})
        pattern = source_config.get("filename_pattern", "policy_*.xlsx")
        sheet_name = source_config.get("sheet_name", "Sheet1")
        
        files = self._find_files(pattern)
        if not files:
            logger.warning("未找到保单数据文件")
            return []

        all_policies = []
        for file_path in files:
            df = self._read_excel_safe(file_path, sheet_name)
            if df.empty:
                continue

            version = self.version_manager.add_version("policy", file_path, len(df))
            policies = []
            
            for _, row in df.iterrows():
                try:
                    policy = Policy(
                        policy_no=str(row.get("保单号", row.get("policy_no", ""))).strip(),
                        policy_name=str(row.get("险种名称", row.get("policy_name", ""))).strip(),
                        applicant_name=str(row.get("投保人", row.get("applicant_name", ""))).strip(),
                        insured_name=str(row.get("被保险人", row.get("insured_name", ""))).strip(),
                        premium=float(row.get("保费", row.get("premium", 0)) or 0),
                        policy_date=pd.to_datetime(row.get("保单生效日", row.get("policy_date"))).date() if pd.notna(row.get("保单生效日", row.get("policy_date"))) else None,
                        policy_period=int(row.get("保险期间", row.get("policy_period", 0)) or 0),
                        payment_method=str(row.get("缴费方式", row.get("payment_method", ""))).strip()
                    )
                    policies.append(policy)
                except Exception as e:
                    logger.warning(f"解析保单数据失败: {row}, 错误: {e}")

            if "policy" in self.version_manager.data_store:
                self.version_manager.data_store["policy"][f"v{version}"]["records"] = policies
            all_policies.extend(policies)

        return all_policies

    def load_sign_records(self) -> List[SignRecord]:
        source_config = self.config.data_sources.get("sign_record", {})
        pattern = source_config.get("filename_pattern", "sign_*.xlsx")
        sheet_name = source_config.get("sheet_name", "Sheet1")
        
        files = self._find_files(pattern)
        if not files:
            logger.warning("未找到签收记录文件")
            return []

        all_records = []
        for file_path in files:
            df = self._read_excel_safe(file_path, sheet_name)
            if df.empty:
                continue

            version = self.version_manager.add_version("sign_record", file_path, len(df))
            records = []
            
            for _, row in df.iterrows():
                try:
                    record = SignRecord(
                        policy_no=str(row.get("保单号", row.get("policy_no", ""))).strip(),
                        sign_date=pd.to_datetime(row.get("签收日期", row.get("sign_date"))).date() if pd.notna(row.get("签收日期", row.get("sign_date"))) else None,
                        sign_person=str(row.get("签收人", row.get("sign_person", ""))).strip(),
                        sign_method=str(row.get("签收方式", row.get("sign_method", "纸质"))).strip(),
                        delivery_no=str(row.get("快递单号", row.get("delivery_no", "")) or "").strip()
                    )
                    records.append(record)
                except Exception as e:
                    logger.warning(f"解析签收记录失败: {row}, 错误: {e}")

            if "sign_record" in self.version_manager.data_store:
                self.version_manager.data_store["sign_record"][f"v{version}"]["records"] = records
            all_records.extend(records)

        return all_records

    def load_visit_records(self) -> List[VisitRecord]:
        source_config = self.config.data_sources.get("visit_record", {})
        pattern = source_config.get("filename_pattern", "visit_*.xlsx")
        sheet_name = source_config.get("sheet_name", "Sheet1")
        
        files = self._find_files(pattern)
        if not files:
            logger.warning("未找到回访记录文件")
            return []

        all_records = []
        for file_path in files:
            df = self._read_excel_safe(file_path, sheet_name)
            if df.empty:
                continue

            version = self.version_manager.add_version("visit_record", file_path, len(df))
            records = []
            
            for _, row in df.iterrows():
                try:
                    visit_status_str = str(row.get("回访状态", row.get("visit_status", "未回访"))).strip()
                    if "成功" in visit_status_str or "已回访" in visit_status_str:
                        visit_status = VisitStatus.VISITED
                    elif "失败" in visit_status_str:
                        visit_status = VisitStatus.VISIT_FAILED
                    else:
                        visit_status = VisitStatus.NOT_VISITED

                    record = VisitRecord(
                        policy_no=str(row.get("保单号", row.get("policy_no", ""))).strip(),
                        visit_date=pd.to_datetime(row.get("回访时间", row.get("visit_date"))) if pd.notna(row.get("回访时间", row.get("visit_date"))) else datetime.now(),
                        visitor=str(row.get("回访人", row.get("visitor", ""))).strip(),
                        visit_status=visit_status,
                        visit_result=str(row.get("回访结果", row.get("visit_result", ""))).strip(),
                        recording_file=str(row.get("录音文件", row.get("recording_file", "")) or "").strip(),
                        visit_notes=str(row.get("备注", row.get("visit_notes", "")) or "").strip()
                    )
                    records.append(record)
                except Exception as e:
                    logger.warning(f"解析回访记录失败: {row}, 错误: {e}")

            if "visit_record" in self.version_manager.data_store:
                self.version_manager.data_store["visit_record"][f"v{version}"]["records"] = records
            all_records.extend(records)

        return all_records

    def load_fee_records(self) -> List[FeeRecord]:
        source_config = self.config.data_sources.get("fee_record", {})
        pattern = source_config.get("filename_pattern", "fee_*.xlsx")
        sheet_name = source_config.get("sheet_name", "Sheet1")
        
        files = self._find_files(pattern)
        if not files:
            logger.warning("未找到扣费记录文件")
            return []

        all_records = []
        for file_path in files:
            df = self._read_excel_safe(file_path, sheet_name)
            if df.empty:
                continue

            version = self.version_manager.add_version("fee_record", file_path, len(df))
            records = []
            
            for _, row in df.iterrows():
                try:
                    record = FeeRecord(
                        policy_no=str(row.get("保单号", row.get("policy_no", ""))).strip(),
                        fee_date=pd.to_datetime(row.get("扣费日期", row.get("fee_date"))).date() if pd.notna(row.get("扣费日期", row.get("fee_date"))) else None,
                        fee_amount=float(row.get("扣费金额", row.get("fee_amount", 0)) or 0),
                        fee_type=str(row.get("费用类型", row.get("fee_type", "保费"))).strip(),
                        transaction_no=str(row.get("交易流水号", row.get("transaction_no", ""))).strip(),
                        payment_channel=str(row.get("扣费渠道", row.get("payment_channel", ""))).strip()
                    )
                    records.append(record)
                except Exception as e:
                    logger.warning(f"解析扣费记录失败: {row}, 错误: {e}")

            if "fee_record" in self.version_manager.data_store:
                self.version_manager.data_store["fee_record"][f"v{version}"]["records"] = records
            all_records.extend(records)

        return all_records

    def load_surrender_applications(self) -> List[SurrenderApplication]:
        source_config = self.config.data_sources.get("surrender_app", {})
        pattern = source_config.get("filename_pattern", "surrender_*.xlsx")
        sheet_name = source_config.get("sheet_name", "Sheet1")
        
        files = self._find_files(pattern)
        if not files:
            logger.warning("未找到退保申请文件")
            return []

        all_records = []
        for file_path in files:
            df = self._read_excel_safe(file_path, sheet_name)
            if df.empty:
                continue

            version = self.version_manager.add_version("surrender_app", file_path, len(df))
            records = []
            
            for _, row in df.iterrows():
                try:
                    record = SurrenderApplication(
                        policy_no=str(row.get("保单号", row.get("policy_no", ""))).strip(),
                        apply_no=str(row.get("申请编号", row.get("apply_no", ""))).strip(),
                        apply_date=pd.to_datetime(row.get("申请日期", row.get("apply_date"))).date() if pd.notna(row.get("申请日期", row.get("apply_date"))) else None,
                        applicant=str(row.get("申请人", row.get("applicant", ""))).strip(),
                        surrender_reason=str(row.get("退保原因", row.get("surrender_reason", ""))).strip(),
                        surrender_type=str(row.get("退保类型", row.get("surrender_type", "全额退保"))).strip(),
                        apply_channel=str(row.get("申请渠道", row.get("apply_channel", ""))).strip(),
                        apply_notes=str(row.get("备注", row.get("apply_notes", "")) or "").strip()
                    )
                    records.append(record)
                except Exception as e:
                    logger.warning(f"解析退保申请失败: {row}, 错误: {e}")

            if "surrender_app" in self.version_manager.data_store:
                self.version_manager.data_store["surrender_app"][f"v{version}"]["records"] = records
            all_records.extend(records)

        return all_records

    def get_version_info(self) -> Dict:
        info = {}
        for data_type in self.version_manager.versions:
            info[data_type] = {
                "latest_version": self.version_manager.get_latest_version(data_type),
                "versions": self.version_manager.get_all_versions(data_type)
            }
        return info

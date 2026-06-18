#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
海草床调查异常预警 - 核心逻辑模块
参数名和错误提示保持稳定，供日常脚本调用
"""

import os
import re
import csv
import glob
import yaml
import hashlib
from datetime import datetime
from typing import List, Dict, Any, Tuple, Optional

ERROR_MESSAGES = {
    "CONFIG_NOT_FOUND": "[SEAGRASS_ERROR_001] 配置文件未找到: {path}",
    "INVALID_CONFIG": "[SEAGRASS_ERROR_002] 配置文件格式错误: {detail}",
    "INPUT_DIR_EMPTY": "[SEAGRASS_ERROR_003] 输入目录为空，没有找到任何数据文件: {path}",
    "SENSOR_DATA_MISSING": "[SEAGRASS_ERROR_004] 缺少传感器数据文件",
    "CSV_WRITE_FAILED": "[SEAGRASS_ERROR_005] CSV明细写入失败: {path}",
    "INVALID_DATA_FORMAT": "[SEAGRASS_ERROR_006] 数据格式错误: {detail}",
    "DRIFT_DETECTION_FAILED": "[SEAGRASS_ERROR_007] 传感器漂移检测失败: {detail}",
    "HISTORY_SAVE_FAILED": "[SEAGRASS_ERROR_008] 历史记录保存失败: {detail}",
}

SOURCE_TYPES = {
    "sensor": "传感器数据",
    "ship": "船上记录",
    "remote_sensing": "遥感截图",
    "boundary": "边界样本",
    "note": "口头备注",
}

ANOMALY_TYPES = {
    "threshold_exceed": "阈值超限",
    "sensor_drift": "传感器漂移",
    "outdated_screenshot": "遥感截图旧版",
    "boundary_case": "边界样本",
    "ship_record_delay": "船上记录滞后",
    "manual_note": "备注提示",
}


class SeagrassAlert:
    """海草床调查异常预警核心类"""

    def __init__(self, config_path: str = "config.yaml"):
        self.config = self._load_config(config_path)
        self.alert_results: List[Dict[str, Any]] = []
        self.source_impact: Dict[str, List[str]] = {}
        self.run_timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    def _load_config(self, config_path: str) -> Dict[str, Any]:
        """加载配置文件，参数名保持稳定"""
        if not os.path.exists(config_path):
            raise FileNotFoundError(
                ERROR_MESSAGES["CONFIG_NOT_FOUND"].format(path=config_path)
            )
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                config = yaml.safe_load(f)
            return config["seagrass_warning"]
        except Exception as e:
            raise ValueError(
                ERROR_MESSAGES["INVALID_CONFIG"].format(detail=str(e))
            )

    def _get_data_files(self, source_type: str) -> List[str]:
        """获取指定类型的数据文件列表"""
        pattern_key = f"{source_type}_pattern"
        if source_type == "remote_sensing":
            pattern_key = "remote_sensing_pattern"
        elif source_type == "ship":
            pattern_key = "ship_record_pattern"
        elif source_type == "note":
            pattern_key = "note_pattern"
        elif source_type == "boundary":
            pattern_key = "boundary_sample_pattern"
        else:
            pattern_key = f"{source_type}_data_pattern"

        pattern = self.config["data_sources"].get(pattern_key, "")
        input_dir = self.config["input_dir"]
        return sorted(glob.glob(os.path.join(input_dir, pattern)))

    def _parse_timestamp(self, ts_str: str) -> datetime:
        """解析时间戳，支持多种格式"""
        for fmt in ["%Y-%m-%d %H:%M:%S", "%Y%m%d_%H%M%S", "%Y-%m-%d", "%Y%m%d"]:
            try:
                return datetime.strptime(ts_str.strip(), fmt)
            except ValueError:
                continue
        return datetime.now()

    def _file_hash(self, filepath: str) -> str:
        """计算文件哈希，用于识别遥感截图旧版"""
        hasher = hashlib.md5()
        with open(filepath, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hasher.update(chunk)
        return hasher.hexdigest()

    def load_sensor_data(self, filepath: str) -> List[Dict[str, Any]]:
        """加载传感器数据"""
        records = []
        try:
            with open(filepath, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    records.append(
                        {
                            "timestamp": self._parse_timestamp(
                                row.get("timestamp", "")
                            ),
                            "temperature": float(row.get("temperature", 0)),
                            "salinity": float(row.get("salinity", 0)),
                            "turbidity": float(row.get("turbidity", 0)),
                            "source_file": os.path.basename(filepath),
                        }
                    )
        except Exception as e:
            raise ValueError(
                ERROR_MESSAGES["INVALID_DATA_FORMAT"].format(
                    detail=f"传感器文件 {filepath}: {str(e)}"
                )
            )
        return records

    def load_ship_records(self, filepath: str) -> List[Dict[str, Any]]:
        """加载船上记录"""
        records = []
        try:
            with open(filepath, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    records.append(
                        {
                            "record_time": self._parse_timestamp(
                                row.get("record_time", "")
                            ),
                            "sensor_time": self._parse_timestamp(
                                row.get("sensor_time", "")
                            ),
                            "location": row.get("location", ""),
                            "observer": row.get("observer", ""),
                            "notes": row.get("notes", ""),
                            "source_file": os.path.basename(filepath),
                        }
                    )
        except Exception as e:
            raise ValueError(
                ERROR_MESSAGES["INVALID_DATA_FORMAT"].format(
                    detail=f"船上记录文件 {filepath}: {str(e)}"
                )
            )
        return records

    def load_boundary_samples(self, filepath: str) -> List[Dict[str, Any]]:
        """加载边界样本"""
        records = []
        try:
            with open(filepath, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    records.append(
                        {
                            "sample_id": row.get("sample_id", ""),
                            "metric": row.get("metric", ""),
                            "value": float(row.get("value", 0)),
                            "is_boundary": row.get("is_boundary", "true").lower()
                            == "true",
                            "source_file": os.path.basename(filepath),
                        }
                    )
        except Exception as e:
            raise ValueError(
                ERROR_MESSAGES["INVALID_DATA_FORMAT"].format(
                    detail=f"边界样本文件 {filepath}: {str(e)}"
                )
            )
        return records

    def load_notes(self, filepath: str) -> List[Dict[str, Any]]:
        """加载口头备注"""
        notes = []
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                for line_num, line in enumerate(f, 1):
                    line = line.strip()
                    if line and not line.startswith("#"):
                        notes.append(
                            {
                                "line_num": line_num,
                                "content": line,
                                "source_file": os.path.basename(filepath),
                            }
                        )
        except Exception as e:
            raise ValueError(
                ERROR_MESSAGES["INVALID_DATA_FORMAT"].format(
                    detail=f"备注文件 {filepath}: {str(e)}"
                )
            )
        return notes

    def detect_sensor_drift(
        self, sensor_records: List[Dict[str, Any]], metric: str
    ) -> List[Dict[str, Any]]:
        """
        检测传感器漂移
        传感器漂移要标成异常处理，而不是默默放行
        """
        drift_results = []
        window = self.config["sensor_params"]["drift_detection_window"]
        max_deviation = self.config["sensor_params"]["drift_max_deviation"]

        try:
            values = [r[metric] for r in sensor_records]

            for i in range(window, len(values)):
                window_values = values[i - window : i]
                current_val = values[i]
                window_mean = sum(window_values) / len(window_values)
                deviation = abs(current_val - window_mean)

                if deviation > max_deviation * (
                    max(window_values) - min(window_values) + 0.001
                ):
                    drift_results.append(
                        {
                            "record_index": i,
                            "metric": metric,
                            "value": current_val,
                            "window_mean": window_mean,
                            "deviation": deviation,
                            "timestamp": sensor_records[i]["timestamp"],
                            "source_file": sensor_records[i]["source_file"],
                            "is_drift": True,
                        }
                    )
        except Exception as e:
            raise RuntimeError(
                ERROR_MESSAGES["DRIFT_DETECTION_FAILED"].format(detail=str(e))
            )

        return drift_results

    def check_threshold_anomaly(
        self, value: float, metric: str
    ) -> Tuple[bool, Optional[str], float]:
        """检查阈值异常"""
        params = self.config["sensor_params"]
        if metric == "temperature":
            threshold = params["temperature_threshold"]
            is_anomaly = value > threshold
            return is_anomaly, "threshold_exceed" if is_anomaly else None, threshold
        elif metric == "salinity":
            min_t = params["salinity_threshold_min"]
            max_t = params["salinity_threshold_max"]
            is_anomaly = value < min_t or value > max_t
            threshold = max_t if value > max_t else min_t
            return is_anomaly, "threshold_exceed" if is_anomaly else None, threshold
        elif metric == "turbidity":
            threshold = params["turbidity_threshold"]
            is_anomaly = value > threshold
            return is_anomaly, "threshold_exceed" if is_anomaly else None, threshold
        return False, None, 0.0

    def check_outdated_screenshot(self, filepath: str) -> Tuple[bool, str]:
        """检查遥感截图是否为旧版"""
        file_hash = self._file_hash(filepath)
        filename = os.path.basename(filepath)

        version_match = re.search(r"_v(\d+)", filename)
        if version_match:
            version = int(version_match.group(1))
            if version < 3:
                return True, f"旧版截图 v{version}（建议使用v3及以上）"
        return False, ""

    def analyze_ship_delay(
        self, ship_records: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """分析船上记录晚于传感器数据的情况"""
        delay_results = []
        for record in ship_records:
            time_diff = (
                record["record_time"] - record["sensor_time"]
            ).total_seconds() / 3600
            if time_diff > 1:
                delay_results.append(
                    {
                        "record_time": record["record_time"],
                        "sensor_time": record["sensor_time"],
                        "delay_hours": round(time_diff, 2),
                        "location": record["location"],
                        "observer": record["observer"],
                        "notes": record["notes"],
                        "source_file": record["source_file"],
                    }
                )
        return delay_results

    def _add_alert(
        self,
        record_id: str,
        timestamp: datetime,
        source_type: str,
        data_source: str,
        metric_name: str,
        metric_value: float,
        threshold: float,
        is_anomaly: bool,
        anomaly_type: Optional[str],
        confidence: float,
        affected_conclusion: str,
        notes: str = "",
    ):
        """添加预警结果"""
        result = {
            "record_id": record_id,
            "timestamp": timestamp.strftime("%Y-%m-%d %H:%M:%S"),
            "source_type": SOURCE_TYPES.get(source_type, source_type),
            "data_source": data_source,
            "metric_name": metric_name,
            "metric_value": metric_value,
            "threshold": threshold,
            "is_anomaly": is_anomaly,
            "anomaly_type": ANOMALY_TYPES.get(anomaly_type, anomaly_type or "正常"),
            "confidence": confidence,
            "affected_conclusion": affected_conclusion,
            "notes": notes,
        }
        self.alert_results.append(result)

        if is_anomaly and anomaly_type:
            if data_source not in self.source_impact:
                self.source_impact[data_source] = []
            impact_desc = f"{ANOMALY_TYPES.get(anomaly_type, anomaly_type)}: {metric_name}={metric_value}"
            if impact_desc not in self.source_impact[data_source]:
                self.source_impact[data_source].append(impact_desc)

    def run_analysis(self) -> Dict[str, Any]:
        """运行完整的异常预警分析"""
        self.alert_results = []
        self.source_impact = {}
        record_counter = 0

        sensor_files = self._get_data_files("sensor")
        ship_files = self._get_data_files("ship")
        remote_files = self._get_data_files("remote_sensing")
        boundary_files = self._get_data_files("boundary")
        note_files = self._get_data_files("note")

        if not any([sensor_files, ship_files, remote_files, boundary_files, note_files]):
            raise FileNotFoundError(
                ERROR_MESSAGES["INPUT_DIR_EMPTY"].format(
                    path=self.config["input_dir"]
                )
            )

        all_sensor_records = []
        for filepath in sensor_files:
            records = self.load_sensor_data(filepath)
            all_sensor_records.extend(records)

            for record in records:
                for metric in ["temperature", "salinity", "turbidity"]:
                    value = record[metric]
                    is_anomaly, anomaly_type, threshold = self.check_threshold_anomaly(
                        value, metric
                    )
                    record_counter += 1
                    self._add_alert(
                        record_id=f"SENSOR_{record_counter:06d}",
                        timestamp=record["timestamp"],
                        source_type="sensor",
                        data_source=record["source_file"],
                        metric_name=metric,
                        metric_value=value,
                        threshold=threshold,
                        is_anomaly=is_anomaly,
                        anomaly_type=anomaly_type,
                        confidence=0.95 if is_anomaly else 1.0,
                        affected_conclusion=(
                            "可能影响海草床健康评估" if is_anomaly else "无影响"
                        ),
                        notes="阈值检测",
                    )

        if all_sensor_records:
            for metric in ["temperature", "salinity", "turbidity"]:
                drifts = self.detect_sensor_drift(all_sensor_records, metric)
                for drift in drifts:
                    record_counter += 1
                    self._add_alert(
                        record_id=f"DRIFT_{record_counter:06d}",
                        timestamp=drift["timestamp"],
                        source_type="sensor",
                        data_source=drift["source_file"],
                        metric_name=f"{metric}_drift",
                        metric_value=drift["value"],
                        threshold=round(drift["window_mean"], 2),
                        is_anomaly=True,
                        anomaly_type="sensor_drift",
                        confidence=0.9,
                        affected_conclusion="传感器漂移，数据可信度下降，需人工复核",
                        notes=f"滑动窗口均值={drift['window_mean']:.2f}, 偏离={drift['deviation']:.2f}",
                    )

        for filepath in ship_files:
            ship_records = self.load_ship_records(filepath)
            delays = self.analyze_ship_delay(ship_records)
            for delay in delays:
                record_counter += 1
                self._add_alert(
                    record_id=f"SHIP_{record_counter:06d}",
                    timestamp=delay["record_time"],
                    source_type="ship",
                    data_source=delay["source_file"],
                    metric_name="record_delay",
                    metric_value=delay["delay_hours"],
                    threshold=1.0,
                    is_anomaly=True,
                    anomaly_type="ship_record_delay",
                    confidence=0.85,
                    affected_conclusion="船上记录滞后，可能影响数据同步分析",
                    notes=f"观测点:{delay['location']}, 记录人:{delay['observer']}, 备注:{delay['notes']}",
                )

        for filepath in remote_files:
            is_outdated, reason = self.check_outdated_screenshot(filepath)
            filename = os.path.basename(filepath)
            record_counter += 1
            self._add_alert(
                record_id=f"REMOTE_{record_counter:06d}",
                timestamp=datetime.fromtimestamp(os.path.getmtime(filepath)),
                source_type="remote_sensing",
                data_source=filename,
                metric_name="screenshot_version",
                metric_value=0.0,
                threshold=3.0,
                is_anomaly=is_outdated,
                anomaly_type="outdated_screenshot" if is_outdated else None,
                confidence=0.9 if is_outdated else 1.0,
                affected_conclusion=(
                    "使用旧版遥感截图，可能遗漏最新海草床变化" if is_outdated else "无影响"
                ),
                notes=reason if reason else "版本正常",
            )

        for filepath in boundary_files:
            boundary_records = self.load_boundary_samples(filepath)
            for record in boundary_records:
                if record["is_boundary"]:
                    record_counter += 1
                    self._add_alert(
                        record_id=f"BOUND_{record_counter:06d}",
                        timestamp=datetime.now(),
                        source_type="boundary",
                        data_source=record["source_file"],
                        metric_name=record["metric"],
                        metric_value=record["value"],
                        threshold=0.0,
                        is_anomaly=True,
                        anomaly_type="boundary_case",
                        confidence=0.7,
                        affected_conclusion="边界样本，需特别注意对结论的影响",
                        notes=f"样本ID:{record['sample_id']}, 处于判定边界，建议人工复核",
                    )

        for filepath in note_files:
            notes = self.load_notes(filepath)
            for note in notes:
                record_counter += 1
                self._add_alert(
                    record_id=f"NOTE_{record_counter:06d}",
                    timestamp=datetime.now(),
                    source_type="note",
                    data_source=note["source_file"],
                    metric_name="manual_note",
                    metric_value=0.0,
                    threshold=0.0,
                    is_anomaly=True,
                    anomaly_type="manual_note",
                    confidence=0.95,
                    affected_conclusion="口头备注，可能影响最终结论判定",
                    notes=f"第{note['line_num']}行: {note['content']}",
                )

        return self.get_summary()

    def get_summary(self) -> Dict[str, Any]:
        """获取分析摘要"""
        anomaly_count = sum(1 for r in self.alert_results if r["is_anomaly"])
        summary = {
            "run_id": self.run_timestamp,
            "total_records": len(self.alert_results),
            "anomaly_count": anomaly_count,
            "normal_count": len(self.alert_results) - anomaly_count,
            "source_impact": self.source_impact,
            "anomaly_by_type": {},
            "alert_results": self.alert_results,
        }

        for result in self.alert_results:
            if result["is_anomaly"]:
                atype = result["anomaly_type"]
                summary["anomaly_by_type"][atype] = (
                    summary["anomaly_by_type"].get(atype, 0) + 1
                )

        return summary

    def export_csv(self, output_path: Optional[str] = None) -> str:
        """导出CSV明细"""
        if output_path is None:
            csv_dir = self.config["csv_dir"]
            os.makedirs(csv_dir, exist_ok=True)
            output_path = os.path.join(
                csv_dir, f"seagrass_alert_{self.run_timestamp}.csv"
            )

        try:
            with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
                writer = csv.DictWriter(
                    f, fieldnames=self.config["output_fields"]
                )
                writer.writeheader()
                for result in self.alert_results:
                    row = {k: result.get(k, "") for k in self.config["output_fields"]}
                    writer.writerow(row)
        except Exception as e:
            raise IOError(
                ERROR_MESSAGES["CSV_WRITE_FAILED"].format(path=output_path)
            )

        return output_path

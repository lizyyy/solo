import json
import csv
from datetime import datetime, timedelta
from typing import List, Any, Dict, Optional
from pathlib import Path
import re

from .models import (
    DNSRecord, DNSRecordType, Region, CDNVendor,
    VendorExport, ProbeLog, SwitchPlan, SwitchStep, SwitchPhase
)


class BaseParser:
    @staticmethod
    def parse_datetime(value: Any) -> datetime:
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            try:
                if value.endswith("Z"):
                    value = value[:-1] + "+00:00"
                return datetime.fromisoformat(value)
            except ValueError:
                pass
            
            formats = [
                "%Y-%m-%d %H:%M:%S",
                "%Y-%m-%dT%H:%M:%S",
                "%Y-%m-%dT%H:%M:%SZ",
                "%Y-%m-%d",
            ]
            for fmt in formats:
                try:
                    return datetime.strptime(value, fmt)
                except ValueError:
                    continue
            raise ValueError(f"无法解析时间格式: {value}")
        raise ValueError(f"无法解析时间类型: {type(value)}")

    @staticmethod
    def parse_region(value: str) -> Region:
        value = value.lower().strip()
        region_map = {
            "cn_main": Region.CN_MAIN, "cn-main": Region.CN_MAIN, "中国大陆": Region.CN_MAIN,
            "cn_hk": Region.CN_HK, "cn-hk": Region.CN_HK, "香港": Region.CN_HK,
            "cn_tw": Region.CN_TW, "cn-tw": Region.CN_TW, "台湾": Region.CN_TW,
            "apac": Region.APAC, "亚太": Region.APAC,
            "na": Region.NA, "北美": Region.NA,
            "eu": Region.EU, "欧洲": Region.EU,
            "sa": Region.SA, "南美": Region.SA,
            "af": Region.AF, "非洲": Region.AF,
            "global": Region.GLOBAL, "全球": Region.GLOBAL,
        }
        if value in region_map:
            return region_map[value]
        return Region.GLOBAL

    @staticmethod
    def parse_vendor(value: str) -> CDNVendor:
        value = value.lower().strip()
        vendor_map = {
            "cdn_a": CDNVendor.CDN_A, "cdna": CDNVendor.CDN_A, "cdn1": CDNVendor.CDN_A,
            "cdn_b": CDNVendor.CDN_B, "cdnb": CDNVendor.CDN_B, "cdn2": CDNVendor.CDN_B,
            "origin": CDNVendor.ORIGIN, "源站": CDNVendor.ORIGIN, "备用源站": CDNVendor.ORIGIN,
        }
        if value in vendor_map:
            return vendor_map[value]
        raise ValueError(f"无法识别的供应商: {value}")


class DNSRecordParser(BaseParser):
    @classmethod
    def parse_json(cls, file_path: Path) -> List[DNSRecord]:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        records = []
        for item in data:
            record = DNSRecord(
                domain=item["domain"],
                record_type=DNSRecordType(item.get("type", item.get("record_type", "A"))),
                value=item["value"],
                ttl=int(item["ttl"]),
                region=cls.parse_region(item.get("region", "global")),
                created_at=cls.parse_datetime(item["created_at"]) if item.get("created_at") else None,
                updated_at=cls.parse_datetime(item["updated_at"]) if item.get("updated_at") else None,
            )
            records.append(record)
        return records

    @classmethod
    def parse_csv(cls, file_path: Path) -> List[DNSRecord]:
        records = []
        with open(file_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                record = DNSRecord(
                    domain=row["domain"].strip(),
                    record_type=DNSRecordType(row.get("type", row.get("record_type", "A")).strip()),
                    value=row["value"].strip(),
                    ttl=int(row["ttl"]),
                    region=cls.parse_region(row.get("region", "global")),
                    created_at=cls.parse_datetime(row["created_at"]) if row.get("created_at") else None,
                    updated_at=cls.parse_datetime(row["updated_at"]) if row.get("updated_at") else None,
                )
                records.append(record)
        return records


class VendorExportParser(BaseParser):
    @classmethod
    def parse_json(cls, file_path: Path) -> List[VendorExport]:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        exports = []
        for item in data:
            export = VendorExport(
                vendor=cls.parse_vendor(item["vendor"]),
                region=cls.parse_region(item.get("region", "global")),
                domain=item["domain"],
                cname_target=item.get("cname_target", item.get("target", "")),
                health_status=item.get("health_status", item.get("status", "unknown")),
                last_check=cls.parse_datetime(item.get("last_check", item.get("check_time", datetime.now()))),
                bandwidth_mbps=float(item["bandwidth_mbps"]) if item.get("bandwidth_mbps") else None,
                error_rate=float(item["error_rate"]) if item.get("error_rate") else None,
            )
            exports.append(export)
        return exports

    @classmethod
    def parse_csv(cls, file_path: Path) -> List[VendorExport]:
        exports = []
        with open(file_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                export = VendorExport(
                    vendor=cls.parse_vendor(row["vendor"]),
                    region=cls.parse_region(row.get("region", "global")),
                    domain=row["domain"].strip(),
                    cname_target=row.get("cname_target", row.get("target", "")).strip(),
                    health_status=row.get("health_status", row.get("status", "unknown")).strip(),
                    last_check=cls.parse_datetime(row.get("last_check", row.get("check_time", datetime.now()))),
                    bandwidth_mbps=float(row["bandwidth_mbps"]) if row.get("bandwidth_mbps") else None,
                    error_rate=float(row["error_rate"]) if row.get("error_rate") else None,
                )
                exports.append(export)
        return exports


class ProbeLogParser(BaseParser):
    @classmethod
    def parse_json(cls, file_path: Path) -> List[ProbeLog]:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        logs = []
        for item in data:
            resolved_ips = item.get("resolved_ips", [])
            if isinstance(resolved_ips, str):
                resolved_ips = [ip.strip() for ip in resolved_ips.split(",")]
            
            log = ProbeLog(
                timestamp=cls.parse_datetime(item["timestamp"]),
                region=cls.parse_region(item.get("region", "global")),
                domain=item["domain"],
                resolver_ip=item.get("resolver_ip", item.get("dns_server", "unknown")),
                resolved_ips=resolved_ips,
                resolved_cname=item.get("resolved_cname"),
                http_status=int(item["http_status"]) if item.get("http_status") else None,
                response_time_ms=int(item["response_time_ms"]) if item.get("response_time_ms") else None,
                success=bool(item.get("success", item.get("is_success", True))),
            )
            logs.append(log)
        return logs

    @classmethod
    def parse_csv(cls, file_path: Path) -> List[ProbeLog]:
        logs = []
        with open(file_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                resolved_ips = row.get("resolved_ips", "")
                if resolved_ips:
                    resolved_ips = [ip.strip() for ip in resolved_ips.split(",")]
                else:
                    resolved_ips = []
                
                log = ProbeLog(
                    timestamp=cls.parse_datetime(row["timestamp"]),
                    region=cls.parse_region(row.get("region", "global")),
                    domain=row["domain"].strip(),
                    resolver_ip=row.get("resolver_ip", row.get("dns_server", "unknown")).strip(),
                    resolved_ips=resolved_ips,
                    resolved_cname=row.get("resolved_cname"),
                    http_status=int(row["http_status"]) if row.get("http_status") else None,
                    response_time_ms=int(row["response_time_ms"]) if row.get("response_time_ms") else None,
                    success=row.get("success", row.get("is_success", "true")).lower() in ["true", "1", "yes"],
                )
                logs.append(log)
        return logs


class SwitchPlanParser(BaseParser):
    @classmethod
    def parse_phase(cls, value: str) -> SwitchPhase:
        value = value.lower().strip()
        phase_map = {
            "ttl_lower": SwitchPhase.TTL_LOWER, "ttl-lower": SwitchPhase.TTL_LOWER, "降低ttl": SwitchPhase.TTL_LOWER,
            "traffic_shift": SwitchPhase.TRAFFIC_SHIFT, "traffic-shift": SwitchPhase.TRAFFIC_SHIFT, "切流": SwitchPhase.TRAFFIC_SHIFT,
            "stabilization": SwitchPhase.STABILIZATION, "稳定期": SwitchPhase.STABILIZATION,
            "rollback": SwitchPhase.ROLLBACK, "回滚": SwitchPhase.ROLLBACK,
            "complete": SwitchPhase.COMPLETE, "完成": SwitchPhase.COMPLETE,
        }
        if value in phase_map:
            return phase_map[value]
        raise ValueError(f"无法识别的阶段: {value}")

    @classmethod
    def parse_json(cls, file_path: Path) -> SwitchPlan:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        steps = []
        for step_data in data.get("steps", []):
            start_time = cls.parse_datetime(step_data["start_time"])
            duration = int(step_data.get("duration_minutes", step_data.get("duration", 30)))
            step = SwitchStep(
                step_id=step_data.get("step_id", step_data.get("id", f"step_{len(steps)}")),
                phase=cls.parse_phase(step_data.get("phase", "traffic_shift")),
                description=step_data.get("description", ""),
                target_vendor=cls.parse_vendor(step_data["target_vendor"]),
                region=cls.parse_region(step_data.get("region", "global")),
                start_time=start_time,
                duration_minutes=duration,
                traffic_percent=int(step_data.get("traffic_percent", 100)),
                expected_effective_time=start_time + timedelta(minutes=duration),
            )
            steps.append(step)
        
        plan = SwitchPlan(
            plan_id=data.get("plan_id", data.get("id", "unknown_plan")),
            name=data.get("name", "未命名切换计划"),
            domain=data["domain"],
            original_vendor=cls.parse_vendor(data["original_vendor"]),
            target_vendor=cls.parse_vendor(data["target_vendor"]),
            rollback_vendor=cls.parse_vendor(data.get("rollback_vendor", data["original_vendor"])),
            steps=steps,
            created_at=cls.parse_datetime(data.get("created_at", datetime.now())),
            planned_start_time=cls.parse_datetime(data.get("planned_start_time", data.get("start_time", datetime.now()))),
        )
        return plan


class ParserFactory:
    PARSERS = {
        "dns_records": DNSRecordParser,
        "vendor_export": VendorExportParser,
        "probe_log": ProbeLogParser,
        "switch_plan": SwitchPlanParser,
    }

    @classmethod
    def parse(cls, file_path: Path, data_type: str) -> Any:
        if data_type not in cls.PARSERS:
            raise ValueError(f"不支持的数据类型: {data_type}")
        
        parser = cls.PARSERS[data_type]
        ext = file_path.suffix.lower()
        
        if ext == ".json":
            if data_type == "switch_plan":
                return parser.parse_json(file_path)
            return parser.parse_json(file_path)
        elif ext == ".csv":
            return parser.parse_csv(file_path)
        else:
            raise ValueError(f"不支持的文件格式: {ext}")

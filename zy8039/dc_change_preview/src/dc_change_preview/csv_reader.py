import csv
from pathlib import Path
from typing import Iterator, Union, Optional

from .models import Device, DeviceType, Rack, SwitchPort


def _safe_int(value: str, default: Optional[int] = None) -> Optional[int]:
    if value is None or value == "":
        return default
    try:
        return int(value)
    except (ValueError, TypeError):
        return default


class CSVReader:
    @staticmethod
    def read_rack_assets(csv_path: Union[str, Path]) -> Iterator[Device]:
        with open(csv_path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                device = Device(
                    device_id=row["device_id"],
                    name=row["name"],
                    device_type=DeviceType(row["device_type"]),
                    rack_id=row["rack_id"],
                    u_start=_safe_int(row.get("u_start"), 0) or 0,
                    u_end=_safe_int(row.get("u_end"), 0) or 0,
                    power_circuits=row.get("power_circuits", "").split(";") if row.get("power_circuits") else [],
                    primary_switch_port=row.get("primary_switch_port") or None,
                    secondary_switch_port=row.get("secondary_switch_port") or None,
                    status=row.get("status", "online"),
                )
                yield device

    @staticmethod
    def read_switch_ports(csv_path: Union[str, Path]) -> Iterator[SwitchPort]:
        with open(csv_path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                port = SwitchPort(
                    port_id=row["port_id"],
                    switch_id=row["switch_id"],
                    port_name=row["port_name"],
                    vlan=row.get("vlan", "default"),
                    status=row.get("status", "free"),
                    connected_device_id=row.get("connected_device_id") or None,
                )
                yield port

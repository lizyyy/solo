import pandas as pd
import json
import yaml
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import os


class DataProcessor:
    def __init__(self, data_dir: str = "sample"):
        self.data_dir = data_dir
        self.tickets_df = None
        self.gate_scans_df = None
        self.bag_check_lanes_df = None
        self.zone_rules = None
        self.issues = []

    def load_data(self):
        self._load_tickets()
        self._load_gate_scans()
        self._load_bag_check_lanes()
        self._load_zone_rules()
        self._merge_data()

    def _load_tickets(self):
        tickets_path = os.path.join(self.data_dir, "tickets.csv")
        self.tickets_df = pd.read_csv(tickets_path)
        self.tickets_df["valid_from"] = pd.to_datetime(self.tickets_df["valid_from"])
        self.tickets_df["valid_to"] = pd.to_datetime(self.tickets_df["valid_to"])

    def _load_gate_scans(self):
        scans_path = os.path.join(self.data_dir, "gate_scans.jsonl")
        scans = []
        with open(scans_path, "r", encoding="utf-8") as f:
            for line in f:
                scans.append(json.loads(line.strip()))
        self.gate_scans_df = pd.DataFrame(scans)
        self.gate_scans_df["scan_time"] = pd.to_datetime(self.gate_scans_df["scan_time"])
        self.gate_scans_df["bag_checked"] = self.gate_scans_df["bag_checked"].astype(bool)

    def _load_bag_check_lanes(self):
        lanes_path = os.path.join(self.data_dir, "bag_check_lanes.csv")
        self.bag_check_lanes_df = pd.read_csv(lanes_path)

    def _load_zone_rules(self):
        rules_path = os.path.join(self.data_dir, "zone_rules.yaml")
        with open(rules_path, "r", encoding="utf-8") as f:
            self.zone_rules = yaml.safe_load(f)

    def _merge_data(self):
        self.gate_scans_df = self.gate_scans_df.merge(
            self.tickets_df[["ticket_id", "event_id", "event_name", "zone"]],
            on="ticket_id",
            how="left"
        )

    def analyze_duplicate_entries(self) -> pd.DataFrame:
        duplicate_interval = self.zone_rules.get("thresholds", {}).get("duplicate_entry_interval_minutes", 5)
        
        duplicates = []
        for ticket_id, group in self.gate_scans_df.groupby("ticket_id"):
            sorted_scans = group.sort_values("scan_time")
            for i in range(1, len(sorted_scans)):
                prev_scan = sorted_scans.iloc[i-1]
                curr_scan = sorted_scans.iloc[i]
                time_diff = (curr_scan["scan_time"] - prev_scan["scan_time"]).total_seconds() / 60
                
                if time_diff <= duplicate_interval:
                    duplicates.append({
                        "issue_type": "同票重复入场",
                        "ticket_id": ticket_id,
                        "event_id": curr_scan["event_id"],
                        "event_name": curr_scan["event_name"],
                        "zone": curr_scan["zone"],
                        "gate_id": curr_scan["gate_id"],
                        "first_scan_time": prev_scan["scan_time"],
                        "second_scan_time": curr_scan["scan_time"],
                        "time_diff_minutes": round(time_diff, 2),
                        "severity": "high"
                    })
        
        for issue in duplicates:
            self.issues.append(issue.copy())
        
        return pd.DataFrame(duplicates)

    def analyze_gate_offline(self) -> pd.DataFrame:
        offline_events = []
        offline_scans = self.gate_scans_df[self.gate_scans_df["gate_status"] == "offline"]
        
        for _, scan in offline_scans.iterrows():
            offline_events.append({
                "issue_type": "闸机离线",
                "ticket_id": scan["ticket_id"],
                "event_id": scan["event_id"],
                "event_name": scan["event_name"],
                "zone": scan["zone"],
                "gate_id": scan["gate_id"],
                "scan_time": scan["scan_time"],
                "severity": "high"
            })
        
        for issue in offline_events:
            self.issues.append(issue.copy())
        
        return pd.DataFrame(offline_events)

    def analyze_bag_check_overload(self) -> pd.DataFrame:
        overload_threshold = self.zone_rules.get("thresholds", {}).get("bag_check_overload_multiplier", 1.5)
        congestion_threshold = self.zone_rules.get("thresholds", {}).get("congestion_threshold_per_minute", 10)
        
        self.gate_scans_df["scan_minute"] = self.gate_scans_df["scan_time"].dt.floor("min")
        traffic_per_minute = self.gate_scans_df.groupby(["gate_id", "scan_minute"]).size().reset_index(name="count")
        
        gate_capacities = self.bag_check_lanes_df.groupby("gate_id")["max_capacity_per_minute"].sum().reset_index()
        gate_capacities.columns = ["gate_id", "total_capacity"]
        
        traffic_with_capacity = traffic_per_minute.merge(gate_capacities, on="gate_id", how="left")
        
        overload_events = []
        for _, row in traffic_with_capacity.iterrows():
            if pd.isna(row["total_capacity"]):
                continue
            
            overload_limit = row["total_capacity"] * overload_threshold
            if row["count"] > overload_limit or row["count"] > congestion_threshold:
                gate_scans = self.gate_scans_df[
                    (self.gate_scans_df["gate_id"] == row["gate_id"]) & 
                    (self.gate_scans_df["scan_minute"] == row["scan_minute"])
                ]
                
                if not gate_scans.empty:
                    sample_scan = gate_scans.iloc[0]
                    overload_events.append({
                        "issue_type": "包检通道超载",
                        "gate_id": row["gate_id"],
                        "event_id": sample_scan["event_id"],
                        "event_name": sample_scan["event_name"],
                        "zone": sample_scan["zone"],
                        "scan_minute": row["scan_minute"],
                        "actual_count": row["count"],
                        "capacity": row["total_capacity"],
                        "overload_ratio": round(row["count"] / row["total_capacity"], 2),
                        "severity": "medium" if row["count"] <= overload_limit else "high"
                    })
        
        for issue in overload_events:
            self.issues.append(issue.copy())
        
        return pd.DataFrame(overload_events)

    def analyze_midnight_crossing(self) -> pd.DataFrame:
        midnight_issues = []
        
        for _, scan in self.gate_scans_df.iterrows():
            ticket = self.tickets_df[self.tickets_df["ticket_id"] == scan["ticket_id"]]
            
            if ticket.empty:
                continue
            
            ticket = ticket.iloc[0]
            scan_time = scan["scan_time"]
            valid_to = ticket["valid_to"]
            
            if scan_time > valid_to:
                midnight_issues.append({
                    "issue_type": "跨午夜场次归属错误",
                    "ticket_id": scan["ticket_id"],
                    "event_id": ticket["event_id"],
                    "event_name": ticket["event_name"],
                    "zone": ticket["zone"],
                    "gate_id": scan["gate_id"],
                    "scan_time": scan_time,
                    "ticket_valid_to": valid_to,
                    "time_diff_hours": round((scan_time - valid_to).total_seconds() / 3600, 2),
                    "severity": "medium"
                })
        
        for issue in midnight_issues:
            self.issues.append(issue.copy())
        
        return pd.DataFrame(midnight_issues)

    def get_all_issues(self) -> pd.DataFrame:
        self.issues = []
        self.analyze_duplicate_entries()
        self.analyze_gate_offline()
        self.analyze_bag_check_overload()
        self.analyze_midnight_crossing()
        
        if not self.issues:
            return pd.DataFrame()
        
        return pd.DataFrame(self.issues)

    def get_traffic_by_gate(self, time_window: Optional[str] = None) -> pd.DataFrame:
        if time_window:
            window = self._get_time_window(time_window)
            if window:
                filtered = self.gate_scans_df[
                    (self.gate_scans_df["scan_time"] >= window["start"]) &
                    (self.gate_scans_df["scan_time"] < window["end"])
                ]
            else:
                filtered = self.gate_scans_df
        else:
            filtered = self.gate_scans_df
        
        return filtered.groupby("gate_id").size().reset_index(name="count")

    def get_traffic_by_zone(self, time_window: Optional[str] = None) -> pd.DataFrame:
        if time_window:
            window = self._get_time_window(time_window)
            if window:
                filtered = self.gate_scans_df[
                    (self.gate_scans_df["scan_time"] >= window["start"]) &
                    (self.gate_scans_df["scan_time"] < window["end"])
                ]
            else:
                filtered = self.gate_scans_df
        else:
            filtered = self.gate_scans_df
        
        return filtered.groupby("zone").size().reset_index(name="count")

    def get_traffic_by_time(self, interval: str = "5min") -> pd.DataFrame:
        self.gate_scans_df["time_bin"] = self.gate_scans_df["scan_time"].dt.floor(interval)
        return self.gate_scans_df.groupby("time_bin").size().reset_index(name="count")

    def get_events(self) -> pd.DataFrame:
        return self.tickets_df[["event_id", "event_name"]].drop_duplicates()

    def get_zones(self, event_id: Optional[str] = None) -> List[str]:
        if event_id:
            return self.tickets_df[self.tickets_df["event_id"] == event_id]["zone"].unique().tolist()
        return self.tickets_df["zone"].unique().tolist()

    def _get_time_window(self, window_name: str) -> Optional[Dict[str, datetime]]:
        time_windows = self.zone_rules.get("time_windows", [])
        for window in time_windows:
            if window["name"] == window_name:
                return {
                    "start": pd.to_datetime(window["start"]),
                    "end": pd.to_datetime(window["end"])
                }
        return None

    def export_issues_csv(self, output_path: str):
        issues_df = self.get_all_issues()
        issues_df.to_csv(output_path, index=False, encoding="utf-8-sig")
        return len(issues_df)

    def export_gate_review_md(self, output_path: str):
        issues_df = self.get_all_issues()
        events = self.get_events()
        
        md_content = f"""# 闸机安检复盘报告

生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## 场次概览

| 场次ID | 场次名称 |
|--------|----------|
"""
        for _, event in events.iterrows():
            md_content += f"| {event['event_id']} | {event['event_name']} |\n"
        
        md_content += f"""
## 异常统计

- 同票重复入场: {len(issues_df[issues_df['issue_type'] == '同票重复入场'])} 起
- 闸机离线: {len(issues_df[issues_df['issue_type'] == '闸机离线'])} 起
- 包检通道超载: {len(issues_df[issues_df['issue_type'] == '包检通道超载'])} 起
- 跨午夜场次归属错误: {len(issues_df[issues_df['issue_type'] == '跨午夜场次归属错误'])} 起

**总计: {len(issues_df)} 个异常**

## 详细异常记录

"""
        
        issue_types = issues_df['issue_type'].unique()
        for issue_type in issue_types:
            type_issues = issues_df[issues_df['issue_type'] == issue_type]
            md_content += f"### {issue_type}\n\n"
            md_content += f"共 {len(type_issues)} 起\n\n"
            
            if issue_type == "同票重复入场":
                md_content += """| 票号 | 场次 | 闸机 | 首次入场时间 | 再次入场时间 | 间隔(分钟) |
|------|------|------|-------------|-------------|-----------|
"""
                for _, issue in type_issues.iterrows():
                    md_content += f"| {issue['ticket_id']} | {issue['event_name']} | {issue['gate_id']} | {issue['first_scan_time']} | {issue['second_scan_time']} | {issue['time_diff_minutes']} |\n"
            
            elif issue_type == "闸机离线":
                md_content += """| 票号 | 场次 | 闸机 | 扫描时间 |
|------|------|------|----------|
"""
                for _, issue in type_issues.iterrows():
                    md_content += f"| {issue['ticket_id']} | {issue['event_name']} | {issue['gate_id']} | {issue['scan_time']} |\n"
            
            elif issue_type == "包检通道超载":
                md_content += """| 闸机 | 场次 | 时间 | 实际流量 | 容量 | 超载率 |
|------|------|------|----------|------|--------|
"""
                for _, issue in type_issues.iterrows():
                    md_content += f"| {issue['gate_id']} | {issue['event_name']} | {issue['scan_minute']} | {issue['actual_count']} | {issue['capacity']} | {issue['overload_ratio']}x |\n"
            
            elif issue_type == "跨午夜场次归属错误":
                md_content += """| 票号 | 场次 | 闸机 | 扫描时间 | 票有效期至 | 超时时长(小时) |
|------|------|------|----------|-----------|----------------|
"""
                for _, issue in type_issues.iterrows():
                    md_content += f"| {issue['ticket_id']} | {issue['event_name']} | {issue['gate_id']} | {issue['scan_time']} | {issue['ticket_valid_to']} | {issue['time_diff_hours']} |\n"
            
            md_content += "\n"
        
        md_content += """
## 建议

1. **同票重复入场**: 加强闸机系统的实时校验，设置合理的入场间隔限制
2. **闸机离线**: 检查闸机网络连接和硬件状态，确保设备稳定运行
3. **包检通道超载**: 在高峰时段增加临时包检通道，引导观众分流
4. **跨午夜场次**: 优化场次时间管理系统，确保跨午夜场次的正确归属

---
*报告由演唱会场馆安检分析系统自动生成*
"""
        
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(md_content)
        
        return len(issues_df)

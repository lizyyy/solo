import pandas as pd
import yaml
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict
from enum import Enum


class RiskSeverity(Enum):
    LOW = "低"
    MEDIUM = "中"
    HIGH = "高"


class RiskType(Enum):
    INCOMPLETE_GROOMING = "未压实"
    WIND_DRIFT_COVERAGE = "风吹雪覆盖不足"
    PATROL_EXPIRED = "巡查过期"
    MIDNIGHT_CROSSING = "跨午夜作业归属异常"
    ICE_EXPOSURE = "结冰/裸露"


@dataclass
class RiskItem:
    risk_id: str
    trail_name: str
    date: str
    risk_type: str
    severity: str
    description: str
    mitigation: str
    timestamp: str
    details: Dict[str, Any]


class SnowRiskAnalyzer:
    def __init__(self, data_dir: str = "./sample"):
        self.data_dir = data_dir
        self.rules = self._load_rules()
        self.snowcats_df = self._load_snowcats()
        self.weather_df = self._load_weather()
        self.patrol_records = self._load_patrol()
        self.trail_categories = self._categorize_trails()

    def _load_rules(self) -> Dict:
        with open(f"{self.data_dir}/rules.yaml", "r", encoding="utf-8") as f:
            return yaml.safe_load(f)

    def _load_snowcats(self) -> pd.DataFrame:
        df = pd.read_csv(f"{self.data_dir}/snowcats.csv")
        df["start_time"] = pd.to_datetime(df["start_time"])
        df["end_time"] = pd.to_datetime(df["end_time"])
        return df

    def _load_weather(self) -> pd.DataFrame:
        df = pd.read_csv(f"{self.data_dir}/weather.csv")
        df["timestamp"] = pd.to_datetime(df["timestamp"])
        return df

    def _load_patrol(self) -> List[Dict]:
        records = []
        with open(f"{self.data_dir}/patrol.jsonl", "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    record = json.loads(line)
                    record["timestamp"] = pd.to_datetime(record["timestamp"])
                    records.append(record)
        return records

    def _categorize_trails(self) -> Dict[str, str]:
        categories = {}
        for _, row in self.snowcats_df.iterrows():
            trail = row["trail_name"]
            if "初级" in trail:
                categories[trail] = "beginner"
            elif "中级" in trail:
                categories[trail] = "intermediate"
            elif "高级" in trail:
                categories[trail] = "advanced"
        return categories

    def get_trail_category(self, trail_name: str) -> str:
        return self.trail_categories.get(trail_name, "beginner")

    def get_trail_rules(self, trail_name: str) -> Dict:
        category = self.get_trail_category(trail_name)
        return self.rules["trail_categories"].get(category, self.rules["trail_categories"]["beginner"])

    def get_available_dates(self) -> List[str]:
        dates = set()
        for _, row in self.snowcats_df.iterrows():
            dates.add(row["start_time"].strftime("%Y-%m-%d"))
            dates.add(row["end_time"].strftime("%Y-%m-%d"))
        return sorted(list(dates))

    def get_available_trails(self) -> List[str]:
        return sorted(self.snowcats_df["trail_name"].unique().tolist())

    def get_weather_for_date(self, date: str) -> pd.DataFrame:
        start_dt = pd.to_datetime(date)
        end_dt = start_dt + timedelta(days=1)
        return self.weather_df[
            (self.weather_df["timestamp"] >= start_dt) &
            (self.weather_df["timestamp"] < end_dt)
        ]

    def get_snowcats_for_date(self, date: str) -> pd.DataFrame:
        start_dt = pd.to_datetime(date) + timedelta(hours=18)
        end_dt = start_dt + timedelta(hours=14)
        return self.snowcats_df[
            (self.snowcats_df["start_time"] < end_dt) &
            (self.snowcats_df["end_time"] > start_dt)
        ]

    def get_patrol_for_date(self, date: str) -> List[Dict]:
        start_dt = pd.to_datetime(date)
        end_dt = start_dt + timedelta(days=1)
        return [
            r for r in self.patrol_records
            if start_dt <= r["timestamp"] < end_dt
        ]

    def check_incomplete_grooming(self, trail_name: str, date: str) -> Optional[RiskItem]:
        rules = self.get_trail_rules(trail_name)
        min_completion = rules["min_completion_pct"]
        snowcats = self.get_snowcats_for_date(date)
        trail_snowcats = snowcats[snowcats["trail_name"] == trail_name]

        if trail_snowcats.empty:
            return RiskItem(
                risk_id=f"IG-{trail_name}-{date}",
                trail_name=trail_name,
                date=date,
                risk_type=RiskType.INCOMPLETE_GROOMING.value,
                severity=RiskSeverity.HIGH.value,
                description=f"雪道 {trail_name} 在 {date} 无压雪作业记录",
                mitigation="紧急安排压雪作业",
                timestamp=datetime.now().isoformat(),
                details={"completion_pct": 0, "required_pct": min_completion}
            )

        total_completion = trail_snowcats["completion_pct"].max()

        if total_completion < min_completion:
            return RiskItem(
                risk_id=f"IG-{trail_name}-{date}",
                trail_name=trail_name,
                date=date,
                risk_type=RiskType.INCOMPLETE_GROOMING.value,
                severity=RiskSeverity.MEDIUM.value,
                description=f"压雪作业完成度 {total_completion}% 低于阈值 {min_completion}%",
                mitigation="补充压雪作业",
                timestamp=datetime.now().isoformat(),
                details={"completion_pct": total_completion, "required_pct": min_completion}
            )
        return None

    def check_wind_drift_coverage(self, trail_name: str, date: str) -> Optional[RiskItem]:
        rules = self.get_trail_rules(trail_name)
        max_wind = rules["max_wind_speed_kmh"]
        max_snowfall = rules["max_snowfall_cm_per_hour"]

        weather = self.get_weather_for_date(date)
        if weather.empty:
            return None

        night_weather = weather[
            (weather["timestamp"].dt.hour >= 22) |
            (weather["timestamp"].dt.hour < 6)
        ]

        if night_weather.empty:
            return None

        max_wind_observed = night_weather["wind_speed_kmh"].max()
        max_snowfall_observed = night_weather["snowfall_cm"].max()

        if max_wind_observed > max_wind or max_snowfall_observed > max_snowfall:
            severity = RiskSeverity.HIGH.value if (
                max_wind_observed > max_wind * 1.2 or
                max_snowfall_observed > max_snowfall * 1.5
            ) else RiskSeverity.MEDIUM.value

            return RiskItem(
                risk_id=f"WC-{trail_name}-{date}",
                trail_name=trail_name,
                date=date,
                risk_type=RiskType.WIND_DRIFT_COVERAGE.value,
                severity=severity,
                description=f"夜间风速 {max_wind_observed} km/h，降雪 {max_snowfall_observed} cm，可能导致风吹雪覆盖不均",
                mitigation="检查并补充雪量，必要时重新压雪",
                timestamp=datetime.now().isoformat(),
                details={
                    "max_wind_kmh": max_wind_observed,
                    "max_snowfall_cm": max_snowfall_observed,
                    "wind_threshold": max_wind,
                    "snowfall_threshold": max_snowfall
                }
            )
        return None

    def check_patrol_expired(self, trail_name: str, date: str) -> Optional[RiskItem]:
        rules = self.get_trail_rules(trail_name)
        expiry_hours = rules["patrol_expiry_hours"]

        patrols = self.get_patrol_for_date(date)
        trail_patrols = [p for p in patrols if p["trail_name"] == trail_name]

        if not trail_patrols:
            return RiskItem(
                risk_id=f"PE-{trail_name}-{date}",
                trail_name=trail_name,
                date=date,
                risk_type=RiskType.PATROL_EXPIRED.value,
                severity=RiskSeverity.HIGH.value,
                description=f"雪道 {trail_name} 在 {date} 无巡查记录",
                mitigation="立即安排巡查",
                timestamp=datetime.now().isoformat(),
                details={"last_patrol": None, "expiry_hours": expiry_hours}
            )

        latest_patrol = max(trail_patrols, key=lambda x: x["timestamp"])
        now = pd.to_datetime(date) + timedelta(hours=8)
        time_since_patrol = (now - latest_patrol["timestamp"]).total_seconds() / 3600

        if time_since_patrol > expiry_hours:
            return RiskItem(
                risk_id=f"PE-{trail_name}-{date}",
                trail_name=trail_name,
                date=date,
                risk_type=RiskType.PATROL_EXPIRED.value,
                severity=RiskSeverity.MEDIUM.value,
                description=f"最近巡查已过期 {time_since_patrol:.1f} 小时",
                mitigation="重新巡查",
                timestamp=datetime.now().isoformat(),
                details={
                    "last_patrol_time": latest_patrol["timestamp"].isoformat(),
                    "hours_since_patrol": round(time_since_patrol, 1),
                    "expiry_hours": expiry_hours
                }
            )
        return None

    def check_midnight_crossing(self, trail_name: str, date: str) -> Optional[RiskItem]:
        snowcats = self.get_snowcats_for_date(date)
        trail_snowcats = snowcats[snowcats["trail_name"] == trail_name]

        for _, row in trail_snowcats.iterrows():
            start_date = row["start_time"].date()
            end_date = row["end_time"].date()

            if start_date != end_date:
                return RiskItem(
                    risk_id=f"MC-{trail_name}-{date}",
                    trail_name=trail_name,
                    date=date,
                    risk_type=RiskType.MIDNIGHT_CROSSING.value,
                    severity=RiskSeverity.LOW.value,
                    description=f"压雪作业跨越午夜: {row['start_time']} - {row['end_time']}",
                    mitigation="确认作业归属日期",
                    timestamp=datetime.now().isoformat(),
                    details={
                        "vehicle_id": row["vehicle_id"],
                        "operator": row["operator"],
                        "start_time": row["start_time"].isoformat(),
                        "end_time": row["end_time"].isoformat()
                    }
                )
        return None

    def check_ice_exposure(self, trail_name: str, date: str) -> Optional[RiskItem]:
        patrols = self.get_patrol_for_date(date)
        trail_patrols = [p for p in patrols if p["trail_name"] == trail_name]

        if not trail_patrols:
            return None

        latest_patrol = max(trail_patrols, key=lambda x: x["timestamp"])
        issues = latest_patrol.get("issues", [])
        status = latest_patrol.get("status", "正常")

        if issues:
            severity = RiskSeverity.HIGH.value if status == "紧急" or "严重" in str(issues) else RiskSeverity.MEDIUM.value

            return RiskItem(
                risk_id=f"IE-{trail_name}-{date}",
                trail_name=trail_name,
                date=date,
                risk_type=RiskType.ICE_EXPOSURE.value,
                severity=severity,
                description=f"巡查发现问题: {', '.join(issues)}",
                mitigation="处理结冰/裸露点",
                timestamp=datetime.now().isoformat(),
                details={
                    "patrol_id": latest_patrol["patrol_id"],
                    "inspector": latest_patrol["inspector"],
                    "patrol_time": latest_patrol["timestamp"].isoformat(),
                    "issues": issues,
                    "status": status
                }
            )
        return None

    def analyze_trail_for_date(self, trail_name: str, date: str) -> List[RiskItem]:
        risks = []

        risk_checks = [
            self.check_incomplete_grooming,
            self.check_wind_drift_coverage,
            self.check_patrol_expired,
            self.check_midnight_crossing,
            self.check_ice_exposure
        ]

        for check in risk_checks:
            risk = check(trail_name, date)
            if risk:
                risks.append(risk)

        return risks

    def analyze_all_trails_for_date(self, date: str) -> List[RiskItem]:
        all_risks = []
        trails = self.get_available_trails()

        for trail in trails:
            risks = self.analyze_trail_for_date(trail, date)
            all_risks.extend(risks)

        return all_risks

    def build_timeline(self, trail_name: str, date: str) -> List[Dict]:
        timeline = []

        snowcats = self.get_snowcats_for_date(date)
        trail_snowcats = snowcats[snowcats["trail_name"] == trail_name]

        for _, row in trail_snowcats.iterrows():
            timeline.append({
                "type": "grooming",
                "start_time": row["start_time"],
                "end_time": row["end_time"],
                "vehicle_id": row["vehicle_id"],
                "operator": row["operator"],
                "completion_pct": row["completion_pct"],
                "label": f"压雪作业 ({row['vehicle_id']})"
            })

        patrols = self.get_patrol_for_date(date)
        trail_patrols = [p for p in patrols if p["trail_name"] == trail_name]

        for patrol in trail_patrols:
            timeline.append({
                "type": "patrol",
                "timestamp": patrol["timestamp"],
                "patrol_id": patrol["patrol_id"],
                "inspector": patrol["inspector"],
                "issues": patrol["issues"],
                "status": patrol["status"],
                "label": f"巡查 ({patrol['inspector']})"
            })

        weather = self.get_weather_for_date(date)
        if not weather.empty:
            for _, row in weather.iterrows():
                timeline.append({
                    "type": "weather",
                    "timestamp": row["timestamp"],
                    "temperature_c": row["temperature_c"],
                    "wind_speed_kmh": row["wind_speed_kmh"],
                    "snowfall_cm": row["snowfall_cm"],
                    "label": f"天气: 风{row['wind_speed_kmh']}km/h, 雪{row['snowfall_cm']}cm"
                })

        return sorted(timeline, key=lambda x: x.get("start_time", x.get("timestamp")))

    def risks_to_dataframe(self, risks: List[RiskItem]) -> pd.DataFrame:
        if not risks:
            return pd.DataFrame(columns=[
                "risk_id", "trail_name", "date", "risk_type",
                "severity", "description", "mitigation", "timestamp", "details"
            ])

        return pd.DataFrame([asdict(r) for r in risks])

    def generate_open_review(self, date: str, risks: List[RiskItem]) -> str:
        trails = self.get_available_trails()
        date_risks = [r for r in risks if r.date == date]

        high_risks = [r for r in date_risks if r.severity == RiskSeverity.HIGH.value]
        medium_risks = [r for r in date_risks if r.severity == RiskSeverity.MEDIUM.value]
        low_risks = [r for r in date_risks if r.severity == RiskSeverity.LOW.value]

        trails_with_issues = set(r.trail_name for r in date_risks)
        trails_clear = set(trails) - trails_with_issues

        md = f"# 雪道开放风险复盘报告\n\n"
        md += f"**日期**: {date}\n"
        md += f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n"

        md += f"## 风险概览\n\n"
        md += f"| 风险等级 | 数量 |\n"
        md += f"|---------|------|\n"
        md += f"| 🔴 高风险 | {len(high_risks)} |\n"
        md += f"| 🟡 中风险 | {len(medium_risks)} |\n"
        md += f"| 🟢 低风险 | {len(low_risks)} |\n\n"

        md += f"## 雪道状态\n\n"
        md += f"### 需重点关注的雪道 ({len(trails_with_issues)}条)\n\n"
        if trails_with_issues:
            for trail in sorted(trails_with_issues):
                trail_risks = [r for r in date_risks if r.trail_name == trail]
                md += f"- **{trail}**: {len(trail_risks)} 个风险项\n"
        else:
            md += f"- 无\n"

        md += f"\n### 可正常开放的雪道 ({len(trails_clear)}条)\n\n"
        if trails_clear:
            for trail in sorted(trails_clear):
                md += f"- {trail}\n"
        else:
            md += f"- 无\n"

        md += f"\n## 风险详情\n\n"

        if high_risks:
            md += f"### 🔴 高风险\n\n"
            for risk in high_risks:
                md += f"#### {risk.risk_type}: {risk.trail_name}\n\n"
                md += f"- **描述**: {risk.description}\n"
                md += f"- **缓解措施**: {risk.mitigation}\n\n"

        if medium_risks:
            md += f"### 🟡 中风险\n\n"
            for risk in medium_risks:
                md += f"#### {risk.risk_type}: {risk.trail_name}\n\n"
                md += f"- **描述**: {risk.description}\n"
                md += f"- **缓解措施**: {risk.mitigation}\n\n"

        if low_risks:
            md += f"### 🟢 低风险\n\n"
            for risk in low_risks:
                md += f"#### {risk.risk_type}: {risk.trail_name}\n\n"
                md += f"- **描述**: {risk.description}\n"
                md += f"- **缓解措施**: {risk.mitigation}\n\n"

        md += f"## 建议\n\n"
        if high_risks:
            md += f"1. **立即处理高风险项**: 优先处理所有高风险雪道，确保安全\n"
        if medium_risks:
            md += f"2. **安排处理中风险项**: 在开园前或运营间隙处理中风险项\n"
        if trails_clear:
            md += f"3. **确认无风险雪道**: 对无风险雪道进行最终确认后可正常开放\n"

        return md

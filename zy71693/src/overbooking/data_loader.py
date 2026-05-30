"""数据导入与清洗模块。

处理现实中常见的数据问题：
- 同名旅客对象区分
- 日期/时间格式不统一
- 附件数据比主表晚到（延迟数据）
- 重复数据检测
- 数据完整性校验
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, date, timedelta
from typing import List, Dict, Any, Optional, Tuple, Callable
from pathlib import Path

import pandas as pd
from dateutil import parser

from .models import (
    FlightOrder, NoShowHistory, FlightInfo, Passenger,
    CompensateRule, CabinClass, DataIssue
)

logger = logging.getLogger(__name__)


class DataLoader:
    """数据加载器 - 负责多源数据导入与预处理。"""

    def __init__(self):
        self.issues: List[DataIssue] = []
        self._duplicate_tracker: Dict[str, List[str]] = {}
        self._passenger_name_map: Dict[str, List[Dict[str, Any]]] = {}
        self._pending_data: Dict[str, List[Dict[str, Any]]] = {}
        self._data_arrival_time: Dict[str, datetime] = {}

    def _generate_issue_id(self) -> str:
        return f"issue_{uuid.uuid4().hex[:12]}"

    def _record_issue(
        self,
        issue_type: str,
        severity: str,
        description: str,
        affected_records: List[Dict[str, Any]],
        suggested_action: str
    ) -> DataIssue:
        """记录数据问题。"""
        issue = DataIssue(
            issue_id=self._generate_issue_id(),
            issue_type=issue_type,
            severity=severity,
            description=description,
            affected_records=affected_records,
            suggested_action=suggested_action
        )
        self.issues.append(issue)
        logger.warning(f"[{severity.upper()}] {issue_type}: {description}")
        return issue

    def _smart_parse_date(self, date_str: str) -> Tuple[Optional[date], Optional[str]]:
        """智能解析日期，尝试多种格式。

        返回: (解析后的日期, 错误信息)
        """
        if not date_str or pd.isna(date_str):
            return None, "日期为空"

        if isinstance(date_str, date):
            return date_str, None
        if isinstance(date_str, datetime):
            return date_str.date(), None

        formats_to_try = [
            "%Y-%m-%d", "%Y/%m/%d", "%Y.%m.%d",
            "%d-%m-%Y", "%d/%m/%Y", "%d.%m.%Y",
            "%m/%d/%Y", "%m-%d-%Y",
            "%Y年%m月%d日", "%y-%m-%d",
        ]

        for fmt in formats_to_try:
            try:
                return datetime.strptime(str(date_str), fmt).date(), None
            except ValueError:
                continue

        try:
            return parser.parse(str(date_str), fuzzy=True).date(), None
        except Exception as e:
            return None, f"无法解析日期: {date_str}, 错误: {str(e)}"

    def _detect_duplicates(self, records: List[Dict[str, Any]], key_fields: List[str]) -> List[Dict[str, Any]]:
        """检测重复记录。"""
        seen: Dict[str, List[int]] = {}
        duplicates: List[Dict[str, Any]] = []

        for idx, record in enumerate(records):
            key = "||".join(str(record.get(f, "")) for f in key_fields)
            if key in seen:
                seen[key].append(idx)
                duplicates.append({
                    "index": idx,
                    "record": record,
                    "duplicate_with_indices": seen[key][:-1],
                    "key": key
                })
            else:
                seen[key] = [idx]

        return duplicates

    def _resolve_name_conflicts(
        self,
        records: List[Dict[str, Any]],
        name_field: str = "passenger_name",
        id_field: Optional[str] = None
    ) -> Tuple[List[Dict[str, Any]], List[DataIssue]]:
        """处理同名旅客问题。

        通过附加信息（身份证号、手机号、航班日期等）区分同名旅客。
        """
        name_groups: Dict[str, List[Dict[str, Any]]] = {}
        issues: List[DataIssue] = []

        for idx, record in enumerate(records):
            name = record.get(name_field, "")
            if name not in name_groups:
                name_groups[name] = []
            name_groups[name].append({"index": idx, **record})

        for name, group in name_groups.items():
            if len(group) <= 1:
                continue

            can_distinguish = True
            for item in group:
                if id_field and not item.get(id_field):
                    can_distinguish = False
                    break

            if not can_distinguish:
                issue = self._record_issue(
                    issue_type="name_conflict",
                    severity="warning",
                    description=f"发现 {len(group)} 条同名旅客记录: '{name}', 缺少足够的身份信息区分",
                    affected_records=[{"index": g["index"], "record": g} for g in group],
                    suggested_action="manual_review"
                )
                issues.append(issue)
            else:
                logger.info(f"同名旅客 '{name}' 有 {len(group)} 条记录，可通过 {id_field} 区分")

            self._passenger_name_map[name] = group

        return records, issues

    def _check_data_arrival_timing(
        self,
        main_data: List[Dict[str, Any]],
        supplemental_data: List[Dict[str, Any]],
        main_key: str,
        supp_key: str,
        max_delay_hours: float = 12.0
    ) -> List[DataIssue]:
        """检查附件数据是否比主表晚到。

        模拟现实中附件数据延迟到达的情况。
        """
        issues: List[DataIssue] = []
        now = datetime.now()

        main_keys = {r.get(main_key) for r in main_data}
        supp_keys = {r.get(supp_key) for r in supplemental_data}

        missing_in_supp = main_keys - supp_keys
        if missing_in_supp:
            last_arrival = self._data_arrival_time.get("supplemental", now)
            delay = (now - last_arrival).total_seconds() / 3600

            if delay > max_delay_hours:
                issue = self._record_issue(
                    issue_type="late_arrival",
                    severity="warning",
                    description=f"附件数据延迟到达已超过 {max_delay_hours} 小时（已延迟 {delay:.1f} 小时），"
                                f"缺失 {len(missing_in_supp)} 条关联记录",
                    affected_records=[{"missing_keys": list(missing_in_supp)[:10]}],
                    suggested_action="request_more_data"
                )
                issues.append(issue)
            else:
                logger.info(f"附件数据尚有 {len(missing_in_supp)} 条未到，"
                            f"目前延迟 {delay:.1f} 小时，仍在容忍窗口内")

                for key in missing_in_supp:
                    if key not in self._pending_data:
                        self._pending_data[key] = []
                    main_records = [r for r in main_data if r.get(main_key) == key]
                    self._pending_data[key].extend(main_records)

        return issues

    def load_flight_orders(self, data: List[Dict[str, Any]]) -> Tuple[List[FlightOrder], List[DataIssue]]:
        """加载航班订单数据。"""
        logger.info(f"开始加载 {len(data)} 条航班订单...")
        self._data_arrival_time["flight_orders"] = datetime.now()

        issues: List[DataIssue] = []
        orders: List[FlightOrder] = []

        duplicates = self._detect_duplicates(data, ["order_id"])
        if duplicates:
            issue = self._record_issue(
                issue_type="duplicate",
                severity="warning",
                description=f"发现 {len(duplicates)} 条重复订单记录",
                affected_records=duplicates,
                suggested_action="manual_review"
            )
            issues.append(issue)

        data, name_issues = self._resolve_name_conflicts(data, "passenger_name", "passenger_id")
        issues.extend(name_issues)

        order_ids_seen = set()
        for idx, row in enumerate(data):
            try:
                if row.get("order_id") in order_ids_seen:
                    logger.debug(f"跳过重复订单: {row.get('order_id')}")
                    continue

                parsed_date, date_err = self._smart_parse_date(row.get("flight_date", ""))
                if date_err and not parsed_date:
                    issue = self._record_issue(
                        issue_type="date_format",
                        severity="error",
                        description=f"订单 {row.get('order_id')} 航班日期格式错误: {date_err}",
                        affected_records=[{"index": idx, "record": row}],
                        suggested_action="reject"
                    )
                    issues.append(issue)
                    continue

                booking_date, book_err = self._smart_parse_date(row.get("booking_date", ""))
                if book_err and not booking_date:
                    booking_date = parsed_date

                try:
                    cabin = CabinClass(row.get("cabin_class", "Y"))
                except ValueError:
                    issue = self._record_issue(
                        issue_type="cabin_mismatch",
                        severity="warning",
                        description=f"订单 {row.get('order_id')} 舱位 '{row.get('cabin_class')}' 不识别，默认经济舱",
                        affected_records=[{"index": idx, "record": row}],
                        suggested_action="manual_review"
                    )
                    issues.append(issue)
                    cabin = CabinClass.ECONOMY

                order = FlightOrder(
                    order_id=str(row["order_id"]),
                    flight_no=str(row.get("flight_no", "")),
                    flight_date=parsed_date,
                    passenger_name=str(row.get("passenger_name", "")),
                    passenger_id=row.get("passenger_id"),
                    cabin_class=cabin,
                    fare_amount=float(row.get("fare_amount", 0)),
                    booking_date=booking_date,
                    status=str(row.get("status", "confirmed"))
                )
                orders.append(order)
                order_ids_seen.add(order.order_id)

            except Exception as e:
                issue = self._record_issue(
                    issue_type="missing_field",
                    severity="error",
                    description=f"解析订单 {row.get('order_id')} 失败: {str(e)}",
                    affected_records=[{"index": idx, "record": row}],
                    suggested_action="reject"
                )
                issues.append(issue)

        logger.info(f"成功加载 {len(orders)} 条有效订单，发现 {len(issues)} 个问题")
        return orders, issues

    def load_no_show_history(self, data: List[Dict[str, Any]]) -> Tuple[List[NoShowHistory], List[DataIssue]]:
        """加载爽约历史数据。"""
        logger.info(f"开始加载 {len(data)} 条爽约历史记录...")
        self._data_arrival_time["no_show_history"] = datetime.now()

        issues: List[DataIssue] = []
        histories: List[NoShowHistory] = []

        duplicates = self._detect_duplicates(data, ["passenger_name", "flight_date", "flight_no"])
        if duplicates:
            issue = self._record_issue(
                issue_type="duplicate",
                severity="warning",
                description=f"发现 {len(duplicates)} 条重复爽约历史记录",
                affected_records=duplicates,
                suggested_action="manual_review"
            )
            issues.append(issue)

        for idx, row in enumerate(data):
            try:
                parsed_date, date_err = self._smart_parse_date(row.get("flight_date", ""))
                if date_err and not parsed_date:
                    issue = self._record_issue(
                        issue_type="date_format",
                        severity="error",
                        description=f"爽约历史记录 {idx} 日期格式错误: {date_err}",
                        affected_records=[{"index": idx, "record": row}],
                        suggested_action="reject"
                    )
                    issues.append(issue)
                    continue

                history = NoShowHistory(
                    history_id=str(row.get("history_id", f"hist_{idx}")),
                    passenger_name=str(row.get("passenger_name", "")),
                    passenger_id=row.get("passenger_id"),
                    flight_date=parsed_date,
                    flight_no=str(row.get("flight_no", "")),
                    was_no_show=bool(row.get("was_no_show", False)),
                    reason=row.get("reason")
                )
                histories.append(history)

            except Exception as e:
                issue = self._record_issue(
                    issue_type="missing_field",
                    severity="error",
                    description=f"解析爽约历史 {idx} 失败: {str(e)}",
                    affected_records=[{"index": idx, "record": row}],
                    suggested_action="reject"
                )
                issues.append(issue)

        logger.info(f"成功加载 {len(histories)} 条爽约历史，发现 {len(issues)} 个问题")
        return histories, issues

    def load_flight_info(self, data: List[Dict[str, Any]]) -> Tuple[List[FlightInfo], List[DataIssue]]:
        """加载航班信息数据。"""
        logger.info(f"开始加载 {len(data)} 条航班信息...")
        self._data_arrival_time["flight_info"] = datetime.now()

        issues: List[DataIssue] = []
        flights: List[FlightInfo] = []

        for idx, row in enumerate(data):
            try:
                parsed_date, date_err = self._smart_parse_date(row.get("flight_date", ""))
                if date_err and not parsed_date:
                    issue = self._record_issue(
                        issue_type="date_format",
                        severity="error",
                        description=f"航班 {row.get('flight_no')} 日期格式错误: {date_err}",
                        affected_records=[{"index": idx, "record": row}],
                        suggested_action="reject"
                    )
                    issues.append(issue)
                    continue

                try:
                    dep_time = parser.parse(str(row.get("scheduled_departure", "")), fuzzy=True)
                except Exception:
                    dep_time = datetime(parsed_date.year, parsed_date.month, parsed_date.day, 10, 0)

                capacity_raw = row.get("capacity", {})
                capacity: Dict[CabinClass, int] = {}
                for cabin_key, count in capacity_raw.items():
                    try:
                        cabin = CabinClass(cabin_key)
                        capacity[cabin] = int(count)
                    except (ValueError, KeyError):
                        logger.warning(f"忽略无法识别的舱位容量: {cabin_key}")

                if not capacity:
                    capacity = {
                        CabinClass.ECONOMY: int(row.get("total_seats", 150)),
                        CabinClass.BUSINESS: int(row.get("business_seats", 20)),
                    }

                flight = FlightInfo(
                    flight_no=str(row["flight_no"]),
                    flight_date=parsed_date,
                    departure=str(row.get("departure", "")),
                    arrival=str(row.get("arrival", "")),
                    scheduled_departure=dep_time,
                    capacity=capacity
                )
                flights.append(flight)

            except Exception as e:
                issue = self._record_issue(
                    issue_type="missing_field",
                    severity="error",
                    description=f"解析航班信息 {idx} 失败: {str(e)}",
                    affected_records=[{"index": idx, "record": row}],
                    suggested_action="reject"
                )
                issues.append(issue)

        logger.info(f"成功加载 {len(flights)} 条航班信息，发现 {len(issues)} 个问题")
        return flights, issues

    def load_passengers(self, data: List[Dict[str, Any]]) -> Tuple[List[Passenger], List[DataIssue]]:
        """加载旅客名单数据。"""
        logger.info(f"开始加载 {len(data)} 条旅客信息...")
        self._data_arrival_time["passengers"] = datetime.now()

        issues: List[DataIssue] = []
        passengers: List[Passenger] = []

        duplicates = self._detect_duplicates(data, ["passenger_id"])
        if duplicates:
            issue = self._record_issue(
                issue_type="duplicate",
                severity="warning",
                description=f"发现 {len(duplicates)} 条重复旅客记录",
                affected_records=duplicates,
                suggested_action="manual_review"
            )
            issues.append(issue)

        passenger_ids_seen = set()
        for idx, row in enumerate(data):
            try:
                pid = str(row.get("passenger_id", ""))
                if pid in passenger_ids_seen:
                    continue

                passenger = Passenger(
                    passenger_id=pid,
                    name=str(row.get("name", "")),
                    phone=row.get("phone"),
                    email=row.get("email"),
                    tier=str(row.get("tier", "basic")),
                    historical_no_show_count=int(row.get("historical_no_show_count", 0)),
                    historical_flight_count=int(row.get("historical_flight_count", 0))
                )
                passengers.append(passenger)
                passenger_ids_seen.add(pid)

            except Exception as e:
                issue = self._record_issue(
                    issue_type="missing_field",
                    severity="error",
                    description=f"解析旅客 {idx} 失败: {str(e)}",
                    affected_records=[{"index": idx, "record": row}],
                    suggested_action="reject"
                )
                issues.append(issue)

        logger.info(f"成功加载 {len(passengers)} 条旅客信息，发现 {len(issues)} 个问题")
        return passengers, issues

    def load_compensation_rules(self, data: List[Dict[str, Any]]) -> Tuple[List[CompensateRule], List[DataIssue]]:
        """加载补偿规则数据。"""
        logger.info(f"开始加载 {len(data)} 条补偿规则...")
        self._data_arrival_time["compensation_rules"] = datetime.now()

        issues: List[DataIssue] = []
        rules: List[CompensateRule] = []

        for idx, row in enumerate(data):
            try:
                try:
                    cabin = CabinClass(row.get("cabin_class", "Y"))
                except ValueError:
                    issue = self._record_issue(
                        issue_type="cabin_mismatch",
                        severity="warning",
                        description=f"补偿规则 {idx} 舱位 '{row.get('cabin_class')}' 不识别",
                        affected_records=[{"index": idx, "record": row}],
                        suggested_action="manual_review"
                    )
                    issues.append(issue)
                    continue

                rule = CompensateRule(
                    rule_id=str(row.get("rule_id", f"rule_{idx}")),
                    cabin_class=cabin,
                    threshold_hours=float(row.get("threshold_hours", 24)),
                    compensation_amount=float(row.get("compensation_amount", 0)),
                    voucher_amount=float(row.get("voucher_amount", 0)),
                    priority_booking=bool(row.get("priority_booking", False))
                )
                rules.append(rule)

            except Exception as e:
                issue = self._record_issue(
                    issue_type="missing_field",
                    severity="error",
                    description=f"解析补偿规则 {idx} 失败: {str(e)}",
                    affected_records=[{"index": idx, "record": row}],
                    suggested_action="reject"
                )
                issues.append(issue)

        logger.info(f"成功加载 {len(rules)} 条补偿规则，发现 {len(issues)} 个问题")
        return rules, issues

    def load_from_csv(self, filepath: str, data_type: str) -> Tuple[Any, List[DataIssue]]:
        """从CSV文件加载数据。"""
        path = Path(filepath)
        if not path.exists():
            raise FileNotFoundError(f"文件不存在: {filepath}")

        logger.info(f"从CSV加载 {data_type}: {filepath}")
        df = pd.read_csv(path)

        if "capacity" in df.columns:
            import json
            df["capacity"] = df["capacity"].apply(
                lambda x: json.loads(x) if isinstance(x, str) else {}
            )

        data = df.to_dict("records")

        loaders: Dict[str, Callable] = {
            "flight_orders": self.load_flight_orders,
            "no_show_history": self.load_no_show_history,
            "flight_info": self.load_flight_info,
            "passengers": self.load_passengers,
            "compensation_rules": self.load_compensation_rules,
        }

        if data_type not in loaders:
            raise ValueError(f"不支持的数据类型: {data_type}")

        return loaders[data_type](data)

    def check_data_consistency(
        self,
        flight_orders: List[FlightOrder],
        flight_info: List[FlightInfo],
        passengers: Optional[List[Passenger]] = None
    ) -> List[DataIssue]:
        """检查跨表数据一致性。"""
        issues: List[DataIssue] = []
        logger.info("检查数据一致性...")

        flight_map = {(f.flight_no, f.flight_date): f for f in flight_info}
        order_flights = {(o.flight_no, o.flight_date) for o in flight_orders}

        missing_flight_info = order_flights - set(flight_map.keys())
        if missing_flight_info:
            issue = self._record_issue(
                issue_type="missing_field",
                severity="warning",
                description=f"有 {len(missing_flight_info)} 个航班缺少航班基础信息",
                affected_records=[{"flights": list(missing_flight_info)[:10]}],
                suggested_action="request_more_data"
            )
            issues.append(issue)

        if passengers:
            passenger_ids = {p.passenger_id for p in passengers}
            orders_without_passenger = [
                o for o in flight_orders
                if o.passenger_id and o.passenger_id not in passenger_ids
            ]
            if orders_without_passenger:
                issue = self._record_issue(
                    issue_type="missing_field",
                    severity="info",
                    description=f"有 {len(orders_without_passenger)} 个订单关联的旅客不在旅客名单中",
                    affected_records=[{"order_ids": [o.order_id for o in orders_without_passenger[:10]]}],
                    suggested_action="manual_review"
                )
                issues.append(issue)

        logger.info(f"一致性检查完成，发现 {len(issues)} 个问题")
        return issues

    def get_all_issues(self) -> List[DataIssue]:
        """获取所有数据问题。"""
        return self.issues

    def clear_issues(self):
        """清空问题记录。"""
        self.issues = []

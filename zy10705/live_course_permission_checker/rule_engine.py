import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Tuple

import pandas as pd


class RuleEngine:
    def __init__(self, console):
        self.console = console

    def load_rules(self, rules_file: Path) -> Dict:
        try:
            with open(rules_file, 'r', encoding='utf-8') as f:
                rules = json.load(f)
            self.console.print(f"✓ 规则加载成功: {len(rules.get('rules', []))} 条规则", style="green")
            return rules
        except Exception as e:
            raise RuntimeError(f"规则文件加载失败: {str(e)}")

    def check_permissions(self, datasets: Dict[str, List[pd.DataFrame]], rules: Dict) -> Dict:
        merged = self._merge_datasets(datasets)
        results = {
            "退款后观看": [],
            "换班学员": [],
            "补录订单": [],
            "不该观看的用户": [],
            "漏授权用户": [],
            "统计摘要": {}
        }

        if not merged["观看记录"] or not merged["订单记录"]:
            self.console.print("警告: 缺少必要的数据，无法进行完整核查", style="bold yellow")
            return results

        watch_df = pd.concat(merged["观看记录"], ignore_index=True)
        order_df = pd.concat(merged["订单记录"], ignore_index=True)
        auth_df = pd.concat(merged["授权名单"], ignore_index=True) if merged["授权名单"] else pd.DataFrame()

        self.console.print(f"  - 观看记录: {len(watch_df)} 条")
        self.console.print(f"  - 订单记录: {len(order_df)} 条")
        self.console.print(f"  - 授权名单: {len(auth_df)} 条" if not auth_df.empty else "  - 授权名单: 无")

        results["退款后观看"] = self._check_refund_after_watch(watch_df, order_df)
        results["换班学员"] = self._check_class_switch(watch_df, order_df)
        results["补录订单"] = self._check_supplementary_order(order_df)
        results["不该观看的用户"] = self._check_unauthorized_watch(watch_df, order_df, auth_df)
        results["漏授权用户"] = self._check_missing_authorization(order_df, auth_df)

        results["统计摘要"] = {
            "总观看记录": len(watch_df),
            "总订单数": len(order_df),
            "授权用户数": len(auth_df),
            "退款后观看数": len(results["退款后观看"]),
            "换班学员数": len(results["换班学员"]),
            "补录订单数": len(results["补录订单"]),
            "不该观看数": len(results["不该观看的用户"]),
            "漏授权数": len(results["漏授权用户"])
        }

        self._print_result_summary(results)
        return results

    def _merge_datasets(self, datasets: Dict[str, List[pd.DataFrame]]) -> Dict[str, List[pd.DataFrame]]:
        return {
            "观看记录": datasets.get("观看记录", []),
            "订单记录": datasets.get("订单记录", []),
            "授权名单": datasets.get("授权名单", [])
        }

    def _parse_datetime(self, dt_str: str) -> datetime:
        if pd.isna(dt_str) or not dt_str:
            return None
        try:
            return pd.to_datetime(dt_str)
        except:
            return None

    def _check_refund_after_watch(self, watch_df: pd.DataFrame, order_df: pd.DataFrame) -> List[Dict]:
        anomalies = []
        refunded_orders = order_df[order_df["订单状态"].str.contains("退款|已退|取消", na=False)]

        for _, order in refunded_orders.iterrows():
            refund_time = self._parse_datetime(order["退款时间"])
            if not refund_time:
                continue

            user_watches = watch_df[watch_df["用户ID"] == order["用户ID"]]
            for _, watch in user_watches.iterrows():
                watch_time = self._parse_datetime(watch["观看时间"])
                if watch_time and watch_time > refund_time:
                    anomalies.append({
                        "用户ID": order["用户ID"],
                        "用户姓名": order["用户姓名"],
                        "课程ID": order["课程ID"],
                        "课程名称": order["课程名称"],
                        "订单ID": order["订单ID"],
                        "退款时间": order["退款时间"],
                        "观看时间": watch["观看时间"],
                        "观看时长": watch["观看时长(秒)"],
                        "异常类型": "退款后观看 - 用户退款后仍继续观看课程回放"
                    })

        return anomalies

    def _check_class_switch(self, watch_df: pd.DataFrame, order_df: pd.DataFrame) -> List[Dict]:
        anomalies = []
        user_orders = order_df.groupby("用户ID")

        for user_id, group in user_orders:
            if len(group["课程ID"].unique()) > 1:
                user_watches = watch_df[watch_df["用户ID"] == user_id]
                watched_courses = set(user_watches["课程ID"].unique())
                ordered_courses = set(group["课程ID"].unique())

                for course_id in watched_courses:
                    if course_id not in ordered_courses:
                        course_name = user_watches[user_watches["课程ID"] == course_id]["课程名称"].iloc[0]
                        user_name = group["用户姓名"].iloc[0]
                        anomalies.append({
                            "用户ID": user_id,
                            "用户姓名": user_name,
                            "课程ID": course_id,
                            "课程名称": course_name,
                            "已购课程": ", ".join(group["课程名称"].unique()),
                            "观看次数": len(user_watches[user_watches["课程ID"] == course_id]),
                            "异常类型": "换班学员 - 观看了非当前班级课程，疑似换班未及时同步权限"
                        })

        return anomalies

    def _check_supplementary_order(self, order_df: pd.DataFrame) -> List[Dict]:
        anomalies = []
        supplementary_orders = order_df[order_df["订单类型"].str.contains("补录|补单|后台", na=False)]

        for _, order in supplementary_orders.iterrows():
            order_time = self._parse_datetime(order["下单时间"])
            pay_time = self._parse_datetime(order["支付时间"])

            anomalies.append({
                "订单ID": order["订单ID"],
                "用户ID": order["用户ID"],
                "用户姓名": order["用户姓名"],
                "课程ID": order["课程ID"],
                "课程名称": order["课程名称"],
                "下单时间": order["下单时间"],
                "支付时间": order["支付时间"],
                "订单状态": order["订单状态"],
                "异常类型": "补录订单 - 需要人工核实授权时效和权限范围"
            })

        return anomalies

    def _check_unauthorized_watch(self, watch_df: pd.DataFrame, order_df: pd.DataFrame, auth_df: pd.DataFrame) -> List[Dict]:
        anomalies = []

        valid_users = set(order_df[~order_df["订单状态"].str.contains("退款|已退|取消", na=False)]["用户ID"].unique())
        if not auth_df.empty:
            valid_users.update(set(auth_df["用户ID"].unique()))

        for user_id in watch_df["用户ID"].unique():
            if user_id not in valid_users:
                user_watches = watch_df[watch_df["用户ID"] == user_id]
                for _, watch in user_watches.iterrows():
                    anomalies.append({
                        "用户ID": user_id,
                        "用户姓名": watch["用户姓名"],
                        "课程ID": watch["课程ID"],
                        "课程名称": watch["课程名称"],
                        "观看时间": watch["观看时间"],
                        "观看时长": watch["观看时长(秒)"],
                        "异常类型": "不该观看 - 无有效订单或授权记录，疑似越权访问"
                    })

        return anomalies

    def _check_missing_authorization(self, order_df: pd.DataFrame, auth_df: pd.DataFrame) -> List[Dict]:
        anomalies = []
        if auth_df.empty:
            return anomalies

        paid_orders = order_df[~order_df["订单状态"].str.contains("退款|已退|取消", na=False)]
        auth_users = set(zip(auth_df["用户ID"], auth_df["课程ID"]))

        for _, order in paid_orders.iterrows():
            key = (order["用户ID"], order["课程ID"])
            if key not in auth_users:
                anomalies.append({
                    "用户ID": order["用户ID"],
                    "用户姓名": order["用户姓名"],
                    "课程ID": order["课程ID"],
                    "课程名称": order["课程名称"],
                    "订单ID": order["订单ID"],
                    "下单时间": order["下单时间"],
                    "异常类型": "漏授权 - 已付款但未在授权名单中，需要补充授权"
                })

        return anomalies

    def _print_result_summary(self, results: Dict):
        self.console.print("\n核查结果摘要:", style="bold")
        self.console.print(f"  退款后观看: {len(results['退款后观看'])} 条", style="red")
        self.console.print(f"  换班学员: {len(results['换班学员'])} 条", style="yellow")
        self.console.print(f"  补录订单: {len(results['补录订单'])} 条", style="blue")
        self.console.print(f"  不该观看: {len(results['不该观看的用户'])} 条", style="red")
        self.console.print(f"  漏授权: {len(results['漏授权用户'])} 条", style="green")

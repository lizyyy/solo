#!/usr/bin/env python3
import argparse
import json
import sys
from datetime import date, datetime
from typing import Dict, List
from dataclasses import asdict

from models import (
    Flower, Subscription, DeliverySchedule, ChangeRequest,
    SubscriptionStatus, ChangeType, AdjustmentStatus
)
from rules_engine import BusinessRulesEngine
from report_generator import ReportGenerator


class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (date, datetime)):
            return obj.isoformat()
        if isinstance(obj, (SubscriptionStatus, ChangeType, AdjustmentStatus)):
            return obj.value
        return super().default(obj)


class FlowerSubscriptionCLI:
    def __init__(self, data_file: str = "data.json"):
        self.data_file = data_file
        self.engine = BusinessRulesEngine()
        self.reporter = ReportGenerator()
        self.flowers: Dict[str, Flower] = {}
        self.subscriptions: Dict[str, Subscription] = {}
        self.schedules: List[DeliverySchedule] = []
        self.change_requests: List[ChangeRequest] = []
        self.load_data()

    def load_data(self):
        try:
            with open(self.data_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            for f_data in data.get("flowers", []):
                f_data["last_updated"] = datetime.fromisoformat(f_data["last_updated"])
                self.flowers[f_data["flower_id"]] = Flower(**f_data)
            for s_data in data.get("subscriptions", []):
                s_data["start_date"] = date.fromisoformat(s_data["start_date"])
                if s_data["end_date"]:
                    s_data["end_date"] = date.fromisoformat(s_data["end_date"])
                s_data["status"] = SubscriptionStatus(s_data["status"])
                s_data["created_at"] = datetime.fromisoformat(s_data["created_at"])
                for pause in s_data.get("pause_history", []):
                    if isinstance(pause.get("start_date"), str):
                        pause["start_date"] = date.fromisoformat(pause["start_date"])
                    if isinstance(pause.get("end_date"), str):
                        pause["end_date"] = date.fromisoformat(pause["end_date"])
                self.subscriptions[s_data["subscription_id"]] = Subscription(**s_data)
            for sched_data in data.get("schedules", []):
                sched_data["delivery_date"] = date.fromisoformat(sched_data["delivery_date"])
                if sched_data["actual_delivery_date"]:
                    sched_data["actual_delivery_date"] = date.fromisoformat(sched_data["actual_delivery_date"])
                self.schedules.append(DeliverySchedule(**sched_data))
            for req_data in data.get("change_requests", []):
                req_data["request_date"] = datetime.fromisoformat(req_data["request_date"])
                req_data["effective_date"] = date.fromisoformat(req_data["effective_date"])
                if req_data["pause_end_date"]:
                    req_data["pause_end_date"] = date.fromisoformat(req_data["pause_end_date"])
                req_data["change_type"] = ChangeType(req_data["change_type"])
                req_data["status"] = AdjustmentStatus(req_data["status"])
                self.change_requests.append(ChangeRequest(**req_data))
            for pd_data in data.get("price_differences", []):
                pd_data["recorded_at"] = datetime.fromisoformat(pd_data["recorded_at"])
                from models import PriceDifference
                self.engine.price_differences.append(PriceDifference(**pd_data))
            for log_data in data.get("inventory_logs", []):
                log_data["timestamp"] = datetime.fromisoformat(log_data["timestamp"])
                from models import InventoryLog
                self.engine.inventory_logs.append(InventoryLog(**log_data))
            for sub_id, reqs in data.get("executed_requests", {}).items():
                for req_data in reqs:
                    req_data["request_date"] = datetime.fromisoformat(req_data["request_date"])
                    req_data["effective_date"] = date.fromisoformat(req_data["effective_date"])
                    if req_data["pause_end_date"]:
                        req_data["pause_end_date"] = date.fromisoformat(req_data["pause_end_date"])
                    req_data["change_type"] = ChangeType(req_data["change_type"])
                    req_data["status"] = AdjustmentStatus(req_data["status"])
                    self.engine.executed_requests[sub_id].append(ChangeRequest(**req_data))
        except FileNotFoundError:
            pass

    def save_data(self):
        data = {
            "flowers": [asdict(f) for f in self.flowers.values()],
            "subscriptions": [asdict(s) for s in self.subscriptions.values()],
            "schedules": [asdict(s) for s in self.schedules],
            "change_requests": [asdict(r) for r in self.change_requests],
            "price_differences": [asdict(pd) for pd in self.engine.price_differences],
            "inventory_logs": [asdict(log) for log in self.engine.inventory_logs],
            "executed_requests": {
                sub_id: [asdict(req) for req in reqs]
                for sub_id, reqs in self.engine.executed_requests.items()
            }
        }
        with open(self.data_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, cls=DateTimeEncoder, indent=2, ensure_ascii=False)

    def cmd_list_flowers(self, args):
        if not self.flowers:
            print("暂无花材数据")
            return
        for fid, flower in self.flowers.items():
            print(f"{fid}: {flower.name} - ¥{flower.price} - 库存:{flower.current_stock}")

    def cmd_list_subscriptions(self, args):
        if not self.subscriptions:
            print("暂无订阅数据")
            return
        for sid, sub in self.subscriptions.items():
            print(f"{sid}: 客户{sub.customer_id} - {sub.status.value} - ¥{sub.total_price}")
            print(f"  周期: {sub.start_date} ~ {sub.end_date}")
            print(f"  当前花材: {', '.join(sub.current_flower_ids)}")

    def cmd_list_schedules(self, args):
        sub_id = args.subscription_id
        filtered = self.schedules
        if sub_id:
            filtered = [s for s in self.schedules if s.subscription_id == sub_id]
        if not filtered:
            print("暂无配送计划")
            return
        for sched in filtered:
            print(f"{sched.schedule_id}: {sched.delivery_date} - {sched.status}")
            print(f"  花材: {', '.join(sched.flower_ids)}")

    def cmd_request_swap(self, args):
        if args.subscription_id not in self.subscriptions:
            print(f"错误: 订阅 {args.subscription_id} 不存在")
            sys.exit(1)
        sub = self.subscriptions[args.subscription_id]
        old_flowers = args.old_flowers.split(',') if args.old_flowers else []
        new_flowers = args.new_flowers.split(',') if args.new_flowers else []
        effective_date = date.fromisoformat(args.effective_date) if args.effective_date else date.today()
        request = ChangeRequest(
            subscription_id=args.subscription_id,
            change_type=ChangeType.SWAP_FLOWER,
            effective_date=effective_date,
            old_flower_ids=old_flowers,
            new_flower_ids=new_flowers,
            requested_by=args.requested_by or "cli_user"
        )
        result = self.engine.execute_change_request(request, sub, self.flowers, self.schedules)
        if result["success"]:
            self.change_requests.append(request)
            self.save_data()
            print(f"换花成功!")
            print(f"差价: ¥{result['old_price']} -> ¥{result['new_price']} = ¥{result['price_diff']:+}")
            print(f"影响配送计划: {len(result['affected_schedules'])}个")
        else:
            print("换花失败:")
            for err in result["errors"]:
                print(f"  - {err}")
            sys.exit(1)

    def cmd_request_pause(self, args):
        if args.subscription_id not in self.subscriptions:
            print(f"错误: 订阅 {args.subscription_id} 不存在")
            sys.exit(1)
        sub = self.subscriptions[args.subscription_id]
        effective_date = date.fromisoformat(args.effective_date) if args.effective_date else date.today()
        end_date = date.fromisoformat(args.end_date) if args.end_date else None
        request = ChangeRequest(
            subscription_id=args.subscription_id,
            change_type=ChangeType.PAUSE,
            effective_date=effective_date,
            pause_end_date=end_date,
            requested_by=args.requested_by or "cli_user"
        )
        result = self.engine.execute_change_request(request, sub, self.flowers, self.schedules)
        if result["success"]:
            self.change_requests.append(request)
            self.save_data()
            print(f"暂停成功!")
            print(f"暂停天数: {result['pause_days']}天")
            print(f"影响配送计划: {len(result['affected_schedules'])}个")
        else:
            print("暂停失败:")
            for err in result["errors"]:
                print(f"  - {err}")
            sys.exit(1)

    def cmd_request_resume(self, args):
        if args.subscription_id not in self.subscriptions:
            print(f"错误: 订阅 {args.subscription_id} 不存在")
            sys.exit(1)
        sub = self.subscriptions[args.subscription_id]
        effective_date = date.fromisoformat(args.effective_date) if args.effective_date else date.today()
        request = ChangeRequest(
            subscription_id=args.subscription_id,
            change_type=ChangeType.RESUME,
            effective_date=effective_date,
            requested_by=args.requested_by or "cli_user"
        )
        result = self.engine.execute_change_request(request, sub, self.flowers, self.schedules)
        if result["success"]:
            self.change_requests.append(request)
            self.save_data()
            print(f"恢复成功!")
            print(f"恢复日期: {result['resume_date']}")
            print(f"影响配送计划: {len(result['affected_schedules'])}个")
        else:
            print("恢复失败:")
            for err in result["errors"]:
                print(f"  - {err}")
            sys.exit(1)

    def cmd_verify(self, args):
        sub_id = args.subscription_id
        if sub_id and sub_id not in self.subscriptions:
            print(f"错误: 订阅 {sub_id} 不存在")
            sys.exit(1)
        all_ok = True
        subscriptions_to_check = [self.subscriptions[sub_id]] if sub_id else list(self.subscriptions.values())
        for sub in subscriptions_to_check:
            ok, issues = self.engine.verify_consistency(sub, self.flowers, self.schedules)
            if not ok:
                all_ok = False
                print(f"\n订阅 {sub.subscription_id} 一致性问题:")
                for issue in issues:
                    print(f"  - {issue}")
        if all_ok:
            print("所有数据一致性检查通过!")
        else:
            sys.exit(1)

    def cmd_report(self, args):
        if args.subscription_id not in self.subscriptions:
            print(f"错误: 订阅 {args.subscription_id} 不存在")
            sys.exit(1)
        sub = self.subscriptions[args.subscription_id]
        period_start = date.fromisoformat(args.start_date) if args.start_date else sub.start_date
        period_end = date.fromisoformat(args.end_date) if args.end_date else (sub.end_date or date.today())
        report_data = self.engine.generate_delivery_report(sub, self.schedules, period_start, period_end)
        human_report = self.reporter.generate_human_readable_report(report_data, sub, self.flowers)
        print(human_report)
        if args.output:
            self.reporter.export_json_report(report_data, args.output)
            print(f"\n机器可读报告已保存到: {args.output}")
        if args.verify:
            is_match = self.reporter.verify_report_consistency(report_data, human_report)
            print(f"\n报告一致性验证: {'通过' if is_match else '失败'}")

    def cmd_list_requests(self, args):
        sub_id = args.subscription_id
        filtered = self.change_requests
        if sub_id:
            filtered = [r for r in self.change_requests if r.subscription_id == sub_id]
        if not filtered:
            print("暂无调整申请")
            return
        for req in filtered:
            print(f"{req.request_id}: {req.change_type.value} - {req.status.value}")
            print(f"  生效日期: {req.effective_date}")
            if req.change_type == ChangeType.SWAP_FLOWER:
                print(f"  换花: {', '.join(req.old_flower_ids)} -> {', '.join(req.new_flower_ids)}")

    def run(self, args=None):
        parser = argparse.ArgumentParser(description="鲜花订阅换花差价暂停恢复排查CLI")
        parser.add_argument("--data-file", default="data.json", help="数据文件路径 (默认: data.json)")
        subparsers = parser.add_subparsers(dest="command", help="可用命令")
        list_flowers = subparsers.add_parser("list-flowers", help="列出所有花材")
        list_flowers.set_defaults(func=self.cmd_list_flowers)
        list_subs = subparsers.add_parser("list-subscriptions", help="列出所有订阅")
        list_subs.set_defaults(func=self.cmd_list_subscriptions)
        list_sched = subparsers.add_parser("list-schedules", help="列出配送计划")
        list_sched.add_argument("--subscription-id", help="订阅ID过滤")
        list_sched.set_defaults(func=self.cmd_list_schedules)
        swap = subparsers.add_parser("swap", help="申请换花")
        swap.add_argument("subscription_id", help="订阅ID")
        swap.add_argument("--old-flowers", required=True, help="原花材ID，逗号分隔")
        swap.add_argument("--new-flowers", required=True, help="新花材ID，逗号分隔")
        swap.add_argument("--effective-date", help="生效日期 (YYYY-MM-DD)")
        swap.add_argument("--requested-by", help="申请人")
        swap.set_defaults(func=self.cmd_request_swap)
        pause = subparsers.add_parser("pause", help="申请暂停")
        pause.add_argument("subscription_id", help="订阅ID")
        pause.add_argument("--effective-date", help="生效日期 (YYYY-MM-DD)")
        pause.add_argument("--end-date", help="结束日期 (YYYY-MM-DD)")
        pause.add_argument("--requested-by", help="申请人")
        pause.set_defaults(func=self.cmd_request_pause)
        resume = subparsers.add_parser("resume", help="申请恢复")
        resume.add_argument("subscription_id", help="订阅ID")
        resume.add_argument("--effective-date", help="生效日期 (YYYY-MM-DD)")
        resume.add_argument("--requested-by", help="申请人")
        resume.set_defaults(func=self.cmd_request_resume)
        list_reqs = subparsers.add_parser("list-requests", help="列出调整申请")
        list_reqs.add_argument("--subscription-id", help="订阅ID过滤")
        list_reqs.set_defaults(func=self.cmd_list_requests)
        verify = subparsers.add_parser("verify", help="验证数据一致性")
        verify.add_argument("--subscription-id", help="指定订阅ID验证")
        verify.set_defaults(func=self.cmd_verify)
        report = subparsers.add_parser("report", help="生成配送报告")
        report.add_argument("subscription_id", help="订阅ID")
        report.add_argument("--start-date", help="统计开始日期")
        report.add_argument("--end-date", help="统计结束日期")
        report.add_argument("--output", help="输出JSON报告文件路径")
        report.add_argument("--verify", action="store_true", help="验证人机报告一致性")
        report.set_defaults(func=self.cmd_report)
        args = parser.parse_args(args)
        if args.command is None:
            parser.print_help()
            return
        args.func(args)


def main():
    parser = argparse.ArgumentParser(description="鲜花订阅换花差价暂停恢复排查CLI", add_help=False)
    parser.add_argument("--data-file", default="data.json", help="数据文件路径 (默认: data.json)")
    known_args, _ = parser.parse_known_args()
    cli = FlowerSubscriptionCLI(known_args.data_file)
    cli.run()


if __name__ == "__main__":
    main()

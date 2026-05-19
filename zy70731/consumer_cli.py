#!/usr/bin/env python3
import argparse
import json
import sys
import re
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass, asdict, field


@dataclass
class Owner:
    name: str
    team: str
    email: str

    def validate(self) -> Tuple[bool, List[str]]:
        errors = []
        if not self.name or len(self.name.strip()) == 0:
            errors.append("负责人姓名不能为空")
        if not self.team or len(self.team.strip()) == 0:
            errors.append("团队名称不能为空")
        if self.email and not re.match(r"^[\w\.-]+@[\w\.-]+\.\w+$", self.email):
            errors.append(f"邮箱格式无效: {self.email}")
        return len(errors) == 0, errors


@dataclass
class ProcessingRange:
    start_partition: int
    end_partition: int
    message_type: str = ""

    def validate(self) -> Tuple[bool, List[str]]:
        errors = []
        if self.start_partition < 0:
            errors.append(f"起始分区不能为负数: {self.start_partition}")
        if self.end_partition < self.start_partition:
            errors.append(f"结束分区 {self.end_partition} 不能小于起始分区 {self.start_partition}")
        return len(errors) == 0, errors

    def overlaps_with(self, other: "ProcessingRange") -> bool:
        return not (
            self.end_partition < other.start_partition
            or other.end_partition < self.start_partition
        )

    def to_dict(self) -> Dict:
        return {
            "start_partition": self.start_partition,
            "end_partition": self.end_partition,
            "message_type": self.message_type,
            "range_str": f"{self.start_partition}-{self.end_partition}"
        }


@dataclass
class ConsumerGroup:
    group_name: str
    queue_name: str
    processing_range: ProcessingRange
    owner: Owner
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())

    def validate(self) -> Tuple[bool, List[str]]:
        errors = []
        if not self.group_name or len(self.group_name.strip()) == 0:
            errors.append("消费者组名称不能为空")
        if not self.queue_name or len(self.queue_name.strip()) == 0:
            errors.append("队列名称不能为空")
        range_valid, range_errors = self.processing_range.validate()
        if not range_valid:
            errors.extend(range_errors)
        owner_valid, owner_errors = self.owner.validate()
        if not owner_valid:
            errors.extend(owner_errors)
        return len(errors) == 0, errors


@dataclass
class TransferRecord:
    group_name: str
    queue_name: str
    from_owner: Owner
    to_owner: Owner
    transferred_at: str = field(default_factory=lambda: datetime.now().isoformat())
    reason: str = ""


class ConsumerRegistry:
    def __init__(self, data_file: str = "consumer_registry.json"):
        self.data_file = data_file
        self.groups: Dict[str, ConsumerGroup] = {}
        self.transfers: List[TransferRecord] = []
        self._load_data()

    def _load_data(self):
        try:
            with open(self.data_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                for group_data in data.get("groups", []):
                    try:
                        group = ConsumerGroup(
                            group_name=group_data["group_name"],
                            queue_name=group_data["queue_name"],
                            processing_range=ProcessingRange(
                                start_partition=group_data["processing_range"]["start_partition"],
                                end_partition=group_data["processing_range"]["end_partition"],
                                message_type=group_data["processing_range"].get("message_type", "")
                            ),
                            owner=Owner(
                                name=group_data["owner"]["name"],
                                team=group_data["owner"]["team"],
                                email=group_data["owner"].get("email", "")
                            ),
                            created_at=group_data.get("created_at", datetime.now().isoformat())
                        )
                        self.groups[group.group_name] = group
                    except Exception:
                        continue
                for transfer_data in data.get("transfers", []):
                    try:
                        transfer = TransferRecord(
                            group_name=transfer_data["group_name"],
                            queue_name=transfer_data["queue_name"],
                            from_owner=Owner(
                                name=transfer_data["from_owner"]["name"],
                                team=transfer_data["from_owner"]["team"],
                                email=transfer_data["from_owner"].get("email", "")
                            ),
                            to_owner=Owner(
                                name=transfer_data["to_owner"]["name"],
                                team=transfer_data["to_owner"]["team"],
                                email=transfer_data["to_owner"].get("email", "")
                            ),
                            transferred_at=transfer_data.get("transferred_at", datetime.now().isoformat()),
                            reason=transfer_data.get("reason", "")
                        )
                        self.transfers.append(transfer)
                    except Exception:
                        continue
        except FileNotFoundError:
            pass

    def _save_data(self):
        data = {
            "groups": [self._group_to_dict(g) for g in self.groups.values()],
            "transfers": [self._transfer_to_dict(t) for t in self.transfers]
        }
        with open(self.data_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _group_to_dict(self, group: ConsumerGroup) -> Dict:
        return {
            "group_name": group.group_name,
            "queue_name": group.queue_name,
            "processing_range": asdict(group.processing_range),
            "owner": asdict(group.owner),
            "created_at": group.created_at
        }

    def _transfer_to_dict(self, transfer: TransferRecord) -> Dict:
        return {
            "group_name": transfer.group_name,
            "queue_name": transfer.queue_name,
            "from_owner": asdict(transfer.from_owner),
            "to_owner": asdict(transfer.to_owner),
            "transferred_at": transfer.transferred_at,
            "reason": transfer.reason
        }

    def register_consumer(self, group: ConsumerGroup) -> Tuple[bool, List[str], str]:
        valid, errors = group.validate()
        if not valid:
            return False, errors, "VALIDATION_ERROR"

        if group.group_name in self.groups:
            existing = self.groups[group.group_name]
            if (existing.queue_name == group.queue_name
                and existing.processing_range.start_partition == group.processing_range.start_partition
                and existing.processing_range.end_partition == group.processing_range.end_partition
                and existing.owner.name == group.owner.name
                and existing.owner.team == group.owner.team):
                return True, ["重复登记，已存在相同记录"], "IDEMPOTENT_SUCCESS"
            else:
                return False, [f"消费者组已存在: {group.group_name}"], "DUPLICATE_ERROR"

        conflicts = self._find_range_conflicts(group)
        if conflicts:
            conflict_msgs = []
            for c in conflicts:
                conflict_msgs.append(
                    f"与消费者组 {c.group_name} (负责人: {c.owner.name}) "
                    f"范围冲突: {c.processing_range.start_partition}-{c.processing_range.end_partition}"
                )
            return False, conflict_msgs, "RANGE_CONFLICT"

        self.groups[group.group_name] = group
        self._save_data()
        return True, ["登记成功"], "SUCCESS"

    def _find_range_conflicts(self, group: ConsumerGroup) -> List[ConsumerGroup]:
        conflicts = []
        for existing in self.groups.values():
            if existing.group_name == group.group_name:
                continue
            if existing.queue_name != group.queue_name:
                continue
            if existing.processing_range.overlaps_with(group.processing_range):
                conflicts.append(existing)
        return conflicts

    def transfer_owner(self, group_name: str, new_owner: Owner, reason: str = "") -> Tuple[bool, List[str], str]:
        valid, errors = new_owner.validate()
        if not valid:
            return False, errors, "VALIDATION_ERROR"

        if group_name not in self.groups:
            return False, [f"消费者组不存在: {group_name}"], "NOT_FOUND"

        group = self.groups[group_name]
        old_owner = group.owner

        if old_owner.name == new_owner.name and old_owner.team == new_owner.team:
            return True, ["负责人未变更，幂等处理"], "IDEMPOTENT_SUCCESS"

        transfer = TransferRecord(
            group_name=group_name,
            queue_name=group.queue_name,
            from_owner=old_owner,
            to_owner=new_owner,
            reason=reason
        )
        self.transfers.append(transfer)
        group.owner = new_owner
        self._save_data()
        return True, ["负责人转移成功"], "SUCCESS"

    def query_by_queue(self, queue_name: str) -> List[ConsumerGroup]:
        return [g for g in self.groups.values() if g.queue_name == queue_name]

    def query_by_group(self, group_name: str) -> Optional[ConsumerGroup]:
        return self.groups.get(group_name)

    def query_by_owner(self, owner_name: str) -> List[ConsumerGroup]:
        return [g for g in self.groups.values() if g.owner.name == owner_name]

    def get_transfer_history(self, group_name: str) -> List[TransferRecord]:
        return [t for t in self.transfers if t.group_name == group_name]

    def generate_report(self, queue_name: Optional[str] = None) -> Dict:
        groups_to_report = list(self.groups.values())
        if queue_name:
            groups_to_report = [g for g in groups_to_report if g.queue_name == queue_name]

        groups_by_queue: Dict[str, List[Dict]] = {}
        owners_summary: Dict[str, Dict] = {}

        for group in groups_to_report:
            if group.queue_name not in groups_by_queue:
                groups_by_queue[group.queue_name] = []
            groups_by_queue[group.queue_name].append({
                "group_name": group.group_name,
                "processing_range": group.processing_range.to_dict(),
                "owner": asdict(group.owner),
                "created_at": group.created_at
            })

            owner_key = f"{group.owner.name}|{group.owner.team}"
            if owner_key not in owners_summary:
                owners_summary[owner_key] = {
                    "name": group.owner.name,
                    "team": group.owner.team,
                    "email": group.owner.email,
                    "group_count": 0,
                    "queues": set()
                }
            owners_summary[owner_key]["group_count"] += 1
            owners_summary[owner_key]["queues"].add(group.queue_name)

        for key in owners_summary:
            owners_summary[key]["queues"] = list(owners_summary[key]["queues"])

        return {
            "report_generated_at": datetime.now().isoformat(),
            "total_groups": len(groups_to_report),
            "total_queues": len(groups_by_queue),
            "total_owners": len(owners_summary),
            "groups_by_queue": groups_by_queue,
            "owners_summary": list(owners_summary.values()),
            "recent_transfers": [self._transfer_to_dict(t) for t in self.transfers[-10:]]
        }


class CLIRunner:
    def __init__(self):
        self.registry = ConsumerRegistry()

    def print_human_report(self, report: Dict):
        print("\n" + "=" * 80)
        print("消费者组归属报告".center(80))
        print("=" * 80)
        print(f"生成时间: {report['report_generated_at']}")
        print(f"消费者组总数: {report['total_groups']}")
        print(f"队列总数: {report['total_queues']}")
        print(f"负责人总数: {report['total_owners']}")
        print("\n" + "-" * 80)

        print("\n【按队列分组】")
        for queue_name, groups in report["groups_by_queue"].items():
            print(f"\n  队列: {queue_name}")
            for g in groups:
                r = g["processing_range"]
                o = g["owner"]
                print(f"    - {g['group_name']}")
                print(f"      范围: {r['range_str']}  消息类型: {r.get('message_type', 'N/A')}")
                print(f"      负责人: {o['name']} ({o['team']}) <{o.get('email', 'N/A')}>")

        print("\n" + "-" * 80)
        print("\n【负责人概览】")
        for owner in report["owners_summary"]:
            print(f"  - {owner['name']} ({owner['team']})")
            print(f"    消费组数量: {owner['group_count']}  负责队列: {', '.join(owner['queues'])}")

        if report["recent_transfers"]:
            print("\n" + "-" * 80)
            print("\n【最近交接记录】")
            for t in report["recent_transfers"]:
                print(f"  - {t['group_name']} @ {t['queue_name']}")
                print(f"    {t['from_owner']['name']} -> {t['to_owner']['name']}")
                print(f"    时间: {t['transferred_at']}  原因: {t.get('reason', 'N/A')}")

        print("\n" + "=" * 80)

    def run(self):
        parser = argparse.ArgumentParser(
            description="消费者组归属交接记录排查CLI",
            formatter_class=argparse.RawDescriptionHelpFormatter,
            epilog="""
示例:
  consumer_cli.py register --group group1 --queue order --start 0 --end 9 --owner 张三 --team 订单组
  consumer_cli.py report --queue order
  consumer_cli.py transfer --group group1 --owner 李四 --team 支付组 --reason 业务交接
  consumer_cli.py query --queue order
  consumer_cli.py history --group group1
            """
        )
        subparsers = parser.add_subparsers(dest="command", required=True)

        register_parser = subparsers.add_parser("register", help="登记消费者组")
        register_parser.add_argument("--group", required=True, help="消费者组名称")
        register_parser.add_argument("--queue", required=True, help="队列名称")
        register_parser.add_argument("--start", type=int, required=True, help="起始分区")
        register_parser.add_argument("--end", type=int, required=True, help="结束分区")
        register_parser.add_argument("--msg-type", default="", help="消息类型")
        register_parser.add_argument("--owner", required=True, help="负责人姓名")
        register_parser.add_argument("--team", required=True, help="所属团队")
        register_parser.add_argument("--email", default="", help="联系邮箱")
        register_parser.add_argument("--json", action="store_true", help="输出JSON格式")

        transfer_parser = subparsers.add_parser("transfer", help="转移负责人")
        transfer_parser.add_argument("--group", required=True, help="消费者组名称")
        transfer_parser.add_argument("--owner", required=True, help="新负责人姓名")
        transfer_parser.add_argument("--team", required=True, help="新团队")
        transfer_parser.add_argument("--email", default="", help="新邮箱")
        transfer_parser.add_argument("--reason", default="", help="交接原因")
        transfer_parser.add_argument("--json", action="store_true", help="输出JSON格式")

        query_parser = subparsers.add_parser("query", help="查询消费者组")
        query_parser.add_argument("--queue", help="按队列查询")
        query_parser.add_argument("--group", help="按组名查询")
        query_parser.add_argument("--owner", help="按负责人查询")
        query_parser.add_argument("--json", action="store_true", help="输出JSON格式")

        history_parser = subparsers.add_parser("history", help="查看交接历史")
        history_parser.add_argument("--group", required=True, help="消费者组名称")
        history_parser.add_argument("--json", action="store_true", help="输出JSON格式")

        report_parser = subparsers.add_parser("report", help="生成归属报告")
        report_parser.add_argument("--queue", help="指定队列（可选）")
        report_parser.add_argument("--json", action="store_true", help="仅输出JSON格式")
        report_parser.add_argument("--output", help="保存JSON到文件")

        args = parser.parse_args()

        if args.command == "register":
            group = ConsumerGroup(
                group_name=args.group,
                queue_name=args.queue,
                processing_range=ProcessingRange(
                    start_partition=args.start,
                    end_partition=args.end,
                    message_type=args.msg_type
                ),
                owner=Owner(
                    name=args.owner,
                    team=args.team,
                    email=args.email
                )
            )
            success, messages, code = self.registry.register_consumer(group)
            result = {
                "success": success,
                "code": code,
                "messages": messages,
                "group": args.group,
                "queue": args.queue
            }
            if args.json:
                print(json.dumps(result, ensure_ascii=False, indent=2))
            else:
                print(f"{'成功' if success else '失败'}: {', '.join(messages)}")

        elif args.command == "transfer":
            new_owner = Owner(
                name=args.owner,
                team=args.team,
                email=args.email
            )
            success, messages, code = self.registry.transfer_owner(
                args.group, new_owner, args.reason
            )
            result = {
                "success": success,
                "code": code,
                "messages": messages,
                "group": args.group
            }
            if args.json:
                print(json.dumps(result, ensure_ascii=False, indent=2))
            else:
                print(f"{'成功' if success else '失败'}: {', '.join(messages)}")

        elif args.command == "query":
            groups = []
            if args.group:
                group = self.registry.query_by_group(args.group)
                if group:
                    groups = [group]
            elif args.queue:
                groups = self.registry.query_by_queue(args.queue)
            elif args.owner:
                groups = self.registry.query_by_owner(args.owner)

            result = {
                "count": len(groups),
                "groups": [self.registry._group_to_dict(g) for g in groups]
            }
            if args.json:
                print(json.dumps(result, ensure_ascii=False, indent=2))
            else:
                if groups:
                    for g in groups:
                        print(f"\n{g.group_name} @ {g.queue_name}")
                        print(f"  范围: {g.processing_range.start_partition}-{g.processing_range.end_partition}")
                        print(f"  负责人: {g.owner.name} ({g.owner.team})")
                else:
                    print("无匹配的消费者组")

        elif args.command == "history":
            transfers = self.registry.get_transfer_history(args.group)
            result = {
                "group": args.group,
                "count": len(transfers),
                "transfers": [self.registry._transfer_to_dict(t) for t in transfers]
            }
            if args.json:
                print(json.dumps(result, ensure_ascii=False, indent=2))
            else:
                if transfers:
                    print(f"\n{args.group} 的交接历史:")
                    for i, t in enumerate(transfers, 1):
                        print(f"\n  {i}. {t.transferred_at}")
                        print(f"     {t.from_owner.name} -> {t.to_owner.name}")
                else:
                    print("无交接记录")

        elif args.command == "report":
            report = self.registry.generate_report(args.queue)
            if args.output:
                with open(args.output, "w", encoding="utf-8") as f:
                    json.dump(report, f, ensure_ascii=False, indent=2)
                print(f"报告已保存到: {args.output}")
            if args.json:
                print(json.dumps(report, ensure_ascii=False, indent=2))
            else:
                self.print_human_report(report)


if __name__ == "__main__":
    runner = CLIRunner()
    runner.run()

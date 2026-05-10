#!/usr/bin/env python3
import argparse
import json
import os
import sys
from datetime import datetime
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field, asdict
from enum import Enum


class PackageStatus(Enum):
    IN_STORE = "in_store"
    PICKED_UP = "picked_up"
    MIS_PICKED = "mis_picked"
    RECOVERED = "recovered"
    LOST = "lost"
    COMPENSATED = "compensated"


class EventType(Enum):
    CHECK_IN = "check_in"
    PICKUP = "pickup"
    MIS_PICK_REGISTER = "mis_pick_register"
    RECOVERY_UPDATE = "recovery_update"
    COMPENSATION = "compensation"
    REVISE = "revise"
    CANCEL = "cancel"


@dataclass
class Package:
    tracking_number: str
    pickup_code: str
    recipient_name: str
    phone: str
    check_in_time: str
    status: str = PackageStatus.IN_STORE.value
    pickup_time: Optional[str] = None
    picked_by: Optional[str] = None
    mis_pick_info: Optional[Dict[str, Any]] = None
    recovery_info: Optional[Dict[str, Any]] = None
    compensation_info: Optional[Dict[str, Any]] = None


@dataclass
class Event:
    event_id: str
    event_type: str
    timestamp: str
    tracking_number: str
    details: Dict[str, Any]
    operator: str
    note: Optional[str] = None


@dataclass
class StateRecord:
    tracking_number: str
    version: int
    timestamp: str
    state: Dict[str, Any]
    event_id: str


class PackageTracker:
    def __init__(self, data_dir: str = "./data"):
        self.data_dir = data_dir
        self.packages_file = os.path.join(data_dir, "packages.json")
        self.events_file = os.path.join(data_dir, "events.json")
        self.states_file = os.path.join(data_dir, "states.json")
        self.compensation_rules = {
            "max_amount": 500,
            "base_amount": 50,
            "multiplier": 1.5
        }
        self._init_storage()

    def _init_storage(self):
        os.makedirs(self.data_dir, exist_ok=True)
        for file_path in [self.packages_file, self.events_file, self.states_file]:
            if not os.path.exists(file_path):
                with open(file_path, "w", encoding="utf-8") as f:
                    json.dump({}, f, ensure_ascii=False, indent=2)

    def _load_json(self, file_path: str) -> Dict:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def _save_json(self, file_path: str, data: Dict):
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _generate_id(self) -> str:
        return datetime.now().strftime("%Y%m%d%H%M%S%f")[:-3]

    def _get_now(self) -> str:
        return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    def _create_event(self, event_type: EventType, tracking_number: str, 
                      details: Dict[str, Any], operator: str, note: str = None) -> Event:
        return Event(
            event_id=self._generate_id(),
            event_type=event_type.value,
            timestamp=self._get_now(),
            tracking_number=tracking_number,
            details=details,
            operator=operator,
            note=note
        )

    def _save_state(self, package: Package, event_id: str):
        states = self._load_json(self.states_file)
        tracking = package.tracking_number
        
        if tracking not in states:
            states[tracking] = []
        
        version = len(states[tracking]) + 1
        state_record = StateRecord(
            tracking_number=tracking,
            version=version,
            timestamp=self._get_now(),
            state=asdict(package),
            event_id=event_id
        )
        states[tracking].append(asdict(state_record))
        self._save_json(self.states_file, states)

    def _save_event(self, event: Event):
        events = self._load_json(self.events_file)
        events[event.event_id] = asdict(event)
        self._save_json(self.events_file, events)

    def _save_package(self, package: Package):
        packages = self._load_json(self.packages_file)
        packages[package.tracking_number] = asdict(package)
        self._save_json(self.packages_file, packages)

    def _get_package(self, tracking_number: str) -> Optional[Package]:
        packages = self._load_json(self.packages_file)
        if tracking_number in packages:
            return Package(**packages[tracking_number])
        return None

    def _find_package_by_code(self, pickup_code: str) -> Optional[Package]:
        packages = self._load_json(self.packages_file)
        for pkg_data in packages.values():
            if pkg_data.get("pickup_code") == pickup_code:
                return Package(**pkg_data)
        return None

    def check_in(self, tracking_number: str, pickup_code: str, recipient_name: str,
                 phone: str, operator: str, note: str = None) -> Dict[str, Any]:
        existing = self._get_package(tracking_number)
        if existing:
            return {"success": False, "error": f"包裹 {tracking_number} 已存在"}
        
        package = Package(
            tracking_number=tracking_number,
            pickup_code=pickup_code,
            recipient_name=recipient_name,
            phone=phone,
            check_in_time=self._get_now()
        )
        
        event = self._create_event(
            EventType.CHECK_IN, tracking_number,
            {
                "pickup_code": pickup_code,
                "recipient_name": recipient_name,
                "phone": phone
            },
            operator, note
        )
        
        self._save_package(package)
        self._save_event(event)
        self._save_state(package, event.event_id)
        
        return {
            "success": True,
            "event_id": event.event_id,
            "message": f"包裹 {tracking_number} 入库成功，取件码：{pickup_code}"
        }

    def pickup(self, pickup_code: str, operator: str, picked_by: str = None,
               note: str = None) -> Dict[str, Any]:
        package = self._find_package_by_code(pickup_code)
        
        if not package:
            return {"success": False, "error": f"取件码 {pickup_code} 对应的包裹不存在（未入库）"}
        
        if package.status in [PackageStatus.PICKED_UP.value, PackageStatus.MIS_PICKED.value]:
            return {"success": False, "error": f"取件码 {pickup_code} 已被核销，禁止重复核销"}
        
        if package.status not in [PackageStatus.IN_STORE.value, PackageStatus.RECOVERED.value]:
            return {"success": False, "error": f"包裹状态不允许取件：{package.status}"}
        
        package.status = PackageStatus.PICKED_UP.value
        package.pickup_time = self._get_now()
        package.picked_by = picked_by or "顾客"
        
        event = self._create_event(
            EventType.PICKUP, package.tracking_number,
            {
                "pickup_code": pickup_code,
                "picked_by": package.picked_by,
                "previous_status": PackageStatus.IN_STORE.value
            },
            operator, note
        )
        
        self._save_package(package)
        self._save_event(event)
        self._save_state(package, event.event_id)
        
        return {
            "success": True,
            "event_id": event.event_id,
            "tracking_number": package.tracking_number,
            "message": f"包裹 {package.tracking_number} 取件成功"
        }

    def register_mis_pick(self, tracking_number: str, operator: str, 
                          reported_by: str, description: str, 
                          mis_picked_by: str = None, note: str = None) -> Dict[str, Any]:
        package = self._get_package(tracking_number)
        
        if not package:
            return {"success": False, "error": f"包裹 {tracking_number} 不存在"}
        
        if package.status != PackageStatus.PICKED_UP.value:
            return {"success": False, "error": f"包裹状态不是已取件，无法登记错拿"}
        
        package.status = PackageStatus.MIS_PICKED.value
        package.mis_pick_info = {
            "reported_by": reported_by,
            "mis_picked_by": mis_picked_by,
            "description": description,
            "register_time": self._get_now()
        }
        
        event = self._create_event(
            EventType.MIS_PICK_REGISTER, tracking_number,
            {
                "reported_by": reported_by,
                "mis_picked_by": mis_picked_by,
                "description": description,
                "previous_status": PackageStatus.PICKED_UP.value
            },
            operator, note
        )
        
        self._save_package(package)
        self._save_event(event)
        self._save_state(package, event.event_id)
        
        return {
            "success": True,
            "event_id": event.event_id,
            "message": f"包裹 {tracking_number} 错拿登记成功"
        }

    def update_recovery(self, tracking_number: str, operator: str, 
                        recovered: bool, recovered_by: str = None,
                        recovery_method: str = None, description: str = None,
                        note: str = None) -> Dict[str, Any]:
        package = self._get_package(tracking_number)
        
        if not package:
            return {"success": False, "error": f"包裹 {tracking_number} 不存在"}
        
        if package.status != PackageStatus.MIS_PICKED.value:
            return {"success": False, "error": f"包裹状态不是错拿，无法更新找回状态"}
        
        if recovered:
            package.status = PackageStatus.RECOVERED.value
        else:
            package.status = PackageStatus.LOST.value
        
        package.recovery_info = {
            "recovered": recovered,
            "recovered_by": recovered_by,
            "recovery_method": recovery_method,
            "description": description,
            "update_time": self._get_now()
        }
        
        event = self._create_event(
            EventType.RECOVERY_UPDATE, tracking_number,
            {
                "recovered": recovered,
                "recovered_by": recovered_by,
                "recovery_method": recovery_method,
                "description": description,
                "previous_status": PackageStatus.MIS_PICKED.value,
                "new_status": package.status
            },
            operator, note
        )
        
        self._save_package(package)
        self._save_event(event)
        self._save_state(package, event.event_id)
        
        if recovered:
            message = f"包裹 {tracking_number} 已找回"
        else:
            message = f"包裹 {tracking_number} 确认丢失"
        
        return {
            "success": True,
            "event_id": event.event_id,
            "message": message
        }

    def calculate_compensation(self, tracking_number: str) -> Dict[str, Any]:
        package = self._get_package(tracking_number)
        
        if not package:
            return {"success": False, "error": f"包裹 {tracking_number} 不存在"}
        
        if package.status == PackageStatus.RECOVERED.value:
            return {"success": False, "error": "包裹已找回，无需赔付"}
        
        if package.status != PackageStatus.LOST.value:
            return {"success": False, "error": f"包裹状态不是丢失，无法计算补偿"}
        
        base_amount = self.compensation_rules["base_amount"]
        max_amount = self.compensation_rules["max_amount"]
        
        estimated_amount = min(base_amount * self.compensation_rules["multiplier"], max_amount)
        
        return {
            "success": True,
            "tracking_number": tracking_number,
            "base_amount": base_amount,
            "max_allowed": max_amount,
            "recommended_amount": estimated_amount,
            "message": f"建议补偿金额：{estimated_amount} 元（最高不超过 {max_amount} 元）"
        }

    def process_compensation(self, tracking_number: str, operator: str, 
                             amount: float, compensated_to: str,
                             payment_method: str = "现金", note: str = None) -> Dict[str, Any]:
        package = self._get_package(tracking_number)
        
        if not package:
            return {"success": False, "error": f"包裹 {tracking_number} 不存在"}
        
        if package.status == PackageStatus.RECOVERED.value:
            return {"success": False, "error": "包裹已找回，禁止赔付"}
        
        if package.status != PackageStatus.LOST.value:
            return {"success": False, "error": f"包裹状态不是丢失，无法进行补偿"}
        
        if amount > self.compensation_rules["max_amount"]:
            return {
                "success": False, 
                "error": f"补偿金额 {amount} 元超过规则上限 {self.compensation_rules['max_amount']} 元"
            }
        
        package.status = PackageStatus.COMPENSATED.value
        package.compensation_info = {
            "amount": amount,
            "compensated_to": compensated_to,
            "payment_method": payment_method,
            "compensation_time": self._get_now()
        }
        
        event = self._create_event(
            EventType.COMPENSATION, tracking_number,
            {
                "amount": amount,
                "compensated_to": compensated_to,
                "payment_method": payment_method,
                "previous_status": PackageStatus.LOST.value
            },
            operator, note
        )
        
        self._save_package(package)
        self._save_event(event)
        self._save_state(package, event.event_id)
        
        return {
            "success": True,
            "event_id": event.event_id,
            "message": f"包裹 {tracking_number} 补偿处理完成，金额：{amount} 元"
        }

    def get_package_history(self, tracking_number: str) -> Dict[str, Any]:
        package = self._get_package(tracking_number)
        if not package:
            return {"success": False, "error": f"包裹 {tracking_number} 不存在"}
        
        states = self._load_json(self.states_file)
        events = self._load_json(self.events_file)
        
        package_states = states.get(tracking_number, [])
        package_events = []
        
        for state in package_states:
            event_id = state.get("event_id")
            if event_id in events:
                package_events.append(events[event_id])
        
        return {
            "success": True,
            "tracking_number": tracking_number,
            "current_state": asdict(package),
            "state_history": package_states,
            "event_history": package_events,
            "total_versions": len(package_states)
        }

    def export_report(self, output_format: str = "text", 
                      include_closed: bool = True) -> Dict[str, Any]:
        packages = self._load_json(self.packages_file)
        events = self._load_json(self.events_file)
        states = self._load_json(self.states_file)
        
        packages_list = []
        for pkg_data in packages.values():
            pkg = Package(**pkg_data)
            
            is_open = pkg.status in [
                PackageStatus.MIS_PICKED.value, 
                PackageStatus.LOST.value
            ]
            
            if not include_closed and not is_open:
                continue
            
            pkg_history = states.get(pkg.tracking_number, [])
            pkg_events = [e for e in events.values() 
                         if e.get("tracking_number") == pkg.tracking_number]
            
            packages_list.append({
                "package": asdict(pkg),
                "status_display": self._get_status_display(pkg.status),
                "is_open": is_open,
                "state_count": len(pkg_history),
                "event_count": len(pkg_events),
                "events": pkg_events
            })
        
        open_cases = [p for p in packages_list if p["is_open"]]
        closed_cases = [p for p in packages_list if not p["is_open"]]
        
        report = {
            "generated_at": self._get_now(),
            "summary": {
                "total_packages": len(packages_list),
                "open_cases": len(open_cases),
                "closed_cases": len(closed_cases),
                "total_events": len(events)
            },
            "open_cases": open_cases,
            "closed_cases": closed_cases,
            "all_packages": packages_list
        }
        
        return report

    def _get_status_display(self, status: str) -> str:
        display_map = {
            PackageStatus.IN_STORE.value: "在库待取",
            PackageStatus.PICKED_UP.value: "已取件",
            PackageStatus.MIS_PICKED.value: "错拿待处理",
            PackageStatus.RECOVERED.value: "已找回",
            PackageStatus.LOST.value: "确认丢失",
            PackageStatus.COMPENSATED.value: "已补偿"
        }
        return display_map.get(status, status)


def format_report_text(report: Dict[str, Any]) -> str:
    lines = []
    lines.append("=" * 80)
    lines.append("快递驿站错拿追踪报告")
    lines.append("=" * 80)
    lines.append(f"生成时间：{report['generated_at']}")
    lines.append("-" * 80)
    
    summary = report["summary"]
    lines.append(f"总包裹数：{summary['total_packages']}")
    lines.append(f"未结事件：{summary['open_cases']}")
    lines.append(f"已结事件：{summary['closed_cases']}")
    lines.append(f"总事件数：{summary['total_events']}")
    lines.append("-" * 80)
    
    if report["open_cases"]:
        lines.append("\n【未结事件】")
        lines.append("-" * 80)
        for case in report["open_cases"]:
            pkg = case["package"]
            lines.append(f"\n包裹：{pkg['tracking_number']}")
            lines.append(f"  取件码：{pkg['pickup_code']}")
            lines.append(f"  收件人：{pkg['recipient_name']} ({pkg['phone']})")
            lines.append(f"  当前状态：{case['status_display']}")
            lines.append(f"  入库时间：{pkg['check_in_time']}")
            
            if pkg.get("mis_pick_info"):
                mi = pkg["mis_pick_info"]
                lines.append(f"  错拿信息：")
                lines.append(f"    - 登记人：{mi.get('reported_by', 'N/A')}")
                lines.append(f"    - 描述：{mi.get('description', 'N/A')}")
                lines.append(f"    - 登记时间：{mi.get('register_time', 'N/A')}")
            
            lines.append(f"  状态版本数：{case['state_count']}")
    
    if report["closed_cases"]:
        lines.append("\n【已结事件】")
        lines.append("-" * 80)
        for case in report["closed_cases"]:
            pkg = case["package"]
            lines.append(f"\n包裹：{pkg['tracking_number']}")
            lines.append(f"  取件码：{pkg['pickup_code']}")
            lines.append(f"  收件人：{pkg['recipient_name']} ({pkg['phone']})")
            lines.append(f"  当前状态：{case['status_display']}")
            lines.append(f"  入库时间：{pkg['check_in_time']}")
            
            if pkg.get("recovery_info"):
                ri = pkg["recovery_info"]
                lines.append(f"  找回信息：")
                lines.append(f"    - 已找回：{'是' if ri.get('recovered') else '否'}")
                lines.append(f"    - 更新时间：{ri.get('update_time', 'N/A')}")
            
            if pkg.get("compensation_info"):
                ci = pkg["compensation_info"]
                lines.append(f"  补偿信息：")
                lines.append(f"    - 金额：{ci.get('amount', 'N/A')} 元")
                lines.append(f"    - 赔付对象：{ci.get('compensated_to', 'N/A')}")
                lines.append(f"    - 赔付时间：{ci.get('compensation_time', 'N/A')}")
            
            lines.append(f"  事件链：")
            for evt in case["events"]:
                lines.append(f"    [{evt['timestamp']}] {evt['event_type']} - {evt['operator']}")
    
    lines.append("\n" + "=" * 80)
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(
        description="快递驿站错拿追踪 CLI 工具",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    check_in_parser = subparsers.add_parser("check-in", help="导入包裹入库")
    check_in_parser.add_argument("--tracking", required=True, help="快递单号")
    check_in_parser.add_argument("--code", required=True, help="取件码")
    check_in_parser.add_argument("--name", required=True, help="收件人姓名")
    check_in_parser.add_argument("--phone", required=True, help="联系电话")
    check_in_parser.add_argument("--operator", required=True, help="操作人")
    check_in_parser.add_argument("--note", help="备注")

    pickup_parser = subparsers.add_parser("pickup", help="取件码核销")
    pickup_parser.add_argument("--code", required=True, help="取件码")
    pickup_parser.add_argument("--operator", required=True, help="操作人")
    pickup_parser.add_argument("--picked-by", help="取件人（默认：顾客）")
    pickup_parser.add_argument("--note", help="备注")

    mispick_parser = subparsers.add_parser("register-mispick", help="登记错拿")
    mispick_parser.add_argument("--tracking", required=True, help="快递单号")
    mispick_parser.add_argument("--operator", required=True, help="操作人")
    mispick_parser.add_argument("--reported-by", required=True, help="报告人")
    mispick_parser.add_argument("--description", required=True, help="错拿描述")
    mispick_parser.add_argument("--mis-picked-by", help="错拿人")
    mispick_parser.add_argument("--note", help="备注")

    recovery_parser = subparsers.add_parser("update-recovery", help="更新找回结果")
    recovery_parser.add_argument("--tracking", required=True, help="快递单号")
    recovery_parser.add_argument("--operator", required=True, help="操作人")
    recovery_parser.add_argument("--recovered", required=True, choices=["yes", "no"], 
                                help="是否找回")
    recovery_parser.add_argument("--recovered-by", help="找回人")
    recovery_parser.add_argument("--method", help="找回方式")
    recovery_parser.add_argument("--description", help="找回/丢失描述")
    recovery_parser.add_argument("--note", help="备注")

    calc_parser = subparsers.add_parser("calc-compensation", help="计算补偿金额")
    calc_parser.add_argument("--tracking", required=True, help="快递单号")

    comp_parser = subparsers.add_parser("compensate", help="处理补偿")
    comp_parser.add_argument("--tracking", required=True, help="快递单号")
    comp_parser.add_argument("--operator", required=True, help="操作人")
    comp_parser.add_argument("--amount", required=True, type=float, help="补偿金额")
    comp_parser.add_argument("--compensated-to", required=True, help="赔付对象")
    comp_parser.add_argument("--payment", default="现金", help="支付方式（默认：现金）")
    comp_parser.add_argument("--note", help="备注")

    history_parser = subparsers.add_parser("history", help="查询包裹历史")
    history_parser.add_argument("--tracking", required=True, help="快递单号")

    report_parser = subparsers.add_parser("report", help="导出追踪报告")
    report_parser.add_argument("--format", choices=["text", "json"], default="text",
                              help="输出格式")
    report_parser.add_argument("--open-only", action="store_true",
                              help="只显示未结事件")
    report_parser.add_argument("--output", help="输出到文件")

    args = parser.parse_args()
    tracker = PackageTracker()

    if args.command == "check-in":
        result = tracker.check_in(
            args.tracking, args.code, args.name, args.phone,
            args.operator, args.note
        )
    elif args.command == "pickup":
        result = tracker.pickup(
            args.code, args.operator, args.picked_by, args.note
        )
    elif args.command == "register-mispick":
        result = tracker.register_mis_pick(
            args.tracking, args.operator, args.reported_by,
            args.description, args.mis_picked_by, args.note
        )
    elif args.command == "update-recovery":
        result = tracker.update_recovery(
            args.tracking, args.operator,
            args.recovered == "yes", args.recovered_by,
            args.method, args.description, args.note
        )
    elif args.command == "calc-compensation":
        result = tracker.calculate_compensation(args.tracking)
    elif args.command == "compensate":
        result = tracker.process_compensation(
            args.tracking, args.operator, args.amount,
            args.compensated_to, args.payment, args.note
        )
    elif args.command == "history":
        result = tracker.get_package_history(args.tracking)
    elif args.command == "report":
        report = tracker.export_report(
            include_closed=not args.open_only
        )
        if args.format == "json":
            output = json.dumps(report, ensure_ascii=False, indent=2)
        else:
            output = format_report_text(report)
        
        if args.output:
            with open(args.output, "w", encoding="utf-8") as f:
                f.write(output)
            print(f"报告已保存到：{args.output}")
        else:
            print(output)
        return
    else:
        parser.print_help()
        return

    if result.get("success"):
        print(f"✓ {result.get('message', '操作成功')}")
        if "event_id" in result:
            print(f"  事件ID：{result['event_id']}")
        if "tracking_number" in result and args.command == "pickup":
            print(f"  快递单号：{result['tracking_number']}")
        if "recommended_amount" in result:
            print(f"  建议金额：{result['recommended_amount']} 元")
            print(f"  规则上限：{result['max_allowed']} 元")
    else:
        print(f"✗ 操作失败：{result.get('error', '未知错误')}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

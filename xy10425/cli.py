#!/usr/bin/env python3
import click
import json
import os
import sys
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import Optional, List, Dict


@dataclass
class MenuItem:
    id: str
    name: str
    window: str
    category: str
    price: float
    is_special: bool = False


@dataclass
class Reservation:
    id: str
    menu_item_id: str
    menu_item_name: str
    window: str
    weight: float
    container_id: str
    fridge_location: str
    operator: str
    registration_time: datetime
    expected_destruction_time: datetime
    status: str = "registered"
    actual_destruction_time: Optional[datetime] = None
    destruction_operator: Optional[str] = None
    notes: str = ""


@dataclass
class DailyData:
    date: str
    menu_items: List[MenuItem] = field(default_factory=list)
    reservations: List[Reservation] = field(default_factory=list)
    missed_items: List[Dict] = field(default_factory=list)


class Storage:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir
        self._ensure_dir()

    def _ensure_dir(self):
        if not os.path.exists(self.data_dir):
            os.makedirs(self.data_dir)

    def _get_file_path(self, date: str) -> str:
        return os.path.join(self.data_dir, f"{date}.json")

    def load_daily_data(self, date: str) -> DailyData:
        file_path = self._get_file_path(date)
        if not os.path.exists(file_path):
            return DailyData(date=date)

        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        menu_items = [MenuItem(**item) for item in data.get("menu_items", [])]
        reservations = [
            Reservation(
                **{
                    k: (
                        datetime.fromisoformat(v)
                        if k in ["registration_time", "expected_destruction_time", "actual_destruction_time"] and v
                        else v
                    )
                    for k, v in res.items()
                }
            )
            for res in data.get("reservations", [])
        ]

        return DailyData(
            date=date,
            menu_items=menu_items,
            reservations=reservations,
            missed_items=data.get("missed_items", [])
        )

    def save_daily_data(self, daily_data: DailyData) -> None:
        file_path = self._get_file_path(daily_data.date)

        data = {
            "date": daily_data.date,
            "menu_items": [item.__dict__ for item in daily_data.menu_items],
            "reservations": [
                {
                    k: (
                        v.isoformat()
                        if isinstance(v, datetime)
                        else v
                    )
                    for k, v in res.__dict__.items()
                }
                for res in daily_data.reservations
            ],
            "missed_items": daily_data.missed_items
        }

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def import_menu(self, date: str, menu_items: List[Dict]) -> DailyData:
        daily_data = self.load_daily_data(date)
        existing_confirmed = [
            res for res in daily_data.reservations
            if res.status in ["destroyed", "missed"]
        ]

        new_menu_items = []
        for item in menu_items:
            menu_item = MenuItem(
                id=item["id"],
                name=item["name"],
                window=item["window"],
                category=item["category"],
                price=item["price"],
                is_special=item.get("is_special", False)
            )
            new_menu_items.append(menu_item)

        daily_data.menu_items = new_menu_items
        daily_data.reservations = existing_confirmed + [
            res for res in daily_data.reservations
            if res.status not in ["destroyed", "missed"]
        ]

        self.save_daily_data(daily_data)
        return daily_data

    def add_reservation(self, date: str, reservation_data: Dict) -> Reservation:
        daily_data = self.load_daily_data(date)

        reservation = Reservation(
            id=f"RES-{datetime.now().strftime('%Y%m%d%H%M%S%f')}",
            menu_item_id=reservation_data["menu_item_id"],
            menu_item_name=reservation_data["menu_item_name"],
            window=reservation_data["window"],
            weight=reservation_data["weight"],
            container_id=reservation_data["container_id"],
            fridge_location=reservation_data["fridge_location"],
            operator=reservation_data["operator"],
            registration_time=datetime.now(),
            expected_destruction_time=reservation_data["expected_destruction_time"]
        )

        daily_data.reservations.append(reservation)
        self.save_daily_data(daily_data)
        return reservation

    def confirm_destruction(self, date: str, reservation_id: str, operator: str, notes: str = "") -> Optional[Reservation]:
        daily_data = self.load_daily_data(date)

        for res in daily_data.reservations:
            if res.id == reservation_id:
                res.status = "destroyed"
                res.actual_destruction_time = datetime.now()
                res.destruction_operator = operator
                res.notes = notes
                self.save_daily_data(daily_data)
                return res

        return None

    def mark_missed(self, date: str, menu_item_id: str, reason: str, operator: str) -> None:
        daily_data = self.load_daily_data(date)

        daily_data.missed_items.append({
            "menu_item_id": menu_item_id,
            "reason": reason,
            "operator": operator,
            "marked_at": datetime.now().isoformat()
        })

        for res in daily_data.reservations:
            if res.menu_item_id == menu_item_id and res.status == "registered":
                res.status = "missed"
                res.notes = reason

        self.save_daily_data(daily_data)


class Validator:
    MIN_WEIGHT = 100
    DESTRUCTION_GRACE_PERIOD_HOURS = 48

    def validate(self, daily_data: DailyData, current_time: datetime = None) -> List[Dict]:
        if current_time is None:
            current_time = datetime.now()

        issues = []
        issues.extend(self._check_missing_reservations(daily_data))
        issues.extend(self._check_weight_issues(daily_data))
        issues.extend(self._check_duplicate_reservations(daily_data))
        issues.extend(self._check_premature_destruction(daily_data))
        issues.extend(self._check_expired_reservations(daily_data, current_time))

        return issues

    def _check_missing_reservations(self, daily_data: DailyData) -> List[Dict]:
        issues = []
        reserved_item_ids = {
            res.menu_item_id
            for res in daily_data.reservations
            if res.status in ["registered", "destroyed"]
        }

        missed_item_ids = {item["menu_item_id"] for item in daily_data.missed_items}

        for item in daily_data.menu_items:
            if item.id not in reserved_item_ids and item.id not in missed_item_ids:
                issues.append({
                    "type": "missing",
                    "severity": "high",
                    "message": f"菜品未留样: {item.name} (窗口: {item.window})",
                    "menu_item_id": item.id,
                    "menu_item_name": item.name,
                    "window": item.window
                })

        return issues

    def _check_weight_issues(self, daily_data: DailyData) -> List[Dict]:
        issues = []
        for res in daily_data.reservations:
            if res.weight < self.MIN_WEIGHT:
                issues.append({
                    "type": "weight",
                    "severity": "medium",
                    "message": f"留样重量不足: {res.menu_item_name} - {res.weight}g (最低要求: {self.MIN_WEIGHT}g)",
                    "menu_item_id": res.menu_item_id,
                    "menu_item_name": res.menu_item_name,
                    "reservation_id": res.id
                })

        return issues

    def _check_duplicate_reservations(self, daily_data: DailyData) -> List[Dict]:
        issues = []
        item_reservations = {}

        for res in daily_data.reservations:
            if res.status in ["registered", "destroyed"]:
                if res.menu_item_id not in item_reservations:
                    item_reservations[res.menu_item_id] = []
                item_reservations[res.menu_item_id].append(res)

        for item_id, reservations in item_reservations.items():
            if len(reservations) > 1:
                item = next(
                    (item for item in daily_data.menu_items if item.id == item_id),
                    None
                )
                item_name = item.name if item else item_id
                issues.append({
                    "type": "duplicate",
                    "severity": "high",
                    "message": f"同一菜品重复登记: {item_name} - 已登记 {len(reservations)} 次",
                    "menu_item_id": item_id,
                    "menu_item_name": item_name,
                    "count": len(reservations)
                })

        return issues

    def _check_premature_destruction(self, daily_data: DailyData) -> List[Dict]:
        issues = []
        for res in daily_data.reservations:
            if (
                res.status == "destroyed"
                and res.actual_destruction_time
                and res.actual_destruction_time < res.expected_destruction_time
            ):
                issues.append({
                    "type": "premature",
                    "severity": "high",
                    "message": f"销毁过早: {res.menu_item_name} - 预计销毁时间: {res.expected_destruction_time.strftime('%Y-%m-%d %H:%M')}, 实际销毁时间: {res.actual_destruction_time.strftime('%Y-%m-%d %H:%M')}",
                    "menu_item_id": res.menu_item_id,
                    "menu_item_name": res.menu_item_name,
                    "reservation_id": res.id
                })

        return issues

    def _check_expired_reservations(self, daily_data: DailyData, current_time: datetime) -> List[Dict]:
        issues = []
        for res in daily_data.reservations:
            if (
                res.status == "registered"
                and current_time > res.expected_destruction_time
            ):
                issues.append({
                    "type": "expired",
                    "severity": "medium",
                    "message": f"留样已过期未销毁: {res.menu_item_name} - 预计销毁时间: {res.expected_destruction_time.strftime('%Y-%m-%d %H:%M')}",
                    "menu_item_id": res.menu_item_id,
                    "menu_item_name": res.menu_item_name,
                    "reservation_id": res.id
                })

        return issues

    def get_destruction_reminders(self, daily_data: DailyData, hours_before: int = 2) -> List[Reservation]:
        current_time = datetime.now()
        reminders = []

        for res in daily_data.reservations:
            if res.status == "registered":
                time_diff = res.expected_destruction_time - current_time
                if 0 < time_diff.total_seconds() < hours_before * 3600:
                    reminders.append(res)

        return reminders

    def get_responsible_persons(self, daily_data: DailyData) -> dict:
        statistics = {
            "operators": {},
            "windows": {}
        }

        for item in daily_data.missed_items:
            operator = item.get("operator", "未知")
            if operator not in statistics["operators"]:
                statistics["operators"][operator] = 0
            statistics["operators"][operator] += 1

            menu_item = next(
                (mi for mi in daily_data.menu_items if mi.id == item["menu_item_id"]),
                None
            )
            if menu_item:
                window = menu_item.window
                if window not in statistics["windows"]:
                    statistics["windows"][window] = 0
                statistics["windows"][window] += 1

        for res in daily_data.reservations:
            if res.status in ["registered", "destroyed"]:
                operator = res.operator
                if operator not in statistics["operators"]:
                    statistics["operators"][operator] = 0

        return statistics


class Reporter:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir

    def generate_compliance_report(self, daily_data: DailyData) -> Dict:
        validator = Validator()
        issues = validator.validate(daily_data)

        total_menu_items = len(daily_data.menu_items)
        registered_reservations = [
            res for res in daily_data.reservations
            if res.status in ["registered", "destroyed"]
        ]
        destroyed_reservations = [
            res for res in daily_data.reservations
            if res.status == "destroyed"
        ]
        missed_items = daily_data.missed_items

        high_issues = [i for i in issues if i["severity"] == "high"]
        medium_issues = [i for i in issues if i["severity"] == "medium"]

        compliance_rate = 0.0
        if total_menu_items > 0:
            compliant_items = len(registered_reservations) - len(missed_items) - len(high_issues)
            compliance_rate = (compliant_items / total_menu_items) * 100

        return {
            "date": daily_data.date,
            "total_menu_items": total_menu_items,
            "registered_reservations": len(registered_reservations),
            "destroyed_reservations": len(destroyed_reservations),
            "missed_items": len(missed_items),
            "high_issues": len(high_issues),
            "medium_issues": len(medium_issues),
            "compliance_rate": round(compliance_rate, 2),
            "issues": issues
        }

    def get_destruction_reminders(self, daily_data: DailyData, hours_before: int = 2) -> List[Dict]:
        validator = Validator()
        reminders = validator.get_destruction_reminders(daily_data, hours_before)

        return [
            {
                "id": res.id,
                "menu_item_name": res.menu_item_name,
                "window": res.window,
                "fridge_location": res.fridge_location,
                "container_id": res.container_id,
                "expected_destruction_time": res.expected_destruction_time.strftime('%Y-%m-%d %H:%M:%S'),
                "operator": res.operator
            }
            for res in reminders
        ]

    def get_responsible_statistics(self, daily_data: DailyData) -> Dict:
        validator = Validator()
        stats = validator.get_responsible_persons(daily_data)

        return {
            "date": daily_data.date,
            "operators": stats["operators"],
            "windows": stats["windows"]
        }

    def export_csv_report(self, daily_data: DailyData, file_path: str) -> bool:
        try:
            import csv

            compliance_report = self.generate_compliance_report(daily_data)
            statistics = self.get_responsible_statistics(daily_data)
            reminders = self.get_destruction_reminders(daily_data)

            with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
                writer = csv.writer(f)

                writer.writerow(['食堂菜品留样检查报告', daily_data.date])
                writer.writerow([])

                writer.writerow(['一、今日合规情况'])
                writer.writerow(['菜品总数', compliance_report['total_menu_items']])
                writer.writerow(['已留样', compliance_report['registered_reservations']])
                writer.writerow(['已销毁', compliance_report['destroyed_reservations']])
                writer.writerow(['漏留', compliance_report['missed_items']])
                writer.writerow(['严重问题', compliance_report['high_issues']])
                writer.writerow(['一般问题', compliance_report['medium_issues']])
                writer.writerow(['合规率', f"{compliance_report['compliance_rate']}%"])
                writer.writerow([])

                writer.writerow(['二、问题列表'])
                if compliance_report['issues']:
                    writer.writerow(['问题类型', '严重程度', '问题描述'])
                    for issue in compliance_report['issues']:
                        writer.writerow([
                            issue['type'],
                            issue['severity'],
                            issue['message']
                        ])
                else:
                    writer.writerow(['无问题'])
                writer.writerow([])

                writer.writerow(['三、待销毁提醒'])
                if reminders:
                    writer.writerow(['留样ID', '菜品名称', '窗口', '冰箱位置', '容器编号', '预计销毁时间', '操作人'])
                    for reminder in reminders:
                        writer.writerow([
                            reminder['id'],
                            reminder['menu_item_name'],
                            reminder['window'],
                            reminder['fridge_location'],
                            reminder['container_id'],
                            reminder['expected_destruction_time'],
                            reminder['operator']
                        ])
                else:
                    writer.writerow(['无待销毁留样'])
                writer.writerow([])

                writer.writerow(['四、责任人统计 - 操作人'])
                if statistics['operators']:
                    writer.writerow(['操作人', '漏留次数'])
                    for operator, count in statistics['operators'].items():
                        writer.writerow([operator, count])
                else:
                    writer.writerow(['无操作人记录'])
                writer.writerow([])

                writer.writerow(['五、责任人统计 - 窗口'])
                if statistics['windows']:
                    writer.writerow(['窗口', '漏留次数'])
                    for window, count in statistics['windows'].items():
                        writer.writerow([window, count])
                else:
                    writer.writerow(['无窗口漏留记录'])

            return True
        except Exception as e:
            print(f"导出报告失败: {e}")
            return False

    def print_compliance_summary(self, daily_data: DailyData):
        compliance_report = self.generate_compliance_report(daily_data)

        print("\n" + "="*60)
        print(f"【今日合规情况】- {daily_data.date}")
        print("="*60)
        print(f"菜品总数: {compliance_report['total_menu_items']}")
        print(f"已留样: {compliance_report['registered_reservations']}")
        print(f"已销毁: {compliance_report['destroyed_reservations']}")
        print(f"漏留: {compliance_report['missed_items']}")
        print(f"严重问题: {compliance_report['high_issues']}")
        print(f"一般问题: {compliance_report['medium_issues']}")
        print(f"合规率: {compliance_report['compliance_rate']}%")
        print("-"*60)

        if compliance_report['issues']:
            print("\n【问题列表】:")
            for issue in compliance_report['issues']:
                severity_marker = "🔴" if issue['severity'] == "high" else "🟡"
                print(f"  {severity_marker} [{issue['type']}] {issue['message']}")
        else:
            print("\n✅ 所有检查通过！")

    def print_destruction_reminders(self, daily_data: DailyData, hours_before: int = 2):
        reminders = self.get_destruction_reminders(daily_data, hours_before)

        print("\n" + "="*60)
        print(f"【待销毁提醒】- {daily_data.date} (未来{hours_before}小时内)")
        print("="*60)

        if reminders:
            for reminder in reminders:
                print(f"\n留样ID: {reminder['id']}")
                print(f"  菜品: {reminder['menu_item_name']}")
                print(f"  窗口: {reminder['window']}")
                print(f"  冰箱位置: {reminder['fridge_location']}")
                print(f"  容器编号: {reminder['container_id']}")
                print(f"  预计销毁时间: {reminder['expected_destruction_time']}")
                print(f"  操作人: {reminder['operator']}")
        else:
            print("✅ 无待销毁留样")

    def print_responsible_statistics(self, daily_data: DailyData):
        stats = self.get_responsible_statistics(daily_data)

        print("\n" + "="*60)
        print(f"【责任人统计】- {daily_data.date}")
        print("="*60)

        print("\n【操作人统计】:")
        if stats['operators']:
            for operator, count in stats['operators'].items():
                print(f"  {operator}: {count} 次漏留")
        else:
            print("  无操作人记录")

        print("\n【窗口统计】:")
        if stats['windows']:
            for window, count in stats['windows'].items():
                print(f"  {window}: {count} 次漏留")
        else:
            print("  无窗口漏留记录")


def get_today_date() -> str:
    return datetime.now().strftime("%Y-%m-%d")


@click.group()
def cli():
    """食堂菜品留样管理系统 CLI"""
    pass


@cli.command()
@click.option('--date', default=None, help='日期 (格式: YYYY-MM-DD, 默认今天)')
@click.argument('menu_file', type=click.Path(exists=True))
def import_menu(date, menu_file):
    """导入当天菜单"""
    if not date:
        date = get_today_date()

    storage = Storage()

    try:
        with open(menu_file, 'r', encoding='utf-8') as f:
            menu_items = json.load(f)

        daily_data = storage.import_menu(date, menu_items)

        click.echo(f"✅ 成功导入 {len(menu_items)} 道菜到 {date}")
        click.echo(f"\n菜单列表:")
        for i, item in enumerate(daily_data.menu_items, 1):
            click.echo(f"  {i}. {item.name} (ID: {item.id}, 窗口: {item.window})")

    except Exception as e:
        click.echo(f"❌ 导入失败: {e}")


@cli.command()
@click.option('--date', default=None, help='日期 (格式: YYYY-MM-DD, 默认今天)')
@click.option('--menu-item-id', required=True, help='菜品ID')
@click.option('--weight', required=True, type=float, help='留样重量 (克)')
@click.option('--container-id', required=True, help='容器编号')
@click.option('--fridge-location', required=True, help='冰箱位置')
@click.option('--operator', required=True, help='操作人')
@click.option('--destruction-hours', default=48, help='预计保留时间 (小时, 默认48)')
def register(date, menu_item_id, weight, container_id, fridge_location, operator, destruction_hours):
    """登记留样信息"""
    if not date:
        date = get_today_date()

    storage = Storage()
    daily_data = storage.load_daily_data(date)

    menu_item = None
    for item in daily_data.menu_items:
        if item.id == menu_item_id:
            menu_item = item
            break

    if not menu_item:
        click.echo(f"❌ 找不到菜品ID: {menu_item_id}")
        return

    existing_reservations = [
        res for res in daily_data.reservations
        if res.menu_item_id == menu_item_id and res.status in ["registered", "destroyed"]
    ]
    if existing_reservations:
        click.echo(f"⚠️ 警告: 该菜品已登记留样，继续登记将创建重复记录")
        if not click.confirm("是否继续?"):
            return

    expected_destruction_time = datetime.now() + timedelta(hours=destruction_hours)

    reservation_data = {
        "menu_item_id": menu_item.id,
        "menu_item_name": menu_item.name,
        "window": menu_item.window,
        "weight": weight,
        "container_id": container_id,
        "fridge_location": fridge_location,
        "operator": operator,
        "expected_destruction_time": expected_destruction_time
    }

    reservation = storage.add_reservation(date, reservation_data)

    click.echo(f"✅ 留样登记成功!")
    click.echo(f"\n留样信息:")
    click.echo(f"  ID: {reservation.id}")
    click.echo(f"  菜品: {reservation.menu_item_name}")
    click.echo(f"  窗口: {reservation.window}")
    click.echo(f"  重量: {reservation.weight}g")
    click.echo(f"  容器编号: {reservation.container_id}")
    click.echo(f"  冰箱位置: {reservation.fridge_location}")
    click.echo(f"  操作人: {reservation.operator}")
    click.echo(f"  预计销毁时间: {reservation.expected_destruction_time.strftime('%Y-%m-%d %H:%M:%S')}")


@cli.command()
@click.option('--date', default=None, help='日期 (格式: YYYY-MM-DD, 默认今天)')
@click.option('--reservation-id', required=True, help='留样ID')
@click.option('--operator', required=True, help='操作人')
@click.option('--notes', default='', help='备注')
def destroy(date, reservation_id, operator, notes):
    """确认销毁留样"""
    if not date:
        date = get_today_date()

    storage = Storage()
    reservation = storage.confirm_destruction(date, reservation_id, operator, notes)

    if reservation:
        click.echo(f"✅ 销毁确认成功!")
        click.echo(f"\n销毁信息:")
        click.echo(f"  留样ID: {reservation.id}")
        click.echo(f"  菜品: {reservation.menu_item_name}")
        click.echo(f"  实际销毁时间: {reservation.actual_destruction_time.strftime('%Y-%m-%d %H:%M:%S')}")
        click.echo(f"  操作人: {reservation.destruction_operator}")
        if notes:
            click.echo(f"  备注: {reservation.notes}")
    else:
        click.echo(f"❌ 找不到留样ID: {reservation_id}")


@cli.command()
@click.option('--date', default=None, help='日期 (格式: YYYY-MM-DD, 默认今天)')
@click.option('--menu-item-id', required=True, help='菜品ID')
@click.option('--reason', required=True, help='漏留原因')
@click.option('--operator', required=True, help='标记人')
def mark_missed(date, menu_item_id, reason, operator):
    """标记漏留菜品"""
    if not date:
        date = get_today_date()

    storage = Storage()
    daily_data = storage.load_daily_data(date)

    menu_item = None
    for item in daily_data.menu_items:
        if item.id == menu_item_id:
            menu_item = item
            break

    if not menu_item:
        click.echo(f"❌ 找不到菜品ID: {menu_item_id}")
        return

    storage.mark_missed(date, menu_item_id, reason, operator)

    click.echo(f"✅ 漏留标记成功!")
    click.echo(f"\n漏留信息:")
    click.echo(f"  菜品: {menu_item.name}")
    click.echo(f"  窗口: {menu_item.window}")
    click.echo(f"  原因: {reason}")
    click.echo(f"  标记人: {operator}")


@cli.command()
@click.option('--date', default=None, help='日期 (格式: YYYY-MM-DD, 默认今天)')
def list_menu(date):
    """列出当天菜单"""
    if not date:
        date = get_today_date()

    storage = Storage()
    daily_data = storage.load_daily_data(date)

    if not daily_data.menu_items:
        click.echo(f"⚠️ {date} 没有菜单")
        return

    click.echo(f"\n{date} 菜单列表:")
    click.echo("-" * 60)

    for i, item in enumerate(daily_data.menu_items, 1):
        click.echo(f"  {i}. ID: {item.id}")
        click.echo(f"     名称: {item.name}")
        click.echo(f"     窗口: {item.window}")
        click.echo(f"     分类: {item.category}")
        click.echo(f"     价格: ¥{item.price}")
        if item.is_special:
            click.echo(f"     ⭐ 特色菜")
        click.echo("")


@cli.command()
@click.option('--date', default=None, help='日期 (格式: YYYY-MM-DD, 默认今天)')
@click.option('--status', default='all', type=click.Choice(['all', 'registered', 'destroyed', 'missed']))
def list_reservations(date, status):
    """列出留样记录"""
    if not date:
        date = get_today_date()

    storage = Storage()
    daily_data = storage.load_daily_data(date)

    if status == 'all':
        reservations = daily_data.reservations
    else:
        reservations = [res for res in daily_data.reservations if res.status == status]

    if not reservations:
        click.echo(f"⚠️ {date} 没有{status}状态的留样记录")
        return

    click.echo(f"\n{date} 留样记录 ({status}):")
    click.echo("-" * 60)

    for i, res in enumerate(reservations, 1):
        status_marker = {
            'registered': '🟢',
            'destroyed': '✅',
            'missed': '❌'
        }.get(res.status, '⚪')

        click.echo(f"  {i}. {status_marker} ID: {res.id}")
        click.echo(f"     菜品: {res.menu_item_name}")
        click.echo(f"     窗口: {res.window}")
        click.echo(f"     状态: {res.status}")
        click.echo(f"     重量: {res.weight}g")
        click.echo(f"     容器: {res.container_id}")
        click.echo(f"     冰箱: {res.fridge_location}")
        click.echo(f"     操作人: {res.operator}")
        click.echo(f"     预计销毁: {res.expected_destruction_time.strftime('%Y-%m-%d %H:%M')}")
        if res.actual_destruction_time:
            click.echo(f"     实际销毁: {res.actual_destruction_time.strftime('%Y-%m-%d %H:%M')}")
        click.echo("")


@cli.command()
@click.option('--date', default=None, help='日期 (格式: YYYY-MM-DD, 默认今天)')
def status(date):
    """查看今日合规情况"""
    if not date:
        date = get_today_date()

    storage = Storage()
    reporter = Reporter()
    daily_data = storage.load_daily_data(date)

    reporter.print_compliance_summary(daily_data)


@cli.command()
@click.option('--date', default=None, help='日期 (格式: YYYY-MM-DD, 默认今天)')
@click.option('--hours', default=2, help='检查未来多少小时内的销毁提醒 (默认2)')
def reminders(date, hours):
    """查看待销毁提醒"""
    if not date:
        date = get_today_date()

    storage = Storage()
    reporter = Reporter()
    daily_data = storage.load_daily_data(date)

    reporter.print_destruction_reminders(daily_data, hours)


@cli.command()
@click.option('--date', default=None, help='日期 (格式: YYYY-MM-DD, 默认今天)')
def statistics(date):
    """查看责任人统计"""
    if not date:
        date = get_today_date()

    storage = Storage()
    reporter = Reporter()
    daily_data = storage.load_daily_data(date)

    reporter.print_responsible_statistics(daily_data)


@cli.command()
@click.option('--date', default=None, help='日期 (格式: YYYY-MM-DD, 默认今天)')
@click.option('--output', default=None, help='输出文件路径 (默认: reports/{date}_report.csv)')
def export_report(date, output):
    """导出检查报告"""
    if not date:
        date = get_today_date()

    if not output:
        if not os.path.exists('reports'):
            os.makedirs('reports')
        output = f"reports/{date}_report.csv"

    storage = Storage()
    reporter = Reporter()
    daily_data = storage.load_daily_data(date)

    success = reporter.export_csv_report(daily_data, output)

    if success:
        click.echo(f"✅ 报告已导出到: {output}")
    else:
        click.echo(f"❌ 报告导出失败")


if __name__ == '__main__':
    cli()

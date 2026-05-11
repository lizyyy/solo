import os
import json
from datetime import datetime
from typing import Dict, List, Optional
from .models import MenuItem, Reservation, DailyData


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

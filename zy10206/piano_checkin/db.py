import json
import os
from datetime import datetime
from typing import Dict, List, Any

class DataStore:
    def __init__(self, data_dir: str = "./data"):
        self.data_dir = data_dir
        self.members_file = os.path.join(data_dir, "members.json")
        self.packages_file = os.path.join(data_dir, "packages.json")
        self.transactions_file = os.path.join(data_dir, "transactions.json")
        self._init_store()

    def _init_store(self):
        if not os.path.exists(self.data_dir):
            os.makedirs(self.data_dir)
        
        for f in [self.members_file, self.packages_file, self.transactions_file]:
            if not os.path.exists(f):
                with open(f, "w", encoding="utf-8") as fp:
                    json.dump([], fp)

    def _read_json(self, filepath: str) -> List[Dict]:
        with open(filepath, "r", encoding="utf-8") as fp:
            return json.load(fp)

    def _write_json(self, filepath: str, data: List[Dict]):
        with open(filepath, "w", encoding="utf-8") as fp:
            json.dump(data, fp, ensure_ascii=False, indent=2)

    def get_members(self) -> List[Dict]:
        return self._read_json(self.members_file)

    def save_member(self, member: Dict):
        members = self.get_members()
        existing = next((m for m in members if m["member_id"] == member["member_id"]), None)
        if existing:
            members = [m if m["member_id"] != member["member_id"] else member for m in members]
        else:
            members.append(member)
        self._write_json(self.members_file, members)

    def get_packages(self) -> List[Dict]:
        return self._read_json(self.packages_file)

    def save_package(self, package: Dict):
        packages = self.get_packages()
        existing = next((p for p in packages if p["package_id"] == package["package_id"]), None)
        if existing:
            packages = [p if p["package_id"] != package["package_id"] else package for p in packages]
        else:
            packages.append(package)
        self._write_json(self.packages_file, packages)

    def get_transactions(self) -> List[Dict]:
        return self._read_json(self.transactions_file)

    def save_transaction(self, transaction: Dict):
        transactions = self.get_transactions()
        transactions.append(transaction)
        self._write_json(self.transactions_file, transactions)

    def save_transactions_batch(self, batch: List[Dict]):
        transactions = self.get_transactions()
        transactions.extend(batch)
        self._write_json(self.transactions_file, transactions)

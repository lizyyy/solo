import json
import os
from datetime import date, datetime
from typing import List, Optional, Dict
from models import Secret, Owner, SystemAccount, SecretLevel, ProcessingStatus, ConclusionType, ReminderRecord, ProcessingConclusion


class SecretEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (date, datetime)):
            return obj.isoformat()
        if isinstance(obj, (SecretLevel, ProcessingStatus, ConclusionType)):
            return obj.value
        if hasattr(obj, '__dataclass_fields__'):
            return {k: v for k, v in obj.__dict__.items()}
        return super().default(obj)


def decode_secret(d: Dict) -> Secret:
    if 'system_account' in d and isinstance(d['system_account'], dict):
        d['system_account'] = SystemAccount(**d['system_account'])
    if 'owner' in d and isinstance(d['owner'], dict):
        d['owner'] = Owner(**d['owner'])
    if 'level' in d:
        d['level'] = SecretLevel(d['level'])
    if 'status' in d:
        d['status'] = ProcessingStatus(d['status'])
    if 'expire_date' in d:
        d['expire_date'] = date.fromisoformat(d['expire_date'])
    if 'created_at' in d:
        d['created_at'] = datetime.fromisoformat(d['created_at'])
    if 'updated_at' in d:
        d['updated_at'] = datetime.fromisoformat(d['updated_at'])
    if 'reminder_records' in d:
        for i, r in enumerate(d['reminder_records']):
            r['reminder_time'] = datetime.fromisoformat(r['reminder_time'])
            d['reminder_records'][i] = ReminderRecord(**r)
    if 'conclusion' in d and d['conclusion']:
        d['conclusion']['conclusion_time'] = datetime.fromisoformat(d['conclusion']['conclusion_time'])
        d['conclusion']['conclusion_type'] = ConclusionType(d['conclusion']['conclusion_type'])
        d['conclusion'] = ProcessingConclusion(**d['conclusion'])
    if 'transfer_history' in d:
        for t in d['transfer_history']:
            t['transfer_time'] = datetime.fromisoformat(t['transfer_time'])
    return Secret(**d)


class SecretStore:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir
        self.secrets_file = os.path.join(data_dir, "secrets.json")
        self.owners_file = os.path.join(data_dir, "owners.json")
        self._ensure_data_dir()

    def _ensure_data_dir(self):
        if not os.path.exists(self.data_dir):
            os.makedirs(self.data_dir)

    def save_secrets(self, secrets: List[Secret]) -> None:
        with open(self.secrets_file, 'w', encoding='utf-8') as f:
            json.dump(secrets, f, cls=SecretEncoder, ensure_ascii=False, indent=2)

    def load_secrets(self) -> List[Secret]:
        if not os.path.exists(self.secrets_file):
            return []
        with open(self.secrets_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return [decode_secret(d) for d in data]

    def save_owners(self, owners: List[Owner]) -> None:
        with open(self.owners_file, 'w', encoding='utf-8') as f:
            json.dump([o.__dict__ for o in owners], f, cls=SecretEncoder, ensure_ascii=False, indent=2)

    def load_owners(self) -> List[Owner]:
        if not os.path.exists(self.owners_file):
            return []
        with open(self.owners_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return [Owner(**d) for d in data]

    def add_secret(self, secret: Secret) -> None:
        secrets = self.load_secrets()
        secrets.append(secret)
        self.save_secrets(secrets)

    def get_secret(self, secret_id: str) -> Optional[Secret]:
        secrets = self.load_secrets()
        return next((s for s in secrets if s.secret_id == secret_id), None)

    def update_secret(self, secret: Secret) -> bool:
        secrets = self.load_secrets()
        for i, s in enumerate(secrets):
            if s.secret_id == secret.secret_id:
                secrets[i] = secret
                self.save_secrets(secrets)
                return True
        return False

    def delete_secret(self, secret_id: str) -> bool:
        secrets = self.load_secrets()
        secrets = [s for s in secrets if s.secret_id != secret_id]
        self.save_secrets(secrets)
        return True

    def find_secrets(self, **filters) -> List[Secret]:
        secrets = self.load_secrets()
        result = []
        for secret in secrets:
            match = True
            for key, value in filters.items():
                if hasattr(secret, key):
                    if getattr(secret, key) != value:
                        match = False
                        break
                elif hasattr(secret.system_account, key):
                    if getattr(secret.system_account, key) != value:
                        match = False
                        break
                elif hasattr(secret.owner, key):
                    if getattr(secret.owner, key) != value:
                        match = False
                        break
            if match:
                result.append(secret)
        return result

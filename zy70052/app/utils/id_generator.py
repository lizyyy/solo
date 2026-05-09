import uuid
from datetime import datetime
import random
import string


class IdGenerator:
    
    @staticmethod
    def generate_uuid() -> str:
        return str(uuid.uuid4()).replace("-", "")
    
    @staticmethod
    def generate_business_no(prefix: str) -> str:
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        random_str = "".join(random.choices(string.digits, k=6))
        return f"{prefix}{timestamp}{random_str}"
    
    @staticmethod
    def generate_application_no() -> str:
        return IdGenerator.generate_business_no("EXT")
    
    @staticmethod
    def generate_plan_no() -> str:
        return IdGenerator.generate_business_no("PLN")
    
    @staticmethod
    def generate_snapshot_no() -> str:
        return IdGenerator.generate_business_no("SNP")
    
    @staticmethod
    def generate_record_no() -> str:
        return IdGenerator.generate_business_no("RCD")
    
    @staticmethod
    def generate_log_no() -> str:
        return IdGenerator.generate_business_no("LOG")
    
    @staticmethod
    def generate_task_no() -> str:
        return IdGenerator.generate_business_no("TSK")
    
    @staticmethod
    def generate_account_no() -> str:
        return IdGenerator.generate_business_no("ACC")

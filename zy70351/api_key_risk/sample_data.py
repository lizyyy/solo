"""样例数据生成器"""

from datetime import datetime, timedelta, date
from typing import List
import uuid
import random

from .data_loader import DataStore
from .models import (
    CustomerProfile, APIKey, AccessLog, IPRegionBaseline,
    APIConfig
)


class SampleDataGenerator:
    """样例数据生成器"""

    def __init__(self, data_dir: str = "./data"):
        self.data_store = DataStore(data_dir)
        self.data_store.load_all()

    def generate_all_samples(self):
        self._generate_api_configs()
        self._generate_customer_normal_growth()
        self._generate_customer_leak_suspected()
        self._generate_customer_brute_force()
        self._generate_customer_false_positive()
        self.data_store.save_all()
        print("样例数据生成完成！")

    def _generate_api_configs(self):
        configs = [
            APIConfig(endpoint="/api/v1/user/info", is_sensitive=False,
                     permission_required="user:read", max_calls_per_hour=1000),
            APIConfig(endpoint="/api/v1/payment/create", is_sensitive=True,
                     permission_required="payment:write", max_calls_per_hour=100),
            APIConfig(endpoint="/api/v1/payment/refund", is_sensitive=True,
                     permission_required="payment:write", max_calls_per_hour=50),
            APIConfig(endpoint="/api/v1/order/list", is_sensitive=False,
                     permission_required="order:read", max_calls_per_hour=500),
            APIConfig(endpoint="/api/v1/order/detail", is_sensitive=True,
                     permission_required="order:read", max_calls_per_hour=200),
            APIConfig(endpoint="/api/v1/auth/login", is_sensitive=True,
                     permission_required="auth:login", max_calls_per_hour=200),
            APIConfig(endpoint="/api/v1/auth/verify", is_sensitive=True,
                     permission_required="auth:verify", max_calls_per_hour=500),
            APIConfig(endpoint="/api/v1/data/export", is_sensitive=True,
                     permission_required="data:export", max_calls_per_hour=10),
        ]
        for config in configs:
            self.data_store.set_api_config(config)

    def _generate_customer_normal_growth(self):
        customer = CustomerProfile(
            customer_id="CUST-001",
            customer_name="正常业务增长公司",
            create_date=date.today() - timedelta(days=90),
            business_type="电商",
            industry="零售",
            avg_daily_calls=4800,
            peak_hours=[10, 11, 14, 15, 20, 21],
            usual_regions=["北京", "上海", "广州", "深圳"],
            is_new_customer=False
        )
        self.data_store.set_customer(customer)

        api_key = APIKey(
            key_id="KEY-001",
            customer_id="CUST-001",
            api_key="sk_normal_12345",
            create_date=date.today() - timedelta(days=60),
            permissions=["user:read", "order:read", "payment:write"],
            rate_limit=5000,
            is_active=True
        )
        self.data_store.set_api_key(api_key)

        baseline = IPRegionBaseline(
            customer_id="CUST-001",
            key_id="KEY-001",
            usual_regions=["北京", "上海", "广州", "深圳"],
            usual_ips=["10.0.1.1", "10.0.1.2", "10.0.2.1"],
            last_updated=datetime.now()
        )
        self.data_store.set_region_baseline(baseline)

        logs = self._generate_normal_growth_logs(api_key.api_key)
        for log in logs:
            self.data_store.add_access_log(log)

    def _generate_customer_leak_suspected(self):
        customer = CustomerProfile(
            customer_id="CUST-002",
            customer_name="疑似密钥泄露公司",
            create_date=date.today() - timedelta(days=180),
            business_type="金融",
            industry="银行",
            avg_daily_calls=2400,
            peak_hours=[9, 10, 11, 14, 15, 16],
            usual_regions=["北京", "天津", "河北"],
            is_new_customer=False
        )
        self.data_store.set_customer(customer)

        api_key = APIKey(
            key_id="KEY-002",
            customer_id="CUST-002",
            api_key="sk_suspected_67890",
            create_date=date.today() - timedelta(days=90),
            permissions=["user:read", "order:read", "payment:write", "data:export"],
            rate_limit=10000,
            is_active=True
        )
        self.data_store.set_api_key(api_key)

        baseline = IPRegionBaseline(
            customer_id="CUST-002",
            key_id="KEY-002",
            usual_regions=["北京", "天津", "河北"],
            usual_ips=["10.1.1.1", "10.1.1.2"],
            last_updated=datetime.now()
        )
        self.data_store.set_region_baseline(baseline)

        logs = self._generate_leak_suspected_logs(api_key.api_key)
        for log in logs:
            self.data_store.add_access_log(log)

    def _generate_customer_brute_force(self):
        customer = CustomerProfile(
            customer_id="CUST-003",
            customer_name="撞库攻击目标公司",
            create_date=date.today() - timedelta(days=365),
            business_type="SaaS",
            industry="企业服务",
            avg_daily_calls=1200,
            peak_hours=[9, 10, 11, 14, 15],
            usual_regions=["杭州", "上海", "苏州"],
            is_new_customer=False
        )
        self.data_store.set_customer(customer)

        api_key = APIKey(
            key_id="KEY-003",
            customer_id="CUST-003",
            api_key="sk_brute_11111",
            create_date=date.today() - timedelta(days=120),
            permissions=["user:read", "auth:login", "auth:verify"],
            rate_limit=3000,
            is_active=True
        )
        self.data_store.set_api_key(api_key)

        baseline = IPRegionBaseline(
            customer_id="CUST-003",
            key_id="KEY-003",
            usual_regions=["杭州", "上海", "苏州"],
            usual_ips=["10.2.1.1"],
            last_updated=datetime.now()
        )
        self.data_store.set_region_baseline(baseline)

        logs = self._generate_brute_force_logs(api_key.api_key)
        for log in logs:
            self.data_store.add_access_log(log)

    def _generate_customer_false_positive(self):
        customer = CustomerProfile(
            customer_id="CUST-004",
            customer_name="误报确认公司（新客户）",
            create_date=date.today() - timedelta(days=3),
            business_type="电商",
            industry="零售",
            avg_daily_calls=600,
            peak_hours=[10, 11, 20, 21],
            usual_regions=["成都", "重庆"],
            is_new_customer=True
        )
        self.data_store.set_customer(customer)

        api_key = APIKey(
            key_id="KEY-004",
            customer_id="CUST-004",
            api_key="sk_false_22222",
            create_date=date.today() - timedelta(days=2),
            permissions=["user:read", "order:read"],
            rate_limit=2000,
            is_active=True
        )
        self.data_store.set_api_key(api_key)

        baseline = IPRegionBaseline(
            customer_id="CUST-004",
            key_id="KEY-004",
            usual_regions=["成都", "重庆"],
            usual_ips=["10.3.1.1"],
            last_updated=datetime.now()
        )
        self.data_store.set_region_baseline(baseline)

        logs = self._generate_false_positive_logs(api_key.api_key)
        for log in logs:
            self.data_store.add_access_log(log)

    def _generate_normal_growth_logs(self, api_key: str) -> List[AccessLog]:
        logs = []
        endpoints = [
            ("/api/v1/user/info", 200, 50),
            ("/api/v1/order/list", 200, 80),
            ("/api/v1/payment/create", 200, 200),
        ]

        base_time = datetime.now() - timedelta(hours=6)
        call_count = 0

        for i in range(200):
            endpoint, status, rt = random.choice(endpoints)
            log_time = base_time + timedelta(minutes=i * 2)

            is_sensitive = endpoint in ["/api/v1/payment/create"]

            logs.append(AccessLog(
                log_id=str(uuid.uuid4()),
                api_key=api_key,
                endpoint=endpoint,
                ip=f"10.0.{random.randint(1,3)}.{random.randint(1,10)}",
                region=random.choice(["北京", "上海", "广州"]),
                timestamp=log_time,
                status_code=status,
                response_time_ms=rt + random.randint(-20, 50),
                is_sensitive=is_sensitive,
                is_duplicate=False
            ))
            call_count += 1

        return logs

    def _generate_leak_suspected_logs(self, api_key: str) -> List[AccessLog]:
        logs = []
        base_time = datetime.now() - timedelta(hours=2)

        suspicious_ips = [
            "192.168.100.1", "192.168.100.2", "192.168.100.3",
            "192.168.100.4", "192.168.100.5", "192.168.100.6"
        ]
        suspicious_regions = ["俄罗斯", "乌克兰", "哈萨克斯坦", "美国"]

        for i in range(150):
            log_time = base_time + timedelta(minutes=i * 0.5)

            is_sensitive_phase = i > 50

            if is_sensitive_phase:
                endpoint = random.choice(["/api/v1/data/export", "/api/v1/payment/refund"])
                status = 200
                is_sensitive = True
            else:
                endpoint = random.choice(["/api/v1/user/info", "/api/v1/order/list"])
                status = 200
                is_sensitive = endpoint == "/api/v1/order/list"

            logs.append(AccessLog(
                log_id=str(uuid.uuid4()),
                api_key=api_key,
                endpoint=endpoint,
                ip=random.choice(suspicious_ips),
                region=random.choice(suspicious_regions),
                timestamp=log_time,
                status_code=status,
                response_time_ms=50 + random.randint(-20, 100),
                is_sensitive=is_sensitive,
                is_duplicate=False
            ))

        for i in range(10):
            logs.append(AccessLog(
                log_id=str(uuid.uuid4()),
                api_key=api_key,
                endpoint="/api/v1/user/info",
                ip=random.choice(suspicious_ips),
                region=random.choice(suspicious_regions),
                timestamp=base_time + timedelta(minutes=i * 0.5),
                status_code=200,
                response_time_ms=50,
                is_sensitive=False,
                is_duplicate=True
            ))

        return logs

    def _generate_brute_force_logs(self, api_key: str) -> List[AccessLog]:
        logs = []
        base_time = datetime.now() - timedelta(hours=1)

        attacker_ips = [f"203.0.113.{i}" for i in range(1, 21)]

        for i in range(100):
            log_time = base_time + timedelta(seconds=i * 2)

            endpoint = "/api/v1/auth/login"
            status = random.choice([401, 401, 401, 403, 404, 500])
            ip = random.choice(attacker_ips)

            logs.append(AccessLog(
                log_id=str(uuid.uuid4()),
                api_key=api_key,
                endpoint=endpoint,
                ip=ip,
                region="海外",
                timestamp=log_time,
                status_code=status,
                response_time_ms=100 + random.randint(-30, 100),
                is_sensitive=True,
                is_duplicate=False
            ))

        for i in range(30):
            log_time = base_time - timedelta(hours=5) + timedelta(minutes=i * 5)
            logs.append(AccessLog(
                log_id=str(uuid.uuid4()),
                api_key=api_key,
                endpoint="/api/v1/user/info",
                ip="10.2.1.1",
                region="杭州",
                timestamp=log_time,
                status_code=200,
                response_time_ms=50,
                is_sensitive=False,
                is_duplicate=False
            ))

        return logs

    def _generate_false_positive_logs(self, api_key: str) -> List[AccessLog]:
        logs = []
        base_time = datetime.now() - timedelta(hours=3)

        for i in range(80):
            log_time = base_time + timedelta(minutes=i * 2)
            endpoint = random.choice(["/api/v1/user/info", "/api/v1/order/list"])
            region = random.choice(["成都", "重庆", "深圳"])

            logs.append(AccessLog(
                log_id=str(uuid.uuid4()),
                api_key=api_key,
                endpoint=endpoint,
                ip=f"10.3.1.{random.randint(1, 5)}",
                region=region,
                timestamp=log_time,
                status_code=200,
                response_time_ms=60 + random.randint(-20, 50),
                is_sensitive=False,
                is_duplicate=False
            ))

        return logs

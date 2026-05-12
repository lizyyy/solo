import json
import random
from datetime import datetime, timedelta
from pathlib import Path

random.seed(42)

def generate_log_line(timestamp, path, method, status, duration_ms,
                       business_code=None, trace_id=None):
    return {
        "timestamp": timestamp.strftime("%Y-%m-%d %H:%M:%S"),
        "path": path,
        "method": method,
        "status": status,
        "duration_ms": duration_ms,
        "business_code": business_code,
        "trace_id": trace_id or f"trace_{random.randint(100000, 999999)}"
    }

def generate_healthy_service(base_time, count=100):
    logs = []
    current = base_time

    for i in range(count):
        hour_offset = random.randint(0, 23)
        minute_offset = random.randint(0, 59)
        ts = current + timedelta(hours=hour_offset, minutes=minute_offset, seconds=random.randint(0, 59))

        endpoint = random.choice([
            "/api/products/1001",
            "/api/products/1002",
            "/api/products",
            "/api/orders/list"
        ])

        method = random.choice(["GET", "GET", "GET", "POST"])
        status = random.choice([200] * 98 + [304, 404])
        duration = random.uniform(10, 80)

        business_code = "SUCCESS" if status == 200 else None

        logs.append(generate_log_line(ts, endpoint, method, status, duration, business_code))

        current = ts

    return logs

def generate_latency_jitter_service(base_time, count=100):
    logs = []
    current = base_time

    for i in range(count):
        hour_offset = random.randint(0, 23)
        ts = current + timedelta(hours=hour_offset, minutes=random.randint(0, 59), seconds=random.randint(0, 59))

        endpoint = random.choice([
            "/api/products/2001",
            "/api/products/2002",
        ])

        method = "GET"

        jitter = random.random()
        if jitter < 0.6:
            duration = random.uniform(100, 200)
        elif jitter < 0.85:
            duration = random.uniform(400, 600)
        else:
            duration = random.uniform(2000, 5000)

        status = 200
        business_code = "SUCCESS"

        logs.append(generate_log_line(ts, endpoint, method, status, duration, business_code))
        current = ts

    return logs

def generate_high_error_rate_service(base_time, count=100):
    logs = []
    current = base_time

    for i in range(count):
        hour_offset = random.randint(0, 23)
        ts = current + timedelta(hours=hour_offset, minutes=random.randint(0, 59), seconds=random.randint(0, 59))

        endpoint = random.choice([
            "/api/products/3001",
            "/api/products/3001/update",
            "/api/products/3002",
            "/api/orders/create"
        ])

        method = random.choice(["GET", "POST", "PUT"])

        error_type = random.random()
        if error_type < 0.7:
            status = 200
            business_code = "SUCCESS"
        elif error_type < 0.85:
            status = 500
            business_code = "SYSTEM_ERROR"
        elif error_type < 0.92:
            status = 503
            business_code = "TIMEOUT"
        else:
            status = 404
            business_code = "NOT_FOUND"

        duration = random.uniform(20, 300) if status != 503 else random.uniform(5000, 10000)

        logs.append(generate_log_line(ts, endpoint, method, status, duration, business_code))
        current = ts

    return logs

def generate_health_checks(base_time, count=20):
    logs = []
    current = base_time

    for i in range(count):
        ts = current + timedelta(hours=i, minutes=random.randint(0, 59))
        logs.append(generate_log_line(
            ts,
            random.choice(["/health", "/healthz", "/ping", "/metrics"]),
            "GET",
            200,
            random.uniform(1, 10),
            "SUCCESS"
        ))
        current = ts

    return logs

def generate_duplicates(logs, count=5):
    return logs + random.sample(logs, min(count, len(logs)))

def generate_mixed_duration():
    logs = []
    base = datetime(2026, 5, 10, 0, 0, 0)

    logs.extend(generate_healthy_service(base, 80))
    logs.extend(generate_latency_jitter_service(base, 60))
    logs.extend(generate_high_error_rate_service(base, 50))
    logs.extend(generate_health_checks(base, 10))

    random.shuffle(logs)
    logs = generate_duplicates(logs, 8)

    return logs

def generate_period_logs():
    logs1 = []
    logs2 = []

    base1 = datetime(2026, 5, 8, 0, 0, 0)
    base2 = datetime(2026, 5, 11, 0, 0, 0)

    logs1.extend(generate_healthy_service(base1, 60))
    logs1.extend(generate_latency_jitter_service(base1, 30))
    logs1.extend(generate_high_error_rate_service(base1, 20))

    logs2.extend(generate_healthy_service(base2, 70))
    logs2.extend(generate_latency_jitter_service(base2, 50))
    logs2.extend(generate_high_error_rate_service(base2, 40))

    random.shuffle(logs1)
    random.shuffle(logs2)

    return logs1, logs2

def main():
    examples_dir = Path(__file__).parent
    logs_dir = examples_dir / "logs"
    logs_dir.mkdir(exist_ok=True)

    mixed = generate_mixed_duration()
    with open(logs_dir / "access.log", "w", encoding="utf-8") as f:
        for log in mixed:
            f.write(json.dumps(log, ensure_ascii=False) + "\n")
    print(f"✓ 生成 {len(mixed)} 条测试日志 -> access.log")

    logs1, logs2 = generate_period_logs()

    with open(logs_dir / "period1.log", "w", encoding="utf-8") as f:
        for log in logs1:
            f.write(json.dumps(log, ensure_ascii=False) + "\n")
    print(f"✓ 生成 {len(logs1)} 条时段1日志 -> period1.log")

    with open(logs_dir / "period2.log", "w", encoding="utf-8") as f:
        for log in logs2:
            f.write(json.dumps(log, ensure_ascii=False) + "\n")
    print(f"✓ 生成 {len(logs2)} 条时段2日志 -> period2.log")

    print(f"\n总共生成 {len(mixed) + len(logs1) + len(logs2)} 条日志")

if __name__ == "__main__":
    main()

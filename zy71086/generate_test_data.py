#!/usr/bin/env python3
from datetime import datetime, timedelta, timezone
import json
import shutil
from pathlib import Path


def main():
    now = datetime.now(timezone.utc)
    print(f"Generating test data with current time: {now}")

    Path("test_data/clean").mkdir(parents=True, exist_ok=True)
    Path("test_data/dirty").mkdir(parents=True, exist_ok=True)

    shutil.copy("test_data/clean/manifest.json", "test_data/dirty/manifest.json")

    clean_run_results = generate_clean_run_results(now)
    write_json("test_data/clean/run_results.json", clean_run_results)

    clean_sources = generate_clean_sources(now)
    write_json("test_data/clean/sources.json", clean_sources)

    dirty_run_results = generate_dirty_run_results(now)
    write_json("test_data/dirty/run_results.json", dirty_run_results)

    dirty_sources = generate_dirty_sources(now)
    write_json("test_data/dirty/sources.json", dirty_sources)

    report_tables = {
        "每日销售报表": "model.analytics.report_daily_sales",
        "用户维度表": "model.analytics.dim_users",
        "订单事实表": "model.analytics.fct_orders"
    }
    write_json("test_data/clean/report_tables.json", report_tables)
    write_json("test_data/dirty/report_tables.json", report_tables)

    print("Test data generated successfully!")


def generate_clean_run_results(now: datetime) -> dict:
    models = [
        "model.analytics.dim_users",
        "model.analytics.fct_orders",
        "model.analytics.report_daily_sales",
        "model.staging.stg_users",
        "model.staging.stg_orders"
    ]

    results = []
    for i, model in enumerate(models):
        completed = now - timedelta(minutes=30 + i * 5)
        started = completed - timedelta(seconds=10 + i * 2)
        results.append({
            "unique_id": model,
            "status": "success",
            "execution_time": 10.0 + i * 2,
            "timing": [{
                "name": "execute",
                "started_at": started.isoformat().replace("+00:00", "Z"),
                "completed_at": completed.isoformat().replace("+00:00", "Z")
            }]
        })

    return {
        "metadata": {"dbt_version": "1.5.0", "generated_at": now.isoformat()},
        "results": results
    }


def generate_clean_sources(now: datetime) -> dict:
    sources = ["source.raw.users", "source.raw.orders"]
    results = []

    for i, source in enumerate(sources):
        max_loaded = now - timedelta(minutes=45 + i * 5)
        results.append({
            "unique_id": source,
            "max_loaded_at": max_loaded.isoformat().replace("+00:00", "Z"),
            "snapshotted_at": now.isoformat().replace("+00:00", "Z"),
            "age": (45 + i * 5) * 60.0,
            "status": "pass",
            "warn_after": {"period": "hour", "count": 1},
            "error_after": {"period": "hour", "count": 3}
        })

    return {
        "metadata": {"dbt_version": "1.5.0", "generated_at": now.isoformat()},
        "results": results
    }


def generate_dirty_run_results(now: datetime) -> dict:
    results = []

    completed = now - timedelta(minutes=35)
    started = completed - timedelta(seconds=12)
    results.append({
        "unique_id": "model.analytics.dim_users",
        "status": "success",
        "execution_time": 12.0,
        "timing": [{
            "name": "execute",
            "started_at": started.isoformat().replace("+00:00", "Z"),
            "completed_at": completed.isoformat().replace("+00:00", "Z")
        }]
    })

    completed = now - timedelta(minutes=240)
    started = completed - timedelta(seconds=25)
    results.append({
        "unique_id": "model.analytics.fct_orders",
        "status": "success",
        "execution_time": 25.0,
        "timing": [{
            "name": "execute",
            "started_at": started.isoformat().replace("+00:00", "Z"),
            "completed_at": completed.isoformat().replace("+00:00", "Z")
        }]
    })

    results.append({
        "unique_id": "model.analytics.report_daily_sales",
        "status": "skipped",
        "execution_time": 0.0,
        "timing": []
    })

    results.append({
        "unique_id": "model.staging.stg_users",
        "status": "success",
        "execution_time": 5.0,
        "timing": [{
            "name": "execute",
            "started_at": (now - timedelta(minutes=40, seconds=5)).isoformat().replace("+00:00", "Z"),
            "completed_at": (now - timedelta(minutes=40)).isoformat().replace("+00:00", "Z")
        }]
    })

    results.append({
        "unique_id": "model.staging.stg_orders",
        "status": "error",
        "execution_time": 3.0,
        "timing": [{
            "name": "execute",
            "started_at": (now - timedelta(minutes=38, seconds=3)).isoformat().replace("+00:00", "Z"),
            "completed_at": (now - timedelta(minutes=38)).isoformat().replace("+00:00", "Z")
        }],
        "message": "Database connection failed"
    })

    return {
        "metadata": {"dbt_version": "1.5.0", "generated_at": now.isoformat()},
        "results": results
    }


def generate_dirty_sources(now: datetime) -> dict:
    results = []

    max_loaded = now - timedelta(minutes=45)
    results.append({
        "unique_id": "source.raw.users",
        "max_loaded_at": max_loaded.isoformat().replace("+00:00", "Z"),
        "snapshotted_at": now.isoformat().replace("+00:00", "Z"),
        "age": 45 * 60.0,
        "status": "pass",
        "warn_after": {"period": "hour", "count": 1},
        "error_after": {"period": "hour", "count": 3}
    })

    max_loaded = now - timedelta(minutes=300)
    results.append({
        "unique_id": "source.raw.orders",
        "max_loaded_at": max_loaded.isoformat().replace("+00:00", "Z"),
        "snapshotted_at": now.isoformat().replace("+00:00", "Z"),
        "age": 300 * 60.0,
        "status": "error",
        "warn_after": {"period": "hour", "count": 1},
        "error_after": {"period": "hour", "count": 3}
    })

    return {
        "metadata": {"dbt_version": "1.5.0", "generated_at": now.isoformat()},
        "results": results
    }


def write_json(path: str, data: dict) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"Created: {path}")


if __name__ == "__main__":
    main()

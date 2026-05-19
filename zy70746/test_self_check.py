import asyncio
import httpx
import sys
import os
from typing import Dict, List

BASE_URL = "http://localhost:8000"


class Colors:
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    ENDC = "\033[0m"


def print_success(message: str):
    print(f"{Colors.GREEN}✓ {message}{Colors.ENDC}")


def print_failure(message: str):
    print(f"{Colors.RED}✗ {message}{Colors.ENDC}")


def print_info(message: str):
    print(f"{Colors.BLUE}ℹ {message}{Colors.ENDC}")


async def test_create_batch(client: httpx.AsyncClient, batch_id: str) -> bool:
    print_info(f"Testing create batch: {batch_id}")
    try:
        response = await client.post(
            f"{BASE_URL}/api/batches/",
            json={
                "batch_id": batch_id,
                "release_name": "feature-auth",
                "version": "v2.3.1",
                "environment": "production"
            }
        )
        if response.status_code == 201:
            print_success(f"Batch {batch_id} created successfully")
            return True
        else:
            print_failure(f"Failed to create batch: {response.status_code} - {response.text}")
            return False
    except Exception as e:
        print_failure(f"Error creating batch: {str(e)}")
        return False


async def test_create_duplicate_batch(client: httpx.AsyncClient, batch_id: str) -> bool:
    print_info("Testing duplicate batch creation (should fail)")
    try:
        response = await client.post(
            f"{BASE_URL}/api/batches/",
            json={
                "batch_id": batch_id,
                "release_name": "feature-auth",
                "version": "v2.3.1",
                "environment": "production"
            }
        )
        if response.status_code == 400:
            data = response.json()
            if data.get("code") == "already_processed":
                print_success("Duplicate batch correctly rejected with ALREADY_PROCESSED")
                return True
        print_failure(f"Duplicate batch test failed: {response.status_code} - {response.text}")
        return False
    except Exception as e:
        print_failure(f"Error testing duplicate batch: {str(e)}")
        return False


async def test_list_batches(client: httpx.AsyncClient) -> bool:
    print_info("Testing list batches")
    try:
        response = await client.get(f"{BASE_URL}/api/batches/")
        if response.status_code == 200:
            batches = response.json()
            print_success(f"Listed {len(batches)} batches successfully")
            return True
        print_failure(f"Failed to list batches: {response.status_code}")
        return False
    except Exception as e:
        print_failure(f"Error listing batches: {str(e)}")
        return False


async def test_create_metrics(client: httpx.AsyncClient, batch_id: str) -> bool:
    print_info(f"Testing create metrics for batch: {batch_id}")
    metrics = [
        {
            "batch_id": batch_id,
            "metric_name": "error_rate",
            "metric_type": "core",
            "current_value": 0.08,
            "baseline_value": 0.05,
            "unit": "ratio"
        },
        {
            "batch_id": batch_id,
            "metric_name": "latency_p95",
            "metric_type": "core",
            "current_value": 250,
            "baseline_value": 200,
            "unit": "ms"
        },
        {
            "batch_id": batch_id,
            "metric_name": "cpu_usage",
            "metric_type": "auxiliary",
            "current_value": 65,
            "baseline_value": 50,
            "unit": "percent"
        },
        {
            "batch_id": batch_id,
            "metric_name": "memory_usage",
            "metric_type": "auxiliary",
            "current_value": 70,
            "baseline_value": 60,
            "unit": "percent"
        }
    ]
    
    success_count = 0
    for metric in metrics:
        try:
            response = await client.post(f"{BASE_URL}/api/metrics/", json=metric)
            if response.status_code == 201:
                success_count += 1
            else:
                print_failure(f"Failed to create metric {metric['metric_name']}: {response.status_code}")
        except Exception as e:
            print_failure(f"Error creating metric {metric['metric_name']}: {str(e)}")
    
    if success_count == len(metrics):
        print_success(f"All {len(metrics)} metrics created successfully")
        return True
    return False


async def test_create_threshold_rules(client: httpx.AsyncClient) -> bool:
    print_info("Testing create threshold rules")
    rules = [
        {
            "rule_name": "error_rate_threshold",
            "metric_name": "error_rate",
            "metric_type": "core",
            "threshold_type": "change_rate",
            "threshold_value": 0.5,
            "comparison_operator": "<=",
            "weight": 3.0,
            "description": "Error rate change should not exceed 50%"
        },
        {
            "rule_name": "latency_threshold",
            "metric_name": "latency_p95",
            "metric_type": "core",
            "threshold_type": "change_rate",
            "threshold_value": 0.3,
            "comparison_operator": "<=",
            "weight": 2.0,
            "description": "Latency change should not exceed 30%"
        },
        {
            "rule_name": "cpu_threshold",
            "metric_name": "cpu_usage",
            "metric_type": "auxiliary",
            "threshold_type": "absolute",
            "threshold_value": 80,
            "comparison_operator": "<=",
            "weight": 1.0,
            "description": "CPU usage should stay below 80%"
        }
    ]
    
    success_count = 0
    for rule in rules:
        try:
            response = await client.post(f"{BASE_URL}/api/thresholds/", json=rule)
            if response.status_code == 201:
                success_count += 1
            else:
                print_failure(f"Failed to create rule {rule['rule_name']}: {response.status_code}")
        except Exception as e:
            print_failure(f"Error creating rule {rule['rule_name']}: {str(e)}")
    
    if success_count == len(rules):
        print_success(f"All {len(rules)} threshold rules created successfully")
        return True
    return False


async def test_list_threshold_rules(client: httpx.AsyncClient) -> bool:
    print_info("Testing list threshold rules")
    try:
        response = await client.get(f"{BASE_URL}/api/thresholds/")
        if response.status_code == 200:
            rules = response.json()
            print_success(f"Listed {len(rules)} threshold rules successfully")
            return True
        print_failure(f"Failed to list rules: {response.status_code}")
        return False
    except Exception as e:
        print_failure(f"Error listing rules: {str(e)}")
        return False


async def test_aggregate_metrics(client: httpx.AsyncClient, batch_id: str) -> bool:
    print_info(f"Testing metrics aggregation for batch: {batch_id}")
    try:
        response = await client.post(f"{BASE_URL}/api/batches/{batch_id}/aggregate/")
        if response.status_code == 200:
            data = response.json()
            if data.get("aggregated"):
                print_success("Metrics aggregated successfully")
                print_info(f"  Core metrics: {data.get('core_metrics_count')}")
                print_info(f"  Aux metrics: {data.get('aux_metrics_count')}")
                return True
        print_failure(f"Failed to aggregate metrics: {response.status_code} - {response.text}")
        return False
    except Exception as e:
        print_failure(f"Error aggregating metrics: {str(e)}")
        return False


async def test_make_decision(client: httpx.AsyncClient, batch_id: str) -> Dict:
    print_info(f"Testing threshold decision for batch: {batch_id}")
    try:
        response = await client.post(f"{BASE_URL}/api/batches/{batch_id}/decide/")
        if response.status_code == 200:
            data = response.json()
            print_success(f"Decision made successfully: {data['status']}")
            print_info(f"  Auto decision: {data['auto_decision']}")
            print_info(f"  Confidence: {data['auto_confidence']:.2f}")
            print_info(f"  Needs manual review: {data['needs_manual_review']}")
            return data
        print_failure(f"Failed to make decision: {response.status_code} - {response.text}")
        return None
    except Exception as e:
        print_failure(f"Error making decision: {str(e)}")
        return None


async def test_get_decision(client: httpx.AsyncClient, batch_id: str) -> bool:
    print_info(f"Testing get decision for batch: {batch_id}")
    try:
        response = await client.get(f"{BASE_URL}/api/batches/{batch_id}/decision/")
        if response.status_code == 200:
            decision = response.json()
            print_success(f"Decision retrieved successfully: {decision['status']}")
            return True
        print_failure(f"Failed to get decision: {response.status_code}")
        return False
    except Exception as e:
        print_failure(f"Error getting decision: {str(e)}")
        return False


async def test_manual_override(client: httpx.AsyncClient, batch_id: str) -> bool:
    print_info(f"Testing manual override for batch: {batch_id}")
    try:
        response = await client.post(
            f"{BASE_URL}/api/batches/{batch_id}/override/",
            json={
                "decision": "approve",
                "operator": "admin@example.com",
                "reason": "Metrics are within acceptable range after manual review"
            }
        )
        if response.status_code == 200:
            data = response.json()
            print_success(f"Manual override successful: {data['status']}")
            print_info(f"  Operator: {data['manual_operator']}")
            print_info(f"  Reason: {data['manual_reason']}")
            return True
        print_failure(f"Failed to override decision: {response.status_code} - {response.text}")
        return False
    except Exception as e:
        print_failure(f"Error overriding decision: {str(e)}")
        return False


async def test_double_override(client: httpx.AsyncClient, batch_id: str) -> bool:
    print_info("Testing double override (should fail)")
    try:
        response = await client.post(
            f"{BASE_URL}/api/batches/{batch_id}/override/",
            json={
                "decision": "reject",
                "operator": "admin@example.com",
                "reason": "Second attempt"
            }
        )
        if response.status_code == 400:
            data = response.json()
            if data.get("code") == "already_processed":
                print_success("Double override correctly rejected with ALREADY_PROCESSED")
                return True
        print_failure(f"Double override test failed: {response.status_code} - {response.text}")
        return False
    except Exception as e:
        print_failure(f"Error testing double override: {str(e)}")
        return False


async def test_execute_decision(client: httpx.AsyncClient, batch_id: str) -> bool:
    print_info(f"Testing execute decision for batch: {batch_id}")
    try:
        response = await client.post(f"{BASE_URL}/api/batches/{batch_id}/execute/")
        if response.status_code == 200:
            data = response.json()
            print_success(f"Decision executed successfully: {data['status']}")
            print_info(f"  Final decision: {data['final_decision']}")
            return True
        print_failure(f"Failed to execute decision: {response.status_code} - {response.text}")
        return False
    except Exception as e:
        print_failure(f"Error executing decision: {str(e)}")
        return False


async def test_export_summary(client: httpx.AsyncClient, batch_id: str) -> bool:
    print_info(f"Testing summary export for batch: {batch_id}")
    try:
        response = await client.post(f"{BASE_URL}/api/batches/{batch_id}/export/")
        if response.status_code == 200:
            summary = response.json()
            print_success("Summary exported successfully")
            print_info(f"  Batch: {summary['batch_id']}")
            print_info(f"  Decision method: {summary['decision_method']}")
            print_info(f"  Duration: {summary['duration_seconds']}s")
            return True
        print_failure(f"Failed to export summary: {response.status_code} - {response.text}")
        return False
    except Exception as e:
        print_failure(f"Error exporting summary: {str(e)}")
        return False


async def test_list_summaries(client: httpx.AsyncClient) -> bool:
    print_info("Testing list summaries")
    try:
        response = await client.get(f"{BASE_URL}/api/summaries/")
        if response.status_code == 200:
            summaries = response.json()
            print_success(f"Listed {len(summaries)} summaries successfully")
            return True
        print_failure(f"Failed to list summaries: {response.status_code}")
        return False
    except Exception as e:
        print_failure(f"Error listing summaries: {str(e)}")
        return False


async def test_needs_manual_review_scenario(client: httpx.AsyncClient) -> bool:
    print_info("Testing NEEDS_MANUAL_REVIEW error code scenario")
    batch_id = "BATCH-REVIEW-TEST-002"
    
    await test_create_batch(client, batch_id)
    
    metrics = [
        {
            "batch_id": batch_id,
            "metric_name": "error_rate_2",
            "metric_type": "core",
            "current_value": 0.055,
            "baseline_value": 0.05,
            "unit": "ratio"
        }
    ]
    for metric in metrics:
        await client.post(f"{BASE_URL}/api/metrics/", json=metric)
    
    await client.post(f"{BASE_URL}/api/batches/{batch_id}/decide/")
    
    try:
        response = await client.post(f"{BASE_URL}/api/batches/{batch_id}/execute/")
        if response.status_code == 400:
            data = response.json()
            if data.get("code") == "needs_manual_review":
                print_success("NEEDS_MANUAL_REVIEW error code correctly returned")
                return True
        print_failure(f"NEEDS_MANUAL_REVIEW test failed: {response.status_code} - {response.text}")
        return False
    except Exception as e:
        print_failure(f"Error testing NEEDS_MANUAL_REVIEW: {str(e)}")
        return False


async def test_not_found_scenario(client: httpx.AsyncClient) -> bool:
    print_info("Testing NOT_FOUND error code scenario")
    try:
        response = await client.get(f"{BASE_URL}/api/batches/NONEXISTENT/decision/")
        if response.status_code == 404:
            data = response.json()
            if data.get("code") == "not_found":
                print_success("NOT_FOUND error code correctly returned")
                return True
        print_failure(f"NOT_FOUND test failed: {response.status_code} - {response.text}")
        return False
    except Exception as e:
        print_failure(f"Error testing NOT_FOUND: {str(e)}")
        return False


async def test_invalid_state_scenario(client: httpx.AsyncClient) -> bool:
    print_info("Testing INVALID_STATE error code scenario")
    batch_id = "BATCH-INVALID-STATE-001"
    
    await test_create_batch(client, batch_id)
    
    metrics = [
        {
            "batch_id": batch_id,
            "metric_name": "error_rate",
            "metric_type": "core",
            "current_value": 0.06,
            "baseline_value": 0.05,
            "unit": "ratio"
        }
    ]
    for metric in metrics:
        await client.post(f"{BASE_URL}/api/metrics/", json=metric)
    
    await client.post(f"{BASE_URL}/api/batches/{batch_id}/decide/")
    await client.post(
        f"{BASE_URL}/api/batches/{batch_id}/override/",
        json={
            "decision": "approve",
            "operator": "admin@example.com",
            "reason": "Approved"
        }
    )
    await client.post(f"{BASE_URL}/api/batches/{batch_id}/execute/")
    
    try:
        response = await client.post(
            f"{BASE_URL}/api/batches/{batch_id}/override/",
            json={
                "decision": "reject",
                "operator": "admin@example.com",
                "reason": "Second override"
            }
        )
        if response.status_code == 400:
            data = response.json()
            if data.get("code") == "invalid_state":
                print_success("INVALID_STATE error code correctly returned")
                return True
        print_failure(f"INVALID_STATE test failed: {response.status_code} - {response.text}")
        return False
    except Exception as e:
        print_failure(f"Error testing INVALID_STATE: {str(e)}")
        return False


async def run_all_tests():
    print("\n" + "="*60)
    print("  回滚指标裁决人工覆写 API - 自检脚本")
    print("="*60 + "\n")
    print_info("Using existing database (server manages it)")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        results = []
        
        print("\n" + "-"*60)
        print("  Phase 1: Batch Management Tests")
        print("-"*60 + "\n")
        batch_id = "BATCH-2024-001"
        results.append(("create_batch", await test_create_batch(client, batch_id)))
        results.append(("duplicate_batch", await test_create_duplicate_batch(client, batch_id)))
        results.append(("list_batches", await test_list_batches(client)))
        
        print("\n" + "-"*60)
        print("  Phase 2: Metrics & Threshold Tests")
        print("-"*60 + "\n")
        results.append(("create_metrics", await test_create_metrics(client, batch_id)))
        results.append(("create_threshold_rules", await test_create_threshold_rules(client)))
        results.append(("list_threshold_rules", await test_list_threshold_rules(client)))
        results.append(("aggregate_metrics", await test_aggregate_metrics(client, batch_id)))
        
        print("\n" + "-"*60)
        print("  Phase 3: Decision Tests")
        print("-"*60 + "\n")
        decision = await test_make_decision(client, batch_id)
        results.append(("make_decision", decision is not None))
        results.append(("get_decision", await test_get_decision(client, batch_id)))
        results.append(("manual_override", await test_manual_override(client, batch_id)))
        results.append(("double_override", await test_double_override(client, batch_id)))
        results.append(("execute_decision", await test_execute_decision(client, batch_id)))
        
        print("\n" + "-"*60)
        print("  Phase 4: Summary Export Tests")
        print("-"*60 + "\n")
        results.append(("export_summary", await test_export_summary(client, batch_id)))
        results.append(("list_summaries", await test_list_summaries(client)))
        
        print("\n" + "-"*60)
        print("  Phase 5: Error Code Scenario Tests")
        print("-"*60 + "\n")
        results.append(("needs_manual_review", await test_needs_manual_review_scenario(client)))
        results.append(("not_found", await test_not_found_scenario(client)))
        results.append(("invalid_state", await test_invalid_state_scenario(client)))
        
        print("\n" + "="*60)
        print("  TEST SUMMARY")
        print("="*60 + "\n")
        
        passed = sum(1 for _, result in results if result)
        total = len(results)
        
        for test_name, result in results:
            status = "PASS" if result else "FAIL"
            color = Colors.GREEN if result else Colors.RED
            print(f"{color}{status:6}{Colors.ENDC} - {test_name}")
        
        print("\n" + "-"*60)
        print(f"\nTotal: {passed}/{total} tests passed")
        
        if passed == total:
            print_success("All tests passed!")
            return 0
        else:
            print_failure(f"{total - passed} test(s) failed")
            return 1


if __name__ == "__main__":
    exit_code = asyncio.run(run_all_tests())
    sys.exit(exit_code)

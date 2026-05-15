import pytest
import httpx
from main import app
from test_data import generate_receipt_data, generate_duplicate_batch, generate_small_batch
import json


class TestAuthRecoveryService:
    @pytest.fixture(autouse=True)
    def setup(self):
        import os
        if os.path.exists("auth_recovery.db"):
            os.remove("auth_recovery.db")
        import models
        models.create_tables()
    
    @pytest.mark.asyncio
    async def test_submit_batch_success(self):
        async with httpx.AsyncClient(app=app, base_url="http://test") as client:
            data = generate_small_batch()
            response = await client.post("/api/v1/batch/submit", json=data)
            assert response.status_code == 200
            result = response.json()
            assert result["code"] == 200
            assert result["data"]["total_count"] == 1
            print("✓ 批次提交成功测试通过")
    
    @pytest.mark.asyncio
    async def test_duplicate_submission_detection(self):
        async with httpx.AsyncClient(app=app, base_url="http://test") as client:
            data = generate_small_batch()
            response1 = await client.post("/api/v1/batch/submit", json=data)
            assert response1.status_code == 200
            
            response2 = await client.post("/api/v1/batch/submit", json=data)
            assert response2.status_code == 409
            result = response2.json()
            assert result["code"] == 409
            assert "内容重复" in result["message"]
            assert "batch_id" in result["data"]
            print("✓ 重复提交检测测试通过")
    
    @pytest.mark.asyncio
    async def test_exception_records_not_skipped(self):
        async with httpx.AsyncClient(app=app, base_url="http://test") as client:
            data = generate_receipt_data()
            response = await client.post("/api/v1/batch/submit", json=data)
            assert response.status_code == 200
            batch_id = response.json()["data"]["batch_id"]
            
            response = await client.get(f"/api/v1/records?batch_id={batch_id}")
            records = response.json()["data"]
            assert len(records) == 8
            
            exception_records = [r for r in records if r["risk_type"] != "NORMAL"]
            assert len(exception_records) == 4
            print(f"✓ 异常记录保留测试通过（共{len(exception_records)}条异常）")
    
    @pytest.mark.asyncio
    async def test_query_by_filters(self):
        async with httpx.AsyncClient(app=app, base_url="http://test") as client:
            data = generate_receipt_data()
            response = await client.post("/api/v1/batch/submit", json=data)
            batch_id = response.json()["data"]["batch_id"]
            
            response = await client.get(f"/api/v1/records?batch_id={batch_id}")
            assert len(response.json()["data"]) == 8
            
            response = await client.get("/api/v1/records?operator=operator1")
            assert len(response.json()["data"]) == 2
            
            response = await client.get("/api/v1/records?risk_type=DUPLICATE_SUBMISSION")
            assert len(response.json()["data"]) == 1
            print("✓ 按条件过滤查询测试通过")
    
    @pytest.mark.asyncio
    async def test_summary_json_format(self):
        async with httpx.AsyncClient(app=app, base_url="http://test") as client:
            data = generate_receipt_data()
            response = await client.post("/api/v1/batch/submit", json=data)
            batch_id = response.json()["data"]["batch_id"]
            
            response = await client.get(f"/api/v1/batch/{batch_id}/summary?format=json")
            result = response.json()
            assert result["code"] == 200
            assert result["data"]["total_orders"] == 6
            assert result["data"]["orders_with_exceptions"] == 4
            print("✓ JSON格式摘要测试通过")
    
    @pytest.mark.asyncio
    async def test_summary_markdown_format(self):
        async with httpx.AsyncClient(app=app, base_url="http://test") as client:
            data = generate_receipt_data()
            response = await client.post("/api/v1/batch/submit", json=data)
            batch_id = response.json()["data"]["batch_id"]
            
            response = await client.get(f"/api/v1/batch/{batch_id}/summary?format=markdown")
            assert response.status_code == 200
            assert "授权回收摘要" in response.text
            assert "业务单号" in response.text
            assert "异常记录" in response.text
            assert "结论" in response.text
            print("✓ Markdown格式摘要测试通过")
    
    @pytest.mark.asyncio
    async def test_summary_order_consolidation(self):
        async with httpx.AsyncClient(app=app, base_url="http://test") as client:
            data = generate_receipt_data()
            response = await client.post("/api/v1/batch/submit", json=data)
            batch_id = response.json()["data"]["batch_id"]
            
            response = await client.get(f"/api/v1/batch/{batch_id}/summary")
            details = response.json()["data"]["details"]
            
            order5 = next(o for o in details if o["business_order_no"] == "BIZ2024010005")
            assert len(order5["exceptions"]) == 1
            assert len(order5["corrections"]) == 1
            assert "ACCOUNT_MISMATCH" in order5["conclusion"]
            assert "修正回执确认" in order5["conclusion"]
            
            order1 = next(o for o in details if o["business_order_no"] == "BIZ2024010001")
            assert len(order1["exceptions"]) == 1
            assert len(order1["corrections"]) == 0
            assert "DUPLICATE_SUBMISSION" in order1["conclusion"]
            assert "暂无后续修正回执" in order1["conclusion"]
            
            order3 = next(o for o in details if o["business_order_no"] == "BIZ2024010003")
            assert len(order3["exceptions"]) == 1
            assert len(order3["corrections"]) == 0
            
            order6 = next(o for o in details if o["business_order_no"] == "BIZ2024010006")
            assert len(order6["exceptions"]) == 1
            assert len(order6["corrections"]) == 0
            print("✓ 按业务单号整合摘要测试通过（异常、修正、结论完整）")
    
    @pytest.mark.asyncio
    async def test_markdown_contains_corrections(self):
        async with httpx.AsyncClient(app=app, base_url="http://test") as client:
            data = generate_receipt_data()
            response = await client.post("/api/v1/batch/submit", json=data)
            batch_id = response.json()["data"]["batch_id"]
            
            response = await client.get(f"/api/v1/batch/{batch_id}/summary?format=markdown")
            md_content = response.text
            assert "已修正单据数" in md_content
            assert "修正记录" in md_content
            assert "后续正常回执" in md_content
            assert "RCPT202401150006" in md_content
            print("✓ Markdown格式包含修正记录测试通过")
    
    @pytest.mark.asyncio
    async def test_json_markdown_consistency(self):
        async with httpx.AsyncClient(app=app, base_url="http://test") as client:
            data = generate_receipt_data()
            response = await client.post("/api/v1/batch/submit", json=data)
            batch_id = response.json()["data"]["batch_id"]
            
            json_response = await client.get(f"/api/v1/batch/{batch_id}/summary")
            json_data = json_response.json()["data"]
            
            md_response = await client.get(f"/api/v1/batch/{batch_id}/summary?format=markdown")
            md_content = md_response.text
            
            assert str(json_data["total_orders"]) in md_content
            assert str(json_data["orders_with_exceptions"]) in md_content
            assert str(json_data["orders_with_corrections"]) in md_content
            
            for detail in json_data["details"]:
                assert detail["business_order_no"] in md_content
                assert detail["conclusion"] in md_content
            print("✓ JSON与Markdown内容一致测试通过")
    
    @pytest.mark.asyncio
    async def test_list_batches(self):
        async with httpx.AsyncClient(app=app, base_url="http://test") as client:
            data1 = generate_small_batch()
            data1["batch_name"] = "批次1"
            await client.post("/api/v1/batch/submit", json=data1)
            
            data2 = generate_small_batch()
            data2["records"][0]["receipt_no"] = "TEST002"
            data2["batch_name"] = "批次2"
            await client.post("/api/v1/batch/submit", json=data2)
            
            response = await client.get("/api/v1/batches")
            batches = response.json()["data"]
            assert len(batches) == 2
            print("✓ 批次列表查询测试通过")
    
    @pytest.mark.asyncio
    async def test_boundary_empty_batch(self):
        async with httpx.AsyncClient(app=app, base_url="http://test") as client:
            data = {
                "operator": "test",
                "batch_name": "空批次",
                "records": []
            }
            response = await client.post("/api/v1/batch/submit", json=data)
            assert response.status_code == 200
            assert response.json()["data"]["total_count"] == 0
            print("✓ 空批次边界测试通过")
    
    @pytest.mark.asyncio
    async def test_same_batch_name_different_content(self):
        async with httpx.AsyncClient(app=app, base_url="http://test") as client:
            data1 = generate_small_batch()
            response1 = await client.post("/api/v1/batch/submit", json=data1)
            assert response1.status_code == 200
            
            data2 = generate_small_batch()
            data2["records"][0]["amount"] = 999.00
            response2 = await client.post("/api/v1/batch/submit", json=data2)
            assert response2.status_code == 200
            print("✓ 同名不同内容批次测试通过")


def run_self_check():
    print("=" * 60)
    print("批量授权回收服务 - 自检脚本")
    print("=" * 60)
    print()
    
    try:
        pytest.main([__file__, "-v", "--tb=short"])
        print()
        print("=" * 60)
        print("✓ 所有自检用例通过！")
        print("=" * 60)
    except Exception as e:
        print(f"✗ 自检失败: {e}")


if __name__ == "__main__":
    run_self_check()

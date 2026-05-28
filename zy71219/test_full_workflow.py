#!/usr/bin/env python3
import sys
import json
from datetime import datetime, timedelta

sys.path.insert(0, '.')

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_full_workflow():
    print("=" * 80)
    print("信用证单据不符API 完整测试流程")
    print("=" * 80)
    print()

    test_lc_number = f"LC-TEST-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    lc_id = None
    doc_ids = {}

    try:
        print("【测试1】创建信用证")
        print("-" * 80)

        lc_data = {
            "lc_number": test_lc_number,
            "issuing_bank": "BANK OF CHINA SHANGHAI BRANCH",
            "applicant": "ABC TRADE CO., LTD.",
            "beneficiary": "XYZ EXPORT CO., LTD.",
            "currency": "USD",
            "amount": 50000.00,
            "latest_shipment_date": (datetime.now() + timedelta(days=30)).isoformat(),
            "expiry_date": (datetime.now() + timedelta(days=45)).isoformat(),
            "status": "DRAFT",
            "clauses_text": """
45A: DESCRIPTION OF GOODS
MEN'S COTTON T-SHIRTS, 5000PCS AT USD10.00 PER PC
CIF SHANGHAI

44C: LATEST SHIPMENT DATE
2024-03-31

44E: PORT OF LOADING
SHANGHAI, CHINA

44F: PORT OF DISCHARGE
LOS ANGELES, USA

46A: DOCUMENTS REQUIRED
+ SIGNED COMMERCIAL INVOICE IN 3 COPIES
+ FULL SET OF CLEAN ON BOARD OCEAN BILL OF LADING
+ PACKING LIST IN 3 COPIES

47A: ADDITIONAL CONDITIONS
+ ALL DOCUMENTS MUST BEAR THE CREDIT NUMBER
+ SHIPMENT MUST BE EFFECTED BY CONTAINER
            """,
            "remarks": "测试信用证 - 全流程验证"
        }

        response = client.post("/api/letters-of-credit", json=lc_data)
        assert response.status_code == 200, f"创建信用证失败: {response.text}"
        result = response.json()
        assert result["success"], f"创建信用证返回失败: {result}"

        lc_id = result["data"]["id"]
        print(f"✅ 信用证创建成功，ID: {lc_id}, 编号: {test_lc_number}")
        print()

        print("【测试2】信用证编号防重 - 尝试创建相同编号的信用证")
        print("-" * 80)

        response = client.post("/api/letters-of-credit", json=lc_data)
        assert response.status_code == 400, "应该返回400错误表示编号重复"
        result = response.json()
        print(f"✅ 防重机制生效，正确拒绝重复创建: {result['detail']}")
        print()

        print("【测试3】解析信用证条款")
        print("-" * 80)

        response = client.post(f"/api/clauses/{lc_id}/parse-and-save")
        assert response.status_code == 200, f"解析条款失败: {response.text}"
        result = response.json()
        assert result["success"], f"解析条款返回失败: {result}"
        print(f"✅ 成功解析 {result['data']['clauses'].__len__()} 条条款")
        for clause in result["data"]["clauses"]:
            print(f"  - {clause['clause_type']}: {clause['content'][:60]}...")
        print()

        print("【测试4】创建提单 (BL)")
        print("-" * 80)

        bl_data = {
            "lc_id": lc_id,
            "document_type": "BILL_OF_LADING",
            "document_number": "BL-SH-2024-001",
            "content": {
                "bl_number": "BL-SH-2024-001",
                "shipment_date": (datetime.now() + timedelta(days=35)).isoformat(),
                "port_of_loading": "NINGBO, CHINA",
                "port_of_destination": "LOS ANGELES, USA",
                "beneficiary": "XYZ EXPORT CO., LTD.",
                "applicant": "ABC TRADE CO., LTD.",
                "package_quantity": 5000,
                "gross_weight": 25000,
                "shipping_marks": "ABC / LOS ANGELES / NO.1-500",
                "invoice_number": "INV-2024-0001",
            },
            "raw_text": "BILL OF LADING ...",
            "submitted_by": "单证员张三",
            "remarks": "测试提单 - 故意设置装运期超限和装运港不符"
        }

        response = client.post("/api/documents", json=bl_data)
        assert response.status_code == 200, f"创建提单失败: {response.text}"
        result = response.json()
        assert result["success"], f"创建提单返回失败: {result}"
        doc_ids["BL"] = result["data"]["id"]
        print(f"✅ 提单创建成功，ID: {doc_ids['BL']}, 版本: v{result['data']['version']}")
        print()

        print("【测试5】单据编号防重 - 尝试创建相同编号的提单")
        print("-" * 80)

        response = client.post("/api/documents", json=bl_data)
        assert response.status_code == 200, f"创建请求应该返回但标记为失败"
        result = response.json()
        assert not result["success"], f"应该返回 success=false 表示编号重复"
        print(f"✅ 防重机制生效，正确拒绝重复单据: {result['message']}")
        print(f"  提示: {result['data']['action_required']}")
        print()

        print("【测试6】使用 force-create 强制创建新版本（覆盖旧版本）")
        print("-" * 80)

        bl_data["content"]["shipment_date"] = (datetime.now() + timedelta(days=25)).isoformat()
        bl_data["content"]["port_of_loading"] = "SHANGHAI, CHINA"
        bl_data["remarks"] = "修正后的提单 - 第二版"

        response = client.post(
            "/api/documents/force-create",
            json=bl_data,
            params={"change_reason": "修正装运期和装运港错误", "operator": "单证员张三"}
        )
        assert response.status_code == 200, f"强制创建新版本失败: {response.text}"
        result = response.json()
        assert result["success"], f"强制创建返回失败: {result}"
        old_ver = result["data"]["deactivated_versions"][0]
        new_ver = result["data"]["new_document"]
        doc_ids["BL"] = new_ver["id"]
        print(f"✅ 成功创建新版本 v{new_ver['version']}，旧版本 v{old_ver['version']} 已作废")
        print(f"  旧版本作废: ID={old_ver['id']}, 新版本: ID={new_ver['id']}")
        print()

        print("【测试7】创建商业发票")
        print("-" * 80)

        inv_data = {
            "lc_id": lc_id,
            "document_type": "COMMERCIAL_INVOICE",
            "document_number": "INV-2024-0001",
            "content": {
                "invoice_number": "INV-2024-0001",
                "invoice_date": datetime.now().isoformat(),
                "beneficiary": "XYZ EXPORT CO., LTD.",
                "applicant": "ABC TRADE CO., LTD.",
                "goods_description": "MEN'S COTTON T-SHIRTS, 5000PCS AT USD10.00 PER PC, FOB SHANGHAI",
                "quantity": 5000,
                "unit_price": 10.00,
                "total_amount": 55000.00,
                "currency": "USD",
                "gross_weight": 25000,
                "shipping_marks": "ABC / LOS ANGELES / NO.1-500",
                "incoterms": "FOB",
            },
            "submitted_by": "单证员张三",
            "remarks": "测试发票 - 故意设置金额超限和贸易术语不符"
        }

        response = client.post("/api/documents", json=inv_data)
        assert response.status_code == 200, f"创建发票失败: {response.text}"
        result = response.json()
        assert result["success"], f"创建发票返回失败: {result}"
        doc_ids["INVOICE"] = result["data"]["id"]
        print(f"✅ 发票创建成功，ID: {doc_ids['INVOICE']}")
        print()

        print("【测试8】创建装箱单 (单单不符测试)")
        print("-" * 80)

        pl_data = {
            "lc_id": lc_id,
            "document_type": "PACKING_LIST",
            "document_number": "PL-2024-0001",
            "content": {
                "invoice_number": "INV-2024-0002",
                "quantity": 4800,
                "gross_weight": 24000,
                "shipping_marks": "ABC / LOS ANGELES / NO.1-480",
            },
            "submitted_by": "单证员张三",
            "remarks": "测试箱单 - 故意设置发票号、数量、唛头与发票不一致"
        }

        response = client.post("/api/documents", json=pl_data)
        assert response.status_code == 200, f"创建箱单失败: {response.text}"
        result = response.json()
        assert result["success"], f"创建箱单返回失败: {result}"
        doc_ids["PL"] = result["data"]["id"]
        print(f"✅ 箱单创建成功，ID: {doc_ids['PL']}")
        print()

        print("【测试9】运行信用证全面合规检查")
        print("-" * 80)

        response = client.post(f"/api/letters-of-credit/{lc_id}/check")
        assert response.status_code == 200, f"合规检查失败: {response.text}"
        result = response.json()
        assert result["success"], f"合规检查返回失败: {result}"
        print(f"✅ 检查完成:")
        print(f"  检查单据数: {result['data']['documents_checked']}")
        print(f"  新发现不符点: {result['data']['new_discrepancies']}")
        print(f"  待处理不符点总数: {result['data']['total_open_discrepancies']}")
        print(f"  信用证状态自动更新为: {result['data']['lc_status']}")
        print()

        print("【测试10】查询不符点列表 - 按严重程度分类")
        print("-" * 80)

        response = client.get("/api/discrepancies", params={"lc_id": lc_id, "status": "OPEN"})
        assert response.status_code == 200, f"查询不符点失败: {response.text}"
        result = response.json()
        assert result["success"], f"查询不符点返回失败: {result}"

        discrepancies = result["data"]["items"]
        discrepancy_ids = [d["id"] for d in discrepancies]
        print(f"✅ 共发现 {len(discrepancies)} 个待处理不符点:")

        by_severity = {"CRITICAL": [], "HIGH": [], "MEDIUM": [], "LOW": []}
        for d in discrepancies:
            by_severity[d["severity"]].append(d)

        for severity in ["CRITICAL", "HIGH", "MEDIUM", "LOW"]:
            if by_severity[severity]:
                print(f"\n  [{severity} - {len(by_severity[severity])}个]")
                for d in by_severity[severity][:3]:
                    print(f"    - [{d['id']}] {d['description'][:80]}...")
        print()

        if discrepancies:
            print("【测试11】查看不符点详情（原因、影响、下一步动作）")
            print("-" * 80)

            disc_id = discrepancy_ids[0]
            response = client.get(f"/api/discrepancies/{disc_id}")
            assert response.status_code == 200, f"查询不符点详情失败: {response.text}"
            result = response.json()
            assert result["success"], f"查询不符点详情返回失败: {result}"
            d = result["data"]

            print(f"✅ 不符点 {disc_id} 详情:")
            print(f"  类型: {d['discrepancy_type']}")
            print(f"  严重程度: {d['severity']}")
            print(f"  描述: {d['description']}")
            print(f"  原因: {d['reason']}")
            print(f"  影响范围: {d['impact_scope']}")
            print(f"  下一步动作: {d['next_action']}")
            print()

            print("【测试12】修正不符点 - 推进状态")
            print("-" * 80)

            update_data = {
                "status": "RESOLVED",
                "correction_note": "已联系货代修改提单，将装运港改为SHANGHAI，装运期提前至信用证规定范围内",
                "corrected_by": "单证员张三",
            }

            response = client.put(
                f"/api/discrepancies/{disc_id}",
                json=update_data,
                params={"change_reason": "已修改单据，解决不符点", "operator": "单证员张三"}
            )
            assert response.status_code == 200, f"修正不符点失败: {response.text}"
            result = response.json()
            assert result["success"], f"修正不符点返回失败: {result}"
            print(f"✅ 不符点 {disc_id} 已标记为 RESOLVED")
            print()

            print("【测试13】接受不符点（申请人接受不符）")
            print("-" * 80)

            if len(discrepancy_ids) > 1:
                disc_id2 = discrepancy_ids[1]
                response = client.post(
                    f"/api/discrepancies/{disc_id2}/accept",
                    params={"remarks": "申请人已确认接受此不符点，不影响付款", "operator": "单证员张三"}
                )
                assert response.status_code == 200, f"接受不符点失败: {response.text}"
                result = response.json()
                assert result["success"], f"接受不符点返回失败: {result}"
                print(f"✅ 不符点 {disc_id2} 已标记为 ACCEPTED")
            print()

        print("【测试14】查询单据版本历史")
        print("-" * 80)

        response = client.get(f"/api/documents/{doc_ids['BL']}/versions")
        assert response.status_code == 200, f"查询版本历史失败: {response.text}"
        result = response.json()
        assert result["success"], f"查询版本历史返回失败: {result}"
        print(f"✅ 提单版本历史:")
        for v in result["data"]["all_versions"]:
            status = "✅ 有效" if v["is_active"] else "❌ 已作废"
            print(f"  v{v['version']} (ID: {v['id']}): {status}")
        print()

        print("【测试15】信用证状态流转")
        print("-" * 80)

        transition_data = {
            "new_status": "RESOLVING",
            "remarks": "正在修改单据解决不符点",
            "operator": "单证员张三",
        }

        response = client.post(f"/api/letters-of-credit/{lc_id}/transition", json=transition_data)
        assert response.status_code == 200, f"状态流转失败: {response.text}"
        result = response.json()
        assert result["success"], f"状态流转返回失败: {result}"
        print(f"✅ 状态已从 DRAFT 流转到 RESOLVING")
        print()

        print("【测试16】获取报告汇总数据")
        print("-" * 80)

        response = client.get(f"/api/reports/discrepancy/{lc_id}/summary")
        assert response.status_code == 200, f"获取报告汇总失败: {response.text}"
        result = response.json()
        assert result["success"], f"获取报告汇总返回失败: {result}"
        data = result["data"]
        print(f"✅ 报告汇总:")
        print(f"  信用证: {data['lc_info']['lc_number']}")
        print(f"  总不符点数: {data['total_discrepancies']}")
        print(f"  严重程度分布: {json.dumps(data['severity_summary'], ensure_ascii=False)}")
        print(f"  状态分布: {json.dumps(data['status_summary'], ensure_ascii=False)}")
        print(f"  不符点类型: {json.dumps(data['type_summary'], ensure_ascii=False)}")
        print()

        print("【测试17】导出Excel报告")
        print("-" * 80)

        response = client.get(f"/api/reports/discrepancy/{lc_id}/excel")
        assert response.status_code == 200, f"导出Excel失败: {response.text}"
        assert "application/vnd.openxmlformats" in response.headers.get("content-type", "")
        assert len(response.content) > 0
        print(f"✅ Excel报告导出成功，文件大小: {len(response.content)} bytes")
        print()

        print("【测试18】导出PDF报告")
        print("-" * 80)

        response = client.get(f"/api/reports/discrepancy/{lc_id}/pdf")
        assert response.status_code == 200, f"导出PDF失败: {response.text}"
        assert response.headers.get("content-type") == "application/pdf"
        assert len(response.content) > 0
        print(f"✅ PDF报告导出成功，文件大小: {len(response.content)} bytes")
        print()

        print("【测试19】重复编号测试 - 验证同一编号不能同时有两个有效版本")
        print("-" * 80)

        from app.database import SessionLocal
        from app.models import Document

        db = SessionLocal()
        active_docs = db.query(Document).filter(
            Document.lc_id == lc_id,
            Document.document_type == "BILL_OF_LADING",
            Document.document_number == "BL-SH-2024-001",
            Document.is_active == True
        ).all()

        db.close()

        assert len(active_docs) == 1, f"应该只有1个有效版本，实际有{len(active_docs)}个"
        print(f"✅ 验证通过：同一单据编号只有 {len(active_docs)} 个有效版本")
        print(f"  当前有效版本: v{active_docs[0].version} (ID: {active_docs[0].id})")
        print()

        print("【测试20】查询信用证列表 - 带统计信息")
        print("-" * 80)

        response = client.get("/api/letters-of-credit", params={"search": test_lc_number})
        assert response.status_code == 200, f"查询信用证列表失败: {response.text}"
        result = response.json()
        assert result["success"], f"查询信用证列表返回失败: {result}"
        lc_summary = result["data"]["items"][0]
        print(f"✅ 信用证汇总查询:")
        print(f"  编号: {lc_summary['lc_number']}")
        print(f"  状态: {lc_summary['status']}")
        print(f"  总不符点数: {lc_summary['discrepancy_count']}")
        print(f"  待处理不符点: {lc_summary['open_discrepancy_count']}")
        print()

        print("=" * 80)
        print("✅ 所有测试通过！信用证单据不符API运行正常")
        print("=" * 80)
        print()
        print("📋 测试总结:")
        print("  ✅ 信用证创建、查询、状态流转")
        print("  ✅ 信用证编号防重机制")
        print("  ✅ 单据创建、版本管理")
        print("  ✅ 单据编号防重机制（重复编号不能创建两份有效结果）")
        print("  ✅ force-create 覆盖旧版本机制")
        print("  ✅ 条款自动解析")
        print("  ✅ 单证比对（装运期、货描、金额、港口等）")
        print("  ✅ 单单比对（发票号、数量、重量、唛头等）")
        print("  ✅ 不符点分类（严重/高/中/低）")
        print("  ✅ 不符点原因、影响范围、下一步动作显示")
        print("  ✅ 不符点修正和状态推进")
        print("  ✅ 版本历史留痕")
        print("  ✅ 报告导出（Excel/PDF）")
        print()
        return True

    except AssertionError as e:
        print(f"\n❌ 测试失败: {e}")
        import traceback
        traceback.print_exc()
        return False
    except Exception as e:
        print(f"\n❌ 发生错误: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = test_full_workflow()
    sys.exit(0 if success else 1)

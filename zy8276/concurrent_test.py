#!/usr/bin/env python3
"""
并发下单测试脚本
模拟 20 个用户并发下单，测试库存扣减的并发安全性和幂等性
"""

import asyncio
import aiohttp
import json
import time
import uuid
from typing import List, Dict, Any
from collections import Counter

BASE_URL = "http://localhost:8000"


class ConcurrentTester:
    def __init__(self, base_url: str = BASE_URL):
        self.base_url = base_url
        self.results: List[Dict[str, Any]] = []
        self.successful_orders = []
        self.failed_orders = []
        self.idempotent_duplicates = []

    async def create_order(
        self,
        session: aiohttp.ClientSession,
        user_id: str,
        sku: str,
        quantity: int,
        idempotency_key: str
    ) -> Dict[str, Any]:
        """创建订单（预占库存）"""
        url = f"{self.base_url}/api/orders/"
        payload = {
            "user_id": user_id,
            "sku": sku,
            "quantity": quantity,
            "idempotency_key": idempotency_key
        }
        
        start_time = time.time()
        try:
            async with session.post(url, json=payload) as response:
                end_time = time.time()
                response_data = await response.json()
                result = {
                    "user_id": user_id,
                    "idempotency_key": idempotency_key,
                    "status_code": response.status,
                    "response": response_data,
                    "duration": end_time - start_time,
                    "success": response.status == 201
                }
                return result
        except Exception as e:
            end_time = time.time()
            return {
                "user_id": user_id,
                "idempotency_key": idempotency_key,
                "status_code": 0,
                "response": {"detail": str(e)},
                "duration": end_time - start_time,
                "success": False
            }

    async def get_product(self, session: aiohttp.ClientSession, sku: str) -> Dict[str, Any]:
        """获取商品信息"""
        url = f"{self.base_url}/api/products/{sku}"
        async with session.get(url) as response:
            return await response.json()

    async def get_audit_report(self, session: aiohttp.ClientSession) -> Dict[str, Any]:
        """获取审计报告"""
        url = f"{self.base_url}/api/audit/report/json"
        async with session.get(url) as response:
            return await response.json()

    async def run_concurrent_orders(
        self,
        sku: str,
        num_requests: int = 20,
        quantity_per_order: int = 1,
        use_unique_idempotency_keys: bool = True
    ):
        """运行并发下单测试"""
        print(f"\n{'='*60}")
        print(f"并发下单测试")
        print(f"{'='*60}")
        print(f"商品 SKU: {sku}")
        print(f"并发请求数: {num_requests}")
        print(f"每单购买数量: {quantity_per_order}")
        print(f"幂等键策略: {'每个请求唯一' if use_unique_idempotency_keys else '所有请求相同'}")
        print(f"{'='*60}\n")

        async with aiohttp.ClientSession() as session:
            print("[1] 获取初始商品库存...")
            initial_product = await self.get_product(session, sku)
            print(f"    商品: {initial_product['name']}")
            print(f"    总库存: {initial_product['total_stock']}")
            print(f"    可用库存: {initial_product['available_stock']}")
            print(f"    冻结库存: {initial_product['frozen_stock']}")
            print(f"    已售库存: {initial_product['sold_stock']}")

            print(f"\n[2] 准备 {num_requests} 个并发请求...")
            tasks = []
            
            for i in range(num_requests):
                user_id = f"user_{i+1:02d}"
                if use_unique_idempotency_keys:
                    idempotency_key = f"CONCURRENT_{uuid.uuid4().hex[:12]}"
                else:
                    idempotency_key = "CONCURRENT_SAME_KEY_TEST"
                
                task = self.create_order(
                    session=session,
                    user_id=user_id,
                    sku=sku,
                    quantity=quantity_per_order,
                    idempotency_key=idempotency_key
                )
                tasks.append(task)

            print(f"[3] 开始并发执行...")
            start_time = time.time()
            
            results = await asyncio.gather(*tasks)
            
            end_time = time.time()
            total_duration = end_time - start_time
            
            print(f"[4] 执行完成，耗时: {total_duration:.2f} 秒")

            self.results = results
            self._analyze_results(initial_product)

            print(f"\n[5] 获取最终商品库存...")
            final_product = await self.get_product(session, sku)
            print(f"    可用库存: {final_product['available_stock']}")
            print(f"    冻结库存: {final_product['frozen_stock']}")
            print(f"    已售库存: {final_product['sold_stock']}")

            print(f"\n[6] 验证库存一致性...")
            total_after = final_product['available_stock'] + final_product['frozen_stock'] + final_product['sold_stock']
            if total_after == final_product['total_stock']:
                print(f"    ✅ 库存一致: {final_product['available_stock']} + {final_product['frozen_stock']} + {final_product['sold_stock']} = {total_after} = {final_product['total_stock']}")
            else:
                print(f"    ❌ 库存不一致: {final_product['available_stock']} + {final_product['frozen_stock']} + {final_product['sold_stock']} = {total_after} != {final_product['total_stock']}")

            print(f"\n[7] 检查是否超卖...")
            if final_product['available_stock'] >= 0 and final_product['frozen_stock'] >= 0 and final_product['sold_stock'] >= 0:
                print(f"    ✅ 所有库存字段均为非负数，无超卖")
            else:
                print(f"    ❌ 检测到负数库存，存在超卖问题！")

            print(f"\n[8] 导出审计报告...")
            audit_report = await self.get_audit_report(session)
            print(f"    总订单数: {audit_report['total_orders']}")
            print(f"    待支付: {audit_report['pending_orders']}")
            print(f"    已支付: {audit_report['paid_orders']}")
            print(f"    已取消: {audit_report['cancelled_orders']}")
            print(f"    库存平衡: {'✅ 是' if audit_report['summary']['all_balanced'] else '❌ 否'}")

    def _analyze_results(self, initial_product: Dict[str, Any]):
        """分析测试结果"""
        print(f"\n{'='*60}")
        print(f"测试结果分析")
        print(f"{'='*60}")

        success_count = sum(1 for r in self.results if r['success'])
        fail_count = len(self.results) - success_count
        
        print(f"\n请求统计:")
        print(f"  总请求数: {len(self.results)}")
        print(f"  成功: {success_count}")
        print(f"  失败: {fail_count}")

        if fail_count > 0:
            print(f"\n失败原因统计:")
            fail_reasons = Counter()
            for r in self.results:
                if not r['success']:
                    detail = r['response'].get('detail', 'Unknown')
                    fail_reasons[detail] += 1
            
            for reason, count in fail_reasons.most_common():
                print(f"  - {reason}: {count} 次")

        print(f"\n响应时间统计:")
        durations = [r['duration'] for r in self.results]
        if durations:
            print(f"  平均: {sum(durations)/len(durations):.3f} 秒")
            print(f"  最快: {min(durations):.3f} 秒")
            print(f"  最慢: {max(durations):.3f} 秒")

        successful_orders = [r for r in self.results if r['success']]
        order_nos = [r['response'].get('order_no') for r in successful_orders]
        unique_order_nos = set(order_nos)
        
        print(f"\n订单分析:")
        print(f"  成功订单数: {len(successful_orders)}")
        print(f"  唯一订单号: {len(unique_order_nos)}")
        
        if len(order_nos) != len(unique_order_nos):
            print(f"  ⚠️  检测到重复订单号，可能是幂等性机制生效")
        else:
            print(f"  ✅ 所有订单号唯一")

        print(f"\n预期最大成功订单数: {initial_product['available_stock']}")
        if success_count <= initial_product['available_stock']:
            print(f"✅ 实际成功订单数 ({success_count}) 未超过可用库存 ({initial_product['available_stock']})")
        else:
            print(f"❌ 实际成功订单数 ({success_count}) 超过了可用库存 ({initial_product['available_stock']})，存在超卖！")


async def main():
    print("="*60)
    print("库存扣减服务 - 并发测试工具")
    print("="*60)
    
    tester = ConcurrentTester()
    
    print("\n【测试场景 1】20 个并发请求，每个请求唯一幂等键")
    print("-"*60)
    await tester.run_concurrent_orders(
        sku="SKU001",
        num_requests=20,
        quantity_per_order=1,
        use_unique_idempotency_keys=True
    )
    
    print("\n" + "="*60)
    print("【测试场景 2】幂等性测试 - 20 个并发请求使用相同幂等键")
    print("-"*60)
    print("预期结果：只有 1 个请求成功，其余请求返回相同订单")
    print("="*60)
    
    tester2 = ConcurrentTester()
    await tester2.run_concurrent_orders(
        sku="SKU002",
        num_requests=20,
        quantity_per_order=1,
        use_unique_idempotency_keys=False
    )
    
    print("\n" + "="*60)
    print("测试完成！")
    print("="*60)


if __name__ == "__main__":
    asyncio.run(main())

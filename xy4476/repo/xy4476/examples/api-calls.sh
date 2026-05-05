#!/bin/bash

# 播客广告排期API服务接口用例
# 前提：服务已在 http://localhost:3000 运行

BASE_URL="http://localhost:3000"

echo "=== 播客广告排期API服务测试用例 ==="
echo ""

# 1. 健康检查
echo "1. 健康检查"
curl -s "$BASE_URL/api/health" | json
echo ""

# 2. 获取API根目录信息
echo "2. API根目录信息"
curl -s "$BASE_URL/" | json
echo ""

# 3. 创建新赞助商
echo "3. 创建新赞助商"
curl -s -X POST "$BASE_URL/api/sponsors" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "蔚来汽车",
    "category": "汽车",
    "website": "https://nio.com",
    "contact_person": "陈经理",
    "phone": "13900139001",
    "email": "chen@nio.com"
  }' | json
echo ""

# 4. 获取所有赞助商
echo "4. 获取所有赞助商"
curl -s "$BASE_URL/api/sponsors" | json
echo ""

# 5. 创建新节目期数
echo "5. 创建新节目期数"
curl -s -X POST "$BASE_URL/api/episodes" \
  -H "Content-Type: application/json" \
  -d '{
    "episode_number": 6,
    "title": "电动汽车的未来",
    "description": "探讨电动汽车行业的发展趋势",
    "publish_date": "2026-02-05",
    "recording_date": "2026-02-01",
    "status": "planned",
    "inventory": 3
  }' | json
echo ""

# 6. 获取所有节目期数
echo "6. 获取所有节目期数"
curl -s "$BASE_URL/api/episodes" | json
echo ""

# 7. 导入广告合同（示例）
echo "7. 导入广告合同"
curl -s -X POST "$BASE_URL/api/contracts/import" \
  -H "Content-Type: application/json" \
  -d '{
    "contract_number": "CT-2026-TEST-001",
    "sponsor": "蔚来汽车",
    "category": "汽车",
    "total_slots": 4,
    "used_slots": 0,
    "start_date": "2026-02-01",
    "end_date": "2026-04-30",
    "exclusivity_category": "汽车",
    "max_frequency": 2,
    "makegood_allowed": 1,
    "episodes": [6]
  }' | json
echo ""

# 8. 获取所有合同
echo "8. 获取所有合同"
curl -s "$BASE_URL/api/contracts" | json
echo ""

# 9. 检查冲突（模拟冲突检查）
echo "9. 检查冲突"
# 假设我们要检查赞助商ID 1（元气森林）在节目期数 2 中是否有冲突
curl -s "$BASE_URL/api/check-conflicts?sponsor_id=1&category=饮料&episode_ids=2" | json
echo ""

# 10. 创建广告档期（带冲突检查）
echo "10. 创建广告档期"
curl -s -X POST "$BASE_URL/api/ad-slots" \
  -H "Content-Type: application/json" \
  -d '{
    "sponsor_id": 1,
    "episode_id": 3,
    "slot_type": "pre-roll",
    "position": 1,
    "contract_id": "CT-2026-001",
    "is_broadcast": 0,
    "is_fulfilled": 0
  }' | json
echo ""

# 11. 获取所有广告档期
echo "11. 获取所有广告档期"
curl -s "$BASE_URL/api/ad-slots" | json
echo ""

# 12. 生成风险报告（JSON格式）
echo "12. 生成风险报告（JSON格式）"
curl -s "$BASE_URL/api/reports/risk/json" | json
echo ""

# 13. 下载风险报告（Markdown格式）
echo "13. 下载风险报告（Markdown格式）"
curl -s -o risk-report.md "$BASE_URL/api/reports/risk"
echo "报告已保存到 risk-report.md"
echo ""

echo "=== 测试用例执行完成 ==="
echo ""
echo "提示：如果没有 json 命令，可以用 python3 -m json.tool 替代"
echo "例如：curl -s $BASE_URL/api/health | python3 -m json.tool"

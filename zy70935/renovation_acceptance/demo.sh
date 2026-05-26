#!/bin/bash
set -e
BASE=http://127.0.0.1:8000

echo "=== 1. 创建带照片的水电批次 ==="
curl -s -X POST $BASE/batches -H 'Content-Type: application/json' -d '{
  "project_name":"阳光花园 1 号楼 201","supervisor":"张监理","node":"hydro_electric",
  "photos":["http://img/a/1.jpg","http://img/a/2.jpg"],
  "items":[{"item":"水管压力测试","required":true,"remark":"1.2MPa 保压 30min"},
           {"item":"电路绝缘电阻","required":true,"remark":"≥ 0.5MΩ"}],
  "extra":{"施工方":"佳华装饰"}
}' | python3 -m json.tool

echo "=== 2. 去重提交同一批 ==="
curl -s -X POST $BASE/batches -H 'Content-Type: application/json' -d '{
  "project_name":"阳光花园 1 号楼 201","supervisor":"张监理","node":"hydro_electric",
  "photos":["http://img/a/1.jpg","http://img/a/2.jpg"],
  "items":[{"item":"水管压力测试","required":true,"remark":"1.2MPa 保压 30min"},
           {"item":"电路绝缘电阻","required":true,"remark":"≥ 0.5MΩ"}],
  "extra":{"施工方":"佳华装饰"}
}' | python3 -m json.tool

echo "=== 3. 等 worker 处理，查询批次 ==="
sleep 3
curl -s $BASE/batches | python3 -m json.tool

echo "=== 4. 人工确认为通过 ==="
curl -s -X POST $BASE/batches/1/confirm -H 'Content-Type: application/json' \
  -d '{"operator":"李总监","conclusion":"passed","reason":"现场抽检合格"}' | python3 -m json.tool

echo "=== 5. 标记返工（触发 rework_count）==="
curl -s -X POST $BASE/batches/1/rework -H 'Content-Type: application/json' \
  -d '{"operator":"李总监","reason":"水压测试未达标，需返工"}' | python3 -m json.tool

echo "=== 6. 再次确认为通过 ==="
curl -s -X POST $BASE/batches/1/confirm -H 'Content-Type: application/json' \
  -d '{"operator":"李总监","conclusion":"passed","reason":"返工后复测合格"}' | python3 -m json.tool

echo "=== 7. 导出报告 ==="
curl -s -X POST $BASE/batches/1/export -H 'Content-Type: application/json' \
  -d '{"operator":"系统导出员"}' | python3 -m json.tool

echo "=== 8. 下载报告 ==="
curl -s -o /tmp/report.csv $BASE/batches/1/report
cat /tmp/report.csv

echo ""
echo "=== 9. 审计日志 ==="
curl -s $BASE/audits | python3 -m json.tool

echo "=== 10. 返工统计 ==="
curl -s $BASE/rework-stats | python3 -m json.tool

echo "=== 11. 原始回溯 ==="
curl -s $BASE/raw/1 | python3 -m json.tool

echo "=== 12. 照片缺失场景（应返回 pending_evidence）==="
curl -s -X POST $BASE/batches -H 'Content-Type: application/json' -d '{
  "project_name":"阳光花园 1 号楼 201","supervisor":"张监理","node":"masonry_carpentry",
  "photos":[],
  "items":[{"item":"墙砖空鼓率","required":true,"remark":"< 5%"}]
}' | python3 -m json.tool
sleep 3
curl -s $BASE/batches | python3 -m json.tool

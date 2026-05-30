#!/bin/bash

BASE_URL="http://localhost:5000/api"

echo "=========================================="
echo "跑步配速分段分析后端 API 测试脚本"
echo "=========================================="
echo ""

echo "=== 1. 健康检查 ==="
curl -s "$BASE_URL/health" | python3 -m json.tool
echo ""

echo "=== 2. 创建运动员 ==="
curl -s -X POST "$BASE_URL/athletes" \
  -H "Content-Type: application/json" \
  -d '{"name": "张三", "gender": "男", "age": 35, "weight": 70, "max_hr": 185}' | python3 -m json.tool
echo ""

echo "=== 3. 查询所有运动员 ==="
curl -s "$BASE_URL/athletes" | python3 -m json.tool
echo ""

echo "=== 4. 导入正常跑步数据 ==="
curl -s -X POST "$BASE_URL/runs/import" \
  -F "athlete_name=张三" \
  -F "title=日常训练-正常跑" \
  -F "file=@sample_data/good_run.csv" | python3 -m json.tool
echo ""

echo "=== 5. 导入有问题的跑步数据（关键错误样例） ==="
echo "这个数据包含：轨迹断点、坡度单位错误、配速崩盘、心率漂移"
curl -s -X POST "$BASE_URL/runs/import" \
  -F "athlete_name=张三" \
  -F "title=比赛数据-有问题" \
  -F "file=@sample_data/problematic_run.csv" | python3 -m json.tool
echo ""

echo "=== 6. 导入半程马拉松数据（半程后崩盘） ==="
curl -s -X POST "$BASE_URL/runs/import" \
  -F "athlete_name=张三" \
  -F "title=半程马拉松-后半程撞墙" \
  -F "file=@sample_data/half_marathon_collapse.csv" | python3 -m json.tool
echo ""

echo "=== 7. 查询所有跑步记录 ==="
curl -s "$BASE_URL/runs" | python3 -m json.tool
echo ""

echo "=== 8. 分析第1条跑步记录 ==="
RUN_ID=1
curl -s -X POST "$BASE_URL/runs/$RUN_ID/analyze" | python3 -m json.tool
echo ""

echo "=== 9. 分析第2条跑步记录（有问题的） ==="
RUN_ID=2
curl -s -X POST "$BASE_URL/runs/$RUN_ID/analyze" | python3 -m json.tool
echo ""

echo "=== 10. 分析第3条跑步记录（半程马拉松） ==="
RUN_ID=3
curl -s -X POST "$BASE_URL/runs/$RUN_ID/analyze" | python3 -m json.tool
echo ""

echo "=== 11. 查看第2条记录的详细信息（含分段和异常） ==="
RUN_ID=2
curl -s "$BASE_URL/runs/$RUN_ID" | python3 -m json.tool
echo ""

echo "=== 12. 查看第2条记录的异常详情 ==="
RUN_ID=2
curl -s "$BASE_URL/runs/$RUN_ID/anomalies" | python3 -m json.tool
echo ""

echo "=== 13. 查看第3条记录的异常详情（半程崩盘） ==="
RUN_ID=3
curl -s "$BASE_URL/runs/$RUN_ID/anomalies" | python3 -m json.tool
echo ""

echo "=== 14. 确认一个异常 ==="
ANOMALY_ID=1
curl -s -X POST "$BASE_URL/anomalies/$ANOMALY_ID/confirm" \
  -H "Content-Type: application/json" \
  -d '{"confirmed_by": "李教练"}' | python3 -m json.tool
echo ""

echo "=== 15. 添加教练备注 ==="
RUN_ID=2
curl -s -X PUT "$BASE_URL/runs/$RUN_ID/coach-notes" \
  -H "Content-Type: application/json" \
  -d '{"notes": "这条数据明显有问题，坡度45%明显是单位错误，应该是0.45度。另外第600米到1600米有GPS信号丢失。建议重跑或者手动修正数据。后半程配速下降严重，需要加强耐力训练。"}' | python3 -m json.tool
echo ""

echo "=== 16. 查看分析报告 ==="
RUN_ID=3
curl -s "$BASE_URL/runs/$RUN_ID/report" | python3 -m json.tool
echo ""

echo "=== 17. 查询所有异常（按类型筛选） ==="
curl -s "$BASE_URL/anomalies?type=pace_drop" | python3 -m json.tool
echo ""

echo "=== 18. 导出分析结果 ==="
RUN_ID=3
curl -s "$BASE_URL/runs/$RUN_ID/export" -o "run_${RUN_ID}_export.json"
echo "已导出到 run_${RUN_ID}_export.json"
echo ""

echo "=========================================="
echo "测试完成！"
echo "=========================================="
echo ""
echo "关键异常样例说明："
echo "1. 坡度单位错误：第5行 grade=45.0（正常应该是0-10%）"
echo "2. 轨迹断点：第7行直接从500米跳到1600米，时间间隔100秒"
echo "3. 配速崩盘：从2400米开始speed从3.5骤降到0.5"
echo "4. 心率漂移：后半程心率持续上升超过10bpm"
echo "5. 半程崩盘：21公里后配速从3.5骤降到0.5，典型'撞墙'"

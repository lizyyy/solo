#!/bin/bash
set -e
BASE="http://localhost:3002/api"

# 清理旧数据
rm -f data/wave-tank.db
# 重启后端会重新建库，这里直接用 curl 测试（当前后端已有连接，需要先重启）
# 让我们测试重启场景：导入前先初始化数据库
echo "==> 0. 初始化数据库（先验证报告接口返回空）"
echo -n "报告初始总数: "
curl -s "$BASE/report" | grep -o '"totalRecords":[0-9]*'

echo ""
echo "==> 1. 通过 HTTP 导入 test-data.csv"
curl -s -F "file=@test-data.csv;type=text/csv" "$BASE/records/import" > /tmp/import.json
echo -n "导入状态: "
cat /tmp/import.json | grep -o '"success":true\|"success":false'
IMPORTED=$(cat /tmp/import.json | grep -o '"imported":[0-9]*' | head -1 | cut -d: -f2)
MIXED=$(cat /tmp/import.json | grep -o '"mixed":[0-9]*' | head -1 | cut -d: -f2)
echo "导入条数: $IMPORTED, 其中混用待复核: $MIXED"

echo ""
echo "==> 2. 获取列表，找出 S001 混用记录"
curl -s "$BASE/records?status=mixed_unit&pageSize=5" > /tmp/list.json
ID=$(cat /tmp/list.json | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
S001_ID=$(cat /tmp/list.json | grep -o '"sensorId":"S001"[^}]*' | head -1 | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "选中 S001 混用记录 ID: $S001_ID"

echo ""
echo "==> 3. 尝试用维修师傅角色确认（应该失败）"
curl -s -X PATCH -H 'Content-Type: application/json' \
  -d '{"operatorRole":"maintenance_worker","note":"维修师傅确认"}' \
  "$BASE/records/$S001_ID/confirm" > /tmp/err.json
echo -n "维修师傅确认失败: "
cat /tmp/err.json

echo ""
echo "==> 4. 维修师傅 review：标记照片可信 + 修正值"
curl -s -X PATCH -H 'Content-Type: application/json' \
  -d '{"operatorRole":"maintenance_worker","credibility":"photo_trusted","correctedValue":298.65,"correctedUnit":"K","note":"工况照片显示用开尔文"}' \
  "$BASE/records/$S001_ID/review" > /tmp/rev.json
REV_STATUS=$(cat /tmp/rev.json | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
REV_CRE=$(cat /tmp/rev.json | grep -o '"credibility":"[^"]*"' | head -1 | cut -d'"' -f4)
REV_SRC=$(cat /tmp/rev.json | grep -o '"source":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "复核后: status=$REV_STATUS, credibility=$REV_CRE, source=$REV_SRC"

echo ""
echo "==> 5. 报告摘要同步（确认前）"
curl -s "$BASE/report" > /tmp/rpt1.json
TOTAL=$(cat /tmp/rpt1.json | grep -o '"totalRecords":[0-9]*' | cut -d: -f2)
MIXED_COUNT=$(cat /tmp/rpt1.json | grep -o '"mixedCount":[0-9]*' | cut -d: -f2)
PENDING=$(cat /tmp/rpt1.json | grep -o '"pendingCount":[0-9]*' | cut -d: -f2)
CONFIRMED=$(cat /tmp/rpt1.json | grep -o '"confirmedCount":[0-9]*' | cut -d: -f2)
ROLLED=$(cat /tmp/rpt1.json | grep -o '"rolledBackCount":[0-9]*' | cut -d: -f2)
echo "总=$TOTAL, 混用=$MIXED_COUNT, 待办=$PENDING, 确认=$CONFIRMED, 回滚=$ROLLED"

echo ""
echo "==> 6. 训练教练用 training_coach 确认（应该成功）"
curl -s -X PATCH -H 'Content-Type: application/json' \
  -d '{"operatorRole":"training_coach","note":"和工况照片一致"}' \
  "$BASE/records/$S001_ID/confirm" > /tmp/ok.json
OK_STATUS=$(cat /tmp/ok.json | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
OK_SRC=$(cat /tmp/ok.json | grep -o '"source":"[^"]*"' | head -1 | cut -d'"' -f4)
OK_CV=$(cat /tmp/ok.json | grep -o '"correctedValue":[0-9.]*' | head -1 | cut -d: -f2)
echo "确认后: status=$OK_STATUS, source=$OK_SRC, correctedValue=$OK_CV"

echo ""
echo "==> 7. 报告摘要同步（确认后）"
curl -s "$BASE/report" > /tmp/rpt2.json
TOTAL=$(cat /tmp/rpt2.json | grep -o '"totalRecords":[0-9]*' | cut -d: -f2)
MIXED_COUNT=$(cat /tmp/rpt2.json | grep -o '"mixedCount":[0-9]*' | cut -d: -f2)
CONFIRMED=$(cat /tmp/rpt2.json | grep -o '"confirmedCount":[0-9]*' | cut -d: -f2)
ROLLED=$(cat /tmp/rpt2.json | grep -o '"rolledBackCount":[0-9]*' | cut -d: -f2)
echo "总=$TOTAL, 混用=$MIXED_COUNT, 确认=$CONFIRMED, 回滚=$ROLLED"

echo ""
echo "==> 8. 兼容历史角色 coach 确认另一条"
ID2=$(cat /tmp/list.json | grep -o '"sensorId":"S001"[^}]*' | sed -n '2p' | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "第二条 S001 ID: $ID2"
curl -s -X PATCH -H 'Content-Type: application/json' \
  -d '{"operatorRole":"coach","note":"兼容历史值 coach"}' \
  "$BASE/records/$ID2/confirm" > /tmp/ok2.json
OK2_STATUS=$(cat /tmp/ok2.json | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "历史角色 coach 确认: status=$OK2_STATUS (应等于 confirmed)"

echo ""
echo "==> 9. 回滚第一条记录"
curl -s -X POST -H 'Content-Type: application/json' \
  -d '{"operatorRole":"training_coach","reason":"照片角度不对，需重拍"}' \
  "$BASE/records/$S001_ID/rollback" > /tmp/rol.json
ROL_STATUS=$(cat /tmp/rol.json | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)
ROL_SRC=$(cat /tmp/rol.json | grep -o '"source":"[^"]*"' | head -1 | cut -d'"' -f4)
ROL_CV=$(cat /tmp/rol.json | grep -o '"correctedValue":[^,]*' | head -1 | cut -d: -f2)
echo "回滚后: status=$ROL_STATUS, source=$ROL_SRC, correctedValue=$ROL_CV"

echo ""
echo "==> 10. 报告摘要（回滚后）"
curl -s "$BASE/report" > /tmp/rpt3.json
TOTAL=$(cat /tmp/rpt3.json | grep -o '"totalRecords":[0-9]*' | cut -d: -f2)
MIXED_COUNT=$(cat /tmp/rpt3.json | grep -o '"mixedCount":[0-9]*' | cut -d: -f2)
CONFIRMED=$(cat /tmp/rpt3.json | grep -o '"confirmedCount":[0-9]*' | cut -d: -f2)
ROLLED=$(cat /tmp/rpt3.json | grep -o '"rolledBackCount":[0-9]*' | cut -d: -f2)
echo "总=$TOTAL, 混用=$MIXED_COUNT, 确认=$CONFIRMED, 回滚=$ROLLED"

echo ""
echo "==> 11. 审计日志查询"
curl -s "$BASE/records/$S001_ID/audit-log" > /tmp/log.json
echo "审计日志条数: $(cat /tmp/log.json | grep -o '"action":"' | wc -l | tr -d ' ')"

echo ""
echo "==> 12. CSV 导出 (检查新列)"
curl -s "$BASE/report/export?format=csv" -o /tmp/export.csv
wc -l /tmp/export.csv
echo "头部列："
head -1 /tmp/export.csv
echo ""
echo "回滚记录的列内容 (前200字符)："
grep "$S001_ID" /tmp/export.csv | cut -c 1-200

echo ""
echo "✅ HTTP E2E 链路完成"

#!/bin/bash
set -e
cd "$(dirname "$0")/.."
rm -f data/alertdb.sqlite3

echo "=== 1) 登记宠物 ==="
python3 -m src.cli pet-add --pet-id CHAMELEON-01 --pet-name 小绿 --species 变色龙

echo "=== 2) 导入第一批疫苗照片（材料分两次凑齐）==="
echo "IMG-FIRST-BATCH" > /tmp/vaccine1.jpg
python3 -m src.cli photo-import \
  --pet-id CHAMELEON-01 \
  --photo-source-id VAX-B1 \
  --photo-path /tmp/vaccine1.jpg \
  --photo-batch 2026W23A \
  --notes "第1-2针"

echo "=== 3) 建一条温控异常提醒 ==="
python3 -m src.cli alert-import \
  --pet-id CHAMELEON-01 \
  --alert-source-id ALERT-0609 \
  --alert-time "2026-06-09 10:15" \
  --temperature-c 31.8

AID=$(python3 -c '
import sqlite3
c = sqlite3.connect("data/alertdb.sqlite3")
print(c.execute("select alert_id from temp_alerts").fetchone()[0])
')
echo "   -> alert_id = $AID"

echo "=== 4) 阿岑追加人工备注，带 source_note_id ==="
python3 -m src.cli alert-note \
  --alert-id "$AID" \
  --note "现场查看遮阳灯位置过高" \
  --author 阿岑 \
  --source-note-id NOTE-001

echo "=== 5) 阿岑把提醒状态改成 CONFIRMED ==="
python3 -m src.cli alert-status \
  --alert-id "$AID" \
  --new-status CONFIRMED \
  --reason "现场复核 31.2°C，确认为温控器偏差" \
  --author 阿岑 \
  --conclusion "调整灯罩高度，加设排风扇"

echo "=== 6) 补第二批疫苗照片（后补材料不能覆盖结论）==="
echo "IMG-SECOND-BATCH" > /tmp/vaccine2.jpg
python3 -m src.cli photo-import \
  --pet-id CHAMELEON-01 \
  --photo-source-id VAX-B2 \
  --photo-path /tmp/vaccine2.jpg \
  --photo-batch 2026W23B \
  --notes "第3针+驱虫"

echo "=== 7) 验证结论没被覆盖 + 列出提醒(含历史) ==="
python3 -m src.cli list --pet-id CHAMELEON-01 --with-history

echo ""
echo "=== 8) 导入用药记录，然后改剂量看是否触发待复核(exit 5 = E005) ==="
set +e
python3 -m src.cli med-import \
  --pet-id CHAMELEON-01 \
  --med-source-id MED-001 \
  --med-name 钙粉 \
  --dosage "1g/次" \
  --frequency "每日一次"
echo "   首次导入 exit=$?"

python3 -m src.cli med-import \
  --pet-id CHAMELEON-01 \
  --med-source-id MED-001 \
  --med-name 钙粉 \
  --dosage "3g/次" \
  --frequency "每日一次"
echo "   改剂量后 exit=$?"
set -e

echo ""
echo "=== 9) 验证状态变为 PENDING_REVIEW ==="
python3 -m src.cli list --pet-id CHAMELEON-01 --with-history \
  | grep -E "(status|PENDING|待复核|原因|剂量变更|CONFIRMED)" || true

echo ""
echo "=== 10) 试一次重复导入提醒 -- 确认不翻倍 ==="
python3 -m src.cli alert-import \
  --pet-id CHAMELEON-01 \
  --alert-source-id ALERT-0609 \
  --alert-time "2026-06-09 10:15" \
  --temperature-c 31.8

echo ""
echo "=== 11) 生成 HTML 报告 ==="
python3 -m src.cli report --pet-id CHAMELEON-01

echo ""
echo "🎉 端到端演示完成！"

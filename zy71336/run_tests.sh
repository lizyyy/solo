#!/bin/bash

set -e

echo "🎹 钢琴练琴打卡异常处理系统 - 自动化测试"
echo "=" * 70

cd "$(dirname "$0")"

echo ""
echo "📋 步骤1: 初始化测试数据..."
echo "----------------------------------------"
python3 init_test_data.py <<EOF
y
EOF

echo ""
echo "🔍 步骤2: 加载学生和音频信息..."
echo "----------------------------------------"

STUDENTS=$(python3 -c "
import json, sys
data = json.load(open('data/students.json'))
for s in data:
    print(f'{s[\"student_id\"]}')
")

STUDENT_IDS=($STUDENTS)
S0=${STUDENT_IDS[0]}
S1=${STUDENT_IDS[1]}
S2=${STUDENT_IDS[2]}
S3=${STUDENT_IDS[3]}
S4=${STUDENT_IDS[4]}

AUDIO_DIR="data/audio"
BLANK="$AUDIO_DIR/test_blank.wav"
SHORT="$AUDIO_DIR/test_short.wav"
N1="$AUDIO_DIR/test_normal1.wav"
N2="$AUDIO_DIR/test_normal2.wav"
N3="$AUDIO_DIR/test_normal3.wav"

TODAY=$(date +%Y-%m-%d)
YESTERDAY=$(python3 -c "from datetime import datetime, timedelta; print((datetime.now()-timedelta(days=1)).strftime('%Y-%m-%d'))")
TWO_DAYS_AGO=$(python3 -c "from datetime import datetime, timedelta; print((datetime.now()-timedelta(days=2)).strftime('%Y-%m-%d'))")
FIVE_DAYS_AGO=$(python3 -c "from datetime import datetime, timedelta; print((datetime.now()-timedelta(days=5)).strftime('%Y-%m-%d'))")

echo "学生ID: $S0, $S1, $S2, $S3, $S4"
echo "测试日期: $TODAY"

echo ""
echo "🧪 步骤3: 运行测试场景..."
echo "----------------------------------------"

echo ""
echo "测试1: 空白音频检测"
echo "处理: $BLANK"
python3 -m piano_checkin.cli --process "$BLANK" "$S0" --date "$TODAY"
echo "✅ 测试1完成"

echo ""
echo "测试2: 时长不足检测"
echo "处理: $SHORT"
python3 -m piano_checkin.cli --process "$SHORT" "$S1" --date "$TODAY"
echo "✅ 测试2完成"

echo ""
echo "测试3: 同日重复上传 (第1/3条)"
python3 -m piano_checkin.cli --process "$N1" "$S2" --date "$TODAY"

echo ""
echo "测试3: 同日重复上传 (第2/3条)"
python3 -m piano_checkin.cli --process "$N2" "$S2" --date "$TODAY"

echo ""
echo "测试3: 同日重复上传 (第3/3条)"
python3 -m piano_checkin.cli --process "$N3" "$S2" --date "$TODAY"

echo ""
echo "测试3: 合并重复记录"
python3 -m piano_checkin.cli --merge "$TODAY"
echo "✅ 测试3完成"

echo ""
echo "测试4: 补录超期（5天前，超期2天）"
python3 -m piano_checkin.cli --process "$N1" "$S3" --date "$TODAY" --makeup --original-date "$FIVE_DAYS_AGO" --reason "生病发烧请假"
echo "✅ 测试4完成"

echo ""
echo "测试5: 补录理由无效（仅2字）"
python3 -m piano_checkin.cli --process "$N1" "$S4" --date "$TODAY" --makeup --original-date "$TWO_DAYS_AGO" --reason "有事"
echo "✅ 测试5完成"

echo ""
echo "测试6: 补录日期与课程表不匹配"
python3 -m piano_checkin.cli --process "$N1" "$S0" --date "$TODAY" --makeup --original-date "$YESTERDAY" --reason "昨天有事请假"
echo "✅ 测试6完成"

echo ""
echo "测试7: 正常打卡（无异常）"
python3 -m piano_checkin.cli --process "$N1" "$S1" --date "$TODAY"
echo "✅ 测试7完成"

echo ""
echo "📊 步骤4: 查看所有记录..."
echo "----------------------------------------"
python3 -m piano_checkin.cli --list --date "$TODAY"

echo ""
echo "📊 步骤5: 查看异常记录..."
echo "----------------------------------------"
python3 -m piano_checkin.cli --list --date "$TODAY" --abnormal-only

echo ""
echo "📊 步骤6: 生成日报 (文本格式)..."
echo "----------------------------------------"
python3 -m piano_checkin.cli --report "$TODAY" --report-format text

echo ""
echo "📊 步骤7: 生成日报 (JSON格式)..."
echo "----------------------------------------"
python3 -m piano_checkin.cli --report "$TODAY" --report-format json

echo ""
echo "📊 步骤8: 生成日报 (CSV格式)..."
echo "----------------------------------------"
python3 -m piano_checkin.cli --report "$TODAY" --report-format csv

echo ""
echo "📊 步骤9: 生成学生报告..."
echo "----------------------------------------"
python3 -m piano_checkin.cli --student-report "$S2"

echo ""
echo "🔍 步骤10: 查看历史备份..."
echo "----------------------------------------"
ls -la data/history/ 2>/dev/null | head -20 || echo "暂无历史备份"

echo ""
echo "=" * 70
echo "🎉 所有测试完成！"
echo "=" * 70
echo ""
echo "📝 验证要点:"
echo "  1. 空白音频应该被检测到（音量<-50dB）"
echo "  2. 15秒音频应该提示时长不足（需要30秒）"
echo "  3. 3条同日记录应该合并为1条，保留质量最好的"
echo "  4. 补录超期5-3=2天，应该标记异常"
echo "  5. 理由'有事'仅2字，应该标记无效（需要5字）"
echo "  6. 补录日期应该与课程表匹配验证"
echo "  7. 正常记录应该标记为正常状态"
echo "  8. 日报应该包含所有统计和异常明细"
echo "  9. 每次保存后data/history应该有备份文件"
echo ""
echo "💡 进入交互模式: python3 -m piano_checkin.cli -i"
echo ""

#!/bin/bash
BASE=Fj4jbNvHaado6JsbEFgci9XMnJu

set -e

echo "=== 创建表: 导入日志表 ==="
IMP_TABLE_RESULT=$(lark-cli base +table-create --base-token $BASE --name "导入日志表" 2>&1)
echo "$IMP_TABLE_RESULT"
IMP_TABLE_ID=$(echo "$IMP_TABLE_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['table']['id'])" 2>/dev/null)
echo "导入日志表ID: $IMP_TABLE_ID"
sleep 0.5

CMD_IMP="lark-cli base +field-create --base-token $BASE --table-id $IMP_TABLE_ID"

echo "=== 更新导入日志表首列为导入批次号"
lark-cli base +field-update --base-token $BASE --table-id $IMP_TABLE_ID --field-id ID --json '{"name":"导入批次号","type":"auto_number","style":{"rules":[{"type":"text","text":"IMP-"},{"type":"created_time","date_format":"yyyyMMdd"},{"type":"incremental_number","length":3}]}}' --yes
sleep 0.5

echo "导入日志表字段..."
$CMD_IMP --json '{"name":"导入文件名","type":"text"}'
sleep 0.3
$CMD_IMP --json '{"name":"导入时间","type":"created_at","style":{"format":"yyyy-MM-dd HH:mm"}}'
sleep 0.3
$CMD_IMP --json '{"name":"导入总条数","type":"number","style":{"type":"plain","precision":0}}'
sleep 0.3
$CMD_IMP --json '{"name":"新增条数","type":"number","style":{"type":"plain","precision":0}}'
sleep 0.3
$CMD_IMP --json '{"name":"跳过重复条数","type":"number","style":{"type":"plain","precision":0}}'
sleep 0.3
$CMD_IMP --json '{"name":"人工备注保护条数","type":"number","style":{"type":"plain","precision":0}}'
sleep 0.3
$CMD_IMP --json '{"name":"异常条数","type":"number","style":{"type":"plain","precision":0}}'
sleep 0.3
$CMD_IMP --json '{"name":"导入人","type":"created_by"}'
sleep 0.3
$CMD_IMP --json '{"name":"导入状态","type":"select","multiple":false,"options":[{"name":"进行中","hue":"Orange","lightness":"Lighter"},{"name":"已完成","hue":"Green","lightness":"Standard"},{"name":"部分完成","hue":"Yellow","lightness":"Lighter"},{"name":"失败","hue":"Red","lightness":"Standard"}]}'
sleep 0.3
$CMD_IMP --json '{"name":"备注说明","type":"text"}'

echo ""
echo "=== 创建表: 异常记录表 ==="
EXC_TABLE_RESULT=$(lark-cli base +table-create --base-token $BASE --name "异常记录表" 2>&1)
echo "$EXC_TABLE_RESULT"
EXC_TABLE_ID=$(echo "$EXC_TABLE_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['table']['id'])" 2>/dev/null)
echo "异常记录表ID: $EXC_TABLE_ID"
sleep 0.5

CMD_EXC="lark-cli base +field-create --base-token $BASE --table-id $EXC_TABLE_ID"

echo "=== 更新异常记录表首列为异常编号"
lark-cli base +field-update --base-token $BASE --table-id $EXC_TABLE_ID --field-id ID --json '{"name":"异常编号","type":"auto_number","style":{"rules":[{"type":"text","text":"EX-"},{"type":"incremental_number","length":5}]}}' --yes
sleep 0.5

echo "异常记录表字段..."
$CMD_EXC --json '{"name":"关联报告编号","type":"text"}'
sleep 0.3
$CMD_EXC --json '{"name":"关联宠物姓名","type":"text"}'
sleep 0.3
$CMD_EXC --json '{"name":"异常类型","type":"select","multiple":false,"options":[{"name":"疫苗日期缺失","hue":"Red","lightness":"Lighter"},{"name":"微信备注冲突","hue":"Orange","lightness":"Lighter"},{"name":"字段名不一致","hue":"Yellow","lightness":"Lighter"},{"name":"数据不一致","hue":"Purple","lightness":"Lighter"},{"name":"其他异常","hue":"Gray","lightness":"Lighter"}]}'
sleep 0.3
$CMD_EXC --json '{"name":"异常描述","type":"text"}'
sleep 0.3
$CMD_EXC --json '{"name":"人工确认理由","type":"text"}'
sleep 0.3
$CMD_EXC --json '{"name":"影响范围","type":"text"}'
sleep 0.3
$CMD_EXC --json '{"name":"处理状态","type":"select","multiple":false,"options":[{"name":"待确认","hue":"Orange","lightness":"Lighter"},{"name":"已确认","hue":"Blue","lightness":"Lighter"},{"name":"已忽略","hue":"Gray","lightness":"Lighter"},{"name":"已修复","hue":"Green","lightness":"Standard"}]}'
sleep 0.3
$CMD_EXC --json '{"name":"处理人","type":"user","multiple":false}'
sleep 0.3
$CMD_EXC --json '{"name":"处理时间","type":"datetime","style":{"format":"yyyy-MM-dd HH:mm"}}'
sleep 0.3
$CMD_EXC --json '{"name":"原始字段名记录","type":"text"}'
sleep 0.3
$CMD_EXC --json '{"name":"来源材料链接","type":"text","style":{"type":"url"}}'
sleep 0.3
$CMD_EXC --json '{"name":"创建时间","type":"created_at","style":{"format":"yyyy-MM-dd HH:mm"}}'
sleep 0.3
$CMD_EXC --json '{"name":"更新时间","type":"updated_at","style":{"format":"yyyy-MM-dd HH:mm"}}'

echo ""
echo "=== 创建表: 字段别名映射表 ==="
ALIAS_TABLE_RESULT=$(lark-cli base +table-create --base-token $BASE --name "字段别名映射表" 2>&1)
echo "$ALIAS_TABLE_RESULT"
ALIAS_TABLE_ID=$(echo "$ALIAS_TABLE_RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['table']['id'])" 2>/dev/null)
echo "字段别名映射表ID: $ALIAS_TABLE_ID"
sleep 0.5

CMD_ALIAS="lark-cli base +field-create --base-token $BASE --table-id $ALIAS_TABLE_ID"

echo "=== 更新字段别名映射表首列为映射ID"
lark-cli base +field-update --base-token $BASE --table-id $ALIAS_TABLE_ID --field-id ID --json '{"name":"映射ID","type":"auto_number","style":{"rules":[{"type":"text","text":"MAP-"},{"type":"incremental_number","length":3}]}}' --yes
sleep 0.5

echo "字段别名映射表字段..."
$CMD_ALIAS --json '{"name":"标准字段名","type":"select","multiple":false,"options":[{"name":"主人微信备注","hue":"Blue","lightness":"Lighter"},{"name":"宠物姓名","hue":"Green","lightness":"Lighter"},{"name":"主人姓名","hue":"Purple","lightness":"Lighter"},{"name":"上课日期","hue":"Orange","lightness":"Lighter"},{"name":"疫苗接种日期","hue":"Red","lightness":"Lighter"},{"name":"课程名称","hue":"Carmine","lightness":"Lighter"}]}'
sleep 0.3
$CMD_ALIAS --json '{"name":"运营主管使用的别名","type":"text"}'
sleep 0.3
$CMD_ALIAS --json '{"name":"使用场景说明","type":"text"}'
sleep 0.3
$CMD_ALIAS --json '{"name":"最近使用时间","type":"updated_at","style":{"format":"yyyy-MM-dd HH:mm"}}'
sleep 0.3
$CMD_ALIAS --json '{"name":"是否启用","type":"checkbox"}'

echo ""
echo "=== 所有辅助表创建完成 ==="
echo "导入日志表ID: $IMP_TABLE_ID"
echo "异常记录表ID: $EXC_TABLE_ID"  
echo "字段别名映射表ID: $ALIAS_TABLE_ID"

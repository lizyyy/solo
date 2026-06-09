#!/bin/bash
BASE=Fj4jbNvHaado6JsbEFgci9XMnJu
MAIN=tblUcXaYYXNDsKfP
EXC=tblx2Y63lE047DWV
ALIAS=tbl6S3Xe2UyouFAh
IMP=tblLlcdq3ozZ74Ix

echo "=== 配置视图筛选: 已处理记录 = 处理状态==已处理"
lark-cli base +view-set-filter --base-token $BASE --table-id $MAIN --view-id "已处理记录" --json '{"logic":"and","conditions":[["处理状态","intersects",["已处理"]]}'
sleep 0.3

echo ""
echo "=== 配置视图筛选: 待补材料 = 处理状态==待补材料"
lark-cli base +view-set-filter --base-token $BASE --table-id $MAIN --view-id "待补材料" --json '{"logic":"and","conditions":[["处理状态","intersects",["待补材料"]]}'
sleep 0.3

echo ""
echo "=== 配置视图筛选: 人工改判 = 处理状态==人工改判"
lark-cli base +view-set-filter --base-token $BASE --table-id $MAIN --view-id "人工改判" --json '{"logic":"and","conditions":[["处理状态","intersects",["人工改判"]]}'
sleep 0.3

echo ""
echo "=== 配置视图筛选: 异常追溯 = (处理状态==异常) OR (疫苗缺失标记==缺失)"
lark-cli base +view-set-filter --base-token $BASE --table-id $MAIN --view-id "异常追溯" --json '{"logic":"or","conditions":[["处理状态","intersects",["异常"]],["疫苗缺失标记","==","缺失"]]}'
sleep 0.3

echo ""
echo "=== 异常记录表: 创建视图 ==="
lark-cli base +view-rename --base-token $BASE --table-id $EXC --view-id "Grid View" --name "全部异常"
sleep 0.3
lark-cli base +view-create --base-token $BASE --table-id $EXC --json '[
  {"name":"待确认异常","type":"grid"},
  {"name":"疫苗日期缺失","type":"grid"},
  {"name":"字段名不一致","type":"grid"}
]'
sleep 0.5

echo ""
echo "=== 配置异常表视图筛选 ==="
lark-cli base +view-set-filter --base-token $BASE --table-id $EXC --view-id "待确认异常" --json '{"logic":"and","conditions":[["处理状态","intersects",["待确认"]]}'
sleep 0.3
lark-cli base +view-set-filter --base-token $BASE --table-id $EXC --view-id "疫苗日期缺失" --json '{"logic":"and","conditions":[["异常类型","intersects",["疫苗日期缺失"]]}'
sleep 0.3
lark-cli base +view-set-filter --base-token $BASE --table-id $EXC --view-id "字段名不一致" --json '{"logic":"and","conditions":[["异常类型","intersects",["字段名不一致"]]}'
sleep 0.3

echo ""
echo "=== 字段别名映射表: 重命名默认视图并创建启用别名视图 ==="
lark-cli base +view-rename --base-token $BASE --table-id $ALIAS --view-id "Grid View" --name "全部映射"
sleep 0.3
lark-cli base +view-create --base-token $BASE --table-id $ALIAS --json '[{"name":"已启用映射","type":"grid"}]'
sleep 0.3
lark-cli base +view-set-filter --base-token $BASE --table-id $ALIAS --view-id "已启用映射" --json '{"logic":"and","conditions":[["是否启用","==",true]]}'
sleep 0.3

echo ""
echo "=== 导入日志表: 重命名默认视图 ==="
lark-cli base +view-rename --base-token $BASE --table-id $IMP --view-id "Grid View" --name "全部导入记录"
sleep 0.3

echo ""
echo "=== 所有视图配置完成 ==="

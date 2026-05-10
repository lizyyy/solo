#!/bin/bash

cd "$(dirname "$0")/.."

echo "============================================"
echo "园区访客车牌放行系统 - 演示脚本"
echo "============================================"
echo ""

if [ ! -f "data/reservations.json" ]; then
    echo "正在初始化演示数据..."
    python3 -m park_visitor_system.demo_setup
    echo ""
fi

echo "请选择要演示的场景："
echo ""
echo "  1. 正常预约入场 - 张三（京A12345）"
echo "  2. 临时换车审批 - 李四（原京B67890，换车京B00001）"
echo "  3. 超时离场 - 王五（京C11111）"
echo "  4. 黑名单拦截 - 京Z99999"
echo "  5. 重复入场测试"
echo "  6. 出场早于入场测试"
echo "  7. 查看当前数据状态"
echo "  8. 生成交班日志"
echo "  9. 生成日报表"
echo "  10. 清空所有数据重新开始"
echo ""
echo "  0. 退出"
echo ""

read -p "请输入选项 (0-10): " choice

case $choice in
    1)
        echo ""
        echo "【场景1】正常预约入场"
        echo "---------------------------------"
        echo "访客：张三"
        echo "车牌：京A12345"
        echo "预约时间：09:00 - 18:00"
        echo ""
        echo "第一步：检查车辆能否入场"
        python3 -m park_visitor_system.cli check --plate 京A12345
        echo ""
        echo "第二步：车辆入场扫描"
        python3 -m park_visitor_system.cli entry --plate 京A12345 --operator 张保安
        echo ""
        echo "第三步：查看当前在园车辆"
        python3 -m park_visitor_system.cli list --type in-park
        ;;
    2)
        echo ""
        echo "【场景2】临时换车审批"
        echo "---------------------------------"
        echo "访客：李四"
        echo "原车牌：京B67890"
        echo "新车牌：京B00001"
        echo "原因：原车辆故障，换车来访"
        echo ""
        echo "第一步：访客提出换车申请"
        python3 -m park_visitor_system.cli request-plate-change \
            --original-plate 京B67890 \
            --new-plate 京B00001 \
            --reason "原车辆故障，换车来访"
        echo ""
        echo "第二步：尝试用新车牌入场（应被拦截，因为还未审批）"
        python3 -m park_visitor_system.cli check --plate 京B00001
        echo ""
        echo "第三步：审批车牌变更申请"
        echo "（实际操作中需要先查看申请编号，此处为演示已获取编号）"
        request_id=$(ls -t data/plate_changes.json 2>/dev/null && python3 -c "
import json
with open('data/plate_changes.json') as f:
    data = json.load(f)
    if data:
        print(list(data.keys())[-1])
    else:
        print('')
")
        if [ -n "$request_id" ]; then
            python3 -m park_visitor_system.cli approve-plate-change $request_id
        else
            echo "请先执行第一步申请换车"
        fi
        echo ""
        echo "第四步：再次检查新车牌能否入场"
        python3 -m park_visitor_system.cli check --plate 京B00001
        echo ""
        echo "第五步：新车牌入场"
        python3 -m park_visitor_system.cli entry --plate 京B00001 --operator 李保安
        ;;
    3)
        echo ""
        echo "【场景3】超时离场"
        echo "---------------------------------"
        echo "访客：王五"
        echo "车牌：京C11111"
        echo "预约时间：14:00 - 16:00"
        echo "模拟离场时间：17:30（超时1.5小时）"
        echo ""
        echo "第一步：车辆入场"
        python3 -m park_visitor_system.cli entry --plate 京C11111 --operator 王保安 --time "$(date +%Y-%m-%d) 14:30"
        echo ""
        echo "第二步：模拟17:30离场（超时1.5小时）"
        python3 -m park_visitor_system.cli exit --plate 京C11111 --operator 王保安 --time "$(date +%Y-%m-%d) 17:30"
        ;;
    4)
        echo ""
        echo "【场景4】黑名单拦截"
        echo "---------------------------------"
        echo "车牌：京Z99999"
        echo "黑名单原因：上次来访时损坏园区设施"
        echo ""
        echo "第一步：检查黑名单车辆能否入场"
        python3 -m park_visitor_system.cli check --plate 京Z99999
        echo ""
        echo "第二步：黑名单车辆尝试入场"
        python3 -m park_visitor_system.cli entry --plate 京Z99999 --operator 赵保安
        ;;
    5)
        echo ""
        echo "【场景5】重复入场测试"
        echo "---------------------------------"
        echo "先让京A12345入场，然后再次尝试入场"
        echo ""
        echo "第一步：第一次入场"
        python3 -m park_visitor_system.cli entry --plate 京A12345 --operator 测试员
        echo ""
        echo "第二步：第二次入场（应被拦截）"
        python3 -m park_visitor_system.cli entry --plate 京A12345 --operator 测试员
        ;;
    6)
        echo ""
        echo "【场景6】出场早于入场测试"
        echo "---------------------------------"
        echo "测试未入场的车辆直接出场"
        echo ""
        echo "尝试让未入场的车牌（京D22222）出场"
        python3 -m park_visitor_system.cli exit --plate 京D22222 --operator 测试员
        ;;
    7)
        echo ""
        echo "【当前数据状态】"
        echo "---------------------------------"
        echo ""
        echo "1. 访客预约列表："
        python3 -m park_visitor_system.cli list --type reservations
        echo ""
        echo "2. 黑名单列表："
        python3 -m park_visitor_system.cli list --type blacklist
        echo ""
        echo "3. 当前在园车辆："
        python3 -m park_visitor_system.cli list --type in-park
        echo ""
        echo "4. 事件记录："
        python3 -m park_visitor_system.cli list --type events
        ;;
    8)
        echo ""
        echo "【生成交班日志】"
        echo "---------------------------------"
        today=$(date +%Y-%m-%d)
        python3 -m park_visitor_system.cli shift-log \
            --start-time "$today 08:00" \
            --end-time "$today 20:00" \
            --operator "张保安" \
            --output "data/shift_log_$today.json"
        ;;
    9)
        echo ""
        echo "【生成日报表】"
        echo "---------------------------------"
        today=$(date +%Y-%m-%d)
        python3 -m park_visitor_system.cli daily-report \
            --date "$today" \
            --output "data/daily_report_$today.json"
        ;;
    10)
        echo ""
        read -p "确定要清空所有数据吗？(y/N): " confirm
        if [[ $confirm == [yY] ]]; then
            rm -rf data/
            echo "数据已清空！"
            echo "重新初始化演示数据..."
            python3 -m park_visitor_system.demo_setup
        else
            echo "操作已取消"
        fi
        ;;
    0)
        echo "再见！"
        exit 0
        ;;
    *)
        echo "无效选项"
        ;;
esac

echo ""
echo "============================================"
echo "演示完成！"
echo "============================================"

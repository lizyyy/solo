#!/bin/bash

BASE_URL="http://localhost:8000"

echo "社区食堂配餐管理系统 - curl命令示例"
echo "=========================================="

echo -e "\n1. 导入老人档案CSV"
echo "curl -X POST -F 'file=@test_elderly.csv' $BASE_URL/api/elderly/import-csv"

echo -e "\n2. 查看所有老人列表"
echo "curl $BASE_URL/api/elderly"

echo -e "\n3. 创建菜单"
echo 'curl -X POST -H "Content-Type: application/json" -d '\''{"name":"无糖小米粥","meal_type":"早餐","date":"2024-01-15","ingredients":["小米","水"],"is_sugar_free":true,"allergens":[]}'\'' '$BASE_URL/api/menu

echo -e "\n4. 查看当日菜单"
echo "curl $BASE_URL/api/menu?meal_date=2024-01-15"

echo -e "\n5. 创建配餐订单"
echo "curl -X POST '$BASE_URL/api/meal-order?request_id=req001&elderly_id=老人ID&menu_item_id=菜单ID'"

echo -e "\n6. 改餐"
echo "curl -X POST '$BASE_URL/api/meal-order/change?request_id=change001&order_id=订单ID&new_menu_item_id=新菜单ID&change_reason=改餐原因'"

echo -e "\n7. 查看订单改餐历史"
echo "curl $BASE_URL/api/meal-order/订单ID/changes"

echo -e "\n8. 创建配送记录"
echo "curl -X POST '$BASE_URL/api/delivery?request_id=delivery001&order_id=订单ID'"

echo -e "\n9. 更新配送状态"
echo "curl -X PUT '$BASE_URL/api/delivery/配送ID/status?status=已送达&notes=已签收'"

echo -e "\n10. 按路线查看配送"
echo "curl '$BASE_URL/api/delivery?route=路线A'"

echo -e "\n11. 创建回访记录"
echo "curl -X POST '$BASE_URL/api/follow-up?request_id=follow001&order_id=订单ID&satisfaction=5&feedback=非常满意'"

echo -e "\n12. 查看回访记录"
echo "curl $BASE_URL/api/follow-up"

echo -e "\n=========================================="
echo "使用方法：先启动服务 python main.py"
echo "然后运行完整流程测试：python test_flow.py"

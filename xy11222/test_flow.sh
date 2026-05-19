#!/bin/bash
set -e

echo "=== 门店品控系统测试流程 ==="
echo ""

echo "1. 检查服务是否启动..."
curl -s http://localhost:8000/ | python3 -m json.tool
echo ""

echo "2. 登记留样 - 宫保鸡丁..."
curl -s -X POST http://localhost:8000/api/samples/ \
  -H "Content-Type: application/json" \
  -d '{
    "dish_name": "宫保鸡丁",
    "dish_code": "KC001",
    "sample_time": "'"$(date -u +"%Y-%m-%dT%H:%M:%S")"'",
    "sample_quantity": "200g",
    "keeper": "张三",
    "storage_location": "A柜01层",
    "retention_hours": 48
  }' | python3 -m json.tool
echo ""

echo "3. 重复提交 - 幂等性验证..."
curl -s -X POST http://localhost:8000/api/samples/ \
  -H "Content-Type: application/json" \
  -d '{
    "dish_name": "宫保鸡丁",
    "dish_code": "KC001",
    "sample_time": "'"$(date -u +"%Y-%m-%dT%H:%M:%S")"'",
    "sample_quantity": "200g",
    "keeper": "张三",
    "storage_location": "A柜01层",
    "retention_hours": 48
  }' | python3 -m json.tool
echo ""

echo "4. 登记留样 - 鱼香肉丝..."
curl -s -X POST http://localhost:8000/api/samples/ \
  -H "Content-Type: application/json" \
  -d '{
    "dish_name": "鱼香肉丝",
    "dish_code": "KC002",
    "sample_time": "'"$(date -u -v-2H +"%Y-%m-%dT%H:%M:%S")"'",
    "sample_quantity": "150g",
    "keeper": "李四",
    "storage_location": "A柜02层",
    "retention_hours": 48
  }' | python3 -m json.tool
echo ""

echo "5. 记录冰箱温度..."
curl -s -X POST http://localhost:8000/api/temperatures/ \
  -H "Content-Type: application/json" \
  -d '{
    "fridge_code": "FRIDGE001",
    "fridge_name": "冷藏柜A",
    "measure_time": "'"$(date -u +"%Y-%m-%dT%H:%M:%S")"'",
    "temperature": 4.5,
    "min_temperature": 0,
    "max_temperature": 8,
    "recorder": "张三"
  }' | python3 -m json.tool
echo ""

echo "6. 记录异常温度..."
curl -s -X POST http://localhost:8000/api/temperatures/ \
  -H "Content-Type: application/json" \
  -d '{
    "fridge_code": "FRIDGE002",
    "fridge_name": "冷藏柜B",
    "measure_time": "'"$(date -u +"%Y-%m-%dT%H:%M:%S")"'",
    "temperature": 12.5,
    "min_temperature": 0,
    "max_temperature": 8,
    "recorder": "李四",
    "remark": "设备故障报修中"
  }' | python3 -m json.tool
echo ""

echo "7. 记录废弃..."
curl -s -X POST http://localhost:8000/api/wastes/ \
  -H "Content-Type: application/json" \
  -d '{
    "dish_name": "过期蔬菜",
    "dish_code": "W001",
    "waste_time": "'"$(date -u +"%Y-%m-%dT%H:%M:%S")"'",
    "waste_quantity": "5kg",
    "waste_reason": "过期变质",
    "handler": "王五"
  }' | python3 -m json.tool
echo ""

echo "8. 查看即将到期留样..."
curl -s http://localhost:8000/api/samples/expiring-soon/?hours=48 | python3 -m json.tool
echo ""

echo "9. 抽检留样 (ID=1)..."
curl -s -X POST http://localhost:8000/api/samples/inspect/ \
  -H "Content-Type: application/json" \
  -d '{
    "sample_id": 1,
    "inspector": "品控员A",
    "inspection_result": "合格，无异常"
  }' | python3 -m json.tool
echo ""

echo "10. 销毁留样 (ID=1)..."
curl -s -X POST http://localhost:8000/api/samples/destroy/ \
  -H "Content-Type: application/json" \
  -d '{
    "sample_id": 1,
    "destroyer": "李四"
  }' | python3 -m json.tool
echo ""

echo "11. 查看留样历史记录..."
curl -s http://localhost:8000/api/samples/1/history | python3 -m json.tool
echo ""

echo "12. 查看所有留样..."
curl -s http://localhost:8000/api/samples/ | python3 -m json.tool
echo ""

echo "13. 查看异常温度记录..."
curl -s "http://localhost:8000/api/temperatures/?abnormal_only=true" | python3 -m json.tool
echo ""

echo "14. 查看废弃记录..."
curl -s http://localhost:8000/api/wastes/ | python3 -m json.tool
echo ""

echo "15. 生成日报表..."
curl -s http://localhost:8000/api/report/daily/ | python3 -m json.tool
echo ""

echo "=== 测试流程完成 ==="
echo ""
echo "提示: 重启服务后再次运行此脚本，验证幂等性和数据持久化"

#!/bin/bash
BASE_URL=http://localhost:3000

echo "======================================"
echo "  装修材料采购比价 API 演示脚本"
echo "======================================"
echo ""

echo "=== 1. 创建项目 ==="
PROJECT=$(curl -s -X POST $BASE_URL/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name":"阳光花园1号楼装修","description":"全屋装修项目"}')
echo $PROJECT
PROJECT_ID=$(echo $PROJECT | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "项目ID: $PROJECT_ID"
echo ""

echo "=== 2. 创建供应商 ==="
SUPPLIER_A=$(curl -s -X POST $BASE_URL/api/suppliers \
  -H "Content-Type: application/json" \
  -d '{"name":"东鹏瓷砖","contact":"张经理 13800000001"}')
SUPPLIER_A_ID=$(echo $SUPPLIER_A | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "供应商A (东鹏瓷砖) ID: $SUPPLIER_A_ID"

SUPPLIER_B=$(curl -s -X POST $BASE_URL/api/suppliers \
  -H "Content-Type: application/json" \
  -d '{"name":"马可波罗瓷砖","contact":"李经理 13800000002"}')
SUPPLIER_B_ID=$(echo $SUPPLIER_B | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "供应商B (马可波罗瓷砖) ID: $SUPPLIER_B_ID"

SUPPLIER_C=$(curl -s -X POST $BASE_URL/api/suppliers \
  -H "Content-Type: application/json" \
  -d '{"name":"兔宝宝板材","contact":"王经理 13800000003"}')
SUPPLIER_C_ID=$(echo $SUPPLIER_C | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "供应商C (兔宝宝板材) ID: $SUPPLIER_C_ID"

SUPPLIER_D=$(curl -s -X POST $BASE_URL/api/suppliers \
  -H "Content-Type: application/json" \
  -d '{"name":"海蒂诗五金","contact":"赵经理 13800000004"}')
SUPPLIER_D_ID=$(echo $SUPPLIER_D | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "供应商D (海蒂诗五金) ID: $SUPPLIER_D_ID"

SUPPLIER_E=$(curl -s -X POST $BASE_URL/api/suppliers \
  -H "Content-Type: application/json" \
  -d '{"name":"DTC五金","contact":"刘经理 13800000005"}')
SUPPLIER_E_ID=$(echo $SUPPLIER_E | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "供应商E (DTC五金) ID: $SUPPLIER_E_ID"
echo ""

echo "=== 3. 获取材料分类 ==="
CATS=$(curl -s $BASE_URL/api/categories)
TILE_CAT_ID=$(echo $CATS | python3 -c "import sys,json; cats=json.load(sys.stdin); print([c['id'] for c in cats if c['name']=='瓷砖'][0])")
BOARD_CAT_ID=$(echo $CATS | python3 -c "import sys,json; cats=json.load(sys.stdin); print([c['id'] for c in cats if c['name']=='板材'][0])")
HARDWARE_CAT_ID=$(echo $CATS | python3 -c "import sys,json; cats=json.load(sys.stdin); print([c['id'] for c in cats if c['name']=='五金'][0])")
echo "瓷砖分类ID: $TILE_CAT_ID"
echo "板材分类ID: $BOARD_CAT_ID"
echo "五金分类ID: $HARDWARE_CAT_ID"
echo ""

echo "=== 4. 创建项目材料清单 ==="

echo "--- 材料1: 瓷砖 (按片为单位) ---"
TILE=$(curl -s -X POST $BASE_URL/api/materials \
  -H "Content-Type: application/json" \
  -d "{
    \"project_id\": $PROJECT_ID,
    \"category_id\": $TILE_CAT_ID,
    \"name\": \"客厅地砖\",
    \"spec\": \"600x600mm 通体砖\",
    \"unit\": \"片\",
    \"quantity\": 200,
    \"budget_unit_price\": 45,
    \"delivery_deadline\": \"2026-06-01\"
  }")
echo $TILE
TILE_ID=$(echo $TILE | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "瓷砖材料ID: $TILE_ID"
echo ""

echo "--- 材料2: 板材 ---"
BOARD=$(curl -s -X POST $BASE_URL/api/materials \
  -H "Content-Type: application/json" \
  -d "{
    \"project_id\": $PROJECT_ID,
    \"category_id\": $BOARD_CAT_ID,
    \"name\": \"衣柜柜体板\",
    \"spec\": \"18mm E0级 生态板\",
    \"unit\": \"张\",
    \"quantity\": 50,
    \"budget_unit_price\": 280,
    \"delivery_deadline\": \"2026-05-25\"
  }")
echo $BOARD
BOARD_ID=$(echo $BOARD | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "板材材料ID: $BOARD_ID"
echo ""

echo "--- 材料3: 五金 ---"
HARDWARE=$(curl -s -X POST $BASE_URL/api/materials \
  -H "Content-Type: application/json" \
  -d "{
    \"project_id\": $PROJECT_ID,
    \"category_id\": $HARDWARE_CAT_ID,
    \"name\": \"柜门铰链\",
    \"spec\": \"液压阻尼 冷轧钢\",
    \"unit\": \"个\",
    \"quantity\": 100,
    \"budget_unit_price\": 12,
    \"delivery_deadline\": \"2026-05-30\"
  }")
echo $HARDWARE
HARDWARE_ID=$(echo $HARDWARE | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "五金材料ID: $HARDWARE_ID"
echo ""

echo "=== 5. 导入供应商报价 (演示核心场景) ==="

echo "--- 场景A: 瓷砖 - 按片报价 + 含税率 ---"
echo "供应商A: 42元/片, 含税9%"
Q1=$(curl -s -X POST $BASE_URL/api/quotes \
  -H "Content-Type: application/json" \
  -d "{
    \"material_item_id\": $TILE_ID,
    \"supplier_id\": $SUPPLIER_A_ID,
    \"quote_date\": \"2026-05-10\",
    \"unit_price\": 42,
    \"unit\": \"片\",
    \"tax_rate\": 0.09,
    \"delivery_days\": 7,
    \"spec\": \"600x600mm 通体砖\",
    \"brand\": \"东鹏\"
  }")
echo $Q1
echo ""

echo "--- 场景A: 瓷砖 - 按箱报价(演示单位换算) ---"
echo "供应商B: 320元/箱(8片), 含税13%"
Q2=$(curl -s -X POST $BASE_URL/api/quotes \
  -H "Content-Type: application/json" \
  -d "{
    \"material_item_id\": $TILE_ID,
    \"supplier_id\": $SUPPLIER_B_ID,
    \"quote_date\": \"2026-05-10\",
    \"unit_price\": 320,
    \"unit\": \"箱\",
    \"tax_rate\": 0.13,
    \"delivery_days\": 10,
    \"spec\": \"600x600mm 通体砖\",
    \"brand\": \"马可波罗\"
  }")
echo $Q2
echo ""

echo "--- 场景B: 板材 - 厚度差异(演示替代品) ---"
echo "供应商C(标准18mm): 270元/张"
Q3=$(curl -s -X POST $BASE_URL/api/quotes \
  -H "Content-Type: application/json" \
  -d "{
    \"material_item_id\": $BOARD_ID,
    \"supplier_id\": $SUPPLIER_C_ID,
    \"quote_date\": \"2026-05-10\",
    \"unit_price\": 270,
    \"unit\": \"张\",
    \"tax_rate\": 0.13,
    \"delivery_days\": 5,
    \"spec\": \"18mm E0级 生态板\",
    \"brand\": \"兔宝宝\"
  }")
echo $Q3
echo ""

echo "供应商C(替代16mm, 便宜): 230元/张, 标记为替代品"
Q4=$(curl -s -X POST $BASE_URL/api/quotes \
  -H "Content-Type: application/json" \
  -d "{
    \"material_item_id\": $BOARD_ID,
    \"supplier_id\": $SUPPLIER_C_ID,
    \"quote_date\": \"2026-05-10\",
    \"unit_price\": 230,
    \"unit\": \"张\",
    \"tax_rate\": 0.13,
    \"delivery_days\": 5,
    \"spec\": \"16mm E0级 生态板\",
    \"brand\": \"兔宝宝\",
    \"is_alternative\": true,
    \"note\": \"厚度稍薄, 但价格优惠, 非承重部位可使用\"
  }")
echo $Q4
Q4_ID=$(echo $Q4 | python3 -c "import sys,json; print(json.load(sys.stdin)['quote']['id'])")
echo "替代报价ID: $Q4_ID"
echo ""

echo "--- 场景C: 五金 - 缺税率(演示风险检测) ---"
echo "供应商D(含税率13%): 11元/个"
Q5=$(curl -s -X POST $BASE_URL/api/quotes \
  -H "Content-Type: application/json" \
  -d "{
    \"material_item_id\": $HARDWARE_ID,
    \"supplier_id\": $SUPPLIER_D_ID,
    \"quote_date\": \"2026-05-10\",
    \"unit_price\": 11,
    \"unit\": \"个\",
    \"tax_rate\": 0.13,
    \"delivery_days\": 3,
    \"spec\": \"液压阻尼 冷轧钢\",
    \"brand\": \"海蒂诗\"
  }")
echo $Q5
echo ""

echo "供应商E(缺税率): 9.5元/个"
Q6=$(curl -s -X POST $BASE_URL/api/quotes \
  -H "Content-Type: application/json" \
  -d "{
    \"material_item_id\": $HARDWARE_ID,
    \"supplier_id\": $SUPPLIER_E_ID,
    \"quote_date\": \"2026-05-10\",
    \"unit_price\": 9.5,
    \"unit\": \"个\",
    \"delivery_days\": 3,
    \"spec\": \"液压阻尼 冷轧钢\",
    \"brand\": \"DTC\"
  }")
echo $Q6
echo ""

echo "--- 场景D: 送货周期超节点 ---"
echo "供应商B(瓷砖, 30天交货, 超过项目节点)"
Q7=$(curl -s -X POST $BASE_URL/api/quotes \
  -H "Content-Type: application/json" \
  -d "{
    \"material_item_id\": $TILE_ID,
    \"supplier_id\": $SUPPLIER_B_ID,
    \"quote_date\": \"2026-05-10\",
    \"unit_price\": 38,
    \"unit\": \"片\",
    \"tax_rate\": 0.13,
    \"delivery_days\": 30,
    \"spec\": \"600x600mm 通体砖\",
    \"brand\": \"马可波罗\",
    \"note\": \"特价促销, 但需要备货\"
  }")
echo $Q7
echo ""

echo "--- 场景E: 同一供应商重复报价 (演示唯一约束) ---"
echo "尝试重复提交供应商A的相同报价..."
DUPLICATE=$(curl -s -w "\\nHTTP_CODE:%{http_code}" -X POST $BASE_URL/api/quotes \
  -H "Content-Type: application/json" \
  -d "{
    \"material_item_id\": $TILE_ID,
    \"supplier_id\": $SUPPLIER_A_ID,
    \"quote_date\": \"2026-05-10\",
    \"unit_price\": 45,
    \"unit\": \"片\",
    \"tax_rate\": 0.09,
    \"delivery_days\": 7,
    \"spec\": \"600x600mm 通体砖\",
    \"brand\": \"东鹏\"
  }")
echo $DUPLICATE
echo ""

echo "=== 6. 选择供应商 ==="

echo "--- 选择瓷砖供应商 (按归一后价格推荐) ---"
SEL1=$(curl -s -X POST $BASE_URL/api/selections \
  -H "Content-Type: application/json" \
  -d "{
    \"material_item_id\": $TILE_ID,
    \"quote_id\": 1,
    \"selected_by\": \"张工\"
  }")
echo $SEL1
echo ""

echo "--- 选择板材替代品 (触发审批流程) ---"
SEL2=$(curl -s -X POST $BASE_URL/api/selections \
  -H "Content-Type: application/json" \
  -d "{
    \"material_item_id\": $BOARD_ID,
    \"quote_id\": $Q4_ID,
    \"selected_by\": \"张工\"
  }")
echo $SEL2
SEL2_ID=$(echo $SEL2 | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
echo "选择ID(待审批): $SEL2_ID"
echo ""

echo "=== 7. 审批流程 ==="

echo "--- 审批板材替代品 ---"
APV=$(curl -s -X POST $BASE_URL/api/selections/$SEL2_ID/approve \
  -H "Content-Type: application/json" \
  -d "{
    \"approved_by\": \"李总\",
    \"approval_note\": \"同意使用16mm板材, 仅限衣柜隔板使用\"
  }")
echo $APV
echo ""

echo "=== 8. 查询比价结果 ==="
echo "GET /api/projects/$PROJECT_ID/comparison"
echo ""
curl -s $BASE_URL/api/projects/$PROJECT_ID/comparison | python3 -m json.tool
echo ""

echo "======================================"
echo "  演示完成！"
echo "======================================"

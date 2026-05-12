#!/bin/bash

BASE_URL="http://localhost:3000"

echo "========================================"
echo "  旅行社签证材料 API - 完整流程示例"
echo "========================================"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

wait_for_service() {
    echo "等待服务启动..."
    for i in {1..30}; do
        if curl -s "$BASE_URL/health" > /dev/null 2>&1; then
            echo -e "${GREEN}服务已就绪！${NC}"
            return 0
        fi
        sleep 1
    done
    echo -e "${RED}服务启动超时，请先运行 npm run dev${NC}"
    exit 1
}

wait_for_service

echo ""
echo "========================================"
echo "  第 1 步：初始化基础数据"
echo "========================================"
echo ""

echo -e "${YELLOW}1.1 创建国家 - 日本${NC}"
COUNTRY_RES=$(curl -s -X POST "$BASE_URL/api/countries" \
  -H "Content-Type: application/json" \
  -d '{"name":"日本","code":"JP"}')
echo "$COUNTRY_RES" | jq . 2>/dev/null || echo "$COUNTRY_RES"
COUNTRY_ID=$(echo "$COUNTRY_RES" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo "国家ID: $COUNTRY_ID"
echo ""

echo -e "${YELLOW}1.2 创建材料类型${NC}"
MT1_RES=$(curl -s -X POST "$BASE_URL/api/material-types" \
  -H "Content-Type: application/json" \
  -d "{\"country_id\":\"$COUNTRY_ID\",\"name\":\"护照原件\",\"required\":true,\"validity_days\":180}")
echo "护照原件:"
echo "$MT1_RES" | jq . 2>/dev/null || echo "$MT1_RES"
MT1_ID=$(echo "$MT1_RES" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo ""

MT2_RES=$(curl -s -X POST "$BASE_URL/api/material-types" \
  -H "Content-Type: application/json" \
  -d "{\"country_id\":\"$COUNTRY_ID\",\"name\":\"2寸白底照片\",\"required\":true}")
echo "2寸白底照片:"
echo "$MT2_RES" | jq . 2>/dev/null || echo "$MT2_RES"
MT2_ID=$(echo "$MT2_RES" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo ""

MT3_RES=$(curl -s -X POST "$BASE_URL/api/material-types" \
  -H "Content-Type: application/json" \
  -d "{\"country_id\":\"$COUNTRY_ID\",\"name\":\"在职证明\",\"required\":true}")
echo "在职证明:"
echo "$MT3_RES" | jq . 2>/dev/null || echo "$MT3_RES"
MT3_ID=$(echo "$MT3_RES" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo ""

echo -e "${YELLOW}1.3 创建游客 - 张三${NC}"
TOURIST_RES=$(curl -s -X POST "$BASE_URL/api/tourists" \
  -H "Content-Type: application/json" \
  -d '{"name":"张三","passport_number":"E12345678","phone":"13800138000"}')
echo "$TOURIST_RES" | jq . 2>/dev/null || echo "$TOURIST_RES"
TOURIST_ID=$(echo "$TOURIST_RES" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo "游客ID: $TOURIST_ID"
echo ""

read -p "按回车继续..."

echo ""
echo "========================================"
echo "  第 2 步：创建签证申请并上传材料"
echo "========================================"
echo ""

echo -e "${YELLOW}2.1 创建签证申请${NC}"
APP_RES=$(curl -s -X POST "$BASE_URL/api/applications" \
  -H "Content-Type: application/json" \
  -d "{\"tourist_id\":\"$TOURIST_ID\",\"country_id\":\"$COUNTRY_ID\"}")
echo "$APP_RES" | jq . 2>/dev/null || echo "$APP_RES"
APP_ID=$(echo "$APP_RES" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo "申请ID: $APP_ID"
echo ""

echo -e "${YELLOW}2.2 查看初始缺失材料${NC}"
curl -s "$BASE_URL/api/applications/$APP_ID/missing-materials" | jq . 2>/dev/null || curl -s "$BASE_URL/api/applications/$APP_ID/missing-materials"
echo ""

echo -e "${YELLOW}2.3 上传护照${NC}"
M1_RES=$(curl -s -X POST "$BASE_URL/api/applications/$APP_ID/materials" \
  -H "Content-Type: application/json" \
  -d "{\"type_id\":\"$MT1_ID\",\"file_url\":\"/files/passport.pdf\",\"remark\":\"护照扫描件\"}")
echo "$M1_RES" | jq . 2>/dev/null || echo "$M1_RES"
M1_ID=$(echo "$M1_RES" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo ""

echo -e "${YELLOW}2.4 上传照片${NC}"
M2_RES=$(curl -s -X POST "$BASE_URL/api/applications/$APP_ID/materials" \
  -H "Content-Type: application/json" \
  -d "{\"type_id\":\"$MT2_ID\",\"file_url\":\"/files/photo.jpg\",\"remark\":\"白底照片\"}")
echo "$M2_RES" | jq . 2>/dev/null || echo "$M2_RES"
M2_ID=$(echo "$M2_RES" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo ""

echo -e "${YELLOW}2.5 查看现在的缺失材料（还差在职证明）${NC}"
curl -s "$BASE_URL/api/applications/$APP_ID/missing-materials" | jq . 2>/dev/null || curl -s "$BASE_URL/api/applications/$APP_ID/missing-materials"
echo ""

echo -e "${YELLOW}2.6 尝试提交申请（应该失败，因为材料不齐）${NC}"
curl -s -X POST "$BASE_URL/api/applications/$APP_ID/submit" \
  -H "Content-Type: application/json" \
  -d '{"operator":"签证专员"}' | jq . 2>/dev/null || curl -s -X POST "$BASE_URL/api/applications/$APP_ID/submit" -H "Content-Type: application/json" -d '{"operator":"签证专员"}'
echo ""

echo -e "${YELLOW}2.7 上传在职证明${NC}"
M3_RES=$(curl -s -X POST "$BASE_URL/api/applications/$APP_ID/materials" \
  -H "Content-Type: application/json" \
  -d "{\"type_id\":\"$MT3_ID\",\"file_url\":\"/files/work.pdf\",\"remark\":\"在职证明盖章版\"}")
echo "$M3_RES" | jq . 2>/dev/null || echo "$M3_RES"
M3_ID=$(echo "$M3_RES" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo ""

echo -e "${YELLOW}2.8 再次查看缺失材料（应该没有了）${NC}"
curl -s "$BASE_URL/api/applications/$APP_ID/missing-materials" | jq . 2>/dev/null || curl -s "$BASE_URL/api/applications/$APP_ID/missing-materials"
echo ""

read -p "按回车继续..."

echo ""
echo "========================================"
echo "  第 3 步：提交审核并送签"
echo "========================================"
echo ""

echo -e "${YELLOW}3.1 提交申请（材料齐全，应该成功）${NC}"
curl -s -X POST "$BASE_URL/api/applications/$APP_ID/submit" \
  -H "Content-Type: application/json" \
  -d '{"operator":"签证专员"}' | jq . 2>/dev/null || curl -s -X POST "$BASE_URL/api/applications/$APP_ID/submit" -H "Content-Type: application/json" -d '{"operator":"签证专员"}'
echo ""

echo -e "${YELLOW}3.2 开始审核${NC}"
curl -s -X POST "$BASE_URL/api/applications/$APP_ID/start-review" \
  -H "Content-Type: application/json" \
  -d '{"operator":"审核员"}' | jq . 2>/dev/null || curl -s -X POST "$BASE_URL/api/applications/$APP_ID/start-review" -H "Content-Type: application/json" -d '{"operator":"审核员"}'
echo ""

echo -e "${YELLOW}3.3 审核护照 - 通过${NC}"
curl -s -X POST "$BASE_URL/api/applications/materials/$M1_ID/review" \
  -H "Content-Type: application/json" \
  -d '{"status":"APPROVED","reviewer_note":"护照有效期满足要求"}' | jq . 2>/dev/null || echo "审核完成"
echo ""

echo -e "${YELLOW}3.4 审核照片 - 通过${NC}"
curl -s -X POST "$BASE_URL/api/applications/materials/$M2_ID/review" \
  -H "Content-Type: application/json" \
  -d '{"status":"APPROVED","reviewer_note":"照片清晰"}' | jq . 2>/dev/null || echo "审核完成"
echo ""

echo -e "${YELLOW}3.5 审核在职证明 - 通过${NC}"
curl -s -X POST "$BASE_URL/api/applications/materials/$M3_ID/review" \
  -H "Content-Type: application/json" \
  -d '{"status":"APPROVED","reviewer_note":"公章清晰，在职信息完整"}' | jq . 2>/dev/null || echo "审核完成"
echo ""

echo -e "${YELLOW}3.6 送签${NC}"
curl -s -X POST "$BASE_URL/api/applications/$APP_ID/send" \
  -H "Content-Type: application/json" \
  -d '{"operator":"送签员"}' | jq . 2>/dev/null || curl -s -X POST "$BASE_URL/api/applications/$APP_ID/send" -H "Content-Type: application/json" -d '{"operator":"送签员"}'
echo ""

read -p "按回车继续..."

echo ""
echo "========================================"
echo "  第 4 步：退回补件流程"
echo "========================================"
echo ""

echo -e "${YELLOW}4.1 领馆退回（照片规格不对）${NC}"
curl -s -X POST "$BASE_URL/api/applications/$APP_ID/return" \
  -H "Content-Type: application/json" \
  -d '{"reason":"照片规格不符合要求，需要4.5x4.5cm","operator":"签证专员"}' | jq . 2>/dev/null || curl -s -X POST "$BASE_URL/api/applications/$APP_ID/return" -H "Content-Type: application/json" -d '{"reason":"照片规格不符合要求"}'
echo ""

echo -e "${YELLOW}4.2 要求补件${NC}"
curl -s -X POST "$BASE_URL/api/applications/$APP_ID/supplement" \
  -H "Content-Type: application/json" \
  -d "{\"material_id\":\"$M2_ID\",\"reason\":\"照片尺寸不对，要求4.5x4.5cm，请重新提供\",\"operator\":\"签证专员\"}" | jq . 2>/dev/null || echo "补件要求已提交"
echo ""

echo -e "${YELLOW}4.3 查看补件请求${NC}"
curl -s "$BASE_URL/api/applications/supplement-requests?application_id=$APP_ID" | jq . 2>/dev/null || curl -s "$BASE_URL/api/applications/supplement-requests?application_id=$APP_ID"
echo ""

echo -e "${YELLOW}4.4 查看缺失材料${NC}"
curl -s "$BASE_URL/api/applications/$APP_ID/missing-materials" | jq . 2>/dev/null || curl -s "$BASE_URL/api/applications/$APP_ID/missing-materials"
echo ""

echo -e "${YELLOW}4.5 重新上传照片（自动创建版本2）${NC}"
M2V2_RES=$(curl -s -X POST "$BASE_URL/api/applications/$APP_ID/materials" \
  -H "Content-Type: application/json" \
  -d "{\"type_id\":\"$MT2_ID\",\"file_url\":\"/files/photo-v2.jpg\",\"remark\":\"重新提交的4.5x4.5cm照片\"}")
echo "$M2V2_RES" | jq . 2>/dev/null || echo "$M2V2_RES"
M2V2_ID=$(echo "$M2V2_RES" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
echo ""

echo -e "${YELLOW}4.6 查看照片的版本历史${NC}"
curl -s "$BASE_URL/api/applications/$APP_ID/materials/$MT2_ID/versions" | jq . 2>/dev/null || curl -s "$BASE_URL/api/applications/$APP_ID/materials/$MT2_ID/versions"
echo ""

echo -e "${YELLOW}4.7 再次查看缺失材料（应该没有了）${NC}"
curl -s "$BASE_URL/api/applications/$APP_ID/missing-materials" | jq . 2>/dev/null || curl -s "$BASE_URL/api/applications/$APP_ID/missing-materials"
echo ""

echo -e "${YELLOW}4.8 重新提交审核${NC}"
curl -s -X POST "$BASE_URL/api/applications/$APP_ID/submit" \
  -H "Content-Type: application/json" \
  -d '{"operator":"签证专员"}' | jq . 2>/dev/null || echo "提交成功"
echo ""

read -p "按回车继续..."

echo ""
echo "========================================"
echo "  第 5 步：查看完整历史记录"
echo "========================================"
echo ""

echo -e "${YELLOW}5.1 状态变更历史${NC}"
curl -s "$BASE_URL/api/applications/$APP_ID/history" | jq . 2>/dev/null || curl -s "$BASE_URL/api/applications/$APP_ID/history"
echo ""

echo -e "${YELLOW}5.2 最终申请状态${NC}"
curl -s "$BASE_URL/api/applications/$APP_ID" | jq . 2>/dev/null || curl -s "$BASE_URL/api/applications/$APP_ID"
echo ""

echo -e "${YELLOW}5.3 所有材料清单${NC}"
curl -s "$BASE_URL/api/applications/$APP_ID/materials" | jq . 2>/dev/null || curl -s "$BASE_URL/api/applications/$APP_ID/materials"
echo ""

echo ""
echo "========================================"
echo -e "  ${GREEN}流程演示完成！${NC}"
echo "========================================"
echo ""
echo "关键ID汇总（方便后续测试）："
echo "  国家ID:     $COUNTRY_ID"
echo "  游客ID:     $TOURIST_ID"
echo "  申请ID:     $APP_ID"
echo "  材料类型1:  $MT1_ID (护照)"
echo "  材料类型2:  $MT2_ID (照片)"
echo "  材料类型3:  $MT3_ID (在职证明)"
echo ""
echo "你可以继续测试："
echo "  - 查看游客列表: curl $BASE_URL/api/tourists"
echo "  - 查看申请列表: curl $BASE_URL/api/applications"
echo "  - 关闭申请: curl -X POST $BASE_URL/api/applications/$APP_ID/close -H 'Content-Type: application/json' -d '{\"reason\":\"出签完成\"}'"
echo ""

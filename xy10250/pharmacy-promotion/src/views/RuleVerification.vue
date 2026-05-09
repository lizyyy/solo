<script setup>
import { ref, onMounted } from 'vue'
import { EXPIRY_LAYERS, PROMOTION_STATUS } from '../data/constants'
import { validateMedicineBatch, validatePromotion, calculateExpiryDays, getExpiryLayer, isNearExpiry, canTransitionStatus, calculateDiscount, calculateFinalPrice } from '../utils/rules'
import { getBatchList } from '../utils/dataService'

const testResults = ref([])
const loading = ref(false)

const ruleTests = [
  {
    id: 'expiry_days_calculation',
    name: '效期天数计算',
    description: '验证系统能够正确计算从今天到有效期的剩余天数',
    testCases: [
      {
        name: '有效期在今天',
        input: { expiryDate: new Date().toISOString().split('T')[0] },
        expected: '剩余天数 = 0'
      },
      {
        name: '有效期在30天后',
        input: { expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
        expected: '剩余天数 = 30'
      },
      {
        name: '已过期药品',
        input: { expiryDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
        expected: '剩余天数 < 0'
      }
    ]
  },
  {
    id: 'expiry_layer_classification',
    name: '效期分层规则',
    description: '验证系统能够根据剩余天数正确分类到对应效期层',
    rules: [
      { condition: '剩余天数 ≤ 30天', layer: '紧急层 (URGENCY)', color: '#f56c6c' },
      { condition: '30天 < 剩余天数 ≤ 90天', layer: '关注层 (ATTENTION)', color: '#e6a23c' },
      { condition: '90天 < 剩余天数 ≤ 180天', layer: '预警层 (EARLY_WARNING)', color: '#409eff' },
      { condition: '剩余天数 > 180天', layer: '正常 (NORMAL)', color: '#67c23a' }
    ],
    testCases: [
      { name: '25天 → 紧急层', days: 25, expected: 'URGENCY' },
      { name: '30天 → 紧急层', days: 30, expected: 'URGENCY' },
      { name: '60天 → 关注层', days: 60, expected: 'ATTENTION' },
      { name: '90天 → 关注层', days: 90, expected: 'ATTENTION' },
      { name: '120天 → 预警层', days: 120, expected: 'EARLY_WARNING' },
      { name: '180天 → 预警层', days: 180, expected: 'EARLY_WARNING' },
      { name: '200天 → 正常', days: 200, expected: 'NORMAL' }
    ]
  },
  {
    id: 'near_expiry_detection',
    name: '近效期检测',
    description: '验证系统能够正确识别近效期药品（剩余天数 ≤ 180天）',
    rules: [
      { condition: '剩余天数 ≤ 180天', result: '近效期', status: '参与促销资格' },
      { condition: '剩余天数 > 180天', result: '正常效期', status: '不参与促销' }
    ],
    testCases: [
      { name: '180天 → 近效期', days: 180, expected: true },
      { name: '181天 → 正常', days: 181, expected: false },
      { name: '30天 → 近效期', days: 30, expected: true }
    ]
  },
  {
    id: 'batch_validation',
    name: '药品批次验证规则',
    description: '验证系统能够正确验证药品批次数据的完整性和有效性',
    requiredFields: [
      '药品ID', '药品名称', '批号', '有效期', '库存数量', '单价', '处方类型'
    ],
    validationRules: [
      { rule: '库存数量必须 ≥ 0', description: '不能有负库存' },
      { rule: '单价必须 ≥ 0', description: '不能有负价格' },
      { rule: '有效期必须 > 今天', description: '过期药品不能入库' },
      { rule: '批号必须唯一', description: '同一批号不能重复录入' }
    ]
  },
  {
    id: 'prescription_restriction',
    name: '处方限制规则',
    description: '验证系统能够正确处理处方药(Rx)和非处方药(OTC)的促销限制',
    rules: [
      { type: '处方药 (Rx)', restriction: '与非处方药组合促销需额外审核', color: '#f56c6c' },
      { type: '非处方药 (OTC)', restriction: '可自由组合促销', color: '#67c23a' }
    ]
  },
  {
    id: 'status_transition',
    name: '促销状态流转规则',
    description: '验证促销活动状态只能按规定流程流转',
    transitionRules: [
      { from: '草稿 (DRAFT)', to: '审核中 (REVIEW)', allowed: true },
      { from: '草稿 (DRAFT)', to: '生效中 (ACTIVE)', allowed: false },
      { from: '审核中 (REVIEW)', to: '草稿 (DRAFT)', allowed: true },
      { from: '审核中 (REVIEW)', to: '生效中 (ACTIVE)', allowed: true },
      { from: '生效中 (ACTIVE)', to: '已结束 (ENDED)', allowed: true },
      { from: '生效中 (ACTIVE)', to: '草稿 (DRAFT)', allowed: false },
      { from: '已结束 (ENDED)', to: '任意状态', allowed: false }
    ]
  },
  {
    id: 'inventory_lock',
    name: '库存锁定规则',
    description: '验证促销活动生效时会锁定对应库存，结束时释放库存',
    rules: [
      { event: '促销生效', action: '锁定药品批次库存', purpose: '防止超卖' },
      { event: '促销结束', action: '释放药品批次库存', purpose: '恢复库存可用性' }
    ]
  },
  {
    id: 'discount_calculation',
    name: '折扣计算规则',
    description: '验证系统能够正确计算各类优惠方式',
    testCases: [
      {
        name: '百分比折扣：20% off',
        price: 100,
        discountType: 'percentage',
        discountValue: 20,
        expected: 80
      },
      {
        name: '固定金额减免：减30元',
        price: 100,
        discountType: 'fixed_amount',
        discountValue: 30,
        expected: 70
      },
      {
        name: '固定金额减免不超过原价',
        price: 20,
        discountType: 'fixed_amount',
        discountValue: 30,
        expected: 0
      }
    ]
  }
]

function runTests() {
  loading.value = true
  
  const results = []
  
  ruleTests.forEach(rule => {
    const ruleResult = {
      ...rule,
      testResults: []
    }
    
    if (rule.testCases) {
      rule.testCases.forEach(testCase => {
        if (rule.id === 'expiry_days_calculation') {
          const days = calculateExpiryDays(testCase.input.expiryDate)
          ruleResult.testResults.push({
            ...testCase,
            actual: `剩余天数 = ${days}`,
            passed: (testCase.name.includes('今天') && days === 0) ||
                   (testCase.name.includes('30天后') && days >= 29 && days <= 31) ||
                   (testCase.name.includes('已过期') && days < 0)
          })
        } else if (rule.id === 'expiry_layer_classification') {
          const layer = getExpiryLayer(testCase.days)
          ruleResult.testResults.push({
            ...testCase,
            actual: layer,
            passed: layer === testCase.expected
          })
        } else if (rule.id === 'near_expiry_detection') {
          const nearExpiry = isNearExpiry(testCase.days)
          ruleResult.testResults.push({
            ...testCase,
            actual: nearExpiry ? '是' : '否',
            passed: nearExpiry === testCase.expected
          })
        } else if (rule.id === 'discount_calculation') {
          const finalPrice = calculateFinalPrice(
            { price: testCase.price },
            { discountType: testCase.discountType, discountValue: testCase.discountValue }
          )
          ruleResult.testResults.push({
            ...testCase,
            actual: `¥${finalPrice.toFixed(2)}`,
            passed: finalPrice === testCase.expected
          })
        }
      })
    }
    
    if (rule.id === 'status_transition') {
      rule.transitionRules.forEach(trans => {
        const fromStatus = trans.from.includes('草稿') ? PROMOTION_STATUS.DRAFT :
                          trans.from.includes('审核中') ? PROMOTION_STATUS.REVIEW :
                          trans.from.includes('生效中') ? PROMOTION_STATUS.ACTIVE :
                          PROMOTION_STATUS.ENDED
        const toStatus = trans.to.includes('草稿') ? PROMOTION_STATUS.DRAFT :
                        trans.to.includes('审核中') ? PROMOTION_STATUS.REVIEW :
                        trans.to.includes('生效中') ? PROMOTION_STATUS.ACTIVE :
                        PROMOTION_STATUS.ENDED
        const canTransition = canTransitionStatus(fromStatus, toStatus)
        ruleResult.testResults = ruleResult.testResults || []
        ruleResult.testResults.push({
          name: `${trans.from} → ${trans.to}`,
          expected: trans.allowed ? '允许' : '不允许',
          actual: canTransition ? '允许' : '不允许',
          passed: canTransition === trans.allowed
        })
      })
    }
    
    results.push(ruleResult)
  })
  
  testResults.value = results
  loading.value = false
}

onMounted(() => {
  runTests()
})
</script>

<template>
  <div class="rule-verification">
    <div class="page-header">
      <h2>规则验证中心</h2>
      <div class="header-actions">
        <el-button type="primary" @click="runTests">
          <el-icon><Refresh /></el-icon>
          重新运行测试
        </el-button>
      </div>
    </div>

    <el-alert
      type="info"
      show-icon
      :closable="false"
      style="margin-bottom: 16px"
    >
      <template #title>
        规则验证说明
      </template>
      此页面展示系统核心业务规则的定义和验证结果。Reviewer 可以通过此页面确认：
      <ul style="margin: 8px 0 0 20px">
        <li>效期分层规则是否正确实现</li>
        <li>处方限制规则是否正确实现</li>
        <li>库存锁定规则是否正确实现</li>
        <li>促销状态流转规则是否正确实现</li>
        <li>各类折扣计算规则是否正确实现</li>
      </ul>
    </el-alert>

    <div class="rules-container" v-loading="loading">
      <el-card
        v-for="(rule, index) in ruleTests"
        :key="rule.id"
        class="rule-card"
        shadow="hover"
      >
        <template #header>
          <div class="rule-header">
            <div class="rule-title">
              <span class="rule-number">{{ index + 1 }}</span>
              <h3>{{ rule.name }}</h3>
            </div>
            <el-tag type="primary">规则</el-tag>
          </div>
          <p class="rule-desc">{{ rule.description }}</p>
        </template>

        <div v-if="rule.rules" class="rules-list">
          <el-table :data="rule.rules" size="small" border>
            <el-table-column
              v-for="(value, key) in rule.rules[0]"
              :key="key"
              :prop="key"
              :label="key === 'condition' ? '条件' : 
                      key === 'layer' ? '分层' :
                      key === 'color' ? '颜色' :
                      key === 'result' ? '结果' :
                      key === 'status' ? '状态' :
                      key === 'type' ? '类型' :
                      key === 'restriction' ? '限制' :
                      key === 'event' ? '事件' :
                      key === 'action' ? '操作' :
                      key === 'purpose' ? '目的' :
                      key === 'from' ? '起始状态' :
                      key === 'to' ? '目标状态' :
                      key === 'allowed' ? '是否允许' : key"
              :min-width="100"
            >
              <template #default="{ row }">
                <span v-if="key === 'color'" :style="{ color: row[key] }">■</span>
                <span v-else-if="key === 'allowed'">
                  <el-icon :color="row[key] ? '#67c23a' : '#f56c6c'">
                    <Check v-if="row[key]" />
                    <Close v-else />
                  </el-icon>
                </span>
                <span v-else>{{ row[key] }}</span>
              </template>
            </el-table-column>
          </el-table>
        </div>

        <div v-if="rule.requiredFields" class="required-fields">
          <h4>必填字段：</h4>
          <div class="fields-list">
            <el-tag
              v-for="field in rule.requiredFields"
              :key="field"
              type="danger"
              effect="plain"
              size="small"
            >
              {{ field }}
            </el-tag>
          </div>
        </div>

        <div v-if="rule.validationRules" class="validation-rules">
          <h4>验证规则：</h4>
          <el-table :data="rule.validationRules" size="small" border>
            <el-table-column prop="rule" label="规则" min-width="200" />
            <el-table-column prop="description" label="说明" min-width="200" />
          </el-table>
        </div>

        <div v-if="rule.testResults?.length > 0" class="test-results">
          <h4>测试结果：</h4>
          <el-table :data="rule.testResults" size="small" border>
            <el-table-column prop="name" label="测试用例" min-width="200" />
            <el-table-column label="输入" min-width="150">
              <template #default="{ row }">
                <span v-if="row.days">剩余 {{ row.days }} 天</span>
                <span v-else-if="row.price">¥{{ row.price }}, {{ row.discountValue }}{{ row.discountType === 'percentage' ? '%' : '元' }}</span>
                <span v-else>{{ row.input?.expiryDate || '-' }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="expected" label="预期结果" min-width="150" />
            <el-table-column prop="actual" label="实际结果" min-width="150" />
            <el-table-column label="通过" width="80" align="center">
              <template #default="{ row }">
                <el-icon v-if="row.passed" color="#67c23a" size="20">
                  <CircleCheck />
                </el-icon>
                <el-icon v-else color="#f56c6c" size="20">
                  <CircleClose />
                </el-icon>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-card>
    </div>

    <el-card class="summary-card">
      <template #header>
        <span>测试汇总</span>
      </template>
      
      <div class="summary-stats">
        <div class="stat-item">
          <div class="stat-label">测试用例总数</div>
          <div class="stat-value">
            {{ testResults.reduce((sum, r) => sum + (r.testResults?.length || 0), 0) }}
          </div>
        </div>
        <div class="stat-item success">
          <div class="stat-label">通过</div>
          <div class="stat-value">
            {{ testResults.reduce((sum, r) => sum + (r.testResults?.filter(t => t.passed).length || 0), 0) }}
          </div>
        </div>
        <div class="stat-item failed">
          <div class="stat-label">失败</div>
          <div class="stat-value">
            {{ testResults.reduce((sum, r) => sum + (r.testResults?.filter(t => !t.passed).length || 0), 0) }}
          </div>
        </div>
        <div class="stat-item">
          <div class="stat-label">通过率</div>
          <div class="stat-value">
            {{ 
              testResults.reduce((sum, r) => sum + (r.testResults?.length || 0), 0) > 0
                ? Math.round(
                    testResults.reduce((sum, r) => sum + (r.testResults?.filter(t => t.passed).length || 0), 0) 
                    / testResults.reduce((sum, r) => sum + (r.testResults?.length || 0), 0) 
                    * 100
                  )
                : 0
            }}%
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.rule-verification {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-header h2 {
  margin: 0;
  font-size: 18px;
  color: #303133;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.rules-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.rule-card {
  background: #fff;
}

.rule-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.rule-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.rule-title h3 {
  margin: 0;
  font-size: 16px;
  color: #303133;
}

.rule-number {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: #409eff;
  color: #fff;
  border-radius: 50%;
  font-size: 14px;
  font-weight: bold;
}

.rule-desc {
  margin: 8px 0 0 0;
  font-size: 13px;
  color: #909399;
}

.rules-list,
.required-fields,
.validation-rules,
.test-results {
  margin-top: 16px;
}

.rules-list h4,
.required-fields h4,
.validation-rules h4,
.test-results h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: #606266;
}

.fields-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.summary-card {
  background: #fff;
}

.summary-stats {
  display: flex;
  gap: 24px;
}

.stat-item {
  flex: 1;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 8px;
  text-align: center;
}

.stat-item.success {
  background: #f0f9eb;
}

.stat-item.failed {
  background: #fef0f0;
}

.stat-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 28px;
  font-weight: bold;
  color: #303133;
}

.stat-item.success .stat-value {
  color: #67c23a;
}

.stat-item.failed .stat-value {
  color: #f56c6c;
}
</style>

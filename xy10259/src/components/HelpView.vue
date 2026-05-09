<template>
  <div class="help-container">
    <el-card class="help-card">
      <h2 class="help-title">使用说明</h2>
      
      <el-steps :active="currentStep" direction="vertical" finish-status="success">
        <el-step title="第一步：初始化数据">
          <template #description>
            <div class="step-content">
              <el-alert
                title="首次使用"
                type="info"
                :closable="false"
                show-icon
              >
                点击页面右上角的「加载示例数据」按钮，系统将自动填充一套完整的示例数据，包括：
                <ul>
                  <li>10种常见花材（红玫瑰、粉玫瑰、百合等）</li>
                  <li>4个节日花束配方</li>
                  <li>5笔预售订单（包含已确认、待确认、已拒绝三种状态）</li>
                  <li>花材库存记录</li>
                  <li>损耗记录</li>
                  <li>替换方案</li>
                </ul>
              </el-alert>
              <div class="tip-box">
                <el-icon><InfoFilled /></el-icon>
                <span>也可以选择从头开始，手动录入所有数据。</span>
              </div>
            </div>
          </template>
        </el-step>
        
        <el-step title="第二步：配置花材与配方">
          <template #description>
            <div class="step-content">
              <h4>花材管理</h4>
              <p>左侧菜单 → 花材管理</p>
              <ul>
                <li>新增花材：点击「新增花材」按钮，填写花材名称、分类、单位和默认损耗率</li>
                <li>编辑/删除：对已有花材进行修改或删除</li>
                <li>损耗率：不同花材的损耗率不同（如百合损耗率较高）</li>
              </ul>
              
              <h4>花束配方</h4>
              <p>左侧菜单 → 花束配方</p>
              <ul>
                <li>新增配方：点击「新增配方」，配置花束名称、描述和花材组成</li>
                <li>每种配方需要指定包含哪些花材及数量</li>
                <li>可启用/停用配方，停用的配方不会出现在订单选择中</li>
              </ul>
              
              <div class="example-box">
                <strong>示例：</strong>「浪漫红玫瑰」配方包含：11支红玫瑰 + 1扎满天星 + 1扎尤加利叶
              </div>
            </div>
          </template>
        </el-step>
        
        <el-step title="第三步：录入预售订单">
          <template #description>
            <div class="step-content">
              <h4>预售订单管理</h4>
              <p>左侧菜单 → 预售订单</p>
              
              <el-table :data="orderStatusTable" size="small" style="margin: 12px 0">
                <el-table-column prop="status" label="状态" width="100" />
                <el-table-column prop="description" label="说明" />
                <el-table-column prop="actions" label="可操作" width="200" />
              </el-table>
              
              <h4>操作说明</h4>
              <ul>
                <li><strong>新增订单</strong>：填写客户信息、选择花束配方、数量和配送日期</li>
                <li><strong>确认订单</strong>：待确认状态的订单可确认，确认后参与备料计算</li>
                <li><strong>拒绝订单</strong>：待确认状态的订单可拒绝，拒绝后不参与备料计算</li>
                <li><strong>取消确认</strong>：已确认的订单可取消确认，退回待确认状态</li>
              </ul>
              
              <div class="warning-box">
                <el-icon><Warning /></el-icon>
                <span><strong>边界情况：</strong>如果订单关联的配方已被删除，系统会标记「配方缺失」，该订单无法确认。</span>
              </div>
            </div>
          </template>
        </el-step>
        
        <el-step title="第四步：管理库存与损耗">
          <template #description>
            <div class="step-content">
              <h4>库存管理</h4>
              <p>左侧菜单 → 库存管理</p>
              <ul>
                <li>登记到货：记录花材到货情况，包括现有库存和待到货数量</li>
                <li>批次管理：同一花材可分多批次入库</li>
                <li>系统会自动检测相同批次的重复到货，提示是否合并</li>
              </ul>
              
              <h4>损耗记录</h4>
              <p>左侧菜单 → 损耗记录</p>
              <ul>
                <li>新增损耗：登记花材损耗情况（运输损坏、质量问题等）</li>
                <li>损耗确认：损耗记录需要确认后才会纳入备料计算</li>
                <li>系统会取「已确认损耗量」和「默认损耗预估」中的较大值</li>
              </ul>
              
              <div class="formula-box">
                <strong>备料计算公式：</strong>
                <code>总需求 = 基础需求 + max(已确认损耗, 基础需求 × 损耗率)</code>
              </div>
            </div>
          </template>
        </el-step>
        
        <el-step title="第五步：设置替换方案">
          <template #description>
            <div class="step-content">
              <h4>替换方案管理</h4>
              <p>左侧菜单 → 替换方案</p>
              <ul>
                <li>当某种花材可能缺货时，可预设替代花材</li>
                <li>设置替换比例：如 2支百合 = 1朵绣球</li>
                <li>可启用/停用替换方案</li>
              </ul>
              
              <el-table :data="substituteExample" size="small" style="margin: 12px 0">
                <el-table-column prop="original" label="原花材（缺货）" />
                <el-table-column prop="substitute" label="替换花材" />
                <el-table-column prop="ratio" label="替换比例" />
                <el-table-column prop="scenario" label="应用场景" />
              </el-table>
              
              <div class="tip-box">
                <el-icon><InfoFilled /></el-icon>
                <span>看板中会显示哪些花材有替换方案，帮助决策是否需要紧急采购。</span>
              </div>
            </div>
          </template>
        </el-step>
        
        <el-step title="第六步：查看备料看板与导出">
          <template #description>
            <div class="step-content">
              <h4>备料看板</h4>
              <p>左侧菜单 → 备料看板（默认首页）</p>
              
              <h4>看板包含内容：</h4>
              <el-row :gutter="16">
                <el-col :span="12">
                  <div class="feature-box">
                    <h5>📊 统计概览</h5>
                    <ul>
                      <li>预售订单数</li>
                      <li>花束总量</li>
                      <li>花材种类</li>
                      <li>预警信息数</li>
                    </ul>
                  </div>
                </el-col>
                <el-col :span="12">
                  <div class="feature-box">
                    <h5>⚠️ 预警信息</h5>
                    <ul>
                      <li>花材缺口预警</li>
                      <li>配方缺失预警</li>
                    </ul>
                  </div>
                </el-col>
                <el-col :span="12">
                  <div class="feature-box">
                    <h5>📦 备料需求分析</h5>
                    <ul>
                      <li>基础需求（订单×配方）</li>
                      <li>损耗预估</li>
                      <li>库存对比</li>
                      <li>替换方案展示</li>
                    </ul>
                  </div>
                </el-col>
                <el-col :span="12">
                  <div class="feature-box">
                    <h5>📈 库存状态总览</h5>
                    <ul>
                      <li>各花材库存分布</li>
                      <li>待到货数量</li>
                      <li>已确认损耗</li>
                    </ul>
                  </div>
                </el-col>
              </el-row>
              
              <h4>导出报表</h4>
              <p>点击看板右上角「导出报表」按钮，可导出 Excel 格式的备料报表，包含：</p>
              <ul>
                <li>统计概览</li>
                <li>备料需求表</li>
                <li>库存状态表</li>
                <li>预警信息表</li>
              </ul>
            </div>
          </template>
        </el-step>
      </el-steps>
      
      <el-divider />
      
      <h3 class="section-title">边界情况处理</h3>
      <el-row :gutter="16">
        <el-col :span="8">
          <el-card class="edge-case-card">
            <h4><el-icon><DocumentCopy /></el-icon> 重复提交</h4>
            <ul>
              <li>花材名称重复：系统检测并阻止</li>
              <li>订单号重复：系统检测并阻止</li>
              <li>相同批次到货：提示合并或分开</li>
              <li>相同损耗记录：提示合并</li>
            </ul>
          </el-card>
        </el-col>
        <el-col :span="8">
          <el-card class="edge-case-card">
            <h4><el-icon><Warning /></el-icon> 状态冲突</h4>
            <ul>
              <li>已确认订单不能降级为待确认</li>
              <li>已拒绝订单不能编辑</li>
              <li>已确认损耗不能编辑</li>
              <li>同一花材不能有多个启用的替换方案</li>
            </ul>
          </el-card>
        </el-col>
        <el-col :span="8">
          <el-card class="edge-case-card">
            <h4><el-icon><CircleClose /></el-icon> 来源记录缺失</h4>
            <ul>
              <li>订单关联的配方被删除：标记「配方缺失」</li>
              <li>无法确认配方缺失的订单</li>
              <li>看板显示预警信息</li>
              <li>删除花材/配方前会提示风险</li>
            </ul>
          </el-card>
        </el-col>
      </el-row>
      
      <el-divider />
      
      <h3 class="section-title">数据存储说明</h3>
      <el-alert
        title="本地存储"
        type="info"
        :closable="false"
        show-icon
        description="本应用使用浏览器本地存储（localStorage）保存数据，数据不会上传到服务器。如需在不同设备间同步，请使用导出功能备份数据。"
      />
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { InfoFilled, Warning, DocumentCopy, CircleClose } from '@element-plus/icons-vue'

const currentStep = ref(6)

const orderStatusTable = [
  {
    status: '待确认',
    description: '新录入的订单，尚未确认是否有效',
    actions: '确认 / 拒绝 / 编辑 / 删除'
  },
  {
    status: '已确认',
    description: '有效订单，参与备料计算',
    actions: '取消确认 / 删除'
  },
  {
    status: '已拒绝',
    description: '无效订单，不参与备料计算',
    actions: '删除'
  }
]

const substituteExample = [
  {
    original: '红玫瑰（缺货）',
    substitute: '粉玫瑰',
    ratio: '1:1',
    scenario: '情人节红玫瑰紧俏时'
  },
  {
    original: '百合（缺货）',
    substitute: '绣球',
    ratio: '2:1',
    scenario: '2支百合可用1朵绣球替代'
  }
]
</script>

<style scoped>
.help-container {
  max-width: 1000px;
  margin: 0 auto;
}

.help-card {
  padding: 24px;
}

.help-title {
  margin: 0 0 24px 0;
  font-size: 22px;
  color: #303133;
  text-align: center;
}

.step-content {
  padding: 16px 0 16px 24px;
}

.step-content h4 {
  margin: 16px 0 8px 0;
  color: #409eff;
}

.step-content h5 {
  margin: 0 0 8px 0;
  color: #303133;
}

.step-content p {
  margin: 8px 0;
  color: #606266;
}

.step-content ul {
  margin: 8px 0;
  padding-left: 20px;
  color: #606266;
}

.step-content li {
  margin: 4px 0;
}

.tip-box, .warning-box, .example-box, .formula-box {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px;
  border-radius: 8px;
  margin: 12px 0;
}

.tip-box {
  background-color: #ecf5ff;
  color: #409eff;
}

.warning-box {
  background-color: #fef0f0;
  color: #f56c6c;
}

.example-box {
  background-color: #f0f9eb;
  color: #67c23a;
}

.formula-box {
  background-color: #fdf6ec;
  color: #e6a23c;
  font-family: monospace;
}

.formula-box code {
  background-color: rgba(0, 0, 0, 0.1);
  padding: 2px 8px;
  border-radius: 4px;
}

.feature-box {
  background-color: #f5f7fa;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 16px;
}

.section-title {
  margin: 24px 0 16px 0;
  font-size: 18px;
  color: #303133;
}

.edge-case-card {
  height: 100%;
}

.edge-case-card h4 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 12px 0;
  color: #303133;
}

.edge-case-card ul {
  margin: 0;
  padding-left: 20px;
}

.edge-case-card li {
  margin: 4px 0;
  color: #606266;
  font-size: 13px;
}
</style>
<template>
  <div>
    <div class="flex-between mb-20">
      <h2 class="page-title" style="margin: 0;">
        批次详情 - <span class="batch-no">{{ data.batch?.batch_no }}</span>
      </h2>
      <el-button @click="goBack">
        <el-icon><ArrowLeft /></el-icon>
        返回列表
      </el-button>
    </div>

    <el-card v-if="data.batch" class="card-section info-card">
      <template #header>
        <span>批次基本信息</span>
      </template>
      <el-row :gutter="20">
        <el-col :span="6">
          <div class="detail-label">批次号</div>
          <div class="detail-value">{{ data.batch.batch_no }}</div>
        </el-col>
        <el-col :span="6">
          <div class="detail-label">配送日期</div>
          <div class="detail-value">{{ data.batch.delivery_date }}</div>
        </el-col>
        <el-col :span="6">
          <div class="detail-label">餐食类型</div>
          <div class="detail-value">
            {{ data.batch.meal_type === 'breakfast' ? '早餐' : data.batch.meal_type === 'lunch' ? '午餐' : '晚餐' }}
          </div>
        </el-col>
        <el-col :span="6">
          <div class="detail-label">状态</div>
          <div class="detail-value">
            <el-tag :type="data.batch.status === 'completed' ? 'success' : data.batch.status === 'in_progress' ? 'warning' : 'info'">
              {{ data.batch.status === 'completed' ? '已完成' : data.batch.status === 'in_progress' ? '配送中' : '待处理' }}
            </el-tag>
          </div>
        </el-col>
      </el-row>
      <el-row :gutter="20" style="margin-top: 20px;">
        <el-col :span="6">
          <div class="detail-label">总份数</div>
          <div class="detail-value">{{ data.batch.total_meals }}</div>
        </el-col>
        <el-col :span="6">
          <div class="detail-label">已送达</div>
          <div class="detail-value" style="color: #67c23a;">{{ data.batch.delivered_meals }}</div>
        </el-col>
        <el-col :span="6">
          <div class="detail-label">已退回</div>
          <div class="detail-value" style="color: #f56c6c;">{{ data.batch.returned_meals }}</div>
        </el-col>
        <el-col :span="6">
          <div class="detail-label">配送员 / 车辆</div>
          <div class="detail-value">{{ data.batch.distributor || '-' }} / {{ data.batch.vehicle_no || '-' }}</div>
        </el-col>
      </el-row>
    </el-card>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="温度片段" name="temperature">
        <el-card class="card-section">
          <template #header>
            <div class="flex-between">
              <span>温度监控记录</span>
              <div>
                <el-button type="success" size="small" @click="generateTemp(true)">
                  生成正常温度
                </el-button>
                <el-button type="warning" size="small" @click="generateTemp(false)">
                  生成异常温度
                </el-button>
                <el-button type="primary" size="small" @click="openTempDialog">
                  手动添加
                </el-button>
              </div>
            </div>
          </template>

          <el-collapse v-if="data.segments?.length > 0">
            <el-collapse-item
              v-for="segment in data.segments"
              :key="segment.id"
              :title="segment.segment_name"
            >
              <el-card
                :class="segment.check_result?.abnormal ? 'warning-card' : ''"
                shadow="never"
              >
                <el-row :gutter="20" class="mb-10">
                  <el-col :span="6">
                    <div class="detail-label">开始时间</div>
                    <div class="detail-value">{{ segment.start_time }}</div>
                  </el-col>
                  <el-col :span="6">
                    <div class="detail-label">结束时间</div>
                    <div class="detail-value">{{ segment.end_time || '-' }}</div>
                  </el-col>
                  <el-col :span="6">
                    <div class="detail-label">温度状态</div>
                    <div class="detail-value">
                      <el-tag :type="segment.check_result?.abnormal ? 'danger' : 'success'">
                        {{ segment.check_result?.abnormal ? '异常' : '正常' }}
                      </el-tag>
                    </div>
                  </el-col>
                  <el-col :span="6">
                    <div class="detail-label">平均温度</div>
                    <div class="detail-value">
                      <span :class="segment.check_result?.abnormal ? 'temp-danger' : 'temp-normal'">
                        {{ segment.avg_temp?.toFixed(1) }}°C
                      </span>
                    </div>
                  </el-col>
                </el-row>
                <el-row :gutter="20" class="mb-10">
                  <el-col :span="12">
                    <div class="detail-label">温度范围</div>
                    <div class="detail-value">
                      最低 {{ segment.min_temp?.toFixed(1) }}°C - 最高 {{ segment.max_temp?.toFixed(1) }}°C
                    </div>
                  </el-col>
                  <el-col :span="12" v-if="segment.check_result?.abnormal">
                    <div class="detail-label">异常原因</div>
                    <div class="detail-value" style="color: #f56c6c;">
                      {{ segment.check_result.reason }}
                    </div>
                  </el-col>
                </el-row>
                <div class="temp-chart" :ref="el => { if (el) tempCharts[segment.id] = el; }"></div>
              </el-card>
            </el-collapse-item>
          </el-collapse>
          <el-empty v-else description="暂无温度数据" />
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="签收回执" name="receipts">
        <el-card class="card-section">
          <template #header>
            <div class="flex-between">
              <span>签收记录</span>
              <el-button type="primary" size="small" @click="openReceiptDialog">
                添加签收
              </el-button>
            </div>
          </template>
          <el-table :data="data.receipts || []" stripe>
            <el-table-column prop="elderly_id" label="老人编号" width="100" />
            <el-table-column prop="elderly_name" label="老人姓名" width="100" />
            <el-table-column prop="address" label="地址" min-width="150" />
            <el-table-column prop="phone" label="电话" width="120" />
            <el-table-column prop="sign_time" label="签收时间" width="160" />
            <el-table-column prop="sign_type" label="签收类型" width="100">
              <template #default="{ row }">
                <el-tag :type="row.sign_type === 'normal' ? 'success' : 'warning'">
                  {{ row.sign_type === 'normal' ? '正常' : '部分' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="meals_received" label="签收份数" width="100" />
            <el-table-column prop="signer_name" label="签收人" width="100" />
            <el-table-column label="操作" width="150" fixed="right">
              <template #default="{ row }">
                <el-button type="primary" size="small" link @click="openReceiptDialog(row)">编辑</el-button>
                <el-button type="success" size="small" link @click="openReturnDialog(row)">退餐</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="退餐记录" name="returns">
        <el-card class="card-section">
          <template #header>
            <span>退餐记录</span>
          </template>
          <el-table :data="data.returns || []" stripe>
            <el-table-column prop="elderly_name" label="老人姓名" width="100" />
            <el-table-column prop="reason_name" label="退餐原因" width="150">
              <template #default="{ row }">
                <el-tag :type="row.risk_level === 'high' ? 'danger' : row.risk_level === 'medium' ? 'warning' : 'info'">
                  {{ row.reason_name }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="reason_detail" label="详细说明" min-width="200" />
            <el-table-column prop="meals_returned" label="退回份数" width="100" />
            <el-table-column prop="risk_level" label="风险等级" width="100">
              <template #default="{ row }">
                <el-tag :type="row.risk_level === 'high' ? 'danger' : row.risk_level === 'medium' ? 'warning' : 'info'">
                  {{ row.risk_level === 'high' ? '高' : row.risk_level === 'medium' ? '中' : '低' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="getStatusType(row.status)">
                  {{ getStatusText(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="created_at" label="记录时间" width="160" />
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="补偿记录" name="compensations">
        <el-card class="card-section">
          <template #header>
            <span>补偿记录</span>
          </template>
          <el-table :data="data.compensations || []" stripe>
            <el-table-column prop="elderly_name" label="老人" width="100" />
            <el-table-column prop="compensation_type" label="补偿类型" width="100">
              <template #default="{ row }">
                {{ row.compensation_type === 'fixed' ? '固定金额' : '比例' }}
              </template>
            </el-table-column>
            <el-table-column prop="compensation_amount" label="补偿金额" width="120">
              <template #default="{ row }">
                <span style="color: #e6a23c; font-weight: bold;">¥{{ row.compensation_amount }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="reason" label="补偿原因" min-width="200" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.status === 'approved' ? 'success' : row.status === 'rejected' ? 'danger' : 'warning'">
                  {{ row.status === 'approved' ? '已通过' : row.status === 'rejected' ? '已拒绝' : row.status === 'manual' ? '人工录入' : '待审批' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="created_at" label="生成时间" width="160" />
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="安全事件" name="incidents">
        <el-card class="card-section">
          <template #header>
            <span>食品安全事件</span>
          </template>
          <el-table :data="data.incidents || []" stripe>
            <el-table-column prop="incident_type" label="事件类型" width="120">
              <template #default="{ row }">
                <el-tag :type="row.incident_type === 'temperature' ? 'warning' : 'danger'">
                  {{ row.incident_type === 'temperature' ? '温度异常' : '食品安全' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="severity" label="严重程度" width="100">
              <template #default="{ row }">
                <el-tag :type="row.severity === 'high' ? 'danger' : 'warning'">
                  {{ row.severity === 'high' ? '高' : '中' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="description" label="事件描述" min-width="200" />
            <el-table-column prop="affected_count" label="受影响人数" width="100" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.status === 'open' ? 'danger' : 'info'">
                  {{ row.status === 'open' ? '处理中' : '已关闭' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="created_at" label="报告时间" width="160" />
          </el-table>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <el-dialog
      v-model="tempDialogVisible"
      title="添加温度片段"
      width="700px"
    >
      <el-alert
        title="温度标准: 55°C ~ 85°C，超出范围视为异常"
        type="info"
        :closable="false"
        class="mb-20"
      />
      <el-form :model="tempForm" label-width="120px">
        <el-form-item label="片段名称">
          <el-input v-model="tempForm.segment_name" placeholder="如: 出库保温、配送途中、送达阶段" />
        </el-form-item>
        <el-form-item label="开始时间">
          <el-date-picker
            v-model="tempForm.start_time"
            type="datetime"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item label="结束时间">
          <el-date-picker
            v-model="tempForm.end_time"
            type="datetime"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item label="温度记录">
          <el-button type="primary" size="small" @click="addTempRecord" class="mb-10">添加温度点</el-button>
          <el-table :data="tempForm.temp_records" size="small" border>
            <el-table-column label="时间" width="160">
              <template #default="{ $index }">
                <el-date-picker
                  v-model="tempForm.temp_records[$index].time"
                  type="datetime"
                  value-format="YYYY-MM-DD HH:mm:ss"
                  size="small"
                />
              </template>
            </el-table-column>
            <el-table-column label="温度(°C)" width="150">
              <template #default="{ $index }">
                <el-input-number
                  v-model="tempForm.temp_records[$index].temperature"
                  :precision="1"
                  :step="0.5"
                  size="small"
                  style="width: 100%;"
                />
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100">
              <template #default="{ $index }">
                <el-button type="danger" size="small" link @click="removeTempRecord($index)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="tempDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveTempSegment">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="receiptDialogVisible"
      :title="isReceiptEdit ? '编辑签收' : '添加签收'"
      width="600px"
    >
      <el-form :model="receiptForm" :rules="receiptRules" ref="receiptFormRef" label-width="100px">
        <el-form-item label="老人编号" prop="elderly_id">
          <el-input v-model="receiptForm.elderly_id" placeholder="如: E001" />
        </el-form-item>
        <el-form-item label="老人姓名" prop="elderly_name">
          <el-input v-model="receiptForm.elderly_name" placeholder="老人姓名" />
        </el-form-item>
        <el-form-item label="地址">
          <el-input v-model="receiptForm.address" placeholder="配送地址" />
        </el-form-item>
        <el-form-item label="电话">
          <el-input v-model="receiptForm.phone" placeholder="联系电话" />
        </el-form-item>
        <el-form-item label="签收时间">
          <el-date-picker
            v-model="receiptForm.sign_time"
            type="datetime"
            value-format="YYYY-MM-DD HH:mm:ss"
            style="width: 100%;"
          />
        </el-form-item>
        <el-form-item label="签收类型">
          <el-select v-model="receiptForm.sign_type" style="width: 100%;">
            <el-option label="正常签收" value="normal" />
            <el-option label="部分签收" value="partial" />
          </el-select>
        </el-form-item>
        <el-form-item label="签收份数" prop="meals_received">
          <el-input-number v-model="receiptForm.meals_received" :min="0" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="签收人">
          <el-input v-model="receiptForm.signer_name" placeholder="实际签收人" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="receiptDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveReceipt">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="returnDialogVisible"
      title="登记退餐"
      width="600px"
    >
      <el-alert
        title="高风险退餐原因(T001/T002/F001/F002)将自动进入待审核状态"
        type="warning"
        :closable="false"
        class="mb-20"
      />
      <el-form :model="returnForm" :rules="returnRules" ref="returnFormRef" label-width="100px">
        <el-form-item label="退餐类型" prop="return_type">
          <el-select v-model="returnForm.return_type" style="width: 100%;">
            <el-option label="温度问题" value="temperature" />
            <el-option label="食品安全" value="food_safety" />
            <el-option label="其他原因" value="other" />
          </el-select>
        </el-form-item>
        <el-form-item label="退餐原因" prop="reason_code">
          <el-select v-model="returnForm.reason_code" style="width: 100%;">
            <el-option
              v-for="reason in returnReasons"
              :key="reason.code"
              :label="`${reason.name} (风险: ${reason.risk === 'high' ? '高' : reason.risk === 'medium' ? '中' : '低'})`"
              :value="reason.code"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="详细说明">
          <el-input
            v-model="returnForm.reason_detail"
            type="textarea"
            :rows="3"
            placeholder="请详细描述退餐情况"
          />
        </el-form-item>
        <el-form-item label="退回份数" prop="meals_returned">
          <el-input-number v-model="returnForm.meals_returned" :min="1" style="width: 100%;" />
        </el-form-item>
        <el-form-item label="操作员">
          <el-input v-model="returnForm.operator" placeholder="操作员姓名" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="returnDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveReturn">提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import * as echarts from 'echarts';
import dayjs from 'dayjs';
import { ElMessage, ElMessageBox } from 'element-plus';
import { batchAPI, temperatureAPI, receiptAPI, returnAPI } from '@/api';

const route = useRoute();
const router = useRouter();
const activeTab = ref('temperature');
const loading = ref(false);
const data = reactive({
  batch: null,
  segments: [],
  receipts: [],
  returns: [],
  compensations: [],
  incidents: []
});
const tempCharts = reactive({});
const returnReasons = ref([]);

const tempDialogVisible = ref(false);
const receiptDialogVisible = ref(false);
const returnDialogVisible = ref(false);
const isReceiptEdit = ref(false);
const receiptFormRef = ref(null);
const returnFormRef = ref(null);

const tempForm = reactive({
  segment_name: '',
  start_time: '',
  end_time: '',
  temp_records: []
});

const receiptForm = reactive({
  id: '',
  elderly_id: '',
  elderly_name: '',
  address: '',
  phone: '',
  sign_time: '',
  sign_type: 'normal',
  meals_received: 1,
  signer_name: ''
});

const returnForm = reactive({
  receipt_id: '',
  return_type: 'temperature',
  reason_code: '',
  reason_detail: '',
  meals_returned: 1,
  operator: ''
});

const receiptRules = {
  elderly_id: [{ required: true, message: '请输入老人编号', trigger: 'blur' }],
  elderly_name: [{ required: true, message: '请输入老人姓名', trigger: 'blur' }],
  meals_received: [{ required: true, message: '请输入签收份数', trigger: 'blur' }]
};

const returnRules = {
  return_type: [{ required: true, message: '请选择退餐类型', trigger: 'change' }],
  reason_code: [{ required: true, message: '请选择退餐原因', trigger: 'change' }],
  meals_returned: [{ required: true, message: '请输入退回份数', trigger: 'blur' }]
};

const loadData = async () => {
  loading.value = true;
  try {
    const res = await batchAPI.detail(route.params.id);
    Object.assign(data, res.data);
    await nextTick();
    renderTempCharts();
  } finally {
    loading.value = false;
  }
};

const renderTempCharts = () => {
  data.segments.forEach(segment => {
    const el = tempCharts[segment.id];
    if (el && segment.temp_records?.length > 0) {
      const chart = echarts.init(el);
      chart.setOption({
        tooltip: { trigger: 'axis' },
        legend: { data: ['温度', '正常范围下限', '正常范围上限'] },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: {
          type: 'category',
          boundaryGap: false,
          data: segment.temp_records.map(r => r.time?.split(' ')[1] || r.time)
        },
        yAxis: { type: 'value', min: 30, max: 100 },
        series: [
          {
            name: '温度',
            type: 'line',
            data: segment.temp_records.map(r => r.temperature),
            smooth: true,
            itemStyle: { color: segment.check_result?.abnormal ? '#f56c6c' : '#67c23a' },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: segment.check_result?.abnormal ? 'rgba(245, 108, 108, 0.3)' : 'rgba(103, 194, 58, 0.3)' },
                { offset: 1, color: 'rgba(255, 255, 255, 0.1)' }
              ])
            }
          },
          {
            name: '正常范围下限',
            type: 'line',
            data: segment.temp_records.map(() => 55),
            lineStyle: { color: '#909399', type: 'dashed' },
            symbol: 'none'
          },
          {
            name: '正常范围上限',
            type: 'line',
            data: segment.temp_records.map(() => 85),
            lineStyle: { color: '#909399', type: 'dashed' },
            symbol: 'none'
          }
        ]
      });
    }
  });
};

const loadReturnReasons = async () => {
  const res = await returnAPI.reasons();
  returnReasons.value = res.data;
};

const goBack = () => {
  router.push('/batches');
};

const getStatusType = (status) => {
  const types = {
    pending: 'warning',
    approved: 'success',
    rejected: 'danger',
    auto_approved: 'info'
  };
  return types[status] || 'info';
};

const getStatusText = (status) => {
  const texts = {
    pending: '待审核',
    approved: '已通过',
    rejected: '已拒绝',
    auto_approved: '自动通过'
  };
  return texts[status] || status;
};

const openTempDialog = () => {
  Object.assign(tempForm, {
    segment_name: '',
    start_time: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    end_time: '',
    temp_records: []
  });
  tempDialogVisible.value = true;
};

const addTempRecord = () => {
  tempForm.temp_records.push({
    time: dayjs().add(tempForm.temp_records.length * 3, 'minute').format('YYYY-MM-DD HH:mm:ss'),
    temperature: 70
  });
};

const removeTempRecord = (index) => {
  tempForm.temp_records.splice(index, 1);
};

const saveTempSegment = async () => {
  if (!tempForm.segment_name) {
    ElMessage.warning('请输入片段名称');
    return;
  }
  if (tempForm.temp_records.length === 0) {
    ElMessage.warning('请至少添加一条温度记录');
    return;
  }

  await temperatureAPI.create({
    batch_id: route.params.id,
    ...tempForm
  });
  ElMessage.success('温度片段保存成功');
  tempDialogVisible.value = false;
  loadData();
};

const generateTemp = async (normal) => {
  const segmentName = normal ? '生成测试-正常温度' : '生成测试-异常温度';
  const res = normal 
    ? await temperatureAPI.generateNormal({ batch_id: route.params.id, segment_name: segmentName })
    : await temperatureAPI.generateAbnormal({ batch_id: route.params.id, segment_name: segmentName });
  
  await temperatureAPI.create({
    batch_id: route.params.id,
    ...res.data
  });
  ElMessage.success(normal ? '正常温度数据生成成功' : '异常温度数据生成成功');
  loadData();
};

const openReceiptDialog = (row = null) => {
  isReceiptEdit.value = !!row;
  if (row) {
    Object.assign(receiptForm, row);
  } else {
    Object.assign(receiptForm, {
      id: '',
      elderly_id: '',
      elderly_name: '',
      address: '',
      phone: '',
      sign_time: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      sign_type: 'normal',
      meals_received: 1,
      signer_name: ''
    });
  }
  receiptDialogVisible.value = true;
};

const saveReceipt = async () => {
  if (!receiptFormRef.value) return;
  await receiptFormRef.value.validate();

  if (isReceiptEdit.value) {
    await receiptAPI.update(receiptForm.id, receiptForm);
    ElMessage.success('签收记录更新成功');
  } else {
    await receiptAPI.create({
      batch_id: route.params.id,
      ...receiptForm
    });
    ElMessage.success('签收记录添加成功');
  }
  receiptDialogVisible.value = false;
  loadData();
};

const openReturnDialog = (row) => {
  Object.assign(returnForm, {
    receipt_id: row.id,
    return_type: 'temperature',
    reason_code: '',
    reason_detail: '',
    meals_returned: 1,
    operator: ''
  });
  returnDialogVisible.value = true;
};

const saveReturn = async () => {
  if (!returnFormRef.value) return;
  await returnFormRef.value.validate();

  const res = await returnAPI.create(returnForm);
  ElMessage.success(res.data.needs_review ? '退餐已登记，进入审核流程' : '退餐已登记并自动通过');
  returnDialogVisible.value = false;
  loadData();
};

onMounted(() => {
  loadReturnReasons();
  loadData();
});
</script>

<template>
  <div class="project-detail">
    <el-card class="header-card">
      <div class="header-content">
        <div class="back-btn" @click="goBack">
          <el-icon :size="20"><ArrowLeft /></el-icon>
          <span>返回</span>
        </div>
        <div class="project-info" v-if="project">
          <div class="project-title">
            <h2>{{ project.name }}</h2>
            <el-tag :type="getStatusType(project.status)" size="large">
              {{ getStatusText(project.status) }}
            </el-tag>
          </div>
          <div class="project-meta">
            <span><el-icon><User /></el-icon> 供应商: {{ project.vendor }}</span>
            <span v-if="project.start_date"><el-icon><Calendar /></el-icon> {{ project.start_date }} ~ {{ project.end_date || '待定' }}</span>
            <span><el-icon><Money /></el-icon> 金额: ¥{{ (project.total_amount || 0).toLocaleString() }}</span>
          </div>
        </div>
        <div class="header-actions">
          <el-button @click="loadData" :icon="Refresh">刷新</el-button>
          <el-button type="success" @click="exportReport" :icon="Download">导出报告</el-button>
          <el-button type="primary" @click="openMilestoneDialog" :icon="Plus">添加里程碑</el-button>
        </div>
      </div>
    </el-card>

    <div class="progress-section" v-if="milestones.length > 0">
      <el-card>
        <el-steps :active="completedCount" simple>
          <el-step
            v-for="ms in milestones"
            :key="ms.id"
            :title="ms.name"
            :status="ms.status === 'completed' ? 'success' : ms.status === 'cancelled' ? 'error' : 'wait'"
          />
        </el-steps>
        <div class="progress-info">
          进度: {{ completedCount }}/{{ milestones.length }} 里程碑已完成
        </div>
      </el-card>
    </div>

    <div class="milestones-section" v-loading="loading">
      <el-empty v-if="!loading && milestones.length === 0" description="暂无里程碑，点击上方按钮添加">
        <el-button type="primary" @click="openMilestoneDialog" :icon="Plus">添加里程碑</el-button>
      </el-empty>
      
      <div v-for="ms in milestones" :key="ms.id" class="milestone-card">
        <el-card shadow="hover">
          <template #header>
            <div class="milestone-header">
              <div class="milestone-title">
                <el-tag :type="getMilestoneStatusType(ms.status)" effect="dark">
                  {{ getMilestoneStatusText(ms.status) }}
                </el-tag>
                <span class="ms-name">第{{ ms.sequence }}阶段 - {{ ms.name }}</span>
              </div>
              <div class="milestone-actions">
                <el-button type="primary" link @click="openDeliverableDialog(ms)" :icon="Upload">
                  提交交付物
                </el-button>
                <el-button type="success" link @click="completeMilestone(ms)" :icon="CircleCheck">
                  完成
                </el-button>
                <el-button type="warning" link @click="openPaymentDetail(ms)" :icon="Money">
                  付款详情
                </el-button>
                <el-button 
                  type="success" 
                  link 
                  @click="openApproveDialog(ms)" 
                  :icon="CircleCheck"
                  :disabled="ms.payment_status === 'paid' || ms.payment_status === 'partial'"
                >
                  审批付款
                </el-button>
                <el-button 
                  type="primary" 
                  link 
                  @click="openConfirmDialog(ms)" 
                  :icon="Check"
                  :disabled="ms.payment_status === 'paid'"
                >
                  确认付款
                </el-button>
                <el-button type="primary" link @click="openEditMilestoneDialog(ms)" :icon="Edit">
                  编辑
                </el-button>
                <el-button type="danger" link @click="confirmDeleteMilestone(ms)" :icon="Delete">
                  删除
                </el-button>
              </div>
            </div>
          </template>
          
          <div class="milestone-info">
            <el-row :gutter="20">
              <el-col :span="6">
                <div class="info-label">计划日期</div>
                <div class="info-value">{{ ms.planned_date || '待定' }}</div>
              </el-col>
              <el-col :span="6">
                <div class="info-label">实际日期</div>
                <div class="info-value">{{ ms.actual_date || '-' }}</div>
              </el-col>
              <el-col :span="6">
                <div class="info-label">付款金额</div>
                <div class="info-value">
                  ¥{{ (ms.payment_amount || 0).toLocaleString() }}
                  <el-tag :type="ms.payment_status === 'paid' ? 'success' : 'warning'" size="small" style="margin-left: 8px">
                    {{ getPaymentStatusText(ms.payment_status) }}
                  </el-tag>
                </div>
              </el-col>
              <el-col :span="6">
                <div class="info-label">付款比例</div>
                <div class="info-value">{{ ms.payment_percentage || 0 }}%</div>
              </el-col>
            </el-row>
            <p class="ms-desc" v-if="ms.description">{{ ms.description }}</p>
          </div>

          <div class="deliverables-section">
            <div class="section-title">
              <el-icon :size="18"><Document /></el-icon>
              交付物列表 ({{ ms.deliverables?.length || 0 }})
            </div>
            
            <el-empty v-if="!ms.deliverables?.length" description="暂无交付物" />
            
            <el-table
              v-else
              :data="ms.deliverables"
              size="small"
              style="width: 100%"
              stripe
            >
              <el-table-column prop="name" label="交付物名称" min-width="180" />
              <el-table-column prop="version" label="版本" width="100">
                <template #default="{ row }">
                  <el-tag type="info" effect="plain">{{ row.version }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="status" label="状态" width="100">
                <template #default="{ row }">
                  <el-tag :type="getDeliverableStatusType(row.status)">
                    {{ getDeliverableStatusText(row.status) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="file_name" label="附件" min-width="200">
                <template #default="{ row }">
                  <span v-if="row.file_name">
                    <el-icon><Download /></el-icon>
                    <el-link type="primary" @click="downloadFile(row)">
                      {{ row.file_name }}
                    </el-link>
                    <span v-if="row.file_size" class="file-size">
                      ({{ formatFileSize(row.file_size) }})
                    </span>
                  </span>
                  <span v-else class="no-file">无附件</span>
                </template>
              </el-table-column>
              <el-table-column prop="uploader" label="上传人" width="100" />
              <el-table-column prop="created_at" label="提交时间" width="160" />
              <el-table-column label="操作" width="280" fixed="right">
                <template #default="{ row }">
                  <el-button type="primary" link @click="viewDeliverableDetail(row)">
                    详情
                  </el-button>
                  <el-button type="success" link @click="acceptDeliverable(row)" :disabled="row.status === 'accepted'">
                    通过
                  </el-button>
                  <el-button type="warning" link @click="rejectDeliverable(row)" :disabled="row.status === 'accepted'">
                    驳回
                  </el-button>
                  <el-button type="danger" link @click="confirmDeleteDeliverable(row)" :disabled="row.status === 'accepted'">
                    删除
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-card>
      </div>
    </div>

    <el-dialog
      v-model="milestoneDialogVisible"
      :title="isEditMilestone ? '编辑里程碑' : '添加里程碑'"
      width="600px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="milestoneFormRef"
        :model="milestoneForm"
        :rules="milestoneRules"
        label-width="100px"
      >
        <el-form-item label="里程碑名称" prop="name">
          <el-input v-model="milestoneForm.name" placeholder="请输入里程碑名称" maxlength="100" show-word-limit />
        </el-form-item>
        <el-form-item label="阶段序号" prop="sequence">
          <el-input-number
            v-model="milestoneForm.sequence"
            :min="1"
            :precision="0"
            style="width: 100%"
            placeholder="阶段顺序"
          />
        </el-form-item>
        <el-form-item label="计划日期">
          <el-date-picker
            v-model="milestoneForm.planned_date"
            type="date"
            placeholder="选择计划完成日期"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="付款比例">
          <el-input-number
            v-model="milestoneForm.payment_percentage"
            :min="0"
            :max="100"
            :precision="2"
            style="width: 100%"
            placeholder="付款比例 (%)"
          />
        </el-form-item>
        <el-form-item label="付款金额">
          <el-input-number
            v-model="milestoneForm.payment_amount"
            :min="0"
            :precision="2"
            :controls="false"
            style="width: 100%"
            placeholder="付款金额"
          />
        </el-form-item>
        <el-form-item label="付款状态" v-if="isEditMilestone">
          <el-select v-model="milestoneForm.payment_status" placeholder="请选择" style="width: 100%">
            <el-option label="未付款" value="unpaid" />
            <el-option label="部分付款" value="partial" />
            <el-option label="已付款" value="paid" />
          </el-select>
        </el-form-item>
        <el-form-item label="付款触发条件">
          <el-select 
            v-model="milestoneForm.payment_trigger_type" 
            placeholder="请选择付款触发条件" 
            style="width: 100%"
          >
            <el-option 
              v-for="item in paymentTriggerTypes" 
              :key="item.value" 
              :label="item.label" 
              :value="item.value"
            >
              <span>{{ item.label }}</span>
              <div style="font-size: 12px; color: #909399;">{{ item.description }}</div>
            </el-option>
          </el-select>
          <div class="form-tip">设置何时可以触发付款审批</div>
        </el-form-item>
        <el-form-item 
          label="验收通过率" 
          v-if="milestoneForm.payment_trigger_type === 'percentage_accepted'"
        >
          <el-input-number
            v-model="milestoneForm.payment_trigger_condition.percentage"
            :min="0"
            :max="100"
            :precision="0"
            style="width: 100%"
            placeholder="最低验收通过率 (%)"
          />
          <div class="form-tip">当验收通过率达到此比例时触发付款</div>
        </el-form-item>
        <el-form-item label="里程碑描述">
          <el-input
            v-model="milestoneForm.description"
            type="textarea"
            :rows="3"
            placeholder="请输入里程碑描述"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="milestoneDialogVisible = false" :disabled="submitting">取消</el-button>
        <el-button type="primary" @click="submitMilestone" :loading="submitting">
          {{ isEditMilestone ? '保存' : '添加' }}
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="deliverableDialogVisible"
      title="提交交付物"
      width="600px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="deliverableFormRef"
        :model="deliverableForm"
        :rules="deliverableRules"
        label-width="100px"
      >
        <el-form-item label="交付物名称" prop="name">
          <el-input v-model="deliverableForm.name" placeholder="请输入交付物名称" maxlength="100" show-word-limit />
        </el-form-item>
        <el-form-item label="版本号" prop="version">
          <el-input v-model="deliverableForm.version" placeholder="如: v1.0, 1.0.1" maxlength="50" show-word-limit />
          <div class="form-tip">同一里程碑下同名同版本的交付物不能重复提交</div>
        </el-form-item>
        <el-form-item label="上传人">
          <el-input v-model="deliverableForm.uploader" placeholder="请输入上传人" maxlength="50" />
        </el-form-item>
        <el-form-item label="交付物描述">
          <el-input
            v-model="deliverableForm.description"
            type="textarea"
            :rows="3"
            placeholder="请输入交付物描述"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="附件">
          <el-upload
            ref="uploadRef"
            :auto-upload="false"
            :limit="1"
            :on-change="handleFileChange"
            :on-remove="handleFileRemove"
            drag
          >
            <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
            <div class="el-upload__text">拖拽文件到此处或<em>点击上传</em></div>
          </el-upload>
          <div class="form-tip">支持各种类型的文件，单个文件不超过 50MB</div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="deliverableDialogVisible = false" :disabled="submitting">取消</el-button>
        <el-button type="primary" @click="submitDeliverable" :loading="submitting">
          提交
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="deliverableDetailVisible"
      title="交付物详情"
      width="800px"
      :close-on-click-modal="false"
    >
      <div v-if="currentDeliverable" class="deliverable-detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="交付物名称">{{ currentDeliverable.name }}</el-descriptions-item>
          <el-descriptions-item label="版本">
            <el-tag type="info" effect="plain">{{ currentDeliverable.version }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="getDeliverableStatusType(currentDeliverable.status)">
              {{ getDeliverableStatusText(currentDeliverable.status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="上传人">{{ currentDeliverable.uploader || '-' }}</el-descriptions-item>
          <el-descriptions-item label="提交时间">{{ currentDeliverable.created_at }}</el-descriptions-item>
          <el-descriptions-item label="更新时间">{{ currentDeliverable.updated_at }}</el-descriptions-item>
          <el-descriptions-item label="描述" :span="2">{{ currentDeliverable.description || '-' }}</el-descriptions-item>
          <el-descriptions-item label="附件" :span="2">
            <template v-if="currentDeliverable.file_name">
              <el-link type="primary" @click="downloadFile(currentDeliverable)">
                <el-icon><Download /></el-icon>
                {{ currentDeliverable.file_name }}
              </el-link>
              <span v-if="currentDeliverable.file_size" class="file-size">
                ({{ formatFileSize(currentDeliverable.file_size) }})
              </span>
            </template>
            <span v-else>无附件</span>
          </el-descriptions-item>
        </el-descriptions>

        <el-divider content-position="left">验收记录</el-divider>
        <el-table
          :data="currentDeliverable.acceptance_records || []"
          size="small"
          stripe
          empty-text="暂无验收记录"
        >
          <el-table-column prop="result" label="结果" width="80">
            <template #default="{ row }">
              <el-tag :type="row.result === 'accepted' ? 'success' : 'danger'">
                {{ row.result === 'accepted' ? '通过' : '驳回' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="opinion" label="验收意见" />
          <el-table-column prop="reviewer" label="验收人" width="100" />
          <el-table-column prop="created_at" label="时间" width="160" />
        </el-table>

        <el-divider content-position="left">返工记录</el-divider>
        <el-table
          :data="currentDeliverable.rework_records || []"
          size="small"
          stripe
          empty-text="暂无返工记录"
        >
          <el-table-column prop="description" label="返工描述" />
          <el-table-column prop="requirements" label="要求" />
          <el-table-column prop="expected_date" label="预计完成" width="120" />
          <el-table-column prop="actual_date" label="实际完成" width="120" />
          <el-table-column prop="status" label="状态" width="80">
            <template #default="{ row }">
              <el-tag :type="row.status === 'completed' ? 'success' : 'warning'">
                {{ row.status === 'completed' ? '已完成' : '进行中' }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-dialog>

    <el-dialog
      v-model="acceptDialogVisible"
      title="验收通过确认"
      width="500px"
    >
      <el-form
        ref="acceptFormRef"
        :model="acceptForm"
        label-width="80px"
      >
        <el-form-item label="验收意见">
          <el-input
            v-model="acceptForm.opinion"
            type="textarea"
            :rows="3"
            placeholder="请输入验收意见（可选）"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="验收人">
          <el-input v-model="acceptForm.reviewer" placeholder="请输入验收人" maxlength="50" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="acceptDialogVisible = false">取消</el-button>
        <el-button type="success" @click="confirmAccept" :loading="submitting">确认通过</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="rejectDialogVisible"
      title="验收驳回"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="rejectFormRef"
        :model="rejectForm"
        :rules="rejectRules"
        label-width="100px"
      >
        <el-form-item label="验收意见" prop="opinion">
          <el-input
            v-model="rejectForm.opinion"
            type="textarea"
            :rows="2"
            placeholder="请输入验收意见"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="验收人">
          <el-input v-model="rejectForm.reviewer" placeholder="请输入验收人" maxlength="50" />
        </el-form-item>
        <el-form-item label="是否创建返工">
          <el-radio-group v-model="rejectForm.createRework">
            <el-radio :label="false">不创建</el-radio>
            <el-radio :label="true">创建返工记录</el-radio>
          </el-radio-group>
        </el-form-item>
        <template v-if="rejectForm.createRework">
          <el-form-item label="返工描述" prop="rework_description">
            <el-input
              v-model="rejectForm.rework_description"
              type="textarea"
              :rows="2"
              placeholder="请输入返工描述"
              maxlength="500"
              show-word-limit
            />
          </el-form-item>
          <el-form-item label="返工要求">
            <el-input
              v-model="rejectForm.rework_requirements"
              type="textarea"
              :rows="2"
              placeholder="请输入返工要求（可选）"
              maxlength="500"
              show-word-limit
            />
          </el-form-item>
          <el-form-item label="预计完成日期">
            <el-date-picker
              v-model="rejectForm.rework_expected_date"
              type="date"
              placeholder="选择预计完成日期"
              value-format="YYYY-MM-DD"
              style="width: 100%"
            />
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="rejectDialogVisible = false" :disabled="submitting">取消</el-button>
        <el-button type="warning" @click="confirmReject" :loading="submitting">确认驳回</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="paymentDialogVisible"
      title="付款详情"
      width="800px"
      :close-on-click-modal="false"
    >
      <div v-if="activeMilestone" class="payment-detail">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="里程碑名称">{{ activeMilestone.name }}</el-descriptions-item>
          <el-descriptions-item label="阶段序号">第{{ activeMilestone.sequence }}阶段</el-descriptions-item>
          <el-descriptions-item label="付款金额">¥{{ (activeMilestone.payment_amount || 0).toLocaleString() }}</el-descriptions-item>
          <el-descriptions-item label="付款比例">{{ activeMilestone.payment_percentage || 0 }}%</el-descriptions-item>
          <el-descriptions-item label="付款状态">
            <el-tag :type="activeMilestone.payment_status === 'paid' ? 'success' : activeMilestone.payment_status === 'partial' ? 'warning' : 'info'">
              {{ getPaymentStatusText(activeMilestone.payment_status) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="触发条件">
            {{ getPaymentTriggerTypeText(activeMilestone.payment_trigger_type) }}
          </el-descriptions-item>
        </el-descriptions>

        <el-divider content-position="left">付款状态检测</el-divider>
        <el-alert
          :title="paymentStatusCheck?.trigger_met ? '✅ 付款条件已满足' : '⚠️ 付款条件未满足'"
          :type="paymentStatusCheck?.trigger_met ? 'success' : 'warning'"
          :closable="false"
          style="margin-bottom: 16px;"
        >
          <template #default>
            <div v-if="paymentStatusCheck">
              <p>验收通过: {{ paymentStatusCheck.status?.accepted_count || 0 }}/{{ paymentStatusCheck.status?.total_deliverables || 0 }}</p>
              <p>待处理返工: {{ paymentStatusCheck.status?.pending_rework_count || 0 }}</p>
              <p>验收通过率: {{ (paymentStatusCheck.status?.acceptance_rate || 0).toFixed(1) }}%</p>
              <p v-if="paymentStatusCheck.details">说明: {{ paymentStatusCheck.details }}</p>
            </div>
          </template>
        </el-alert>

        <el-divider content-position="left">付款历史记录</el-divider>
        <el-table
          :data="paymentHistory"
          size="small"
          stripe
          empty-text="暂无付款历史"
        >
          <el-table-column prop="action" label="操作" width="120">
            <template #default="{ row }">
              <el-tag :type="getPaymentActionType(row.action)">{{ getPaymentActionText(row.action) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="amount" label="金额" width="120">
            <template #default="{ row }">
              ¥{{ (row.amount || 0).toLocaleString() }}
            </template>
          </el-table-column>
          <el-table-column prop="before_status" label="变更前状态" width="100">
            <template #default="{ row }">
              {{ getPaymentStatusText(row.before_status) }}
            </template>
          </el-table-column>
          <el-table-column prop="after_status" label="变更后状态" width="100">
            <template #default="{ row }">
              {{ getPaymentStatusText(row.after_status) }}
            </template>
          </el-table-column>
          <el-table-column prop="operator" label="操作人" width="100" />
          <el-table-column prop="reason" label="原因/说明" min-width="150" />
          <el-table-column prop="created_at" label="时间" width="160" />
        </el-table>

        <el-divider content-position="left">触发条件日志</el-divider>
        <el-table
          :data="paymentLogs"
          size="small"
          stripe
          empty-text="暂无触发日志"
        >
          <el-table-column prop="trigger_source" label="触发来源" width="120">
            <template #default="{ row }">
              {{ getTriggerSourceText(row.trigger_source) }}
            </template>
          </el-table-column>
          <el-table-column prop="trigger_type" label="触发类型" width="120">
            <template #default="{ row }">
              {{ getPaymentTriggerTypeText(row.trigger_type) }}
            </template>
          </el-table-column>
          <el-table-column label="详情" min-width="200">
            <template #default="{ row }">
              <div v-if="row.details_parsed">
                <span v-if="row.details_parsed.trigger_met" class="text-success">✓ 条件满足</span>
                <span v-else class="text-warning">✗ 条件未满足</span>
                <span v-if="row.details_parsed.details"> - {{ row.details_parsed.details }}</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column prop="created_at" label="时间" width="160" />
        </el-table>
      </div>
      <template #footer>
        <el-button @click="paymentDialogVisible = false">关闭</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="approveDialogVisible"
      title="审批付款"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="approveFormRef"
        :model="approveForm"
        label-width="80px"
      >
        <el-form-item label="审批人">
          <el-input v-model="approveForm.operator" placeholder="请输入审批人" maxlength="50" />
        </el-form-item>
        <el-form-item label="审批意见">
          <el-input
            v-model="approveForm.reason"
            type="textarea"
            :rows="3"
            placeholder="请输入审批意见（可选）"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="approveDialogVisible = false">取消</el-button>
        <el-button type="success" @click="handleApprove" :loading="submitting">确认审批</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="confirmDialogVisible"
      title="确认付款"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="confirmFormRef"
        :model="confirmForm"
        label-width="80px"
      >
        <el-form-item label="操作人">
          <el-input v-model="confirmForm.operator" placeholder="请输入操作人" maxlength="50" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input
            v-model="confirmForm.reason"
            type="textarea"
            :rows="3"
            placeholder="请输入备注（可选）"
            maxlength="500"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="confirmDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleConfirm" :loading="submitting">确认付款</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { 
  ArrowLeft, Refresh, Download, Plus, Upload, CircleCheck, Edit, Delete, 
  Document, User, Calendar, Money, UploadFilled, Check, History, Timer
} from '@element-plus/icons-vue'
import { getProjectDetail } from '@/api/projects'
import { getMilestones, createMilestone, updateMilestone, deleteMilestone, completeMilestone as completeMsApi } from '@/api/milestones'
import { createDeliverable, deleteDeliverable, downloadDeliverable, acceptDeliverable as acceptDlApi, rejectDeliverable as rejectDlApi } from '@/api/deliverables'
import { exportProjectReport } from '@/api/reports'
import { getPaymentTriggerTypes, getPaymentHistory, getPaymentLogs, approvePayment, confirmPayment } from '@/api/payments'

const route = useRoute()
const router = useRouter()

const projectId = computed(() => route.params.id)

const loading = ref(false)
const project = ref(null)
const milestones = ref([])
const currentMilestone = ref(null)
const currentDeliverable = ref(null)
const selectedFile = ref(null)
const submitting = ref(false)

const milestoneDialogVisible = ref(false)
const deliverableDialogVisible = ref(false)
const deliverableDetailVisible = ref(false)
const acceptDialogVisible = ref(false)
const rejectDialogVisible = ref(false)

const isEditMilestone = ref(false)
const milestoneFormRef = ref(null)
const deliverableFormRef = ref(null)
const uploadRef = ref(null)
const acceptFormRef = ref(null)
const rejectFormRef = ref(null)

const paymentTriggerTypes = ref([])
const activeMilestone = ref(null)
const paymentHistory = ref([])
const paymentLogs = ref([])
const paymentLoading = ref(false)

const approveDialogVisible = ref(false)
const confirmDialogVisible = ref(false)
const paymentDialogVisible = ref(false)

const approveForm = reactive({
  operator: '',
  reason: ''
})

const confirmForm = reactive({
  operator: '',
  reason: ''
})

const milestoneForm = reactive({
  id: '',
  project_id: '',
  name: '',
  sequence: 1,
  planned_date: '',
  description: '',
  payment_percentage: 0,
  payment_amount: 0,
  payment_status: 'unpaid',
  status: 'pending',
  payment_trigger_type: 'all_accepted',
  payment_trigger_condition: {}
})

const deliverableForm = reactive({
  milestone_id: '',
  name: '',
  version: '',
  uploader: '',
  description: ''
})

const acceptForm = reactive({
  opinion: '',
  reviewer: ''
})

const rejectForm = reactive({
  opinion: '',
  reviewer: '',
  createRework: false,
  rework_description: '',
  rework_requirements: '',
  rework_expected_date: ''
})

const milestoneRules = {
  name: [
    { required: true, message: '请输入里程碑名称', trigger: 'blur' },
    { min: 2, max: 100, message: '长度在 2 到 100 个字符', trigger: 'blur' }
  ],
  sequence: [
    { required: true, message: '请输入阶段序号', trigger: 'blur' }
  ]
}

const deliverableRules = {
  name: [
    { required: true, message: '请输入交付物名称', trigger: 'blur' },
    { min: 2, max: 100, message: '长度在 2 到 100 个字符', trigger: 'blur' }
  ],
  version: [
    { required: true, message: '请输入版本号', trigger: 'blur' },
    { min: 1, max: 50, message: '长度在 1 到 50 个字符', trigger: 'blur' }
  ]
}

const rejectRules = {
  opinion: [
    { required: true, message: '请输入验收意见', trigger: 'blur' }
  ],
  rework_description: [
    {
      validator: (rule, value, callback) => {
        if (rejectForm.createRework && !value) {
          callback(new Error('请输入返工描述'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}

const completedCount = computed(() => {
  return milestones.value.filter(m => m.status === 'completed').length
})

function getStatusType(status) {
  const map = { active: 'primary', completed: 'success', cancelled: 'info' }
  return map[status] || 'info'
}

function getStatusText(status) {
  const map = { active: '进行中', completed: '已完成', cancelled: '已取消' }
  return map[status] || status
}

function getMilestoneStatusType(status) {
  const map = { pending: 'warning', in_progress: 'primary', completed: 'success', cancelled: 'info' }
  return map[status] || 'info'
}

function getMilestoneStatusText(status) {
  const map = { pending: '待开始', in_progress: '进行中', completed: '已完成', cancelled: '已取消' }
  return map[status] || status
}

function getDeliverableStatusType(status) {
  const map = { submitted: 'warning', reviewing: 'info', accepted: 'success', rejected: 'danger' }
  return map[status] || 'info'
}

function getDeliverableStatusText(status) {
  const map = { submitted: '已提交', reviewing: '审核中', accepted: '已通过', rejected: '已驳回' }
  return map[status] || status
}

function getPaymentStatusText(status) {
  const map = { unpaid: '未付款', partial: '部分付款', paid: '已付款' }
  return map[status] || status
}

const paymentStatusCheck = ref(null)

function getPaymentTriggerTypeText(type) {
  const map = {
    all_accepted: '所有交付物验收通过且无待处理返工',
    no_rework_pending: '无待处理返工',
    percentage_accepted: '按验收通过率触发',
    specific_deliverables: '指定交付物验收通过',
    manual: '手动审批'
  }
  return map[type] || type
}

function getPaymentActionType(action) {
  const map = {
    trigger_met: 'success',
    trigger_not_met: 'info',
    approved: 'primary',
    paid: 'success',
    rejected: 'danger',
    reset: 'warning'
  }
  return map[action] || 'info'
}

function getPaymentActionText(action) {
  const map = {
    trigger_met: '条件满足',
    trigger_not_met: '条件不满足',
    approved: '审批通过',
    paid: '已付款',
    rejected: '审批拒绝',
    reset: '重置'
  }
  return map[action] || action
}

function getTriggerSourceText(source) {
  const map = {
    acceptance_accepted: '验收通过',
    acceptance_rejected: '验收驳回',
    rework_completed: '返工完成',
    system: '系统检测',
    manual: '手动操作'
  }
  return map[source] || source
}

async function openPaymentDetail(ms) {
  activeMilestone.value = ms
  paymentLoading.value = true
  
  try {
    const [history, logs] = await Promise.all([
      getPaymentHistory(ms.id),
      getPaymentLogs(ms.id)
    ])
    
    paymentHistory.value = history
    paymentLogs.value = logs
    
    let triggerCondition = {}
    if (ms.payment_trigger_condition) {
      try {
        triggerCondition = typeof ms.payment_trigger_condition === 'string'
          ? JSON.parse(ms.payment_trigger_condition)
          : ms.payment_trigger_condition
      } catch (e) {
        triggerCondition = {}
      }
    }
    
    const acceptedCount = (ms.deliverables || []).filter(d => d.status === 'accepted').length
    const totalDeliverables = (ms.deliverables || []).length
    const pendingReworkCount = (ms.deliverables || []).reduce((count, d) => {
      return count + (d.rework_records || []).filter(r => r.status === 'pending').length
    }, 0)
    
    let triggerMet = false
    let details = ''
    
    const triggerType = ms.payment_trigger_type || 'all_accepted'
    const acceptanceRate = totalDeliverables > 0 ? (acceptedCount / totalDeliverables) * 100 : 0
    
    switch (triggerType) {
      case 'all_accepted':
        triggerMet = totalDeliverables > 0 && 
                     acceptedCount === totalDeliverables && 
                     pendingReworkCount === 0
        details = triggerMet
          ? '所有交付物已验收通过，且无待处理返工'
          : `验收通过: ${acceptedCount}/${totalDeliverables}, 待返工: ${pendingReworkCount}`
        break
        
      case 'no_rework_pending':
        triggerMet = pendingReworkCount === 0
        details = triggerMet
          ? '无待处理的返工任务'
          : `仍有 ${pendingReworkCount} 个返工任务待完成`
        break
        
      case 'percentage_accepted':
        const requiredPercentage = triggerCondition.percentage || 100
        triggerMet = acceptanceRate >= requiredPercentage
        details = triggerMet
          ? `验收通过率 ${acceptanceRate.toFixed(1)}% >= ${requiredPercentage}%`
          : `验收通过率 ${acceptanceRate.toFixed(1)}% < ${requiredPercentage}%`
        break
        
      case 'manual':
        triggerMet = ms.payment_approved === 1
        details = triggerMet ? '已手动审批通过' : '等待手动审批'
        break
        
      default:
        triggerMet = false
        details = '未知的付款触发类型'
    }
    
    paymentStatusCheck.value = {
      trigger_met: triggerMet,
      trigger_type: triggerType,
      status: {
        total_deliverables: totalDeliverables,
        accepted_count: acceptedCount,
        pending_rework_count: pendingReworkCount,
        acceptance_rate: acceptanceRate
      },
      details
    }
    
    paymentDialogVisible.value = true
  } catch (error) {
    console.error('加载付款详情失败:', error)
    ElMessage.error('加载付款详情失败')
  } finally {
    paymentLoading.value = false
  }
}

function openApproveDialog(ms) {
  if (ms.payment_status === 'paid' || ms.payment_status === 'partial') {
    ElMessage.warning('该里程碑已审批或已付款')
    return
  }
  
  activeMilestone.value = ms
  Object.assign(approveForm, {
    operator: '',
    reason: ''
  })
  approveDialogVisible.value = true
}

function openConfirmDialog(ms) {
  if (ms.payment_status === 'paid') {
    ElMessage.warning('该里程碑已付款')
    return
  }
  
  activeMilestone.value = ms
  Object.assign(confirmForm, {
    operator: '',
    reason: ''
  })
  confirmDialogVisible.value = true
}

async function handleApprove() {
  if (!activeMilestone.value) return
  
  submitting.value = true
  try {
    await approvePayment(activeMilestone.value.id, {
      operator: approveForm.operator.trim(),
      reason: approveForm.reason.trim()
    })
    ElMessage.success('付款审批成功')
    approveDialogVisible.value = false
    loadData()
  } catch (error) {
    console.error('审批失败:', error)
  } finally {
    submitting.value = false
  }
}

async function handleConfirm() {
  if (!activeMilestone.value) return
  
  submitting.value = true
  try {
    await confirmPayment(activeMilestone.value.id, {
      operator: confirmForm.operator.trim(),
      reason: confirmForm.reason.trim()
    })
    ElMessage.success('付款已确认')
    confirmDialogVisible.value = false
    loadData()
  } catch (error) {
    console.error('确认付款失败:', error)
  } finally {
    submitting.value = false
  }
}

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

async function loadData() {
  if (!projectId.value) return
  
  loading.value = true
  try {
    project.value = await getProjectDetail(projectId.value)
    milestones.value = await getMilestones(projectId.value)
  } catch (error) {
    console.error('加载数据失败:', error)
  } finally {
    loading.value = false
  }
}

function goBack() {
  router.push('/')
}

async function exportReport() {
  try {
    const response = await exportProjectReport(projectId.value)
    const blob = new Blob([response.data], { 
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
    })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${project.value?.name || '项目'}_验收报告.xlsx`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch (error) {
    ElMessage.error('导出失败：' + (error.message || '未知错误'))
  }
}

async function loadPaymentTriggerTypes() {
  try {
    paymentTriggerTypes.value = await getPaymentTriggerTypes()
  } catch (error) {
    console.error('加载付款触发类型失败:', error)
  }
}

function openMilestoneDialog() {
  isEditMilestone.value = false
  Object.assign(milestoneForm, {
    id: '',
    project_id: projectId.value,
    name: '',
    sequence: milestones.value.length + 1,
    planned_date: '',
    description: '',
    payment_percentage: 0,
    payment_amount: 0,
    payment_status: 'unpaid',
    status: 'pending',
    payment_trigger_type: 'all_accepted',
    payment_trigger_condition: {}
  })
  milestoneDialogVisible.value = true
}

function openEditMilestoneDialog(ms) {
  isEditMilestone.value = true
  let triggerCondition = {}
  if (ms.payment_trigger_condition) {
    try {
      triggerCondition = typeof ms.payment_trigger_condition === 'string' 
        ? JSON.parse(ms.payment_trigger_condition) 
        : ms.payment_trigger_condition
    } catch (e) {
      triggerCondition = {}
    }
  }
  Object.assign(milestoneForm, {
    id: ms.id,
    project_id: projectId.value,
    name: ms.name,
    sequence: ms.sequence,
    planned_date: ms.planned_date || '',
    description: ms.description || '',
    payment_percentage: ms.payment_percentage || 0,
    payment_amount: ms.payment_amount || 0,
    payment_status: ms.payment_status || 'unpaid',
    status: ms.status || 'pending',
    payment_trigger_type: ms.payment_trigger_type || 'all_accepted',
    payment_trigger_condition: triggerCondition
  })
  milestoneDialogVisible.value = true
}

async function submitMilestone() {
  try {
    await milestoneFormRef.value.validate()
  } catch {
    return
  }
  
  submitting.value = true
  try {
    const data = {
      project_id: milestoneForm.project_id,
      name: milestoneForm.name.trim(),
      sequence: milestoneForm.sequence,
      planned_date: milestoneForm.planned_date || null,
      description: milestoneForm.description.trim(),
      payment_percentage: milestoneForm.payment_percentage || 0,
      payment_amount: milestoneForm.payment_amount || 0,
      payment_status: milestoneForm.payment_status,
      status: milestoneForm.status,
      payment_trigger_type: milestoneForm.payment_trigger_type,
      payment_trigger_condition: milestoneForm.payment_trigger_condition
    }
    
    if (isEditMilestone.value) {
      await updateMilestone(milestoneForm.id, data)
      ElMessage.success('里程碑更新成功')
    } else {
      await createMilestone(data)
      ElMessage.success('里程碑添加成功')
    }
    
    milestoneDialogVisible.value = false
    loadData()
  } catch (error) {
    console.error('提交失败:', error)
  } finally {
    submitting.value = false
  }
}

function confirmDeleteMilestone(ms) {
  ElMessageBox.confirm(
    `确定要删除里程碑「${ms.name}」吗？删除后该里程碑下的所有交付物也会被删除。`,
    '删除确认',
    { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
  ).then(async () => {
    try {
      await deleteMilestone(ms.id)
      ElMessage.success('删除成功')
      loadData()
    } catch (error) {
      console.error('删除失败:', error)
    }
  }).catch(() => {})
}

function completeMilestone(ms) {
  ElMessageBox.confirm(
    `确定要将里程碑「${ms.name}」标记为完成吗？需要该里程碑下所有交付物都已通过验收。`,
    '完成确认',
    { confirmButtonText: '确定', cancelButtonText: '取消', type: 'info' }
  ).then(async () => {
    try {
      await completeMsApi(ms.id)
      ElMessage.success('里程碑已完成')
      loadData()
    } catch (error) {
      console.error('完成失败:', error)
    }
  }).catch(() => {})
}

function openDeliverableDialog(ms) {
  currentMilestone.value = ms
  Object.assign(deliverableForm, {
    milestone_id: ms.id,
    name: '',
    version: 'v1.0',
    uploader: '',
    description: ''
  })
  selectedFile.value = null
  if (uploadRef.value) {
    uploadRef.value.clearFiles()
  }
  deliverableDialogVisible.value = true
}

function handleFileChange(file) {
  selectedFile.value = file.raw
}

function handleFileRemove() {
  selectedFile.value = null
}

async function submitDeliverable() {
  try {
    await deliverableFormRef.value.validate()
  } catch {
    return
  }
  
  submitting.value = true
  try {
    const formData = new FormData()
    formData.append('milestone_id', deliverableForm.milestone_id)
    formData.append('name', deliverableForm.name.trim())
    formData.append('version', deliverableForm.version.trim())
    formData.append('uploader', deliverableForm.uploader.trim())
    formData.append('description', deliverableForm.description.trim())
    
    if (selectedFile.value) {
      formData.append('file', selectedFile.value)
    }
    
    await createDeliverable(formData)
    ElMessage.success('交付物提交成功')
    deliverableDialogVisible.value = false
    loadData()
  } catch (error) {
    console.error('提交失败:', error)
  } finally {
    submitting.value = false
  }
}

function viewDeliverableDetail(deliverable) {
  currentDeliverable.value = deliverable
  deliverableDetailVisible.value = true
}

async function downloadFile(deliverable) {
  try {
    const response = await downloadDeliverable(deliverable.id)
    const blob = new Blob([response.data])
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = deliverable.file_name || deliverable.name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
    ElMessage.success('下载成功')
  } catch (error) {
    ElMessage.error('下载失败：' + (error.message || '未知错误'))
  }
}

function acceptDeliverable(deliverable) {
  currentDeliverable.value = deliverable
  Object.assign(acceptForm, { opinion: '', reviewer: '' })
  acceptDialogVisible.value = true
}

async function confirmAccept() {
  if (!currentDeliverable.value) return
  
  submitting.value = true
  try {
    await acceptDlApi(currentDeliverable.value.id, {
      opinion: acceptForm.opinion.trim(),
      reviewer: acceptForm.reviewer.trim()
    })
    ElMessage.success('验收通过')
    acceptDialogVisible.value = false
    loadData()
  } catch (error) {
    console.error('验收失败:', error)
  } finally {
    submitting.value = false
  }
}

function rejectDeliverable(deliverable) {
  currentDeliverable.value = deliverable
  Object.assign(rejectForm, {
    opinion: '',
    reviewer: '',
    createRework: false,
    rework_description: '',
    rework_requirements: '',
    rework_expected_date: ''
  })
  rejectDialogVisible.value = true
}

async function confirmReject() {
  try {
    await rejectFormRef.value.validate()
  } catch {
    return
  }
  
  if (!currentDeliverable.value) return
  
  submitting.value = true
  try {
    const data = {
      opinion: rejectForm.opinion.trim(),
      reviewer: rejectForm.reviewer.trim()
    }
    
    if (rejectForm.createRework) {
      data.rework_description = rejectForm.rework_description.trim()
      data.rework_requirements = rejectForm.rework_requirements.trim()
      data.rework_expected_date = rejectForm.rework_expected_date || null
    }
    
    await rejectDlApi(currentDeliverable.value.id, data)
    ElMessage.success('验收已驳回')
    rejectDialogVisible.value = false
    loadData()
  } catch (error) {
    console.error('驳回失败:', error)
  } finally {
    submitting.value = false
  }
}

function confirmDeleteDeliverable(deliverable) {
  ElMessageBox.confirm(
    `确定要删除交付物「${deliverable.name} (${deliverable.version})」吗？`,
    '删除确认',
    { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' }
  ).then(async () => {
    try {
      await deleteDeliverable(deliverable.id)
      ElMessage.success('删除成功')
      loadData()
    } catch (error) {
      console.error('删除失败:', error)
    }
  }).catch(() => {})
}

watch(projectId, () => {
  loadData()
})

onMounted(() => {
  loadData()
  loadPaymentTriggerTypes()
})

defineExpose({
  loadData
})
</script>

<style scoped>
.project-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.header-card {
  margin-bottom: 8px;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 20px;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #909399;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.3s;
}

.back-btn:hover {
  background-color: #f5f7fa;
  color: #409eff;
}

.project-info {
  flex: 1;
}

.project-title {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.project-title h2 {
  margin: 0;
  font-size: 20px;
  color: #303133;
}

.project-meta {
  display: flex;
  align-items: center;
  gap: 24px;
  color: #606266;
  font-size: 14px;
}

.project-meta span {
  display: flex;
  align-items: center;
  gap: 4px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.progress-section {
  margin-bottom: 8px;
}

.progress-info {
  text-align: center;
  margin-top: 16px;
  color: #606266;
  font-size: 14px;
}

.milestones-section {
  flex: 1;
}

.milestone-card {
  margin-bottom: 16px;
}

.milestone-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.milestone-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ms-name {
  font-size: 16px;
  font-weight: 500;
  color: #303133;
}

.milestone-actions {
  display: flex;
  gap: 8px;
}

.milestone-info {
  padding: 16px 0;
  border-bottom: 1px solid #ebeef5;
  margin-bottom: 16px;
}

.info-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}

.info-value {
  font-size: 14px;
  color: #303133;
  font-weight: 500;
}

.ms-desc {
  margin: 16px 0 0;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 4px;
  color: #606266;
  font-size: 14px;
}

.deliverables-section {
  margin-top: 16px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  margin-bottom: 12px;
}

.file-size {
  color: #909399;
  font-size: 12px;
  margin-left: 8px;
}

.no-file {
  color: #c0c4cc;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.deliverable-detail {
  padding: 8px 0;
}
</style>
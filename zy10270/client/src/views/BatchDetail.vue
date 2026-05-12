<template>
  <div class="batch-detail">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>批次详情 - {{ batch?.batch_no }}</span>
          <el-button @click="goBack">返回</el-button>
        </div>
      </template>

      <el-descriptions :column="3" border style="margin-bottom: 20px">
        <el-descriptions-item label="批次号">{{ batch?.batch_no }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="batch?.status === 'sent' ? 'warning' : 'success'">
            {{ batch?.status === 'sent' ? '送洗中' : '已完成' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="送洗数量">{{ batch?.send_quantity }}</el-descriptions-item>
        <el-descriptions-item label="回库数量">{{ batch?.receive_quantity }}</el-descriptions-item>
        <el-descriptions-item label="送洗时间">{{ formatDate(batch?.send_at) }}</el-descriptions-item>
        <el-descriptions-item label="回库时间">{{ formatDate(batch?.receive_at) }}</el-descriptions-item>
      </el-descriptions>

      <el-tabs v-model="activeTab">
        <el-tab-pane label="布草明细" name="items">
          <el-table :data="batchItems" style="width: 100%">
            <el-table-column prop="linen_type" label="类型" width="120" />
            <el-table-column prop="linen_id" label="布草ID" width="200" />
            <el-table-column prop="status" label="状态" width="120">
              <template #default="{ row }">
                <el-tag :type="getStatusType(row.status)">
                  {{ getStatusText(row.status) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="150">
              <template #default="{ row }">
                <el-button
                  v-if="row.status === 'missing'"
                  link
                  type="danger"
                  @click="openClaimDialog(row)"
                >
                  申请赔付
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="操作时间线" name="timeline">
          <el-timeline>
            <el-timeline-item
              v-for="item in timeline"
              :key="item.id"
              :timestamp="formatDate(item.created_at)"
              :type="getTimelineType(item.action)"
            >
              <h4>{{ getActionText(item.action) }}</h4>
              <p>{{ item.description }}</p>
              <p v-if="item.quantity">数量: {{ item.quantity }}</p>
              <p v-if="item.created_by">操作人: {{ item.created_by }}</p>
            </el-timeline-item>
          </el-timeline>
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-dialog v-model="claimDialogVisible" title="申请赔付" width="500px">
      <el-form :model="claimForm" label-width="100px">
        <el-form-item label="布草类型">
          <span>{{ claimItem?.linen_type }}</span>
        </el-form-item>
        <el-form-item label="赔付金额">
          <el-input-number v-model="claimForm.amount" :min="0" :step="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="赔付原因">
          <el-input v-model="claimForm.reason" type="textarea" rows="3" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="claimDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitClaim">确认赔付</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import axios from 'axios';

export default {
  name: 'BatchDetail',
  setup() {
    const router = useRouter();
    const route = useRoute();
    const batch = ref(null);
    const batchItems = ref([]);
    const timeline = ref([]);
    const activeTab = ref('items');
    const claimDialogVisible = ref(false);
    const claimItem = ref(null);
    const claimForm = ref({
      amount: 0,
      reason: ''
    });

    const formatDate = (dateStr) => {
      if (!dateStr) return '-';
      return new Date(dateStr).toLocaleString('zh-CN');
    };

    const getStatusType = (status) => {
      const map = {
        sent: 'info',
        received: 'success',
        missing: 'danger'
      };
      return map[status] || 'info';
    };

    const getStatusText = (status) => {
      const map = {
        sent: '送洗中',
        received: '已回库',
        missing: '已丢失'
      };
      return map[status] || status;
    };

    const getTimelineType = (action) => {
      const map = {
        send: 'primary',
        receive: 'success',
        missing: 'danger',
        claim: 'warning'
      };
      return map[action] || '';
    };

    const getActionText = (action) => {
      const map = {
        send: '创建送洗批次',
        receive: '验收入库',
        missing: '标记丢失',
        claim: '赔付处理'
      };
      return map[action] || action;
    };

    const fetchBatchDetail = async () => {
      try {
        const res = await axios.get(`/api/batches/${route.params.id}`);
        batch.value = res.data;
        batchItems.value = res.data.items;
        timeline.value = res.data.timeline;
      } catch (err) {
        ElMessage.error('获取批次详情失败');
      }
    };

    const goBack = () => {
      router.back();
    };

    const openClaimDialog = (item) => {
      claimItem.value = item;
      claimForm.value = { amount: 50, reason: '布草丢失' };
      claimDialogVisible.value = true;
    };

    const submitClaim = async () => {
      try {
        await axios.post('/api/claims', {
          linen_id: claimItem.value.linen_id,
          batch_id: route.params.id,
          amount: claimForm.value.amount,
          reason: claimForm.value.reason
        });
        ElMessage.success('赔付成功');
        claimDialogVisible.value = false;
        fetchBatchDetail();
      } catch (err) {
        ElMessage.error(err.response?.data?.error || '赔付失败');
      }
    };

    onMounted(() => {
      fetchBatchDetail();
    });

    return {
      batch,
      batchItems,
      timeline,
      activeTab,
      claimDialogVisible,
      claimItem,
      claimForm,
      formatDate,
      getStatusType,
      getStatusText,
      getTimelineType,
      getActionText,
      goBack,
      openClaimDialog,
      submitClaim
    };
  }
};
</script>

<style scoped>
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>

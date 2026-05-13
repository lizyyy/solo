<template>
  <div>
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px">
      <h2>文章详情</h2>
      <el-button @click="$router.push('/articles')">返回列表</el-button>
    </div>

    <el-card shadow="hover" style="margin-bottom: 20px">
      <el-descriptions title="基本信息" :column="2" border>
        <el-descriptions-item label="标题">{{ article.title }}</el-descriptions-item>
        <el-descriptions-item label="分类">{{ article.category }}</el-descriptions-item>
        <el-descriptions-item label="作者">{{ article.author }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="getStatusType(article.status)">{{ getStatusText(article.status) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="当前版本">v{{ article.current_version }}</el-descriptions-item>
        <el-descriptions-item label="阅读量">{{ article.read_count }}</el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ article.created_at }}</el-descriptions-item>
        <el-descriptions-item label="最后更新">{{ article.updated_at }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card shadow="hover" style="margin-bottom: 20px">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span style="font-weight: bold">文章内容</span>
          <el-button type="primary" size="small" @click="showEditDialog = true">编辑</el-button>
        </div>
      </template>
      <div style="white-space: pre-wrap; line-height: 1.8">{{ article.content }}</div>
    </el-card>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="版本历史" name="versions">
        <el-card shadow="hover">
          <el-table :data="versions" style="width: 100%">
            <el-table-column prop="version_number" label="版本号" width="100">
              <template #default="scope">v{{ scope.row.version_number }}</template>
            </el-table-column>
            <el-table-column prop="title" label="标题" min-width="200" />
            <el-table-column prop="author" label="作者" width="100" />
            <el-table-column prop="created_at" label="创建时间" width="180" />
            <el-table-column prop="change_log" label="变更说明" min-width="200" />
            <el-table-column label="操作" width="150" fixed="right">
              <template #default="scope">
                <el-button type="primary" link @click="rollbackToVersion(scope.row)" v-if="scope.row.version_number !== article.current_version">回滚到此版本</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="评审记录" name="reviews">
        <el-card shadow="hover">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center">
              <span>评审列表</span>
              <el-button type="primary" size="small" @click="showReviewDialog = true">添加评审</el-button>
            </div>
          </template>
          <el-table :data="reviews" style="width: 100%">
            <el-table-column prop="reviewer" label="评审人" width="120" />
            <el-table-column prop="comment" label="评审意见" min-width="300" />
            <el-table-column prop="status" label="评审结果" width="100">
              <template #default="scope">
                <el-tag :type="scope.row.status === 'approved' ? 'success' : scope.row.status === 'rejected' ? 'danger' : 'warning'">
                  {{ scope.row.status === 'approved' ? '通过' : scope.row.status === 'rejected' ? '拒绝' : '待定' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="created_at" label="评审时间" width="180" />
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="发布记录" name="publish">
        <el-card shadow="hover">
          <el-table :data="publishRecords" style="width: 100%">
            <el-table-column prop="publish_type" label="发布类型" width="120">
              <template #default="scope">
                <el-tag size="small">
                  {{ scope.row.publish_type === 'first_publish' ? '首次发布' : scope.row.publish_type === 'update' ? '更新发布' : '回滚' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="operator" label="操作人" width="120" />
            <el-table-column prop="before_value" label="变更前" min-width="150" />
            <el-table-column prop="after_value" label="变更后" min-width="150" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="scope">
                <el-tag :type="scope.row.status === 'success' ? 'success' : 'danger'" size="small">
                  {{ scope.row.status === 'success' ? '成功' : '失败' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="error_message" label="错误信息" min-width="150" />
            <el-table-column prop="created_at" label="操作时间" width="180" />
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="回滚记录" name="rollback">
        <el-card shadow="hover">
          <el-table :data="rollbackRecords" style="width: 100%">
            <el-table-column prop="operator" label="操作人" width="120" />
            <el-table-column prop="from_version_id" label="从版本" width="100" />
            <el-table-column prop="to_version_id" label="到版本" width="100" />
            <el-table-column prop="reason" label="回滚原因" min-width="300" />
            <el-table-column prop="created_at" label="操作时间" width="180" />
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="人工调整" name="adjustments">
        <el-card shadow="hover">
          <el-table :data="adjustments" style="width: 100%">
            <el-table-column prop="operator" label="操作人" width="120" />
            <el-table-column prop="adjust_type" label="调整类型" width="120" />
            <el-table-column prop="field_name" label="字段名" width="120" />
            <el-table-column prop="before_value" label="调整前" min-width="150" />
            <el-table-column prop="after_value" label="调整后" min-width="150" />
            <el-table-column prop="reason" label="调整原因" min-width="200" />
            <el-table-column prop="created_at" label="操作时间" width="180" />
          </el-table>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="showEditDialog" title="编辑文章" width="600px">
      <el-form :model="editForm" label-width="80px">
        <el-form-item label="标题">
          <el-input v-model="editForm.title" />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="editForm.category" style="width: 100%">
            <el-option label="技术文档" value="技术文档" />
            <el-option label="产品说明" value="产品说明" />
            <el-option label="用户指南" value="用户指南" />
            <el-option label="FAQ" value="FAQ" />
            <el-option label="最佳实践" value="最佳实践" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="editForm.status" style="width: 100%">
            <el-option label="草稿" value="draft" />
            <el-option label="审核中" value="reviewing" />
            <el-option label="已通过" value="approved" />
            <el-option label="已发布" value="published" />
            <el-option label="已归档" value="archived" />
          </el-select>
        </el-form-item>
        <el-form-item label="内容">
          <el-input v-model="editForm.content" type="textarea" :rows="6" />
        </el-form-item>
        <el-form-item label="变更说明">
          <el-input v-model="editForm.changeLog" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" @click="updateArticle">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showReviewDialog" title="添加评审" width="500px">
      <el-form :model="reviewForm" label-width="80px">
        <el-form-item label="评审人">
          <el-input v-model="reviewForm.reviewer" />
        </el-form-item>
        <el-form-item label="评审意见">
          <el-input v-model="reviewForm.comment" type="textarea" :rows="4" />
        </el-form-item>
        <el-form-item label="评审结果">
          <el-select v-model="reviewForm.status" style="width: 100%">
            <el-option label="通过" value="approved" />
            <el-option label="拒绝" value="rejected" />
            <el-option label="待定" value="pending" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showReviewDialog = false">取消</el-button>
        <el-button type="primary" @click="submitReview">提交</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showRollbackDialog" title="回滚确认" width="400px">
      <p>确定要回滚到版本 v{{ rollbackTarget?.version_number }} 吗？</p>
      <el-input v-model="rollbackReason" type="textarea" placeholder="请输入回滚原因" style="margin-top: 15px" />
      <template #footer>
        <el-button @click="showRollbackDialog = false">取消</el-button>
        <el-button type="danger" @click="confirmRollback">确认回滚</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import axios from 'axios';
import { ElMessage } from 'element-plus';

const route = useRoute();
const activeTab = ref('versions');
const showEditDialog = ref(false);
const showReviewDialog = ref(false);
const showRollbackDialog = ref(false);
const rollbackTarget = ref(null);
const rollbackReason = ref('');

const article = ref({});
const versions = ref([]);
const reviews = ref([]);
const publishRecords = ref([]);
const rollbackRecords = ref([]);
const adjustments = ref([]);

const editForm = ref({
  title: '',
  category: '',
  status: '',
  content: '',
  changeLog: ''
});

const reviewForm = ref({
  versionId: '',
  reviewer: '',
  comment: '',
  status: 'pending'
});

const loadArticleDetail = async () => {
  try {
    const response = await axios.get(`/api/articles/${route.params.id}`);
    if (response.data.success) {
      const data = response.data.data;
      article.value = data.article;
      versions.value = data.versions;
      reviews.value = data.reviews;
      publishRecords.value = data.publishRecords;
      rollbackRecords.value = data.rollbackRecords;
      adjustments.value = data.adjustments;
    }
  } catch (error) {
    console.error('加载文章详情失败:', error);
  }
};

const updateArticle = async () => {
  try {
    const response = await axios.put(`/api/articles/${route.params.id}`, {
      ...editForm.value,
      operator: '当前用户'
    });
    if (response.data.success) {
      ElMessage.success('更新成功');
      showEditDialog.value = false;
      loadArticleDetail();
    }
  } catch (error) {
    console.error('更新文章失败:', error);
    ElMessage.error('更新失败');
  }
};

const submitReview = async () => {
  try {
    const response = await axios.post(`/api/articles/${route.params.id}/review`, {
      versionId: article.value.current_version,
      ...reviewForm.value
    });
    if (response.data.success) {
      ElMessage.success('评审提交成功');
      showReviewDialog.value = false;
      reviewForm.value = { versionId: '', reviewer: '', comment: '', status: 'pending' };
      loadArticleDetail();
    }
  } catch (error) {
    console.error('提交评审失败:', error);
    ElMessage.error('提交失败');
  }
};

const rollbackToVersion = (version) => {
  rollbackTarget.value = version;
  showRollbackDialog.value = true;
};

const confirmRollback = async () => {
  try {
    const response = await axios.post(`/api/articles/${route.params.id}/rollback`, {
      toVersionId: rollbackTarget.value.id,
      operator: '当前用户',
      reason: rollbackReason.value
    });
    if (response.data.success) {
      ElMessage.success('回滚成功');
      showRollbackDialog.value = false;
      rollbackReason.value = '';
      loadArticleDetail();
    }
  } catch (error) {
    console.error('回滚失败:', error);
    ElMessage.error('回滚失败');
  }
};

const getStatusType = (status) => {
  const map = {
    draft: 'info',
    reviewing: 'warning',
    approved: 'success',
    published: 'success',
    archived: 'info'
  };
  return map[status] || 'info';
};

const getStatusText = (status) => {
  const map = {
    draft: '草稿',
    reviewing: '审核中',
    approved: '已通过',
    published: '已发布',
    archived: '已归档'
  };
  return map[status] || status;
};

onMounted(() => {
  loadArticleDetail();
});
</script>

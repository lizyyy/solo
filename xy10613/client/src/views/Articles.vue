<template>
  <div>
    <h2 style="margin-bottom: 20px">文章列表</h2>
    
    <el-card shadow="hover" style="margin-bottom: 20px">
      <el-form :inline="true" :model="filters" label-width="80px">
        <el-form-item label="标题关键词">
          <el-input v-model="filters.keyword" placeholder="请输入关键词" clearable />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="filters.category" placeholder="请选择分类" clearable>
            <el-option label="技术文档" value="技术文档" />
            <el-option label="产品说明" value="产品说明" />
            <el-option label="用户指南" value="用户指南" />
            <el-option label="FAQ" value="FAQ" />
            <el-option label="最佳实践" value="最佳实践" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filters.status" placeholder="请选择状态" clearable>
            <el-option label="草稿" value="draft" />
            <el-option label="审核中" value="reviewing" />
            <el-option label="已通过" value="approved" />
            <el-option label="已发布" value="published" />
            <el-option label="已归档" value="archived" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadArticles">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="hover">
      <template #header>
        <div style="display: flex; justify-content: space-between; align-items: center">
          <span style="font-weight: bold; font-size: 16px">文章列表</span>
          <el-button type="primary" size="small" @click="showCreateDialog = true">新建文章</el-button>
        </div>
      </template>
      
      <el-table :data="articles" style="width: 100%">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="title" label="标题" min-width="250" />
        <el-table-column prop="category" label="分类" width="120" />
        <el-table-column prop="author" label="作者" width="100" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="scope">
            <el-tag :type="getStatusType(scope.row.status)" size="small">
              {{ getStatusText(scope.row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="current_version" label="版本" width="80" />
        <el-table-column prop="read_count" label="阅读量" width="100" />
        <el-table-column prop="created_at" label="创建时间" width="180" />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="scope">
            <el-button type="primary" link @click="goToDetail(scope.row.id)">详情</el-button>
            <el-button type="success" link @click="publishArticle(scope.row)" v-if="scope.row.status === 'approved'">发布</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        style="margin-top: 20px; justify-content: flex-end"
        @size-change="loadArticles"
        @current-change="loadArticles"
      />
    </el-card>

    <el-dialog v-model="showCreateDialog" title="新建文章" width="600px">
      <el-form :model="newArticle" label-width="80px">
        <el-form-item label="标题">
          <el-input v-model="newArticle.title" />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="newArticle.category" style="width: 100%">
            <el-option label="技术文档" value="技术文档" />
            <el-option label="产品说明" value="产品说明" />
            <el-option label="用户指南" value="用户指南" />
            <el-option label="FAQ" value="FAQ" />
            <el-option label="最佳实践" value="最佳实践" />
          </el-select>
        </el-form-item>
        <el-form-item label="内容">
          <el-input v-model="newArticle.content" type="textarea" :rows="6" />
        </el-form-item>
        <el-form-item label="作者">
          <el-input v-model="newArticle.author" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="createArticle">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import axios from 'axios';
import { ElMessage } from 'element-plus';

const router = useRouter();
const articles = ref([]);
const showCreateDialog = ref(false);
const filters = ref({
  keyword: '',
  category: '',
  status: ''
});
const pagination = ref({
  page: 1,
  pageSize: 20,
  total: 0
});
const newArticle = ref({
  title: '',
  category: '',
  content: '',
  author: ''
});

const loadArticles = async () => {
  try {
    const response = await axios.get('/api/articles', {
      params: {
        ...filters.value,
        page: pagination.value.page,
        pageSize: pagination.value.pageSize
      }
    });
    if (response.data.success) {
      articles.value = response.data.data;
      pagination.value.total = response.data.total;
    }
  } catch (error) {
    console.error('加载文章列表失败:', error);
  }
};

const resetFilters = () => {
  filters.value = {
    keyword: '',
    category: '',
    status: ''
  };
  pagination.value.page = 1;
  loadArticles();
};

const createArticle = async () => {
  try {
    const response = await axios.post('/api/articles', newArticle.value);
    if (response.data.success) {
      ElMessage.success('创建成功');
      showCreateDialog.value = false;
      newArticle.value = { title: '', category: '', content: '', author: '' };
      loadArticles();
    }
  } catch (error) {
    console.error('创建文章失败:', error);
    ElMessage.error('创建失败');
  }
};

const publishArticle = async (article) => {
  try {
    const response = await axios.post(`/api/articles/${article.id}/publish`, { operator: '当前用户' });
    if (response.data.success) {
      ElMessage.success('发布成功');
      loadArticles();
    }
  } catch (error) {
    console.error('发布文章失败:', error);
    ElMessage.error(error.response?.data?.message || '发布失败');
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

const goToDetail = (id) => {
  router.push(`/article/${id}`);
};

onMounted(() => {
  loadArticles();
});
</script>

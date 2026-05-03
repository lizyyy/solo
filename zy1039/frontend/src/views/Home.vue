<template>
  <div class="home-layout">
    <header class="home-header">
      <div class="logo">
        <el-icon class="logo-icon"><Share /></el-icon>
        <div class="logo-text">
          <div class="title">Stateflow Rehearsal</div>
          <div class="subtitle">状态机交互可视化演练工具</div>
        </div>
      </div>
      <div class="header-actions">
        <el-button type="primary" @click="showImportDialog = true">
          <el-icon><Upload /></el-icon>
          导入状态机
        </el-button>
        <el-button @click="showExamplesDialog = true">
          <el-icon><Collection /></el-icon>
          查看示例
        </el-button>
      </div>
    </header>
    
    <main class="home-main">
      <div v-if="loading" class="loading-overlay">
        <el-icon class="is-loading"><Loading /></el-icon>
      </div>
      
      <div v-if="!loading && projects.length === 0" class="empty-state">
        <el-icon class="empty-icon"><Document /></el-icon>
        <div class="empty-title">暂无项目</div>
        <div class="empty-desc">
          点击上方"导入状态机"按钮开始，或从示例中选择一个状态机
        </div>
      </div>
      
      <div v-else>
        <div class="section-title">
          <el-icon><FolderOpened /></el-icon>
          我的项目
        </div>
        <div class="project-grid">
          <div
            v-for="project in projects"
            :key="project.id"
            class="project-card"
            @click="openProject(project.id)"
          >
            <div class="project-header">
              <h3 class="project-name">{{ project.name }}</h3>
              <el-dropdown @command="handleProjectCommand">
                <el-icon class="cursor-pointer"><MoreFilled /></el-icon>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item :command="{ action: 'open', id: project.id }">
                      打开
                    </el-dropdown-item>
                    <el-dropdown-item :command="{ action: 'export', id: project.id }">
                      导出
                    </el-dropdown-item>
                    <el-dropdown-item divided :command="{ action: 'delete', id: project.id }" type="danger">
                      删除
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
            <p class="project-desc">{{ project.description || '暂无描述' }}</p>
            <div class="project-stats">
              <div class="stat">
                <el-icon><Connection /></el-icon>
                {{ project.stateCount || 0 }} 状态
              </div>
              <div class="stat">
                <el-icon><Lightning /></el-icon>
                {{ project.eventCount || 0 }} 事件
              </div>
            </div>
            <div class="project-footer">
              <span class="update-time">
                更新于 {{ formatTime(project.updatedAt) }}
              </span>
              <el-button type="primary" text @click.stop="openProject(project.id)">
                编辑 <el-icon><ArrowRight /></el-icon>
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </main>
    
    <el-dialog
      v-model="showImportDialog"
      title="导入状态机"
      width="700px"
      :close-on-click-modal="false"
    >
      <el-form :model="importForm" label-width="80px">
        <el-form-item label="项目名称">
          <el-input v-model="importForm.name" placeholder="请输入项目名称" />
        </el-form-item>
        <el-form-item label="状态机定义">
          <el-input
            v-model="importForm.content"
            type="textarea"
            :rows="15"
            placeholder="粘贴 JSON 或 YAML 格式的状态机定义"
            @blur="parseContent"
          />
        </el-form-item>
      </el-form>
      <div v-if="parseError" class="el-alert el-alert--error is-light">
        <i class="el-alert__icon el-icon-error"></i>
        <div class="el-alert__content">
          <p class="el-alert__description">{{ parseError }}</p>
        </div>
      </div>
      <div v-else-if="parseResult" class="el-alert el-alert--success is-light">
        <i class="el-alert__icon el-icon-success"></i>
        <div class="el-alert__content">
          <p class="el-alert__description">
            解析成功：{{ parseResult.stateCount }} 个状态，{{ parseResult.eventCount }} 个事件
          </p>
        </div>
      </div>
      <template #footer>
        <el-button @click="showImportDialog = false">取消</el-button>
        <el-button type="primary" :loading="importing" @click="handleImport">
          导入
        </el-button>
      </template>
    </el-dialog>
    
    <el-dialog
      v-model="showExamplesDialog"
      title="选择示例状态机"
      width="600px"
    >
      <el-table :data="examples" style="width: 100%" v-loading="loadingExamples">
        <el-table-column prop="name" label="名称" min-width="150">
          <template #default="{ row }">
            <div class="font-bold">{{ row.name }}</div>
            <div class="text-sm text-gray-500">{{ row.description }}</div>
          </template>
        </el-table-column>
        <el-table-column prop="stateCount" label="状态数" width="80" align="center" />
        <el-table-column prop="eventCount" label="事件数" width="80" align="center" />
        <el-table-column label="操作" width="120" align="center">
          <template #default="{ row }">
            <el-button type="primary" link @click="useExample(row.filename)">
              使用
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="showExamplesDialog = false">取消</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { projectApi, examplesApi } from '@/api';
import type { Project } from '@/api';

const router = useRouter();

const loading = ref(false);
const projects = ref<Project[]>([]);
const showImportDialog = ref(false);
const showExamplesDialog = ref(false);
const importing = ref(false);
const loadingExamples = ref(false);
const examples = ref<{ filename: string; name: string; description: string; stateCount: number; eventCount: number }[]>([]);
const parseError = ref<string | null>(null);
const parseResult = ref<{ stateCount: number; eventCount: number } | null>(null);

const importForm = ref({
  name: '',
  content: ''
});

const formatTime = (time: string) => {
  const date = new Date(time);
  return date.toLocaleString('zh-CN');
};

const loadProjects = async () => {
  loading.value = true;
  try {
    const res = await projectApi.list();
    if (res.data.success) {
      projects.value = res.data.projects;
    }
  } catch (error) {
    ElMessage.error('加载项目列表失败');
  } finally {
    loading.value = false;
  }
};

const loadExamples = async () => {
  loadingExamples.value = true;
  try {
    const res = await examplesApi.list();
    if (res.data.success) {
      examples.value = res.data.examples;
    }
  } catch (error) {
    ElMessage.error('加载示例列表失败');
  } finally {
    loadingExamples.value = false;
  }
};

const parseContent = async () => {
  if (!importForm.value.content.trim()) {
    parseError.value = null;
    parseResult.value = null;
    return;
  }
  
  try {
    const res = await projectApi.parse(importForm.value.content);
    if (res.data.success) {
      parseError.value = null;
      parseResult.value = {
        stateCount: Object.keys(res.data.machine.states).length,
        eventCount: Object.keys(res.data.machine.events).length
      };
      if (!importForm.value.name) {
        importForm.value.name = res.data.machine.name;
      }
    }
  } catch (error: any) {
    parseResult.value = null;
    parseError.value = error.response?.data?.error || '解析失败，请检查格式';
  }
};

const handleImport = async () => {
  if (!importForm.value.content.trim()) {
    ElMessage.warning('请输入状态机定义');
    return;
  }
  
  importing.value = true;
  try {
    const res = await projectApi.import(importForm.value.content, importForm.value.name);
    if (res.data.success) {
      ElMessage.success('导入成功');
      showImportDialog.value = false;
      importForm.value = { name: '', content: '' };
      parseError.value = null;
      parseResult.value = null;
      loadProjects();
      router.push(`/editor/${res.data.projectId}`);
    }
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '导入失败');
  } finally {
    importing.value = false;
  }
};

const useExample = async (filename: string) => {
  try {
    const res = await examplesApi.get(filename);
    if (res.data.success) {
      const importRes = await projectApi.import(res.data.content, res.data.machine.name);
      if (importRes.data.success) {
        ElMessage.success('导入成功');
        showExamplesDialog.value = false;
        loadProjects();
        router.push(`/editor/${importRes.data.projectId}`);
      }
    }
  } catch (error) {
    ElMessage.error('导入示例失败');
  }
};

const openProject = (id: string) => {
  router.push(`/editor/${id}`);
};

const handleProjectCommand = async (cmd: { action: string; id: string }) => {
  switch (cmd.action) {
    case 'open':
      openProject(cmd.id);
      break;
    case 'export':
      window.open(`/api/projects/${cmd.id}/export?format=json&download=true`, '_blank');
      break;
    case 'delete':
      try {
        await ElMessageBox.confirm('确定要删除此项目吗？此操作不可恢复', '删除确认', {
          type: 'warning'
        });
        await projectApi.delete(cmd.id);
        ElMessage.success('删除成功');
        loadProjects();
      } catch {
        // 取消删除
      }
      break;
  }
};

onMounted(() => {
  loadProjects();
});
</script>

<template>
  <div>
    <el-card v-if="userStore.user?.role === 'admin'">
      <template #header>
        <div class="page-header" style="margin: 0;">
          <span>用户管理</span>
          <el-button type="success" @click="openCreateDialog">
            <el-icon><Plus /></el-icon>
            新增用户
          </el-button>
        </div>
      </template>
      <el-table :data="users" v-loading="loading" stripe>
        <el-table-column prop="username" label="用户名" width="150" />
        <el-table-column prop="email" label="邮箱" width="250" />
        <el-table-column prop="full_name" label="姓名" width="150" />
        <el-table-column prop="department" label="部门" width="150" />
        <el-table-column prop="role" label="角色" width="100">
          <template #default="{ row }">
            <el-tag :type="row.role === 'admin' ? 'danger' : 'primary'" size="small">
              {{ row.role === 'admin' ? '管理员' : '普通用户' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="is_active" label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.is_active ? 'success' : 'danger'" size="small">
              {{ row.is_active ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button type="primary" link size="small" @click="editUser(row)">
                编辑
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.pageSize"
        :total="pagination.total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        style="margin-top: 20px; justify-content: flex-end;"
        @size-change="loadUsers"
        @current-change="loadUsers"
      />
    </el-card>

    <el-alert v-else type="warning" title="无权限" description="您没有权限访问此页面" show-icon />

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="500px">
      <el-form :model="form" :rules="formRules" ref="formRef" label-width="100px">
        <el-form-item label="用户名" prop="username" v-if="!isEdit">
          <el-input v-model="form.username" />
        </el-form-item>
        <el-form-item label="密码" prop="password" v-if="!isEdit">
          <el-input v-model="form.password" type="password" show-password />
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="form.email" />
        </el-form-item>
        <el-form-item label="姓名" prop="full_name">
          <el-input v-model="form.full_name" />
        </el-form-item>
        <el-form-item label="部门">
          <el-input v-model="form.department" />
        </el-form-item>
        <el-form-item label="角色" v-if="isEdit">
          <el-select v-model="form.role" style="width: 100%;">
            <el-option label="普通用户" value="user" />
            <el-option label="管理员" value="admin" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态" v-if="isEdit">
          <el-switch v-model="form.is_active" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveUser">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { getUsers, updateUser } from '@/api/auth'
import { useUserStore } from '@/stores/user'
import { register } from '@/api/auth'
import dayjs from 'dayjs'

const userStore = useUserStore()

const loading = ref(false)
const users = ref([])
const pagination = reactive({
  page: 1,
  pageSize: 20,
  total: 0
})

const dialogVisible = ref(false)
const isEdit = ref(false)
const saving = ref(false)
const formRef = ref(null)
const form = reactive({
  id: '',
  username: '',
  password: '',
  email: '',
  full_name: '',
  department: '',
  role: 'user',
  is_active: true,
  version: 0
})

const formRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
  email: [
    { required: true, message: '请输入邮箱', trigger: 'blur' },
    { type: 'email', message: '请输入正确的邮箱格式', trigger: 'blur' }
  ],
  full_name: [{ required: true, message: '请输入姓名', trigger: 'blur' }]
}

const dialogTitle = computed(() => isEdit.value ? '编辑用户' : '新增用户')

function formatDate(date) {
  return dayjs(date).format('YYYY-MM-DD HH:mm')
}

async function loadUsers() {
  loading.value = true
  try {
    const res = await getUsers({
      page: pagination.page,
      page_size: pagination.pageSize
    })
    users.value = res.users || []
    pagination.total = res.total || 0
  } catch (error) {
    console.error('Failed to load users:', error)
  } finally {
    loading.value = false
  }
}

function openCreateDialog() {
  isEdit.value = false
  Object.assign(form, {
    id: '',
    username: '',
    password: '',
    email: '',
    full_name: '',
    department: '',
    role: 'user',
    is_active: true
  })
  dialogVisible.value = true
}

function editUser(row) {
  isEdit.value = true
  Object.assign(form, {
    id: row.id,
    username: row.username,
    email: row.email,
    full_name: row.full_name,
    department: row.department,
    role: row.role,
    is_active: row.is_active,
    version: row.version
  })
  dialogVisible.value = true
}

async function saveUser() {
  try {
    if (!isEdit.value) {
      await formRef.value.validate()
    }
    saving.value = true

    if (isEdit.value) {
      await updateUser(form.id, {
        email: form.email,
        full_name: form.full_name,
        department: form.department,
        role: form.role,
        is_active: form.is_active
      }, form.version)
      ElMessage.success('用户更新成功')
    } else {
      await register({
        username: form.username,
        password: form.password,
        email: form.email,
        full_name: form.full_name,
        department: form.department
      })
      ElMessage.success('用户创建成功')
    }

    dialogVisible.value = false
    loadUsers()
  } catch (error) {
    console.error('Failed to save user:', error)
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  loadUsers()
})
</script>

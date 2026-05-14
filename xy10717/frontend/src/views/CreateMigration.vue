<template>
  <div class="create-migration">
    <el-card>
      <template #header>
        <span>新建迁移脚本</span>
      </template>

      <el-form :model="form" label-width="120px" :rules="rules" ref="formRef">
        <el-form-item label="脚本名称" prop="name">
          <el-input v-model="form.name" placeholder="请输入脚本名称" />
        </el-form-item>

        <el-form-item label="描述" prop="description">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="请输入描述" />
        </el-form-item>

        <el-form-item label="数据库类型" prop="database_type">
          <el-select v-model="form.database_type" placeholder="请选择数据库类型">
            <el-option label="MySQL" value="mysql" />
            <el-option label="PostgreSQL" value="postgresql" />
            <el-option label="Oracle" value="oracle" />
            <el-option label="SQL Server" value="sqlserver" />
          </el-select>
        </el-form-item>

        <el-form-item label="创建人" prop="created_by">
          <el-input v-model="form.created_by" placeholder="请输入创建人姓名" />
        </el-form-item>

        <el-form-item label="脚本内容" prop="script_content">
          <el-input
            v-model="form.script_content"
            type="textarea"
            :rows="10"
            placeholder="请输入SQL脚本内容"
          />
        </el-form-item>

        <el-divider content-position="left">影响表</el-divider>
        <el-button type="primary" size="small" @click="addAffectedTable" style="margin-bottom: 15px;">
          添加影响表
        </el-button>
        <el-table :data="form.affected_tables" border>
          <el-table-column prop="table_name" label="表名" min-width="150">
            <template #default="{ row, $index }">
              <el-input v-model="row.table_name" size="small" />
            </template>
          </el-table-column>
          <el-table-column prop="operation_type" label="操作类型" width="120">
            <template #default="{ row }">
              <el-select v-model="row.operation_type" size="small">
                <el-option label="CREATE" value="CREATE" />
                <el-option label="ALTER" value="ALTER" />
                <el-option label="DROP" value="DROP" />
                <el-option label="UPDATE" value="UPDATE" />
                <el-option label="DELETE" value="DELETE" />
                <el-option label="SELECT" value="SELECT" />
              </el-select>
            </template>
          </el-table-column>
          <el-table-column prop="estimated_rows" label="预估行数" width="120">
            <template #default="{ row }">
              <el-input-number v-model="row.estimated_rows" size="small" :min="0" />
            </template>
          </el-table-column>
          <el-table-column prop="has_backup" label="已备份" width="100">
            <template #default="{ row }">
              <el-switch v-model="row.has_backup" />
            </template>
          </el-table-column>
          <el-table-column prop="remarks" label="备注" min-width="150">
            <template #default="{ row }">
              <el-input v-model="row.remarks" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80" fixed="right">
            <template #default="{ $index }">
              <el-button type="danger" size="small" @click="removeAffectedTable($index)">
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-divider content-position="left">回滚脚本</el-divider>
        <el-button type="primary" size="small" @click="addRollbackScript" style="margin-bottom: 15px;">
          添加回滚脚本
        </el-button>
        <el-table :data="form.rollback_scripts" border>
          <el-table-column prop="script_content" label="脚本内容" min-width="300">
            <template #default="{ row }">
              <el-input v-model="row.script_content" type="textarea" :rows="3" size="small" />
            </template>
          </el-table-column>
          <el-table-column prop="remarks" label="备注" min-width="150">
            <template #default="{ row }">
              <el-input v-model="row.remarks" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="80" fixed="right">
            <template #default="{ $index }">
              <el-button type="danger" size="small" @click="removeRollbackScript($index)">
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-form-item style="margin-top: 20px;">
          <el-button type="primary" @click="submitForm" :loading="submitting">
            提交
          </el-button>
          <el-button @click="$router.push('/')">
            取消
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useMigrationStore } from '@/stores/migration'

const router = useRouter()
const migrationStore = useMigrationStore()
const formRef = ref(null)
const submitting = ref(false)

const form = reactive({
  name: '',
  description: '',
  database_type: 'mysql',
  created_by: '',
  script_content: '',
  affected_tables: [],
  execution_windows: [],
  rollback_scripts: []
})

const rules = {
  name: [
    { required: true, message: '请输入脚本名称', trigger: 'blur' }
  ],
  script_content: [
    { required: true, message: '请输入脚本内容', trigger: 'blur' }
  ]
}

const addAffectedTable = () => {
  form.affected_tables.push({
    table_name: '',
    operation_type: 'ALTER',
    estimated_rows: 0,
    has_backup: false,
    remarks: ''
  })
}

const removeAffectedTable = (index) => {
  form.affected_tables.splice(index, 1)
}

const addRollbackScript = () => {
  form.rollback_scripts.push({
    script_content: '',
    remarks: ''
  })
}

const removeRollbackScript = (index) => {
  form.rollback_scripts.splice(index, 1)
}

const submitForm = async () => {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (valid) {
      submitting.value = true
      try {
        await migrationStore.createMigration(form)
        ElMessage.success('创建成功')
        router.push('/')
      } catch (error) {
        ElMessage.error('创建失败')
      } finally {
        submitting.value = false
      }
    }
  })
}
</script>
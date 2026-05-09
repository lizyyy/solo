<template>
  <div class="products">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>商品管理</span>
          <el-button type="primary" @click="openCreateDialog">
            <el-icon><Plus /></el-icon>
            新建商品
          </el-button>
        </div>
      </template>

      <div class="search-bar">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索商品编码、名称或条码"
          style="width: 300px"
          clearable
          @keyup.enter="loadProducts"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-button type="primary" @click="loadProducts">
          搜索
        </el-button>
      </div>

      <el-table :data="products" v-loading="loading" style="width: 100%">
        <el-table-column prop="code" label="商品编码" width="150" />
        <el-table-column prop="name" label="商品名称" />
        <el-table-column prop="barcode" label="条码" width="150" />
        <el-table-column prop="specification" label="规格" width="150" />
        <el-table-column prop="unit" label="单位" width="80" />
        <el-table-column label="状态" width="100">
          <template #default="scope">
            <el-tag :type="scope.row.isActive ? 'success' : 'info'">
              {{ scope.row.isActive ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="scope">
            {{ formatDate(scope.row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="scope">
            <el-button type="primary" size="small" link @click="editProduct(scope.row)">
              编辑
            </el-button>
            <el-button type="danger" size="small" link @click="deleteProduct(scope.row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadProducts"
          @current-change="loadProducts"
        />
      </div>
    </el-card>

    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑商品' : '新建商品'"
      width="600px"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="formRules"
        label-width="100px"
      >
        <el-form-item label="商品编码" prop="code">
          <el-input v-model="form.code" :disabled="isEdit" />
        </el-form-item>
        <el-form-item label="商品名称" prop="name">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="条码">
          <el-input v-model="form.barcode" />
        </el-form-item>
        <el-form-item label="规格">
          <el-input v-model="form.specification" />
        </el-form-item>
        <el-form-item label="单位">
          <el-select v-model="form.unit" style="width: 100%">
            <el-option label="个" value="个" />
            <el-option label="台" value="台" />
            <el-option label="把" value="把" />
            <el-option label="箱" value="箱" />
            <el-option label="件" value="件" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="form.isActive" active-text="启用" inactive-text="禁用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitForm">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search } from '@element-plus/icons-vue'
import { productApi } from '@/services/api'

export default {
  name: 'Products',
  components: {
    Plus,
    Search
  },
  setup() {
    const loading = ref(false)
    const products = ref([])
    const searchKeyword = ref('')
    const dialogVisible = ref(false)
    const isEdit = ref(false)
    const submitting = ref(false)
    const formRef = ref(null)
    
    const pagination = reactive({
      page: 1,
      pageSize: 20,
      total: 0
    })
    
    const form = reactive({
      id: null,
      code: '',
      name: '',
      barcode: '',
      specification: '',
      unit: '个',
      isActive: true,
      version: 1
    })
    
    const formRules = {
      code: [
        { required: true, message: '请输入商品编码', trigger: 'blur' }
      ],
      name: [
        { required: true, message: '请输入商品名称', trigger: 'blur' }
      ]
    }
    
    const loadProducts = async () => {
      try {
        loading.value = true
        
        const params = {
          page: pagination.page,
          pageSize: pagination.pageSize
        }
        
        if (searchKeyword.value) {
          params.keyword = searchKeyword.value
        }
        
        const response = await productApi.list(params)
        products.value = response.data.products
        pagination.total = response.data.pagination.total
      } catch (error) {
        console.error('加载商品列表失败:', error)
      } finally {
        loading.value = false
      }
    }
    
    const openCreateDialog = () => {
      form.id = null
      form.code = ''
      form.name = ''
      form.barcode = ''
      form.specification = ''
      form.unit = '个'
      form.isActive = true
      form.version = 1
      isEdit.value = false
      dialogVisible.value = true
    }
    
    const editProduct = (row) => {
      form.id = row.id
      form.code = row.code
      form.name = row.name
      form.barcode = row.barcode
      form.specification = row.specification
      form.unit = row.unit
      form.isActive = row.isActive
      form.version = row.version
      isEdit.value = true
      dialogVisible.value = true
    }
    
    const deleteProduct = async (row) => {
      try {
        await ElMessageBox.confirm(
          `确定要删除商品「${row.name}」吗？`,
          '提示',
          {
            confirmButtonText: '确定',
            cancelButtonText: '取消',
            type: 'warning'
          }
        )
        
        await productApi.delete(row.id)
        ElMessage.success('删除成功')
        loadProducts()
      } catch {
      }
    }
    
    const submitForm = async () => {
      try {
        await formRef.value.validate()
        submitting.value = true
        
        if (isEdit.value) {
          await productApi.update(form.id, { ...form })
        } else {
          await productApi.create({ ...form })
        }
        
        dialogVisible.value = false
        ElMessage.success('保存成功')
        loadProducts()
      } catch (error) {
        console.error('保存失败:', error)
      } finally {
        submitting.value = false
      }
    }
    
    const formatDate = (date) => {
      if (!date) return '-'
      return new Date(date).toLocaleString('zh-CN')
    }
    
    onMounted(() => {
      loadProducts()
    })
    
    return {
      loading,
      products,
      searchKeyword,
      pagination,
      dialogVisible,
      isEdit,
      submitting,
      formRef,
      form,
      formRules,
      loadProducts,
      openCreateDialog,
      editProduct,
      deleteProduct,
      submitForm,
      formatDate,
      Plus,
      Search
    }
  }
}
</script>

<style scoped>
.products {
  padding: 0;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.search-bar {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>

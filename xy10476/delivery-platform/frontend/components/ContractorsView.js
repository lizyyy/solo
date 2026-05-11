(function() {
  const { ref, onMounted } = Vue;

  const ContractorsView = {
    template: `
      <div>
        <div class="page-header">
          <div class="page-title">
            <el-icon><User /></el-icon>
            <span>施工方管理</span>
          </div>
          <div>
            <el-button type="primary" @click="openCreate" :icon="Plus">新增施工方</el-button>
          </div>
        </div>

        <div class="search-bar">
          <el-select v-model="searchCategory" placeholder="筛选分类" clearable @change="loadContractors">
            <el-option v-for="c in PROBLEM_CATEGORIES" :key="c" :label="c" :value="c" />
          </el-select>
          <el-button @click="resetSearch" :icon="Refresh">重置</el-button>
        </div>

        <el-table :data="contractors" v-loading="loading" stripe>
          <el-table-column prop="name" label="施工方名称" width="200" />
          <el-table-column prop="contact_person" label="联系人" width="120" />
          <el-table-column prop="phone" label="联系电话" width="150" />
          <el-table-column label="业务分类" width="150">
            <template #default="{ row }">
              <el-tag v-if="row.category" size="small">{{ row.category }}</el-tag>
              <span v-else style="color: #909399;">未分类</span>
            </template>
          </el-table-column>
          <el-table-column prop="created_at" label="创建时间" />
          <el-table-column label="操作" width="180" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
              <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-dialog v-model="dialogVisible" :title="dialogTitle" width="500px">
          <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
            <el-form-item label="施工方名称" prop="name">
              <el-input v-model="form.name" placeholder="如：墙面施工队" />
            </el-form-item>
            <el-form-item label="联系人" prop="contact_person">
              <el-input v-model="form.contact_person" placeholder="如：张工" />
            </el-form-item>
            <el-form-item label="联系电话" prop="phone">
              <el-input v-model="form.phone" placeholder="如：13800138001" />
            </el-form-item>
            <el-form-item label="业务分类" prop="category">
              <el-select v-model="form.category" placeholder="选择分类" style="width: 100%;">
                <el-option v-for="c in PROBLEM_CATEGORIES" :key="c" :label="c" :value="c" />
              </el-select>
            </el-form-item>
          </el-form>
          <template #footer>
            <el-button @click="dialogVisible = false">取消</el-button>
            <el-button type="primary" @click="handleSubmit">确定</el-button>
          </template>
        </el-dialog>
      </div>
    `,
    setup() {
      const contractors = ref([]);
      const loading = ref(false);
      const searchCategory = ref('');
      const dialogVisible = ref(false);
      const dialogTitle = ref('');
      const isEdit = ref(false);
      const formRef = ref(null);

      const form = ref({
        id: null,
        name: '',
        contact_person: '',
        phone: '',
        category: ''
      });

      const rules = {
        name: [{ required: true, message: '请输入施工方名称', trigger: 'blur' }]
      };

      const loadContractors = async () => {
        loading.value = true;
        try {
          const params = {};
          if (searchCategory.value) params.category = searchCategory.value;
          const res = await api.contractors.list(params);
          if (res.data.code === 0) {
            contractors.value = res.data.data;
          }
        } catch (error) {
          handleError(error, '加载施工方数据失败');
        } finally {
          loading.value = false;
        }
      };

      const resetSearch = () => {
        searchCategory.value = '';
        loadContractors();
      };

      const openCreate = () => {
        isEdit.value = false;
        dialogTitle.value = '新增施工方';
        form.value = {
          id: null,
          name: '',
          contact_person: '',
          phone: '',
          category: ''
        };
        dialogVisible.value = true;
      };

      const openEdit = (row) => {
        isEdit.value = true;
        dialogTitle.value = '编辑施工方';
        form.value = { ...row };
        dialogVisible.value = true;
      };

      const handleSubmit = async () => {
        if (!formRef.value) return;
        try {
          await formRef.value.validate();
          
          if (isEdit.value) {
            await api.contractors.update(form.value.id, form.value);
            handleSuccess('更新成功');
          } else {
            await api.contractors.create(form.value);
            handleSuccess('创建成功');
          }
          
          dialogVisible.value = false;
          loadContractors();
        } catch (error) {
          if (error !== false) {
            handleError(error);
          }
        }
      };

      const handleDelete = (row) => {
        ElementPlus.ElMessageBox.confirm(
          `确定要删除「${row.name}」吗？`,
          '删除确认',
          { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
        ).then(async () => {
          try {
            await api.contractors.delete(row.id);
            handleSuccess('删除成功');
            loadContractors();
          } catch (error) {
            handleError(error);
          }
        }).catch(() => {});
      };

      onMounted(() => {
        loadContractors();
      });

      const { User, Plus, Refresh } = ElementPlusIconsVue;

      return {
        contractors,
        loading,
        searchCategory,
        dialogVisible,
        dialogTitle,
        form,
        formRef,
        rules,
        loadContractors,
        resetSearch,
        openCreate,
        openEdit,
        handleSubmit,
        handleDelete,
        PROBLEM_CATEGORIES,
        api,
        User,
        Plus,
        Refresh
      };
    }
  };

  window.ContractorsView = ContractorsView;
})();

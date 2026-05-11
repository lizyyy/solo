(function() {
  const { ref, onMounted } = Vue;

  const BuildingsView = {
    template: `
      <div>
        <div class="page-header">
          <div class="page-title">
            <el-icon><OfficeBuilding /></el-icon>
            <span>楼栋房号</span>
          </div>
          <div>
            <el-button type="primary" @click="openCreate" :icon="Plus">新增房号</el-button>
          </div>
        </div>

        <div class="search-bar">
          <el-select v-model="searchBuilding" placeholder="筛选楼栋" clearable @change="loadBuildings">
            <el-option 
              v-for="b in uniqueBuildings" 
              :key="b" 
              :label="b" 
              :value="b" 
            />
          </el-select>
          <el-select v-model="searchStatus" placeholder="筛选交付状态" clearable @change="loadBuildings">
            <el-option label="未交付" value="未交付" />
            <el-option label="交付中" value="交付中" />
            <el-option label="已交付" value="已交付" />
          </el-select>
          <el-button @click="resetSearch" :icon="Refresh">重置</el-button>
          <el-button type="success" @click="api.export.rooms()" :icon="Download">导出交付状态</el-button>
        </div>

        <el-table :data="buildings" v-loading="loading" stripe>
          <el-table-column prop="building_no" label="楼栋" width="100" />
          <el-table-column prop="unit_no" label="单元" width="100" />
          <el-table-column prop="room_no" label="房号" width="100" />
          <el-table-column prop="owner_name" label="业主姓名" width="120" />
          <el-table-column prop="owner_phone" label="业主电话" width="140" />
          <el-table-column prop="delivery_date" label="交付日期" width="120" />
          <el-table-column label="交付状态" width="100">
            <template #default="{ row }">
              <el-tag :type="getStatusTagType(row.status)">{{ row.status }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="问题统计" width="300">
            <template #default="{ row }">
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <el-tag size="small" v-if="row.pending_dispatch > 0" type="info">待派单 {{ row.pending_dispatch }}</el-tag>
                <el-tag size="small" v-if="row.pending_fix > 0" type="warning">待整改 {{ row.pending_fix }}</el-tag>
                <el-tag size="small" v-if="row.pending_recheck > 0" type="primary">待复验 {{ row.pending_recheck }}</el-tag>
                <el-tag size="small" v-if="row.completed > 0" type="success">已完成 {{ row.completed }}</el-tag>
                <el-tag size="small" v-if="row.total_problems === 0" effect="plain">暂无问题</el-tag>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="180" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="openEdit(row)">编辑</el-button>
              <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-dialog v-model="dialogVisible" :title="dialogTitle" width="600px">
          <el-form :model="form" :rules="rules" ref="formRef" label-width="100px">
            <el-row :gutter="20">
              <el-col :span="8">
                <el-form-item label="楼栋" prop="building_no">
                  <el-input v-model="form.building_no" placeholder="如：1栋" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="单元" prop="unit_no">
                  <el-input v-model="form.unit_no" placeholder="如：1单元" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="房号" prop="room_no">
                  <el-input v-model="form.room_no" placeholder="如：101" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="业主姓名" prop="owner_name">
                  <el-input v-model="form.owner_name" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="业主电话" prop="owner_phone">
                  <el-input v-model="form.owner_phone" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="交付日期">
                  <el-date-picker 
                    v-model="form.delivery_date" 
                    type="date" 
                    value-format="YYYY-MM-DD"
                    style="width: 100%;" 
                  />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="交付状态">
                  <el-select v-model="form.status" style="width: 100%;">
                    <el-option label="未交付" value="未交付" />
                    <el-option label="交付中" value="交付中" />
                    <el-option label="已交付" value="已交付" />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>
          </el-form>
          <template #footer>
            <el-button @click="dialogVisible = false">取消</el-button>
            <el-button type="primary" @click="handleSubmit">确定</el-button>
          </template>
        </el-dialog>
      </div>
    `,
    setup() {
      const buildings = ref([]);
      const loading = ref(false);
      const searchBuilding = ref('');
      const searchStatus = ref('');
      const dialogVisible = ref(false);
      const dialogTitle = ref('');
      const isEdit = ref(false);
      const formRef = ref(null);

      const form = ref({
        id: null,
        building_no: '',
        unit_no: '',
        room_no: '',
        owner_name: '',
        owner_phone: '',
        delivery_date: '',
        status: '未交付'
      });

      const rules = {
        building_no: [{ required: true, message: '请输入楼栋', trigger: 'blur' }],
        unit_no: [{ required: true, message: '请输入单元', trigger: 'blur' }],
        room_no: [{ required: true, message: '请输入房号', trigger: 'blur' }]
      };

      const uniqueBuildings = ref([]);

      const loadBuildings = async () => {
        loading.value = true;
        try {
          const params = {};
          if (searchBuilding.value) params.building_no = searchBuilding.value;
          if (searchStatus.value) params.status = searchStatus.value;
          const res = await api.buildings.list(params);
          if (res.data.code === 0) {
            buildings.value = res.data.data;
            const set = new Set(buildings.value.map(b => b.building_no));
            uniqueBuildings.value = Array.from(set);
          }
        } catch (error) {
          handleError(error, '加载楼栋数据失败');
        } finally {
          loading.value = false;
        }
      };

      const resetSearch = () => {
        searchBuilding.value = '';
        searchStatus.value = '';
        loadBuildings();
      };

      const getStatusTagType = (status) => {
        const map = {
          '未交付': 'info',
          '交付中': 'warning',
          '已交付': 'success'
        };
        return map[status] || 'info';
      };

      const openCreate = () => {
        isEdit.value = false;
        dialogTitle.value = '新增房号';
        form.value = {
          id: null,
          building_no: '',
          unit_no: '',
          room_no: '',
          owner_name: '',
          owner_phone: '',
          delivery_date: '',
          status: '未交付'
        };
        dialogVisible.value = true;
      };

      const openEdit = (row) => {
        isEdit.value = true;
        dialogTitle.value = '编辑房号';
        form.value = { ...row };
        dialogVisible.value = true;
      };

      const handleSubmit = async () => {
        if (!formRef.value) return;
        try {
          await formRef.value.validate();
          
          if (isEdit.value) {
            await api.buildings.update(form.value.id, form.value);
            handleSuccess('更新成功');
          } else {
            await api.buildings.create(form.value);
            handleSuccess('创建成功');
          }
          
          dialogVisible.value = false;
          loadBuildings();
        } catch (error) {
          if (error !== false) {
            handleError(error);
          }
        }
      };

      const handleDelete = (row) => {
        ElementPlus.ElMessageBox.confirm(
          `确定要删除 ${row.building_no}-${row.unit_no}-${row.room_no} 吗？`,
          '删除确认',
          { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
        ).then(async () => {
          try {
            await api.buildings.delete(row.id);
            handleSuccess('删除成功');
            loadBuildings();
          } catch (error) {
            handleError(error);
          }
        }).catch(() => {});
      };

      onMounted(() => {
        loadBuildings();
      });

      const { OfficeBuilding, Plus, Refresh, Download } = ElementPlusIconsVue;

      return {
        buildings,
        loading,
        searchBuilding,
        searchStatus,
        uniqueBuildings,
        dialogVisible,
        dialogTitle,
        form,
        formRef,
        rules,
        loadBuildings,
        resetSearch,
        getStatusTagType,
        openCreate,
        openEdit,
        handleSubmit,
        handleDelete,
        api,
        OfficeBuilding,
        Plus,
        Refresh,
        Download
      };
    }
  };

  window.BuildingsView = BuildingsView;
})();

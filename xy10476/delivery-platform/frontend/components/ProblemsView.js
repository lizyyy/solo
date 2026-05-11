(function() {
  const { ref, onMounted } = Vue;

  const ProblemsView = {
    template: `
      <div>
        <div class="page-header">
          <div class="page-title">
            <el-icon><Warning /></el-icon>
            <span>验房问题</span>
          </div>
          <div>
            <el-button type="primary" @click="openCreate" :icon="Plus">新增问题</el-button>
          </div>
        </div>

        <div class="search-bar">
          <el-select v-model="searchBuildingId" placeholder="选择房号" clearable style="width: 200px;" @change="loadProblems">
            <el-option 
              v-for="b in buildings" 
              :key="b.id" 
              :label="\`\${b.building_no}-\${b.unit_no}-\${b.room_no}\`" 
              :value="b.id" 
            />
          </el-select>
          <el-select v-model="searchStatus" placeholder="选择状态" clearable @change="loadProblems">
            <el-option label="待派单" value="待派单" />
            <el-option label="待整改" value="待整改" />
            <el-option label="待复验" value="待复验" />
            <el-option label="已完成" value="已完成" />
          </el-select>
          <el-select v-model="searchType" placeholder="问题类型" clearable @change="loadProblems">
            <el-option v-for="t in PROBLEM_TYPES" :key="t" :label="t" :value="t" />
          </el-select>
          <el-select v-model="searchOwnerConfirmed" placeholder="业主确认" clearable @change="loadProblems">
            <el-option label="未确认" :value="0" />
            <el-option label="已确认" :value="1" />
          </el-select>
          <el-button @click="resetSearch" :icon="Refresh">重置</el-button>
          <el-button type="success" @click="api.export.problems()" :icon="Download">导出全部</el-button>
        </div>

        <el-table :data="problems" v-loading="loading" stripe>
          <el-table-column label="房号" width="140">
            <template #default="{ row }">
              <span style="font-weight: bold;">{{ row.building_no }}-{{ row.unit_no }}-{{ row.room_no }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="problem_type" label="问题类型" width="120">
            <template #default="{ row }">
              <el-tag :type="getProblemTypeTag(row.problem_type)" size="small">{{ row.problem_type }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="description" label="问题描述" min-width="200" show-overflow-tooltip />
          <el-table-column prop="inspection_date" label="验房日期" width="120" />
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="PROBLEM_STATUS_MAP[row.status]?.type" size="small">{{ row.status }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="施工方/截止" width="160">
            <template #default="{ row }">
              <div v-if="row.latest_order">
                <div style="font-size: 12px;">{{ row.latest_order.contractor_name }}</div>
                <div style="font-size: 11px; color: #909399;">
                  截止: {{ row.latest_order.deadline }}
                  <span v-if="row.latest_order.is_overdue" style="color: #f56c6c;"> (逾期{{ row.latest_order.overdue_days }}天)</span>
                </div>
              </div>
              <span v-else style="color: #909399;">未派单</span>
            </template>
          </el-table-column>
          <el-table-column label="业主确认" width="100">
            <template #default="{ row }">
              <el-tag v-if="row.owner_confirmed === 1" type="success" size="small">已确认</el-tag>
              <span v-else style="color: #909399;">未确认</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="320" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="openDetail(row)">详情</el-button>
              <el-button 
                link 
                type="primary" 
                size="small" 
                @click="openAssign(row)"
                :disabled="row.status === '已完成' || row.owner_confirmed === 1"
              >派单</el-button>
              <el-button 
                link 
                type="success" 
                size="small" 
                @click="openRecheck(row)"
                :disabled="row.status === '待派单' || row.status === '已完成' || row.owner_confirmed === 1"
              >复验</el-button>
              <el-button 
                link 
                type="warning" 
                size="small" 
                @click="handleOwnerConfirm(row)"
                :disabled="row.status !== '已完成' || row.owner_confirmed === 1"
              >业主确认</el-button>
              <el-button 
                link 
                type="danger" 
                size="small" 
                @click="handleDelete(row)"
                :disabled="row.owner_confirmed === 1"
              >删除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-dialog v-model="createDialogVisible" title="新增验房问题" width="600px">
          <el-form :model="createForm" :rules="createRules" ref="createFormRef" label-width="100px">
            <el-form-item label="房号" prop="building_id">
              <el-select v-model="createForm.building_id" placeholder="选择房号" style="width: 100%;">
                <el-option 
                  v-for="b in buildings" 
                  :key="b.id" 
                  :label="\`\${b.building_no}-\${b.unit_no}-\${b.room_no} (\${b.owner_name || '未登记业主'})\`" 
                  :value="b.id" 
                />
              </el-select>
            </el-form-item>
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="问题类型" prop="problem_type">
                  <el-select v-model="createForm.problem_type" placeholder="选择类型" style="width: 100%;">
                    <el-option v-for="t in PROBLEM_TYPES" :key="t" :label="t" :value="t" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="问题分类" prop="problem_category">
                  <el-select v-model="createForm.problem_category" placeholder="选择分类" style="width: 100%;">
                    <el-option v-for="c in PROBLEM_CATEGORIES" :key="c" :label="c" :value="c" />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>
            <el-form-item label="问题描述" prop="description">
              <el-input v-model="createForm.description" type="textarea" :rows="3" placeholder="请详细描述问题" />
            </el-form-item>
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="位置">
                  <el-input v-model="createForm.location" placeholder="如：客厅北墙" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="验房日期" prop="inspection_date">
                  <el-date-picker 
                    v-model="createForm.inspection_date" 
                    type="date" 
                    value-format="YYYY-MM-DD"
                    style="width: 100%;" 
                  />
                </el-form-item>
              </el-col>
            </el-row>
          </el-form>
          <template #footer>
            <el-button @click="createDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="handleCreate">确定</el-button>
          </template>
        </el-dialog>

        <el-dialog v-model="assignDialogVisible" title="派单" width="500px">
          <el-form :model="assignForm" :rules="assignRules" ref="assignFormRef" label-width="100px">
            <el-form-item label="房号">
              <span style="font-weight: bold;">{{ currentProblem?.building_no }}-{{ currentProblem?.unit_no }}-{{ currentProblem?.room_no }}</span>
            </el-form-item>
            <el-form-item label="问题">
              <span>{{ currentProblem?.problem_type }} - {{ currentProblem?.description }}</span>
            </el-form-item>
            <el-form-item label="施工方" prop="contractor_id">
              <el-select v-model="assignForm.contractor_id" placeholder="选择施工方" style="width: 100%;">
                <el-option 
                  v-for="c in contractors" 
                  :key="c.id" 
                  :label="\`\${c.name} (\${c.category || '综合'})\`" 
                  :value="c.id" 
                />
              </el-select>
            </el-form-item>
            <el-form-item label="截止日期" prop="deadline">
              <el-date-picker 
                v-model="assignForm.deadline" 
                type="date" 
                value-format="YYYY-MM-DD"
                style="width: 100%;" 
              />
            </el-form-item>
          </el-form>
          <template #footer>
            <el-button @click="assignDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="handleAssign">确定派单</el-button>
          </template>
        </el-dialog>

        <el-dialog v-model="recheckDialogVisible" title="复验" width="500px">
          <el-form :model="recheckForm" :rules="recheckRules" ref="recheckFormRef" label-width="100px">
            <el-form-item label="房号">
              <span style="font-weight: bold;">{{ currentProblem?.building_no }}-{{ currentProblem?.unit_no }}-{{ currentProblem?.room_no }}</span>
            </el-form-item>
            <el-form-item label="问题">
              <span>{{ currentProblem?.problem_type }} - {{ currentProblem?.description }}</span>
            </el-form-item>
            <el-form-item label="复验结果" prop="result">
              <el-radio-group v-model="recheckForm.result">
                <el-radio value="通过">通过</el-radio>
                <el-radio value="不通过">不通过</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="复验日期" prop="recheck_date">
              <el-date-picker 
                v-model="recheckForm.recheck_date" 
                type="date" 
                value-format="YYYY-MM-DD"
                style="width: 100%;" 
              />
            </el-form-item>
            <el-form-item label="备注">
              <el-input v-model="recheckForm.remarks" type="textarea" :rows="2" placeholder="复验备注" />
            </el-form-item>
          </el-form>
          <template #footer>
            <el-button @click="recheckDialogVisible = false">取消</el-button>
            <el-button type="primary" @click="handleRecheck">确定</el-button>
          </template>
        </el-dialog>

        <el-dialog v-model="detailDialogVisible" title="问题详情" width="700px" class="detail-dialog">
          <template v-if="currentProblem">
            <el-descriptions :column="2" border>
              <el-descriptions-item label="房号">
                {{ currentProblem.building_no }}-{{ currentProblem.unit_no }}-{{ currentProblem.room_no }}
              </el-descriptions-item>
              <el-descriptions-item label="业主">
                {{ currentProblem.owner_name }} ({{ currentProblem.owner_phone }})
              </el-descriptions-item>
              <el-descriptions-item label="问题类型">
                <el-tag :type="getProblemTypeTag(currentProblem.problem_type)">{{ currentProblem.problem_type }}</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="问题分类">{{ currentProblem.problem_category }}</el-descriptions-item>
              <el-descriptions-item label="问题描述" :span="2">{{ currentProblem.description }}</el-descriptions-item>
              <el-descriptions-item label="位置">{{ currentProblem.location }}</el-descriptions-item>
              <el-descriptions-item label="验房日期">{{ currentProblem.inspection_date }}</el-descriptions-item>
              <el-descriptions-item label="当前状态">
                <el-tag :type="PROBLEM_STATUS_MAP[currentProblem.status]?.type">{{ currentProblem.status }}</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="业主确认">
                <span v-if="currentProblem.owner_confirmed === 1" style="color: #67c23a;">
                  已确认 ({{ currentProblem.owner_confirm_time }})
                </span>
                <span v-else style="color: #909399;">未确认</span>
              </el-descriptions-item>
            </el-descriptions>

            <div class="section-title">派单记录 ({{ problemDetail?.work_orders?.length || 0 }})</div>
            <div v-if="problemDetail?.work_orders?.length > 0">
              <div v-for="(order, idx) in problemDetail.work_orders" :key="order.id" class="timeline-item">
                <div class="timeline-header">
                  <span style="font-weight: bold;">第 {{ problemDetail.work_orders.length - idx }} 次派单</span>
                  <div>
                    <el-tag :type="order.is_overdue ? 'danger' : 'info'" size="small" v-if="order.status !== '已完成'">
                      {{ order.status }}
                      <span v-if="order.is_overdue" style="color: #f56c6c;">(逾期{{ order.overdue_days }}天)</span>
                    </el-tag>
                    <el-tag type="success" size="small" v-else>已完成</el-tag>
                  </div>
                </div>
                <div style="margin-top: 6px;">
                  <div class="info-item"><span class="info-label">施工方：</span><span class="info-value">{{ order.contractor_name }}</span></div>
                  <div class="info-item"><span class="info-label">派单日期：</span><span class="info-value">{{ order.assigned_date }}</span></div>
                  <div class="info-item"><span class="info-label">截止日期：</span><span class="info-value">{{ order.deadline }}</span></div>
                </div>
              </div>
            </div>
            <div v-else class="empty-state" style="padding: 20px;">暂无派单记录</div>

            <div class="section-title">复验记录 ({{ problemDetail?.rechecks?.length || 0 }})</div>
            <div v-if="problemDetail?.rechecks?.length > 0">
              <div v-for="recheck in problemDetail.rechecks" :key="recheck.id" class="timeline-item">
                <div class="timeline-header">
                  <span style="font-weight: bold;">
                    复验结果：
                    <el-tag :type="recheck.result === '通过' ? 'success' : 'danger'" size="small">{{ recheck.result }}</el-tag>
                  </span>
                  <span class="timeline-date">复验日期：{{ recheck.recheck_date }}</span>
                </div>
                <div v-if="recheck.remarks" style="margin-top: 4px; color: #606266;">
                  备注：{{ recheck.remarks }}
                </div>
              </div>
            </div>
            <div v-else class="empty-state" style="padding: 20px;">暂无复验记录</div>

            <div class="section-title">赔付记录 ({{ problemDetail?.compensations?.length || 0 }})</div>
            <div v-if="problemDetail?.compensations?.length > 0">
              <div v-for="comp in problemDetail.compensations" :key="comp.id" class="timeline-item">
                <div class="timeline-header">
                  <span style="font-weight: bold; color: #f56c6c;">逾期 {{ comp.delay_days }} 天</span>
                  <span style="font-size: 18px; font-weight: bold; color: #f56c6c;">¥{{ comp.amount }}</span>
                </div>
                <div style="margin-top: 4px; color: #606266; font-size: 13px;">
                  {{ comp.calculation_basis }}
                </div>
              </div>
            </div>
            <div v-else class="empty-state" style="padding: 20px;">暂无赔付记录</div>
          </template>
        </el-dialog>
      </div>
    `,
    setup() {
      const problems = ref([]);
      const buildings = ref([]);
      const contractors = ref([]);
      const loading = ref(false);
      const searchBuildingId = ref('');
      const searchStatus = ref('');
      const searchType = ref('');
      const searchOwnerConfirmed = ref(null);

      const createDialogVisible = ref(false);
      const createFormRef = ref(null);
      const createForm = ref({
        building_id: '',
        problem_type: '',
        problem_category: '',
        description: '',
        location: '',
        inspection_date: ''
      });
      const createRules = {
        building_id: [{ required: true, message: '请选择房号', trigger: 'change' }],
        problem_type: [{ required: true, message: '请选择问题类型', trigger: 'change' }],
        description: [{ required: true, message: '请输入问题描述', trigger: 'blur' }],
        inspection_date: [{ required: true, message: '请选择验房日期', trigger: 'change' }]
      };

      const assignDialogVisible = ref(false);
      const assignFormRef = ref(null);
      const assignForm = ref({
        contractor_id: '',
        deadline: ''
      });
      const assignRules = {
        contractor_id: [{ required: true, message: '请选择施工方', trigger: 'change' }],
        deadline: [{ required: true, message: '请选择截止日期', trigger: 'change' }]
      };

      const recheckDialogVisible = ref(false);
      const recheckFormRef = ref(null);
      const recheckForm = ref({
        work_order_id: '',
        result: '通过',
        recheck_date: '',
        remarks: ''
      });
      const recheckRules = {
        result: [{ required: true, message: '请选择复验结果', trigger: 'change' }],
        recheck_date: [{ required: true, message: '请选择复验日期', trigger: 'change' }]
      };

      const detailDialogVisible = ref(false);
      const currentProblem = ref(null);
      const problemDetail = ref(null);

      const loadProblems = async () => {
        loading.value = true;
        try {
          const params = {};
          if (searchBuildingId.value) params.building_id = searchBuildingId.value;
          if (searchStatus.value) params.status = searchStatus.value;
          if (searchType.value) params.problem_type = searchType.value;
          if (searchOwnerConfirmed.value !== null) params.owner_confirmed = searchOwnerConfirmed.value;
          const res = await api.problems.list(params);
          if (res.data.code === 0) {
            problems.value = res.data.data;
          }
        } catch (error) {
          handleError(error, '加载问题列表失败');
        } finally {
          loading.value = false;
        }
      };

      const loadBuildings = async () => {
        try {
          const res = await api.buildings.list();
          if (res.data.code === 0) {
            buildings.value = res.data.data;
          }
        } catch (error) {
          handleError(error, '加载楼栋数据失败');
        }
      };

      const loadContractors = async () => {
        try {
          const res = await api.contractors.list();
          if (res.data.code === 0) {
            contractors.value = res.data.data;
          }
        } catch (error) {
          handleError(error, '加载施工方数据失败');
        }
      };

      const resetSearch = () => {
        searchBuildingId.value = '';
        searchStatus.value = '';
        searchType.value = '';
        searchOwnerConfirmed.value = null;
        loadProblems();
      };

      const getProblemTypeTag = (type) => {
        const map = {
          '墙面空鼓': 'warning',
          '门窗渗水': 'info',
          '电路问题': 'danger',
          '水管漏水': 'danger',
          '瓷砖脱落': 'warning',
          '墙面不平': 'info'
        };
        return map[type] || 'info';
      };

      const openCreate = () => {
        createForm.value = {
          building_id: '',
          problem_type: '',
          problem_category: '',
          description: '',
          location: '',
          inspection_date: ''
        };
        createDialogVisible.value = true;
      };

      const handleCreate = async () => {
        if (!createFormRef.value) return;
        try {
          await createFormRef.value.validate();
          await api.problems.create(createForm.value);
          handleSuccess('创建成功');
          createDialogVisible.value = false;
          loadProblems();
        } catch (error) {
          if (error !== false) {
            handleError(error);
          }
        }
      };

      const openAssign = (row) => {
        currentProblem.value = row;
        assignForm.value = {
          contractor_id: '',
          deadline: ''
        };
        assignDialogVisible.value = true;
      };

      const handleAssign = async () => {
        if (!assignFormRef.value || !currentProblem.value) return;
        try {
          await assignFormRef.value.validate();
          await api.problems.assign(currentProblem.value.id, assignForm.value);
          handleSuccess('派单成功');
          assignDialogVisible.value = false;
          loadProblems();
        } catch (error) {
          if (error !== false) {
            handleError(error);
          }
        }
      };

      const openRecheck = (row) => {
        currentProblem.value = row;
        recheckForm.value = {
          work_order_id: row.latest_order?.id || '',
          result: '通过',
          recheck_date: '',
          remarks: ''
        };
        recheckDialogVisible.value = true;
      };

      const handleRecheck = async () => {
        if (!recheckFormRef.value || !currentProblem.value) return;
        try {
          await recheckFormRef.value.validate();
          await api.problems.recheck(currentProblem.value.id, recheckForm.value);
          handleSuccess('复验记录已保存');
          recheckDialogVisible.value = false;
          loadProblems();
        } catch (error) {
          if (error !== false) {
            handleError(error);
          }
        }
      };

      const handleOwnerConfirm = async (row) => {
        ElementPlus.ElMessageBox.confirm(
          `确定将该问题标记为业主已确认吗？确认后将无法修改或重新派单。`,
          '业主确认',
          { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
        ).then(async () => {
          try {
            await api.problems.ownerConfirm(row.id);
            handleSuccess('业主确认成功');
            loadProblems();
          } catch (error) {
            handleError(error);
          }
        }).catch(() => {});
      };

      const openDetail = async (row) => {
        currentProblem.value = row;
        detailDialogVisible.value = true;
        try {
          const res = await api.problems.get(row.id);
          if (res.data.code === 0) {
            problemDetail.value = res.data.data;
          }
        } catch (error) {
          handleError(error, '加载详情失败');
        }
      };

      const handleDelete = (row) => {
        ElementPlus.ElMessageBox.confirm(
          `确定要删除该问题吗？`,
          '删除确认',
          { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
        ).then(async () => {
          try {
            await api.problems.delete(row.id);
            handleSuccess('删除成功');
            loadProblems();
          } catch (error) {
            handleError(error);
          }
        }).catch(() => {});
      };

      onMounted(() => {
        loadBuildings();
        loadContractors();
        loadProblems();
      });

      const { Warning, Plus, Refresh, Download } = ElementPlusIconsVue;

      return {
        problems,
        buildings,
        contractors,
        loading,
        searchBuildingId,
        searchStatus,
        searchType,
        searchOwnerConfirmed,
        createDialogVisible,
        createFormRef,
        createForm,
        createRules,
        assignDialogVisible,
        assignFormRef,
        assignForm,
        assignRules,
        recheckDialogVisible,
        recheckFormRef,
        recheckForm,
        recheckRules,
        detailDialogVisible,
        currentProblem,
        problemDetail,
        loadProblems,
        resetSearch,
        getProblemTypeTag,
        openCreate,
        handleCreate,
        openAssign,
        handleAssign,
        openRecheck,
        handleRecheck,
        handleOwnerConfirm,
        openDetail,
        handleDelete,
        PROBLEM_TYPES,
        PROBLEM_CATEGORIES,
        PROBLEM_STATUS_MAP,
        api,
        Warning,
        Plus,
        Refresh,
        Download
      };
    }
  };

  window.ProblemsView = ProblemsView;
})();

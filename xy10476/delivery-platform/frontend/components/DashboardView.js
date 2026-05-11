const DashboardView = {
  template: `
    <div>
      <div class="page-header">
        <div class="page-title">
          <el-icon><DataAnalysis /></el-icon>
          <span>总览看板</span>
        </div>
        <div>
          <el-button @click="loadStats" :icon="Refresh">刷新</el-button>
        </div>
      </div>

      <el-row :gutter="20" v-if="stats">
        <el-col :span="6">
          <el-card class="stats-card">
            <template #header>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>楼栋总数</span>
                <el-icon color="#409eff" size="24"><OfficeBuilding /></el-icon>
              </div>
            </template>
            <div class="stat-value">{{ stats.total_buildings }}</div>
            <div class="stat-label">套</div>
          </el-card>
        </el-col>

        <el-col :span="6">
          <el-card class="stats-card">
            <template #header>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>问题总数</span>
                <el-icon color="#e6a23c" size="24"><Warning /></el-icon>
              </div>
            </template>
            <div class="stat-value">{{ stats.total_problems }}</div>
            <div class="stat-label">项</div>
          </el-card>
        </el-col>

        <el-col :span="6">
          <el-card class="stats-card">
            <template #header>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>业主已确认</span>
                <el-icon color="#67c23a" size="24"><CircleCheck /></el-icon>
              </div>
            </template>
            <div class="stat-value">{{ stats.owner_confirmed }}</div>
            <div class="stat-label">项</div>
          </el-card>
        </el-col>

        <el-col :span="6">
          <el-card class="stats-card">
            <template #header>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>逾期整改</span>
                <el-icon color="#f56c6c" size="24"><Timer /></el-icon>
              </div>
            </template>
            <div class="stat-value" style="color: #f56c6c;">{{ stats.overdue_count }}</div>
            <div class="stat-label">项</div>
          </el-card>
        </el-col>
      </el-row>

      <el-row :gutter="20" style="margin-top: 24px;">
        <el-col :span="16">
          <el-card class="section-card">
            <template #header>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: bold;">问题状态分布</span>
                <el-button type="primary" link @click="api.export.problems()">导出问题清单</el-button>
              </div>
            </template>
            <el-row :gutter="16" v-if="stats">
              <el-col :span="6" v-for="item in statusList" :key="item.status">
                <div style="text-align: center; padding: 16px; background: #f5f7fa; border-radius: 8px;">
                  <el-tag :type="item.type" size="large" style="margin-bottom: 8px;">
                    {{ item.status }}
                  </el-tag>
                  <div style="font-size: 28px; font-weight: bold; margin-top: 8px;">
                    {{ getStatusCount(item.status) }}
                  </div>
                  <div style="font-size: 12px; color: #909399; margin-top: 4px;">项</div>
                </div>
              </el-col>
            </el-row>
          </el-card>

          <el-card class="section-card" style="margin-top: 20px;">
            <template #header>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: bold;">逾期赔付列表</span>
                <el-button type="danger" link @click="api.export.compensations()">导出赔付记录</el-button>
              </div>
            </template>
            <el-table :data="stats?.overdue_orders || []" v-if="stats?.overdue_orders?.length > 0" stripe size="small">
              <el-table-column prop="building_no" label="楼栋">
                <template #default="{ row }">
                  {{ row.building_no }}-{{ row.unit_no }}-{{ row.room_no }}
                </template>
              </el-table-column>
              <el-table-column prop="problem_type" label="问题类型" />
              <el-table-column prop="description" label="问题描述" show-overflow-tooltip />
              <el-table-column prop="contractor_name" label="责任施工方" />
              <el-table-column prop="deadline" label="截止日期" />
              <el-table-column label="逾期天数">
                <template #default="{ row }">
                  <el-tag type="danger" size="small">{{ row.overdue_days }} 天</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="操作" width="150">
                <template #default="{ row }">
                  <el-button type="primary" link size="small" @click="calculateCompensation(row)">
                    赔付试算
                  </el-button>
                </template>
              </el-table-column>
            </el-table>
            <div v-else class="empty-state">
              <el-icon><CircleCheck /></el-icon>
              <div style="margin-top: 8px;">暂无逾期整改项目</div>
            </div>
          </el-card>
        </el-col>

        <el-col :span="8">
          <el-card class="section-card">
            <template #header>
              <div style="font-weight: bold;">问题类型分布</div>
            </template>
            <div v-if="stats">
              <div v-for="item in stats.type_stats" :key="item.problem_type" style="margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                  <span>{{ item.problem_type }}</span>
                  <span style="font-weight: bold;">{{ item.count }}</span>
                </div>
                <el-progress 
                  :percentage="Math.round((item.count / stats.total_problems) * 100)" 
                  :stroke-width="12"
                  :show-text="false"
                />
              </div>
            </div>
          </el-card>

          <el-card class="section-card" style="margin-top: 20px;">
            <template #header>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: bold;">楼栋交付状态</span>
                <el-button type="primary" link @click="api.export.rooms()">导出交付状态</el-button>
              </div>
            </template>
            <el-table :data="stats?.building_status_stats || []" v-if="stats" stripe size="small">
              <el-table-column prop="status" label="交付状态" />
              <el-table-column prop="count" label="数量">
                <template #default="{ row }">
                  <el-tag type="primary">{{ row.count }} 套</el-tag>
                </template>
              </el-table-column>
            </el-table>
          </el-card>
        </el-col>
      </el-row>

      <el-dialog v-model="compensationDialogVisible" title="赔付试算" width="500px">
        <el-descriptions :column="1" border v-if="compensationData">
          <el-descriptions-item label="房号">
            {{ selectedOverdue?.building_no }}-{{ selectedOverdue?.unit_no }}-{{ selectedOverdue?.room_no }}
          </el-descriptions-item>
          <el-descriptions-item label="问题类型">{{ selectedOverdue?.problem_type }}</el-descriptions-item>
          <el-descriptions-item label="整改截止日期">{{ selectedOverdue?.deadline }}</el-descriptions-item>
          <el-descriptions-item label="逾期天数">
            <el-tag type="danger">{{ compensationData.delay_days }} 天</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="计算依据">{{ compensationData.calculation_basis }}</el-descriptions-item>
          <el-descriptions-item label="赔付金额">
            <span style="font-size: 24px; font-weight: bold; color: #f56c6c;">
              ¥{{ compensationData.amount }}
            </span>
          </el-descriptions-item>
        </el-descriptions>
      </el-dialog>
    </div>
  `,
  setup() {
    const stats = Vue.ref(null);
    const compensationDialogVisible = Vue.ref(false);
    const compensationData = Vue.ref(null);
    const selectedOverdue = Vue.ref(null);

    const statusList = [
      { status: '待派单', type: 'info' },
      { status: '待整改', type: 'warning' },
      { status: '待复验', type: 'primary' },
      { status: '已完成', type: 'success' }
    ];

    const loadStats = async () => {
      try {
        const res = await api.dashboard.stats();
        if (res.data.code === 0) {
          stats.value = res.data.data;
        }
      } catch (error) {
        handleError(error, '加载统计数据失败');
      }
    };

    const getStatusCount = (status) => {
      const item = stats.value?.status_stats?.find(s => s.status === status);
      return item?.count || 0;
    };

    const calculateCompensation = async (row) => {
      selectedOverdue.value = row;
      try {
        const res = await api.problems.calculateCompensation(row.problem_id, {
          work_order_id: row.id
        });
        if (res.data.code === 0) {
          compensationData.value = res.data.data;
          compensationDialogVisible.value = true;
        }
      } catch (error) {
        handleError(error, '赔付试算失败');
      }
    };

    Vue.onMounted(() => {
      loadStats();
    });

    const { Refresh, DataAnalysis, OfficeBuilding, Warning, Timer, CircleCheck, Download } = ElementPlusIconsVue;

    return {
      stats,
      statusList,
      compensationDialogVisible,
      compensationData,
      selectedOverdue,
      loadStats,
      getStatusCount,
      calculateCompensation,
      api,
      Refresh,
      DataAnalysis,
      OfficeBuilding,
      Warning,
      Timer,
      CircleCheck,
      Download
    };
  }
};

window.DashboardView = DashboardView;

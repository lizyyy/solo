(function() {
  const { ref, onMounted } = Vue;

  const KanbanView = {
    template: `
      <div>
        <div class="page-header">
          <div class="page-title">
            <el-icon><Grid /></el-icon>
            <span>整改看板</span>
          </div>
          <div style="display: flex; gap: 12px;">
            <el-button @click="loadKanban" :icon="Refresh">刷新</el-button>
          </div>
        </div>

        <div class="filter-bar">
          <el-select v-model="filterBuildingNo" placeholder="筛选楼栋" clearable @change="loadKanban">
            <el-option 
              v-for="b in buildings" 
              :key="b.id" 
              :label="b.building_no" 
              :value="b.building_no" 
            />
          </el-select>
          <el-select v-model="filterProblemType" placeholder="筛选问题类型" clearable @change="loadKanban">
            <el-option 
              v-for="t in PROBLEM_TYPES" 
              :key="t" 
              :label="t" 
              :value="t" 
            />
          </el-select>
        </div>

        <div class="kanban-container">
          <div class="kanban-column">
            <div class="kanban-header">
              <span class="kanban-title" style="color: #909399;">待派单</span>
              <span class="kanban-count">{{ kanban?.pending_dispatch?.length || 0 }}</span>
            </div>
            <div v-if="kanban?.pending_dispatch?.length === 0" class="empty-state" style="padding: 30px;">
              <el-icon><Plus /></el-icon>
              <div style="margin-top: 8px; font-size: 13px;">暂无待派单问题</div>
            </div>
            <div 
              v-for="item in kanban?.pending_dispatch" 
              :key="item.id" 
              class="problem-card"
              @click="openDetail(item)"
            >
              <div class="problem-room">{{ item.building_no }}-{{ item.unit_no }}-{{ item.room_no }}</div>
              <div class="problem-type">{{ item.problem_type }}</div>
              <div class="problem-desc">{{ item.description }}</div>
              <div class="problem-meta">
                <span>验房: {{ item.inspection_date }}</span>
              </div>
            </div>
          </div>

          <div class="kanban-column">
            <div class="kanban-header">
              <span class="kanban-title" style="color: #e6a23c;">待整改</span>
              <span class="kanban-count" style="background: #fdf6ec;">{{ kanban?.pending_fix?.length || 0 }}</span>
            </div>
            <div v-if="kanban?.pending_fix?.length === 0" class="empty-state" style="padding: 30px;">
              <el-icon><Tools /></el-icon>
              <div style="margin-top: 8px; font-size: 13px;">暂无待整改问题</div>
            </div>
            <div 
              v-for="item in kanban?.pending_fix" 
              :key="item.id" 
              class="problem-card"
              :class="{ overdue: item.latest_order?.is_overdue }"
              @click="openDetail(item)"
            >
              <div class="problem-room">{{ item.building_no }}-{{ item.unit_no }}-{{ item.room_no }}</div>
              <div class="problem-type">{{ item.problem_type }}</div>
              <div class="problem-desc">{{ item.description }}</div>
              <div class="problem-meta">
                <span>施工方: {{ item.latest_order?.contractor_name }}</span>
              </div>
              <div class="problem-meta" style="margin-top: 4px;">
                <span>截止: {{ item.latest_order?.deadline }}</span>
                <span v-if="item.latest_order?.is_overdue" class="overdue-badge">逾期{{ item.latest_order?.overdue_days }}天</span>
              </div>
            </div>
          </div>

          <div class="kanban-column">
            <div class="kanban-header">
              <span class="kanban-title" style="color: #409eff;">待复验</span>
              <span class="kanban-count" style="background: #ecf5ff;">{{ kanban?.pending_recheck?.length || 0 }}</span>
            </div>
            <div v-if="kanban?.pending_recheck?.length === 0" class="empty-state" style="padding: 30px;">
              <el-icon><View /></el-icon>
              <div style="margin-top: 8px; font-size: 13px;">暂无待复验问题</div>
            </div>
            <div 
              v-for="item in kanban?.pending_recheck" 
              :key="item.id" 
              class="problem-card"
              :class="{ overdue: item.latest_order?.is_overdue }"
              @click="openDetail(item)"
            >
              <div class="problem-room">{{ item.building_no }}-{{ item.unit_no }}-{{ item.room_no }}</div>
              <div class="problem-type">{{ item.problem_type }}</div>
              <div class="problem-desc">{{ item.description }}</div>
              <div class="problem-meta">
                <span>施工方: {{ item.latest_order?.contractor_name }}</span>
              </div>
              <div class="problem-meta" style="margin-top: 4px;">
                <span>截止: {{ item.latest_order?.deadline }}</span>
                <span v-if="item.latest_order?.is_overdue" class="overdue-badge">逾期{{ item.latest_order?.overdue_days }}天</span>
              </div>
            </div>
          </div>

          <div class="kanban-column">
            <div class="kanban-header">
              <span class="kanban-title" style="color: #67c23a;">已完成</span>
              <span class="kanban-count" style="background: #f0f9eb;">{{ kanban?.completed?.length || 0 }}</span>
            </div>
            <div v-if="kanban?.completed?.length === 0" class="empty-state" style="padding: 30px;">
              <el-icon><CircleCheck /></el-icon>
              <div style="margin-top: 8px; font-size: 13px;">暂无已完成问题</div>
            </div>
            <div 
              v-for="item in kanban?.completed" 
              :key="item.id" 
              class="problem-card"
              @click="openDetail(item)"
            >
              <div class="problem-room">{{ item.building_no }}-{{ item.unit_no }}-{{ item.room_no }}</div>
              <div class="problem-type">{{ item.problem_type }}</div>
              <div class="problem-desc">{{ item.description }}</div>
              <div class="problem-meta" style="margin-top: 4px;">
                <span v-if="item.owner_confirmed === 1" class="owner-confirmed-tag">业主已确认</span>
                <span v-else>待业主确认</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `,
    setup() {
      const kanban = ref(null);
      const buildings = ref([]);
      const filterBuildingNo = ref('');
      const filterProblemType = ref('');

      const loadKanban = async () => {
        try {
          const params = {};
          if (filterBuildingNo.value) params.building_no = filterBuildingNo.value;
          if (filterProblemType.value) params.problem_type = filterProblemType.value;
          const res = await api.dashboard.kanban(params);
          if (res.data.code === 0) {
            kanban.value = res.data.data;
          }
        } catch (error) {
          handleError(error, '加载看板数据失败');
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

      const openDetail = (item) => {
        ElementPlus.ElMessage.info('点击卡片可跳转到问题详情（功能扩展点，可与问题管理页面集成）');
      };

      onMounted(() => {
        loadBuildings();
        loadKanban();
      });

      const { Refresh, Grid, Plus, Tools, View, CircleCheck } = ElementPlusIconsVue;

      return {
        kanban,
        buildings,
        filterBuildingNo,
        filterProblemType,
        loadKanban,
        PROBLEM_TYPES,
        api,
        Refresh,
        Grid,
        Plus,
        Tools,
        View,
        CircleCheck
      };
    }
  };

  window.KanbanView = KanbanView;
})();

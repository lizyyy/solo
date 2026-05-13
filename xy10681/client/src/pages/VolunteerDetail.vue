<template>
  <div class="volunteer-detail">
    <el-page-header @back="$router.push('/')" title="志愿者详情" />
    
    <el-card style="margin-top: 20px;">
      <template #header>
        <span>{{ volunteer?.name || '加载中...' }} - 基本信息</span>
      </template>
      <el-descriptions :column="3" border>
        <el-descriptions-item label="ID">{{ volunteer?.id }}</el-descriptions-item>
        <el-descriptions-item label="姓名">{{ volunteer?.name }}</el-descriptions-item>
        <el-descriptions-item label="手机号">{{ volunteer?.phone }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-tabs v-model="activeTab" style="margin-top: 20px;">
      <el-tab-pane label="操作时间线" name="timeline">
        <el-card>
          <el-timeline>
            <el-timeline-item
              v-for="item in timeline"
              :key="item.id"
              :timestamp="item.operate_time"
              :type="getTimelineType(item.status)"
              placement="top"
            >
              <div class="timeline-content">
                <h4>{{ item.action }}</h4>
                <p>{{ item.description }}</p>
                <p v-if="item.operator" style="color: #909399; font-size: 12px;">
                  责任人：{{ item.operator }}
                </p>
                <el-tag :type="getTimelineTagType(item.status)" size="small">
                  {{ item.status }}
                </el-tag>
              </div>
            </el-timeline-item>
          </el-timeline>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="岗位技能" name="skills">
        <el-card>
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span>技能认证</span>
              <el-button type="primary" size="small" @click="showAddSkill = true">添加技能</el-button>
            </div>
          </template>
          <el-table :data="skills" border style="width: 100%">
            <el-table-column prop="skill_type" label="技能类型" width="150" />
            <el-table-column prop="skill_level" label="等级" width="120" />
            <el-table-column prop="status" label="状态" width="120">
              <template #default="{ row }">
                <el-tag :type="row.status === '已审核' ? 'success' : 'warning'">
                  {{ row.status }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="created_at" label="创建时间" width="180" />
            <el-table-column label="操作" width="200">
              <template #default="{ row }">
                <el-button type="success" size="small" @click="approveSkill(row)" v-if="row.status === '待审核'">
                  审核通过
                </el-button>
                <el-button type="primary" size="small" @click="viewAuditLog(row, 'volunteer_skills')">
                  审核记录
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="赛段排班" name="schedule">
        <el-card>
          <el-table :data="schedules" border style="width: 100%">
            <el-table-column prop="shift_date" label="日期" width="120" />
            <el-table-column prop="start_time" label="开始时间" width="100" />
            <el-table-column prop="end_time" label="结束时间" width="100" />
            <el-table-column prop="shift_type" label="班次" width="100" />
            <el-table-column prop="location" label="地点" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag type="info">{{ row.status }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="120">
              <template #default="{ row }">
                <el-button type="primary" size="small" @click="viewAuditLog(row, 'shift_schedules')">
                  修改记录
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="签到签退" name="attendance">
        <el-card>
          <el-table :data="attendance" border style="width: 100%">
            <el-table-column prop="check_in_time" label="签到时间" width="180" />
            <el-table-column prop="check_in_location" label="签到地点" />
            <el-table-column prop="check_out_time" label="签退时间" width="180" />
            <el-table-column prop="check_out_location" label="签退地点" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="getStatusType(row.status)">
                  {{ row.status }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="200">
              <template #default="{ row }">
                <el-button type="success" size="small" @click="checkIn(row)" v-if="row.status === '待签到'">
                  签到
                </el-button>
                <el-button type="warning" size="small" @click="checkOut(row)" v-if="row.status === '已签到'">
                  签退
                </el-button>
                <el-button type="primary" size="small" @click="viewAuditLog(row, 'attendance')">
                  修改记录
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="物资包" name="material">
        <el-card>
          <el-table :data="materials" border style="width: 100%">
            <el-table-column prop="package_type" label="物资类型" width="150" />
            <el-table-column prop="items" label="包含物品">
              <template #default="{ row }">
                {{ typeof row.items === 'string' ? row.items : JSON.stringify(row.items) }}
              </template>
            </el-table-column>
            <el-table-column prop="distributed" label="发放状态" width="120">
              <template #default="{ row }">
                <el-tag :type="row.distributed ? 'success' : 'warning'">
                  {{ row.distributed ? '已发放' : '待发放' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="distributed_at" label="发放时间" width="180" />
            <el-table-column label="操作" width="120">
              <template #default="{ row }">
                <el-button type="success" size="small" @click="distributeMaterial(row)" v-if="!row.distributed">
                  发放
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="补贴记录" name="subsidy">
        <el-card>
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span>补贴记录</span>
              <el-button type="warning" @click="testCallback">测试回调发放</el-button>
            </div>
          </template>
          <el-table :data="subsidyRecords" border style="width: 100%">
            <el-table-column prop="rule_name" label="补贴规则" width="150" />
            <el-table-column prop="amount" label="金额" width="100">
              <template #default="{ row }">
                ¥{{ row.amount }}
              </template>
            </el-table-column>
            <el-table-column prop="callback_id" label="回调ID" width="200" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.status === '已发放' ? 'success' : 'warning'">
                  {{ row.status }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="created_at" label="创建时间" width="180" />
          </el-table>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="showAuditLog" title="修改记录" width="800px">
      <el-table :data="auditLogs" border style="width: 100%">
        <el-table-column prop="field_name" label="字段名" width="150" />
        <el-table-column prop="old_value" label="修改前" />
        <el-table-column prop="new_value" label="修改后" />
        <el-table-column prop="operation" label="操作类型" width="120" />
        <el-table-column prop="operator" label="操作人" width="120" />
        <el-table-column prop="operate_time" label="操作时间" width="180" />
      </el-table>
    </el-dialog>

    <el-dialog v-model="showAddSkill" title="添加技能" width="500px">
      <el-form :model="skillForm" label-width="100px">
        <el-form-item label="技能类型">
          <el-input v-model="skillForm.skill_type" />
        </el-form-item>
        <el-form-item label="技能等级">
          <el-select v-model="skillForm.skill_level" style="width: 100%">
            <el-option label="初级" value="初级" />
            <el-option label="中级" value="中级" />
            <el-option label="高级" value="高级" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddSkill = false">取消</el-button>
        <el-button type="primary" @click="addSkill">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script>
import axios from 'axios'
import moment from 'moment'

export default {
  name: 'VolunteerDetail',
  data() {
    return {
      volunteerId: this.$route.params.id,
      volunteer: null,
      activeTab: 'timeline',
      timeline: [],
      skills: [],
      schedules: [],
      attendance: [],
      materials: [],
      subsidyRecords: [],
      showAuditLog: false,
      showAddSkill: false,
      auditLogs: [],
      skillForm: {
        skill_type: '',
        skill_level: '初级'
      },
      callbackCount: 0
    }
  },
  mounted() {
    if (this.$route.query.tab) {
      this.activeTab = this.$route.query.tab
    }
    this.loadVolunteer()
    this.loadTimeline()
    this.loadSkills()
    this.loadSchedules()
    this.loadAttendance()
    this.loadMaterials()
    this.loadSubsidy()
  },
  methods: {
    async loadVolunteer() {
      try {
        const res = await axios.get('/api/volunteers')
        this.volunteer = res.data.find(v => v.id == this.volunteerId)
      } catch (e) {
        console.error(e)
      }
    },
    async loadTimeline() {
      try {
        const res = await axios.get(`/api/timeline/${this.volunteerId}`)
        this.timeline = res.data
      } catch (e) {
        console.error(e)
      }
    },
    async loadSkills() {
      try {
        const res = await axios.get('/api/volunteer-skills', { params: { volunteer_id: this.volunteerId } })
        this.skills = res.data
      } catch (e) {
        console.error(e)
      }
    },
    async loadSchedules() {
      try {
        const res = await axios.get('/api/shift-schedules', { params: { volunteer_id: this.volunteerId } })
        this.schedules = res.data
      } catch (e) {
        console.error(e)
      }
    },
    async loadAttendance() {
      try {
        const res = await axios.get('/api/attendance', { params: { volunteer_id: this.volunteerId } })
        this.attendance = res.data
      } catch (e) {
        console.error(e)
      }
    },
    async loadMaterials() {
      try {
        const res = await axios.get('/api/material-packages', { params: { volunteer_id: this.volunteerId } })
        this.materials = res.data
      } catch (e) {
        console.error(e)
      }
    },
    async loadSubsidy() {
      try {
        const res = await axios.get('/api/subsidy-records', { params: { volunteer_id: this.volunteerId } })
        this.subsidyRecords = res.data
      } catch (e) {
        console.error(e)
      }
    },
    async viewAuditLog(row, module) {
      try {
        const res = await axios.get(`/api/audit-logs`, { params: { module, record_id: row.id } })
        this.auditLogs = res.data
        this.showAuditLog = true
      } catch (e) {
        console.error(e)
      }
    },
    async approveSkill(row) {
      try {
        await axios.put(`/api/volunteer-skills/${row.id}/status`, {
          status: '已审核',
          operator: '当前用户'
        })
        this.$message.success('审核成功')
        this.loadSkills()
        this.loadTimeline()
      } catch (e) {
        this.$message.error('审核失败')
      }
    },
    async addSkill() {
      try {
        await axios.post('/api/volunteer-skills', {
          volunteer_id: this.volunteerId,
          volunteer_name: this.volunteer.name,
          ...this.skillForm,
          operator: '当前用户'
        })
        this.$message.success('添加成功')
        this.showAddSkill = false
        this.skillForm = { skill_type: '', skill_level: '初级' }
        this.loadSkills()
        this.loadTimeline()
      } catch (e) {
        this.$message.error('添加失败')
      }
    },
    async checkIn(row) {
      try {
        await axios.post(`/api/attendance/${row.id}/check-in`, {
          check_in_time: moment().format('YYYY-MM-DD HH:mm:ss'),
          check_in_location: '现场签到',
          operator: '当前用户'
        })
        this.$message.success('签到成功')
        this.loadAttendance()
        this.loadTimeline()
      } catch (e) {
        this.$message.error('签到失败')
      }
    },
    async checkOut(row) {
      try {
        await axios.post(`/api/attendance/${row.id}/check-out`, {
          check_out_time: moment().format('YYYY-MM-DD HH:mm:ss'),
          check_out_location: '现场签退',
          operator: '当前用户'
        })
        this.$message.success('签退成功')
        this.loadAttendance()
        this.loadTimeline()
      } catch (e) {
        this.$message.error('签退失败')
      }
    },
    async distributeMaterial(row) {
      try {
        await axios.post(`/api/material-packages/${row.id}/distribute`, {
          operator: '当前用户'
        })
        this.$message.success('发放成功')
        this.loadMaterials()
        this.loadTimeline()
      } catch (e) {
        this.$message.error('发放失败')
      }
    },
    async testCallback() {
      this.callbackCount++
      const callbackId = `TEST_${moment().format('YYYYMMDDHHmmss')}_${this.callbackCount}`
      try {
        const res = await axios.post('/api/subsidy-records/callback', {
          callback_id: callbackId,
          volunteer_id: this.volunteerId,
          volunteer_name: this.volunteer.name,
          rule_id: 1,
          rule_name: '测试回调补贴',
          amount: 100,
          operator: '当前用户'
        })
        this.$message.success(res.data.message || '回调成功')
        this.loadSubsidy()
        this.loadTimeline()
      } catch (e) {
        if (e.response?.data?.intercepted) {
          this.$message.warning('补贴被拦截：存在未发放物资包！')
        } else if (e.response?.data?.error) {
          this.$message.error(e.response.data.error)
        } else {
          this.$message.error('回调失败')
        }
        this.loadTimeline()
      }
    },
    getTimelineType(status) {
      const types = {
        '已审核': 'success',
        '已发放': 'success',
        '已签到': 'primary',
        '已签退': 'primary',
        '已排班': 'info',
        '待处理': 'warning',
        '已处理': 'success',
        '已拦截': 'danger'
      }
      return types[status] || 'info'
    },
    getTimelineTagType(status) {
      const types = {
        '已审核': 'success',
        '已发放': 'success',
        '已签到': 'primary',
        '已签退': 'primary',
        '已排班': 'info',
        '待处理': 'warning',
        '已处理': 'success',
        '已拦截': 'danger'
      }
      return types[status] || 'info'
    },
    getStatusType(status) {
      const types = {
        '待签到': 'warning',
        '已签到': 'primary',
        '已签退': 'success'
      }
      return types[status] || 'info'
    }
  }
}
</script>

<style scoped>
.timeline-content h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: bold;
}
.timeline-content p {
  margin: 4px 0;
  font-size: 13px;
}
</style>

import React, { useEffect } from 'react'
import { Layout, message, Modal, Button, Popconfirm, Upload } from 'antd'
import {
  PlusOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
  ImportOutlined,
  ExportOutlined,
  UserOutlined,
  CalendarOutlined,
  TeamOutlined,
  DeleteOutlined,
} from '@ant-design/icons'
import useStore from './store'
import { importExportApi } from './services/api'
import Header from './components/Header'
import DateView from './components/DateView'
import ConflictList from './components/ConflictList'
import VolunteerDetail from './components/VolunteerDetail'
import VolunteerModal from './components/VolunteerModal'
import DateModal from './components/DateModal'
import PositionModal from './components/PositionModal'
import RequirementModal from './components/RequirementModal'
import './styles/index.css'

const { Content } = Layout

function App() {
  const {
    fetchAllData,
    loading,
    error,
    conflictStats,
    generateSchedule,
    clearError,
    importVolunteers,
  } = useStore()

  const [volunteerModalVisible, setVolunteerModalVisible] = React.useState(false)
  const [dateModalVisible, setDateModalVisible] = React.useState(false)
  const [positionModalVisible, setPositionModalVisible] = React.useState(false)
  const [requirementModalVisible, setRequirementModalVisible] = React.useState(false)
  const [editingVolunteer, setEditingVolunteer] = React.useState(null)
  const [editingDate, setEditingDate] = React.useState(null)
  const [editingPosition, setEditingPosition] = React.useState(null)
  const [selectedDateForRequirement, setSelectedDateForRequirement] = React.useState(null)

  useEffect(() => {
    fetchAllData()
  }, [fetchAllData])

  useEffect(() => {
    if (error) {
      message.error(error)
      clearError()
    }
  }, [error, clearError])

  const handleGenerateSchedule = async () => {
    Modal.confirm({
      title: '生成排班',
      content: '是否要重新生成排班？这将清空现有的排班数据。',
      okText: '重新生成',
      cancelText: '取消',
      onOk: async () => {
        try {
          const result = await generateSchedule(true)
          message.success(`成功生成 ${result.newSchedulesCount} 个排班，覆盖率 ${result.coverage}%`)
        } catch (err) {
          message.error('生成排班失败')
        }
      },
    })
  }

  const handleImportVolunteers = (file) => {
    Modal.confirm({
      title: '导入志愿者',
      content: '确定要导入这份志愿者名单吗？同名的志愿者信息会被更新。',
      onOk: async () => {
        try {
          const result = await importVolunteers(file)
          message.success(`成功导入 ${result.imported_count} 名志愿者`)
          fetchAllData()
        } catch (err) {
          message.error('导入失败：' + (err.response?.data?.error || err.message))
        }
      },
    })
    return false
  }

  const handleExportVolunteers = () => {
    importExportApi.exportVolunteers()
  }

  const handleExportSchedules = () => {
    importExportApi.exportSchedules()
  }

  const handleAddVolunteer = () => {
    setEditingVolunteer(null)
    setVolunteerModalVisible(true)
  }

  const handleEditVolunteer = (volunteer) => {
    setEditingVolunteer(volunteer)
    setVolunteerModalVisible(true)
  }

  const handleAddDate = () => {
    setEditingDate(null)
    setDateModalVisible(true)
  }

  const handleEditDate = (date) => {
    setEditingDate(date)
    setDateModalVisible(true)
  }

  const handleAddPosition = () => {
    setEditingPosition(null)
    setPositionModalVisible(true)
  }

  const handleEditPosition = (position) => {
    setEditingPosition(position)
    setPositionModalVisible(true)
  }

  const handleAddRequirement = (dateId) => {
    setSelectedDateForRequirement(dateId)
    setRequirementModalVisible(true)
  }

  const headerActions = (
    <div className="header-actions">
      <Upload
        accept=".csv"
        showUploadList={false}
        beforeUpload={handleImportVolunteers}
      >
        <Button icon={<ImportOutlined />}>导入志愿者</Button>
      </Upload>
      <Button icon={<ExportOutlined />} onClick={handleExportVolunteers}>
        导出名单
      </Button>
      <Button icon={<ExportOutlined />} onClick={handleExportSchedules}>
        导出排班
      </Button>
      <Button
        type="primary"
        icon={<ThunderboltOutlined />}
        onClick={handleGenerateSchedule}
        loading={loading}
      >
        一键排班
      </Button>
    </div>
  )

  return (
    <Layout style={{ height: '100%' }}>
      <Header
        title="志愿者排班系统"
        actions={headerActions}
        conflictStats={conflictStats}
      />
      <Content className="layout-content">
        <div className="three-column-layout">
          <ConflictList
            onAddVolunteer={handleAddVolunteer}
            onAddDate={handleAddDate}
            onAddPosition={handleAddPosition}
            onEditDate={handleEditDate}
            onEditPosition={handleEditPosition}
            onAddRequirement={handleAddRequirement}
          />
          <DateView
            onEditDate={handleEditDate}
            onAddRequirement={handleAddRequirement}
            onEditVolunteer={handleEditVolunteer}
          />
          <VolunteerDetail
            onEditVolunteer={handleEditVolunteer}
          />
        </div>
      </Content>

      <VolunteerModal
        visible={volunteerModalVisible}
        volunteer={editingVolunteer}
        onClose={() => setVolunteerModalVisible(false)}
        onSuccess={() => fetchAllData()}
      />

      <DateModal
        visible={dateModalVisible}
        date={editingDate}
        onClose={() => setDateModalVisible(false)}
        onSuccess={() => fetchAllData()}
      />

      <PositionModal
        visible={positionModalVisible}
        position={editingPosition}
        onClose={() => setPositionModalVisible(false)}
        onSuccess={() => fetchAllData()}
      />

      <RequirementModal
        visible={requirementModalVisible}
        dateId={selectedDateForRequirement}
        onClose={() => setRequirementModalVisible(false)}
        onSuccess={() => fetchAllData()}
      />
    </Layout>
  )
}

export default App

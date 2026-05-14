import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import { migrationApi, approvalApi, executionApi, exportApi } from '@/api'

export const useMigrationStore = defineStore('migration', () => {
  const migrations = ref([])
  const currentMigration = ref(null)
  const loading = ref(false)
  const traceData = ref(null)

  const fetchMigrations = async () => {
    loading.value = true
    try {
      migrations.value = await migrationApi.list()
    } catch (error) {
      console.error('获取迁移脚本列表失败:', error)
    } finally {
      loading.value = false
    }
  }

  const fetchMigration = async (id) => {
    loading.value = true
    try {
      currentMigration.value = await migrationApi.get(id)
    } catch (error) {
      console.error('获取迁移脚本详情失败:', error)
    } finally {
      loading.value = false
    }
  }

  const createMigration = async (data) => {
    return await migrationApi.create(data)
  }

  const updateMigration = async (id, data) => {
    return await migrationApi.update(id, data)
  }

  const deleteMigration = async (id) => {
    return await migrationApi.delete(id)
  }

  const recalculateTables = async (id) => {
    return await migrationApi.recalculateTables(id)
  }

  const addAffectedTable = async (id, data) => {
    return await migrationApi.addAffectedTable(id, data)
  }

  const addRollbackScript = async (id, data) => {
    return await migrationApi.addRollbackScript(id, data)
  }

  const getApprovalChain = async (migrationId) => {
    return await approvalApi.getChain(migrationId)
  }

  const createApprovalChain = async (migrationId, data) => {
    return await approvalApi.createChain(migrationId, data)
  }

  const startApprovalChain = async (chainId) => {
    return await approvalApi.startChain(chainId)
  }

  const approveStep = async (stepId, approver, comment) => {
    return await approvalApi.approveStep(stepId, approver, comment)
  }

  const rejectStep = async (stepId, approver, comment) => {
    return await approvalApi.rejectStep(stepId, approver, comment)
  }

  const listExecutionLogs = async (migrationId = null) => {
    return await executionApi.listLogs(migrationId)
  }

  const startExecution = async (migrationId, executedBy) => {
    return await executionApi.start(migrationId, executedBy)
  }

  const completeExecution = async (logId, success, output, errorMessage, affectedRows) => {
    return await executionApi.complete(logId, success, output, errorMessage, affectedRows)
  }

  const replayExecution = async (logId, executedBy) => {
    return await executionApi.replay(logId, executedBy)
  }

  const manualFix = async (migrationId, scriptContent, executedBy) => {
    return await executionApi.manualFix(migrationId, scriptContent, executedBy)
  }

  const exportExcel = (migrationId) => {
    exportApi.exportExcel(migrationId)
  }

  const getTrace = async (migrationId) => {
    loading.value = true
    try {
      traceData.value = await exportApi.getTrace(migrationId)
      return traceData.value
    } catch (error) {
      console.error('获取追溯链失败:', error)
    } finally {
      loading.value = false
    }
  }

  return {
    migrations,
    currentMigration,
    loading,
    traceData,
    fetchMigrations,
    fetchMigration,
    createMigration,
    updateMigration,
    deleteMigration,
    recalculateTables,
    addAffectedTable,
    addRollbackScript,
    getApprovalChain,
    createApprovalChain,
    startApprovalChain,
    approveStep,
    rejectStep,
    listExecutionLogs,
    startExecution,
    completeExecution,
    replayExecution,
    manualFix,
    exportExcel,
    getTrace
  }
})
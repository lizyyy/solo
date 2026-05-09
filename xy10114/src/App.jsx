import { useState, useEffect, useCallback } from 'react'
import { api } from './api'
import Header from './components/Header'
import Sidebar from './components/Sidebar'
import ContractDetail from './components/ContractDetail'
import Toast from './components/Toast'
import './App.css'

export default function App() {
  const [contracts, setContracts] = useState([])
  const [selectedContract, setSelectedContract] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [showHistory, setShowHistory] = useState(false)

  const loadContracts = useCallback(async () => {
    try {
      setLoading(true)
      const data = await api.getContracts()
      setContracts(data || [])
    } catch (error) {
      showToast('加载合同列表失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadContracts()
  }, [loadContracts])

  const showToast = (message, type = 'info') => {
    setToast({ message, type })
  }

  const handleImport = async () => {
    try {
      const result = await api.importFile()
      if (result.canceled) return
      
      if (result.success) {
        showToast(result.message || '文件导入成功', 'success')
        await loadContracts()
      } else if (result.errorType === 'DUPLICATE_FILE') {
        showToast(`文件已存在：${result.existingContract?.file_name}`, 'warning')
      } else {
        showToast(result.error || '导入失败', 'error')
      }
    } catch (error) {
      showToast('导入失败：' + error.message, 'error')
    }
  }

  const handleBatchImport = async () => {
    try {
      const result = await api.importFiles()
      if (result.canceled) return
      
      if (result.success) {
        const successCount = result.results.filter(r => r.success).length
        const totalCount = result.results.length
        showToast(`成功导入 ${successCount}/${totalCount} 个文件`, successCount > 0 ? 'success' : 'warning')
        await loadContracts()
      } else {
        showToast(result.error || '批量导入失败', 'error')
      }
    } catch (error) {
      showToast('批量导入失败：' + error.message, 'error')
    }
  }

  const handleSelectContract = async (contract) => {
    setSelectedContract(contract)
    setShowHistory(false)
  }

  const handleDeleteContract = async (contractId) => {
    if (!window.confirm('确定要删除此合同及其所有批注吗？此操作不可撤销。')) {
      return
    }
    
    try {
      const result = await api.deleteContract(contractId)
      if (result.success) {
        showToast('合同删除成功', 'success')
        if (selectedContract?.id === contractId) {
          setSelectedContract(null)
        }
        await loadContracts()
      } else {
        showToast('删除失败', 'error')
      }
    } catch (error) {
      showToast('删除失败：' + error.message, 'error')
    }
  }

  const handleExportAll = async () => {
    if (contracts.length === 0) {
      showToast('没有可导出的合同', 'warning')
      return
    }
    
    try {
      const result = await api.exportAllExcel()
      if (result.canceled) return
      
      if (result.success) {
        showToast(`导出成功：${result.fileName}（${result.contractCount}个合同，${result.commentCount}条批注）`, 'success')
      } else {
        showToast(result.error || '导出失败', 'error')
      }
    } catch (error) {
      showToast('导出失败：' + error.message, 'error')
    }
  }

  const handleRefresh = () => {
    loadContracts()
    if (selectedContract) {
      setSelectedContract({ ...selectedContract })
    }
  }

  return (
    <div className="app">
      <Header 
        onImport={handleImport}
        onBatchImport={handleBatchImport}
        onExportAll={handleExportAll}
        onRefresh={handleRefresh}
      />
      
      <div className="main-content">
        <Sidebar 
          contracts={contracts}
          selectedContract={selectedContract}
          onSelect={handleSelectContract}
          onDelete={handleDeleteContract}
          loading={loading}
        />
        
        <div className="content-area">
          {selectedContract ? (
            <ContractDetail 
              contract={selectedContract}
              onRefresh={loadContracts}
              onShowToast={showToast}
              showHistory={showHistory}
              onToggleHistory={() => setShowHistory(!showHistory)}
            />
          ) : (
            <div className="empty-state">
              <h2>请选择一个合同</h2>
              <p>从左侧列表选择合同进行批注管理，或导入新的合同文件</p>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <Toast 
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}

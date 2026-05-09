import { FileText, Trash2, Clock, AlertCircle, CheckCircle, XCircle } from 'lucide-react'
import { STATUS_MAP, formatDate, truncateText } from '../utils'
import './Sidebar.css'

export default function Sidebar({ contracts, selectedContract, onSelect, onDelete, loading }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>合同列表</h2>
        <span className="count-badge">{contracts.length}</span>
      </div>
      
      <div className="sidebar-content">
        {loading ? (
          <div className="loading-state">
            <span>加载中...</span>
          </div>
        ) : contracts.length === 0 ? (
          <div className="empty-sidebar">
            <FileText className="empty-icon" />
            <p>暂无合同</p>
            <small>点击顶部"导入文件"开始</small>
          </div>
        ) : (
          <div className="contract-list">
            {contracts.map(contract => (
              <ContractItem 
                key={contract.id}
                contract={contract}
                isSelected={selectedContract?.id === contract.id}
                onClick={() => onSelect(contract)}
                onDelete={() => onDelete(contract.id)}
              />
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}

function ContractItem({ contract, isSelected, onClick, onDelete }) {
  const status = STATUS_MAP[contract.status] || STATUS_MAP['pending']
  
  return (
    <div 
      className={`contract-item ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
    >
      <div className="contract-item-header">
        <FileText size={18} className="contract-icon" />
        <div className="contract-info">
          <h3 className="contract-name" title={contract.file_name}>
            {truncateText(contract.file_name, 28)}
          </h3>
          <div className="contract-meta">
            <span 
              className="status-badge" 
              style={{ backgroundColor: status.color + '20', color: status.color }}
            >
              {status.label}
            </span>
            <span className="version-badge">v{contract.version}</span>
          </div>
        </div>
        <button 
          className="delete-btn" 
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          title="删除合同"
        >
          <Trash2 size={14} />
        </button>
      </div>
      
      {contract.comment_count > 0 && (
        <div className="contract-stats">
          <div className="stat-item">
            <Clock size={12} />
            <span>{formatDate(contract.updated_at)}</span>
          </div>
          <div className="comment-stats">
            <span className="stat">
              <CheckCircle size={12} style={{ color: '#16a34a' }} />
              {contract.accepted_count || 0}
            </span>
            <span className="stat">
              <AlertCircle size={12} style={{ color: '#9ca3af' }} />
              {contract.pending_count || 0}
            </span>
            <span className="stat">
              <XCircle size={12} style={{ color: '#dc2626' }} />
              {contract.rejected_count || 0}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

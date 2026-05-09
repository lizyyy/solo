import { FilePlus, Files, Download, RefreshCw, Scale } from 'lucide-react'
import './Header.css'

export default function Header({ onImport, onBatchImport, onExportAll, onRefresh }) {
  return (
    <header className="header">
      <div className="header-left">
        <div className="logo">
          <Scale className="logo-icon" />
          <h1>法务合同条款批注桌面台</h1>
        </div>
      </div>
      
      <div className="header-actions">
        <button className="btn btn-secondary" onClick={onRefresh} title="刷新">
          <RefreshCw size={16} />
          <span>刷新</span>
        </button>
        
        <button className="btn btn-secondary" onClick={onImport}>
          <FilePlus size={16} />
          <span>导入文件</span>
        </button>
        
        <button className="btn btn-secondary" onClick={onBatchImport}>
          <Files size={16} />
          <span>批量导入</span>
        </button>
        
        <button className="btn btn-primary" onClick={onExportAll}>
          <Download size={16} />
          <span>导出全部</span>
        </button>
      </div>
    </header>
  )
}

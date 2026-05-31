import React from 'react'
import { useStore } from './store/useStore'
import { HomePage } from './pages/HomePage'
import { ImportPage } from './pages/ImportPage'
import { InspectionPage } from './pages/InspectionPage'
import { HistoryPage } from './pages/HistoryPage'
import { ExportPage } from './pages/ExportPage'

function App() {
  const { currentPage } = useStore()
  
  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <HomePage />
      case 'import':
        return <ImportPage />
      case 'inspection':
        return <InspectionPage />
      case 'history':
        return <HistoryPage />
      case 'export':
        return <ExportPage />
      default:
        return <HomePage />
    }
  }
  
  return (
    <div className="h-full w-full">
      {renderPage()}
    </div>
  )
}

export default App

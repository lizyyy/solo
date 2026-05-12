import { useState, useEffect } from 'react'
import { usePalletStore } from './store'
import Dashboard from './components/Dashboard'
import PalletRegistration from './components/PalletRegistration'
import Outbound from './components/Outbound'
import Signature from './components/Signature'
import Return from './components/Return'
import DamageProcessing from './components/DamageProcessing'
import Settlement from './components/Settlement'
import { Package, Truck, CheckCircle, ArrowLeft, AlertTriangle, DollarSign, Layout } from 'lucide-react'

type Tab = 'dashboard' | 'registration' | 'outbound' | 'signature' | 'return' | 'damage' | 'settlement'

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const [initialized, setInitialized] = useState(false)
  const { initSampleData } = usePalletStore()

  useEffect(() => {
    if (!initialized) {
      initSampleData()
      setInitialized(true)
    }
  }, [initialized, initSampleData])

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'dashboard', label: '看板', icon: Layout },
    { id: 'registration', label: '托盘建档', icon: Package },
    { id: 'outbound', label: '装车出库', icon: Truck },
    { id: 'signature', label: '客户签收', icon: CheckCircle },
    { id: 'return', label: '回收验收', icon: ArrowLeft },
    { id: 'damage', label: '破损扣款', icon: AlertTriangle },
    { id: 'settlement', label: '押金结算', icon: DollarSign },
  ]

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />
      case 'registration': return <PalletRegistration />
      case 'outbound': return <Outbound />
      case 'signature': return <Signature />
      case 'return': return <Return />
      case 'damage': return <DamageProcessing />
      case 'settlement': return <Settlement />
    }
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Package className="w-8 h-8 text-blue-600" />
            物流托盘循环管理系统
          </h1>
        </div>
      </div>

      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex space-x-1 overflow-x-auto py-2">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    activeTab === tab.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {renderContent()}
      </div>
    </div>
  )
}

export default App

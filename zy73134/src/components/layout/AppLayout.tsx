import React from 'react'
import TopToolbar from './TopToolbar'

interface AppLayoutProps {
  children?: React.ReactNode
  scene3d?: React.ReactNode
  sidePanel?: React.ReactNode
}

const AppLayout: React.FC<AppLayoutProps> = ({ scene3d, sidePanel }) => {
  return (
    <div className="h-screen w-screen bg-deepsea-900 overflow-hidden relative">
      <div
        className="absolute inset-0 right-0"
        style={{ paddingRight: '35%' }}
      >
        <div className="w-full h-full relative">
          {scene3d}
        </div>
      </div>

      <div
        className="absolute top-0 right-0 h-full w-[35%] min-w-[440px] glass border-l border-deepsea-500/40 z-10"
        style={{
          background:
            'linear-gradient(180deg, rgba(10,31,53,0.55) 0%, rgba(10,37,64,0.7) 100%)',
        }}
      >
        {sidePanel}
      </div>

      <TopToolbar />
    </div>
  )
}

export default AppLayout

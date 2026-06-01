import type { ReactNode } from "react"
import Sidebar from "@/components/layout/Sidebar"

interface PageContainerProps {
  children: ReactNode
}

export default function PageContainer({ children }: PageContainerProps) {
  return (
    <div className="flex h-screen bg-coffee-50 font-sans">
      <Sidebar />
      <main className="flex-1 overflow-auto p-6">
        {children}
      </main>
    </div>
  )
}

/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface Window {
  electronAPI: {
    dbQuery: (sql: string, params?: any[]) => Promise<any[]>
    dbRun: (sql: string, params?: any[]) => Promise<{ lastInsertRowid: number; changes: number }>
    dbGet: (sql: string, params?: any[]) => Promise<any>
    dbTransaction: (fnName: string) => Promise<any>
  }
}

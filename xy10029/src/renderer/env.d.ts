declare global {
  interface Window {
    api: {
      auth: {
        login: (username: string, password: string) => Promise<any>
      }
      users: {
        list: (params: any) => Promise<any>
        create: (data: any) => Promise<any>
        update: (id: string, updates: any) => Promise<any>
        resetPassword: (id: string, newPassword?: string) => Promise<any>
      }
      devices: {
        list: (params: any) => Promise<any>
        get: (id: string) => Promise<any>
        create: (data: any, operator: any) => Promise<any>
        update: (id: string, updates: any, operator: any) => Promise<any>
        lend: (deviceId: string, borrowerId: string, borrowerName: string, operator: any, expectedReturnAt?: string, purpose?: string) => Promise<any>
        return: (deviceId: string, operator: any, notes?: string) => Promise<any>
        changeStatus: (deviceId: string, newStatus: string, operator: any, notes?: string) => Promise<any>
        delete: (deviceId: string, operator: any) => Promise<any>
        history: (deviceId: string) => Promise<any>
        restore: (historyId: string, operator: any) => Promise<any>
      }
      borrows: {
        list: (params: any) => Promise<any>
      }
      logs: {
        list: (params: any) => Promise<any>
      }
      retry: {
        list: (params: any) => Promise<any>
        cancel: (id: string) => Promise<any>
      }
      batch: {
        list: (params: any) => Promise<any>
        get: (id: string) => Promise<any>
        lend: (deviceIds: string[], borrowerId: string, borrowerName: string, operator: any, expectedReturnAt?: string, purpose?: string) => Promise<any>
        return: (deviceIds: string[], operator: any) => Promise<any>
      }
      export: {
        devices: (options: any) => Promise<any>
        borrows: (options: any) => Promise<any>
      }
      import: {
        devices: (operator: any) => Promise<any>
      }
    }
  }
}

export {}

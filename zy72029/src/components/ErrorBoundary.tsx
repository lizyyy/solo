import React from 'react'

interface Props {
  children: React.ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ error, errorInfo })
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-charcoal flex items-center justify-center p-8">
          <div className="bg-paper-cream text-charcoal p-8 max-w-lg border-2 border-warning-orange">
            <h2 className="text-2xl font-mono font-bold mb-4 text-danger-red">
              ⚠️ 配置错误 - 保险理赔逃脱屋
            </h2>
            
            <div className="mb-6">
              <p className="mb-2 font-medium">给讲解员小夏的提示：</p>
              <p className="text-sm opacity-80 mb-4">
                系统检测到配置问题，请不要担心，数据都在。请按下方提示检查后重试。
              </p>
              
              <div className="bg-white p-4 border border-gray-300 mb-4">
                <p className="font-mono text-sm text-danger-red mb-2">
                  错误类型：{this.state.error?.name || '未知错误'}
                </p>
                <p className="text-sm mb-2">
                  <span className="font-medium">通俗解释：</span>
                  {this.getFriendlyMessage()}
                </p>
                <p className="text-xs text-gray-500 mt-2 font-mono">
                  技术详情：{this.state.error?.message}
                </p>
              </div>

              {this.state.errorInfo && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-gray-500 mb-2">
                    查看详细错误堆栈（给技术支持用）
                  </summary>
                  <pre className="bg-gray-100 p-3 overflow-x-auto mt-2 font-mono text-gray-600">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-charcoal text-paper-cream font-mono text-sm hover:bg-opacity-80 transition-colors border-2 border-charcoal"
              >
                重新加载
              </button>
              <button
                onClick={() => {
                  localStorage.clear()
                  window.location.reload()
                }}
                className="px-6 py-2 bg-transparent text-charcoal font-mono text-sm border-2 border-charcoal hover:bg-charcoal hover:text-paper-cream transition-colors"
              >
                重置所有数据
              </button>
            </div>

            <p className="text-xs text-gray-500 mt-6 text-center">
              保险理赔逃脱屋 · 版本 0.1.0 · 专为科普馆讲解员小夏定制
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }

  private getFriendlyMessage(): string {
    const msg = this.state.error?.message || ''
    
    if (msg.includes('JSON') || msg.includes('parse')) {
      return '材料包文件格式不对，可能是导入的JSON文件有语法错误，请检查文件内容。'
    }
    if (msg.includes('undefined') || msg.includes('null')) {
      return '缺少必要的配置信息，请检查材料包是否完整，或确认游戏参数是否都已设置。'
    }
    if (msg.includes('Network') || msg.includes('fetch')) {
      return '网络连接有问题，但本工具是纯本地运行的，可能是浏览器安全设置阻止了某些功能。'
    }
    if (msg.includes('storage') || msg.includes('quota')) {
      return '本地存储空间不足，请尝试清理一些旧的练习记录，或者使用"重置所有数据"按钮。'
    }
    
    return '系统遇到了一个意外问题，请尝试重新加载页面。如果问题持续，请联系技术支持。'
  }
}

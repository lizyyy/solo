import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleRefresh = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="card max-w-md w-full text-center">
            <div className="card-body py-8">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">出错了</h2>
              <p className="text-gray-600 mb-6">
                页面发生了未知错误，请尝试刷新页面。
              </p>
              {this.state.error && (
                <div className="bg-gray-100 rounded-lg p-3 mb-6 text-left">
                  <p className="text-sm text-gray-500 font-medium mb-1">错误信息：</p>
                  <p className="text-sm text-red-600 font-mono">
                    {this.state.error.message}
                  </p>
                </div>
              )}
              <button
                onClick={this.handleRefresh}
                className="btn-primary flex items-center justify-center space-x-2 mx-auto"
              >
                <RefreshCw className="w-4 h-4" />
                <span>刷新页面</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

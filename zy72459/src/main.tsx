import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import App from './App'
import { InspectionProvider } from './store/InspectionContext'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN}>
      <BrowserRouter>
        <InspectionProvider>
          <App />
        </InspectionProvider>
      </BrowserRouter>
    </ConfigProvider>
  </React.StrictMode>,
)

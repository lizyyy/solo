import { Routes, Route } from 'react-router-dom';
import { Layout, Typography } from 'antd';
import InvoiceList from './pages/InvoiceList';
import InvoiceDetail from './pages/InvoiceDetail';

const { Header, Content } = Layout;
const { Title } = Typography;

function App() {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#001529', padding: '0 24px' }}>
        <Title level={3} style={{ color: 'white', margin: 0, lineHeight: '64px' }}>
          报销票据匹配系统
        </Title>
      </Header>
      <Content style={{ padding: '24px', background: '#f0f2f5' }}>
        <Routes>
          <Route path="/" element={<InvoiceList />} />
          <Route path="/invoices/:id" element={<InvoiceDetail />} />
        </Routes>
      </Content>
    </Layout>
  );
}

export default App;

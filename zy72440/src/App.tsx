import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Dashboard } from '@/pages/Dashboard';
import { RecordList } from '@/pages/RecordList';
import { RecordDetail } from '@/pages/RecordDetail';
import { ManagerReview } from '@/pages/ManagerReview';
import { Verification } from '@/pages/Verification';
import { DemoCenter } from '@/pages/DemoCenter';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<AppLayout title="工作台" subtitle="艺人周边库存联动系统" />}>
          <Route path="/" element={<Dashboard />} />
        </Route>
        <Route element={<AppLayout title="记录列表" subtitle="所有库存联动记录" />}>
          <Route path="/records" element={<RecordList />} />
        </Route>
        <Route element={<AppLayout title="记录详情" />}>
          <Route path="/records/:id" element={<RecordDetail />} />
        </Route>
        <Route element={<AppLayout title="店长复核" subtitle="授权地区异常记录处理" />}>
          <Route path="/review" element={<ManagerReview />} />
        </Route>
        <Route element={<AppLayout title="核销单对账" subtitle="课时核销单与历史记录核对" />}>
          <Route path="/verification" element={<Verification />} />
        </Route>
        <Route element={<AppLayout title="演示中心" subtitle="三种典型场景流程演示" />}>
          <Route path="/demo" element={<DemoCenter />} />
        </Route>
      </Routes>
    </Router>
  );
}

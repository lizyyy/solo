import React from 'react';
import Header from '@/components/layout/Header';
import TimeControlBar from '@/components/layout/TimeControlBar';
import StationMap from '@/components/map/StationMap';
import TidalChart from '@/components/chart/TidalChart';
import RecordList from '@/components/list/RecordList';
import DetailDrawer from '@/components/detail/DetailDrawer';
import ReportModal from '@/components/report/ReportModal';

const Home: React.FC = () => {
  return (
    <div className="h-screen w-screen flex flex-col deep-sea-bg overflow-hidden">
      <Header />

      <div className="flex-1 flex overflow-hidden p-4 gap-4 relative">
        <div className="grid-bg absolute inset-4 rounded-xl opacity-50 pointer-events-none" />

        <div className="w-72 flex-shrink-0 relative z-10">
          <StationMap />
        </div>

        <div className="flex-1 flex flex-col gap-4 relative z-10 min-w-0">
          <div className="flex-1 min-h-0">
            <TidalChart />
          </div>
        </div>

        <div className="w-80 flex-shrink-0 relative z-10">
          <RecordList />
        </div>
      </div>

      <TimeControlBar />

      <DetailDrawer />
      <ReportModal />
    </div>
  );
};

export default Home;

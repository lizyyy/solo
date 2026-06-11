import React, { useEffect } from 'react';
import { LayerList } from '../components/LayerList';
import { CollisionList } from '../components/CollisionList';
import { SpaceView } from '../components/SpaceView';
import { DetailPanel } from '../components/DetailPanel';
import { ImportPanel } from '../components/ImportPanel';
import { useReviewStore } from '../store/useReviewStore';

export default function Home() {
  const { session, initDemoSession } = useReviewStore();

  useEffect(() => {
    initDemoSession();
  }, [initDemoSession]);

  if (!session) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-900 text-slate-400">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col bg-slate-950 overflow-hidden">
      <ImportPanel />

      <div className="flex-1 flex overflow-hidden">
        <div className="w-72 flex-shrink-0 border-r border-slate-700 overflow-hidden">
          <LayerList />
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <SpaceView />
          </div>
          <div className="h-80 border-t border-slate-700 overflow-hidden">
            <CollisionList />
          </div>
        </div>

        <div className="w-80 flex-shrink-0 border-l border-slate-700 overflow-hidden">
          <DetailPanel />
        </div>
      </div>
    </div>
  );
}

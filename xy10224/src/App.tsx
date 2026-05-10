import { useState } from 'react';
import { DndContext, DragOverlay } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { AppProvider, useApp } from './AppContext';
import { Header } from './components/Header';
import { LaneGrid } from './components/LaneGrid';
import { BookingModal } from './components/BookingModal';
import { BookingCard } from './components/BookingCard';
import { ConflictPanel, HistoryPanel, ExportPanel } from './components/SidePanel';
import type { Booking } from './types';

function AppContent() {
  const { state, dispatch } = useApp();
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [modalProps, setModalProps] = useState<{
    laneId?: string;
    timeSlotId?: string;
    existingBooking?: Booking;
  }>({});
  const [activeBooking, setActiveBooking] = useState<Booking | null>(null);

  const handleAddBooking = (laneId: string, timeSlotId: string) => {
    setModalProps({ laneId, timeSlotId });
    setModalIsOpen(true);
  };

  const handleEditBooking = (booking: Booking) => {
    setModalProps({ existingBooking: booking });
    setModalIsOpen(true);
  };

  const handleCloseModal = () => {
    setModalIsOpen(false);
    setModalProps({});
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    if (active.data.current?.booking) {
      setActiveBooking(active.data.current.booking);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveBooking(null);

    const { active, over } = event;
    if (!over) return;

    const booking = active.data.current?.booking as Booking;
    if (!booking) return;

    const overId = over.id as string;
    const [laneId, timeSlotId] = overId.split('-');

    if (laneId && timeSlotId) {
      dispatch({
        type: 'MOVE_BOOKING',
        payload: {
          id: booking.id,
          laneId,
          timeSlotId,
        },
      });
    }
  };

  const isBookingInConflict = (bookingId: string) => {
    return state.conflicts.some(
      (c) => c.bookingId1 === bookingId || c.bookingId2 === bookingId
    );
  };

  return (
    <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="min-h-screen bg-gray-100">
        <Header />

        <main className="container mx-auto px-4 py-6">
          {/* 图例说明 */}
          <div className="bg-white rounded-xl shadow-md p-4 mb-6">
            <h3 className="font-bold text-gray-800 mb-3">📖 图例说明</h3>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-blue-500"></div>
                <span className="text-sm text-gray-600">训练队</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-green-500"></div>
                <span className="text-sm text-gray-600">散客</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-purple-500"></div>
                <span className="text-sm text-gray-600">私教课</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-white border-2 border-red-400 ring-2 ring-red-200"></div>
                <span className="text-sm text-gray-600">冲突</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-white border-2 border-yellow-400"></div>
                <span className="text-sm text-gray-600">待复核</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-white border border-gray-300"></div>
                <span className="text-sm text-gray-600">空闲（点击添加预约）</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* 主区域：泳道表格 */}
            <div className="lg:col-span-3">
              <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span>📅</span> 泳道排布表
                <span className="text-sm font-normal text-gray-500">
                  （拖拽预约卡片可调整位置）
                </span>
              </h2>
              <LaneGrid
                onAddBooking={handleAddBooking}
                onEditBooking={handleEditBooking}
              />
            </div>

            {/* 侧边栏 */}
            <div className="space-y-6">
              <ConflictPanel />
              <ExportPanel />
              <HistoryPanel />
            </div>
          </div>

          {/* 使用提示 */}
          <div className="mt-8 bg-blue-50 border border-blue-200 rounded-xl p-6">
            <h3 className="font-bold text-blue-800 mb-3">💡 使用提示</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-blue-700">
              <div>
                <strong>1. 加载样例</strong>
                <p>点击顶部按钮加载"顺利样例"或"冲突样例"数据</p>
              </div>
              <div>
                <strong>2. 添加预约</strong>
                <p>点击空白单元格添加新预约，支持训练队、散客、私教课三种类型</p>
              </div>
              <div>
                <strong>3. 拖拽调整</strong>
                <p>拖拽预约卡片到其他泳道或时段，自动检测冲突</p>
              </div>
              <div>
                <strong>4. 导出日程</strong>
                <p>处理完成后，可导出为 CSV 或 JSON 格式</p>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* 预约编辑弹窗 */}
      <BookingModal
        isOpen={modalIsOpen}
        onClose={handleCloseModal}
        laneId={modalProps.laneId}
        timeSlotId={modalProps.timeSlotId}
        existingBooking={modalProps.existingBooking}
      />

      {/* 拖拽时的悬浮预览 */}
      <DragOverlay>
        {activeBooking && (
          <div className="opacity-80">
            <BookingCard
              booking={activeBooking}
              onClick={() => {}}
              onDelete={() => {}}
              hasConflict={isBookingInConflict(activeBooking.id)}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;

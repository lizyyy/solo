import { useEffect, useState } from 'react';
import { useAppStore } from '@/store/app';
import { EventCard } from '@/components/EventCard';
import { EventForm } from '@/components/EventForm';
import { RegistrationForm } from '@/components/RegistrationForm';
import { EventDetail } from '@/components/EventDetail';
import { Event, Registration, CreateEventDto, UpdateEventDto, CreateRegistrationDto } from '@/types';
import { Plus, Search, UserPlus } from 'lucide-react';

export function Home() {
  const {
    events,
    currentEvent,
    registrations,
    isLoading,
    error,
    fetchEvents,
    fetchEvent,
    createEvent,
    updateEvent,
    createRegistration,
    cancelRegistration,
    setError,
    clearCurrentEvent,
  } = useAppStore();

  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [showRegistrationForm, setShowRegistrationForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchEvents();
  }, []);

  const handleViewEvent = (id: string) => {
    fetchEvent(id);
  };

  const handleEditEvent = (event: Event) => {
    setEditingEvent(event);
    setShowEventForm(true);
  };

  const handleCancelEvent = async (event: Event) => {
    if (window.confirm(`确定要取消活动 "${event.title}" 吗？`)) {
      const result = await updateEvent(event.id, { status: 'cancelled' });
      if (result) {
        fetchEvents();
      }
    }
  };

  const handleEventFormSubmit = async (dto: CreateEventDto | UpdateEventDto) => {
    if (editingEvent) {
      const result = await updateEvent(editingEvent.id, dto);
      if (result) {
        setShowEventForm(false);
        setEditingEvent(null);
        fetchEvents();
      }
    } else {
      const result = await createEvent(dto);
      if (result) {
        setShowEventForm(false);
      }
    }
  };

  const handleRegistrationSubmit = async (dto: CreateRegistrationDto) => {
    const result = await createRegistration({
      ...dto,
      eventId: currentEvent?.id || '',
    });
    if (result) {
      setShowRegistrationForm(false);
    }
  };

  const handleCancelRegistration = async (registration: Registration) => {
    if (window.confirm(`确定要取消 ${registration.userName} 的报名吗？`)) {
      await cancelRegistration(registration.id, registration.version);
    }
  };

  const filteredEvents = events.filter((event) =>
    event.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (currentEvent) {
    return (
      <div className="max-w-6xl mx-auto">
        <EventDetail
          event={currentEvent}
          registrations={registrations}
          onBack={clearCurrentEvent}
          onRegister={() => setShowRegistrationForm(true)}
          onEdit={() => {
            setEditingEvent(currentEvent);
            setShowEventForm(true);
          }}
          onCancelEvent={() => handleCancelEvent(currentEvent)}
          onCancelRegistration={handleCancelRegistration}
          isLoading={isLoading}
        />

        {showRegistrationForm && (
          <RegistrationForm
            eventId={currentEvent.id}
            onSubmit={handleRegistrationSubmit}
            onCancel={() => setShowRegistrationForm(false)}
            isLoading={isLoading}
          />
        )}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">活动管理</h1>
          <p className="text-gray-600 mt-1">创建和管理活动，处理报名</p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="搜索活动..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field pl-10 w-64"
            />
          </div>
          <button onClick={() => setShowEventForm(true)} className="btn-primary flex items-center">
            <Plus className="w-5 h-5 mr-2" />
            创建活动
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-red-700">{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700"
            >
              关闭
            </button>
          </div>
        </div>
      )}

      {isLoading && events.length === 0 ? (
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">加载中...</p>
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-lg">
          <div className="text-gray-400 mb-4">
            <UserPlus className="w-16 h-16 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchQuery ? '未找到匹配的活动' : '还没有活动'}
          </h3>
          <p className="text-gray-500 mb-4">
            {searchQuery ? '尝试使用其他关键词搜索' : '点击上方按钮创建第一个活动'}
          </p>
          {!searchQuery && (
            <button
              onClick={() => setShowEventForm(true)}
              className="btn-primary"
            >
              创建活动
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onView={handleViewEvent}
              onEdit={handleEditEvent}
              onCancel={handleCancelEvent}
            />
          ))}
        </div>
      )}

      {showEventForm && (
        <EventForm
          event={editingEvent || undefined}
          onSubmit={handleEventFormSubmit}
          onCancel={() => {
            setShowEventForm(false);
            setEditingEvent(null);
          }}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { TimelineEvent, TimelineFilter, EventType, EventStatus } from '@/types/timeline';
import type { GateSession } from '@/types/gate';
import { getAllEvents, saveEvents, saveEvent, deleteEvent } from '@/utils/storage';
import { generateId, isTimeInRange } from '@/utils/time';
import { exportToJSON, exportToCSV, exportTeachingReport } from '@/utils/export';

export const useTimelineStore = defineStore('timeline', () => {
  const events = ref<TimelineEvent[]>([]);
  const selectedEventId = ref<string | null>(null);
  const currentTime = ref<number>(Date.now());
  const isLoading = ref(false);
  const filter = ref<TimelineFilter>({
    types: [],
    statuses: [],
    onlyAbnormal: false
  });

  const filteredEvents = computed(() => {
    return events.value.filter(event => {
      if (filter.value.types.length > 0 && !filter.value.types.includes(event.type)) {
        return false;
      }
      if (filter.value.statuses.length > 0 && !filter.value.statuses.includes(event.status)) {
        return false;
      }
      if (filter.value.onlyAbnormal && !event.abnormalMark) {
        return false;
      }
      if (!isTimeInRange(event.timestamp, filter.value.startTime, filter.value.endTime)) {
        return false;
      }
      if (filter.value.keyword) {
        const keyword = filter.value.keyword.toLowerCase();
        return event.title.toLowerCase().includes(keyword) ||
               event.description.toLowerCase().includes(keyword) ||
               (event.operator?.toLowerCase().includes(keyword));
      }
      return true;
    }).sort((a, b) => a.timestamp - b.timestamp);
  });

  const selectedEvent = computed(() => {
    if (!selectedEventId.value) return null;
    return events.value.find(e => e.id === selectedEventId.value) || null;
  });

  const pendingEvents = computed(() => {
    return events.value.filter(e => e.status === 'pending');
  });

  const abnormalEvents = computed(() => {
    return events.value.filter(e => e.abnormalMark);
  });

  const timeRange = computed(() => {
    if (events.value.length === 0) {
      return { start: Date.now(), end: Date.now() };
    }
    const timestamps = events.value.map(e => e.timestamp);
    return {
      start: Math.min(...timestamps),
      end: Math.max(...timestamps)
    };
  });

  async function loadEvents() {
    isLoading.value = true;
    try {
      events.value = await getAllEvents();
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      isLoading.value = false;
    }
  }

  async function addEvent(event: Omit<TimelineEvent, 'id' | 'version' | 'lastModified' | 'evidenceLinks'> & { evidenceLinks?: any[] }) {
    const newEvent: TimelineEvent = {
      ...event,
      id: generateId(),
      evidenceLinks: event.evidenceLinks || [],
      version: 0,
      lastModified: Date.now()
    };
    events.value.push(newEvent);
    await saveEvent(newEvent);
    return newEvent;
  }

  async function updateEvent(id: string, updates: Partial<TimelineEvent>) {
    const index = events.value.findIndex(e => e.id === id);
    if (index !== -1) {
      events.value[index] = {
        ...events.value[index],
        ...updates,
        version: events.value[index].version + 1,
        lastModified: Date.now()
      };
      await saveEvent(events.value[index]);
      return events.value[index];
    }
    return null;
  }

  async function removeEvent(id: string) {
    const index = events.value.findIndex(e => e.id === id);
    if (index !== -1) {
      events.value.splice(index, 1);
      await deleteEvent(id);
      if (selectedEventId.value === id) {
        selectedEventId.value = null;
      }
    }
  }

  async function addEvents(newEvents: Omit<TimelineEvent, 'id' | 'version' | 'lastModified' | 'evidenceLinks'> & { evidenceLinks?: any[] }[]) {
    const eventsToAdd = newEvents.map(e => ({
      ...e,
      id: generateId(),
      evidenceLinks: e.evidenceLinks || [],
      version: 0,
      lastModified: Date.now()
    } as TimelineEvent));
    events.value.push(...eventsToAdd);
    await saveEvents(eventsToAdd);
    return eventsToAdd;
  }

  function selectEvent(id: string | null) {
    selectedEventId.value = id;
    if (id) {
      const event = events.value.find(e => e.id === id);
      if (event) {
        currentTime.value = event.timestamp;
      }
    }
  }

  function setFilter(newFilter: Partial<TimelineFilter>) {
    filter.value = { ...filter.value, ...newFilter };
  }

  function toggleTypeFilter(type: EventType) {
    const index = filter.value.types.indexOf(type);
    if (index === -1) {
      filter.value.types.push(type);
    } else {
      filter.value.types.splice(index, 1);
    }
  }

  function toggleStatusFilter(status: EventStatus) {
    const index = filter.value.statuses.indexOf(status);
    if (index === -1) {
      filter.value.statuses.push(status);
    } else {
      filter.value.statuses.splice(index, 1);
    }
  }

  async function confirmEvent(id: string) {
    return await updateEvent(id, { status: 'confirmed' });
  }

  async function rejectEvent(id: string) {
    return await updateEvent(id, { status: 'rejected' });
  }

  function clearAll() {
    events.value = [];
    selectedEventId.value = null;
  }

  async function loadAll() {
    await loadEvents();
  }

  async function loadBySession(sessionId: string) {
    isLoading.value = true;
    try {
      const allEvents = await getAllEvents();
      events.value = allEvents.filter(e => e.sessionId === sessionId);
    } catch (error) {
      console.error('Failed to load events by session:', error);
    } finally {
      isLoading.value = false;
    }
  }

  async function getBySession(sessionId: string) {
    const allEvents = await getAllEvents();
    return allEvents.filter(e => e.sessionId === sessionId);
  }

  function getAll() {
    return events.value;
  }

  function setEvents(newEvents: TimelineEvent[]) {
    events.value = newEvents;
  }

  function exportData(format: 'json' | 'csv' | 'report', session?: GateSession) {
    const timestamp = Date.now();
    if (format === 'json') {
      exportToJSON(events.value, `timeline-export-${timestamp}.json`);
    } else if (format === 'csv') {
      exportToCSV(events.value, `timeline-export-${timestamp}.csv`);
    } else if (format === 'report' && session) {
      exportTeachingReport(session, events.value);
    }
  }

  return {
    events,
    selectedEventId,
    selectedEvent,
    currentTime,
    isLoading,
    filter,
    filteredEvents,
    pendingEvents,
    abnormalEvents,
    timeRange,
    loadEvents,
    loadAll,
    loadBySession,
    getBySession,
    getAll,
    setEvents,
    addEvent,
    addEvents,
    updateEvent,
    removeEvent,
    selectEvent,
    setFilter,
    toggleTypeFilter,
    toggleStatusFilter,
    confirmEvent,
    rejectEvent,
    clearAll,
    exportData
  };
});

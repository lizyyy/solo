import { create } from 'zustand';
import { AppState, AppActions, Seat, LineOfSightResult, ClassroomLayout, Position3D, TimelineState } from '@/types';
import { defaultLayout } from '@/data/sampleLayouts';

const getInitialState = (): AppState => ({
  layoutName: defaultLayout.name,
  seats: JSON.parse(JSON.stringify(defaultLayout.seats)),
  obstacles: JSON.parse(JSON.stringify(defaultLayout.obstacles)),
  platform: { ...defaultLayout.platform },
  eyeHeight: defaultLayout.eyeHeight,
  selectedSeatId: null,
  isDraggingEnabled: false,
  filters: {
    rows: [],
    blockedOnly: false,
  },
  viewMode: 'perspective',
  timelineStates: [],
  currentTimelineIndex: -1,
  showLineOfSight: true,
});

type Store = AppState & AppActions;

export const useAppStore = create<Store>((set, get) => ({
  ...getInitialState(),

  setSeats: (seats: Seat[]) => set({ seats }),

  updateSeatPosition: (seatId: string, position: Position3D) =>
    set((state) => ({
      seats: state.seats.map((seat) =>
        seat.id === seatId ? { ...seat, position } : seat
      ),
    })),

  toggleSeatSelection: (seatId: string) =>
    set((state) => ({
      seats: state.seats.map((seat) =>
        seat.id === seatId ? { ...seat, isSelected: !seat.isSelected } : seat
      ),
    })),

  setSelectedSeat: (seatId: string | null) => set({ selectedSeatId: seatId }),

  setIsDraggingEnabled: (enabled: boolean) => set({ isDraggingEnabled: enabled }),

  addSeatRow: () =>
    set((state) => {
      const maxRow = Math.max(...state.seats.map((s) => s.row), 0);
      const newRow = maxRow + 1;
      const colsInRow = state.seats.filter((s) => s.row === maxRow).length;
      const lastSeatInPrevRow = state.seats.find((s) => s.row === maxRow && s.col === 0);
      const zSpacing = 2;
      const startX = lastSeatInPrevRow ? state.seats.filter((s) => s.row === maxRow).reduce((min, s) => Math.min(min, s.position.x), Infinity) : -8.75;
      const startZ = lastSeatInPrevRow ? lastSeatInPrevRow.position.z + zSpacing : 0;

      const newSeats: Seat[] = [];
      for (let col = 0; col < colsInRow; col++) {
        newSeats.push({
          id: `seat-${newRow}-${col}-${Date.now()}`,
          row: newRow,
          col,
          position: {
            x: startX + col * 2.5,
            y: 0,
            z: startZ,
          },
          isBlocked: false,
          isSelected: false,
          isVisible: true,
        });
      }
      return { seats: [...state.seats, ...newSeats] };
    }),

  setFilters: (filters: { rows: number[]; blockedOnly: boolean }) =>
    set((state) => ({
      filters,
      seats: state.seats.map((seat) => ({
        ...seat,
        isVisible:
          (filters.rows.length === 0 || filters.rows.includes(seat.row)) &&
          (!filters.blockedOnly || seat.isBlocked),
      })),
    })),

  setViewMode: (mode) => set({ viewMode: mode }),

  setEyeHeight: (height) => set({ eyeHeight: height }),

  saveTimelineState: (name: string) =>
    set((state) => {
      const newState: TimelineState = {
        id: `timeline-${Date.now()}`,
        name,
        seats: JSON.parse(JSON.stringify(state.seats)),
        timestamp: Date.now(),
      };
      return {
        timelineStates: [...state.timelineStates, newState],
        currentTimelineIndex: state.timelineStates.length,
      };
    }),

  setTimelineIndex: (index: number) =>
    set((state) => {
      if (index < 0 || index >= state.timelineStates.length) return state;
      const timelineState = state.timelineStates[index];
      return {
        currentTimelineIndex: index,
        seats: JSON.parse(JSON.stringify(timelineState.seats)),
      };
    }),

  setShowLineOfSight: (show: boolean) => set({ showLineOfSight: show }),

  loadLayout: (layout: ClassroomLayout) =>
    set({
      layoutName: layout.name,
      seats: JSON.parse(JSON.stringify(layout.seats)),
      obstacles: JSON.parse(JSON.stringify(layout.obstacles)),
      platform: { ...layout.platform },
      eyeHeight: layout.eyeHeight,
      timelineStates: [],
      currentTimelineIndex: -1,
    }),

  resetLayout: () => set(getInitialState()),

  updateLineOfSightResults: (results: LineOfSightResult[]) =>
    set((state) => ({
      seats: state.seats.map((seat) => {
        const result = results.find((r) => r.seatId === seat.id);
        return {
          ...seat,
          isBlocked: result?.isBlocked ?? false,
          blockingObstacleId: result?.blockingObstacleId,
        };
      }),
    })),
}));

export const useFilteredSeats = () => {
  const { seats, filters } = useAppStore();
  return seats.filter(
    (seat) =>
      (filters.rows.length === 0 || filters.rows.includes(seat.row)) &&
      (!filters.blockedOnly || seat.isBlocked)
  );
};

export const useBlockedSeatsCount = () => {
  const seats = useFilteredSeats();
  return seats.filter((s) => s.isBlocked).length;
};

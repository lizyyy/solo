import { create } from 'zustand';
import {
  AppState,
  Passenger,
  SeatMap,
  PaidSeat,
  CompanionGroup,
  RebookingRecord,
  WeightConfig,
  SwapScheme,
  ValidationError,
} from '@/types';

interface AppStore extends AppState {
  setPassengers: (passengers: Passenger[]) => void;
  setSeatMap: (seatMap: SeatMap | null) => void;
  setPaidSeats: (paidSeats: PaidSeat[]) => void;
  setCompanionGroups: (groups: CompanionGroup[]) => void;
  setRebookingRecords: (records: RebookingRecord[]) => void;
  setWeightConfig: (config: WeightConfig) => void;
  setSwapSchemes: (schemes: SwapScheme[]) => void;
  setSelectedSchemeId: (id: string | null) => void;
  setValidationErrors: (errors: ValidationError[]) => void;
  resetAll: () => void;
}

const initialWeightConfig: WeightConfig = {
  paidSeatWeight: 10,
  companionWeight: 8,
  cabinDiffWeight: 5,
  distanceWeight: 3,
};

const initialState: AppState = {
  passengers: [],
  seatMap: null,
  paidSeats: [],
  companionGroups: [],
  rebookingRecords: [],
  weightConfig: initialWeightConfig,
  swapSchemes: [],
  selectedSchemeId: null,
  validationErrors: [],
};

export const useAppStore = create<AppStore>((set) => ({
  ...initialState,

  setPassengers: (passengers) => set({ passengers }),
  setSeatMap: (seatMap) => set({ seatMap }),
  setPaidSeats: (paidSeats) => set({ paidSeats }),
  setCompanionGroups: (companionGroups) => set({ companionGroups }),
  setRebookingRecords: (rebookingRecords) => set({ rebookingRecords }),
  setWeightConfig: (weightConfig) => set({ weightConfig }),
  setSwapSchemes: (swapSchemes) => set({ swapSchemes }),
  setSelectedSchemeId: (selectedSchemeId) => set({ selectedSchemeId }),
  setValidationErrors: (validationErrors) => set({ validationErrors }),

  resetAll: () => set(initialState),
}));

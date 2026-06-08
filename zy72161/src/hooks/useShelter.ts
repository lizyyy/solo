import { useShelterStore } from '../store/shelterStore';
import { ShelterStatus, ImportPreviewItem } from '../types';

export function useShelter() {
  const {
    shelters,
    selectedShelterId,
    filterStatus,
    searchKeyword,
    is3DMode,
    setSelectedShelter,
    setFilterStatus,
    setSearchKeyword,
    toggle3DMode,
    updateShelterStatus,
    addProcessRecord,
    addSupplementMaterial,
    getFilteredShelters,
    getShelterFeedbacks,
    getShelterRecords,
    reanalyzeShelter,
    importFromCsv,
    resetToDefault
  } = useShelterStore();

  const selectedShelter = shelters.find(s => s.id === selectedShelterId) || null;
  const filteredShelters = getFilteredShelters();

  const stats = {
    total: shelters.length,
    processed: shelters.filter(s => s.status === ShelterStatus.PROCESSED).length,
    pending: shelters.filter(s => s.status === ShelterStatus.PENDING_VERIFY).length,
    onsite: shelters.filter(s => s.status === ShelterStatus.ONSITE_CHECK).length,
    overCapacity: shelters.filter(s => s.reportedCount > s.designCapacity).length,
    totalCapacity: shelters.reduce((sum, s) => sum + s.designCapacity, 0),
    totalReported: shelters.reduce((sum, s) => sum + s.reportedCount, 0)
  };

  return {
    shelters,
    selectedShelter,
    selectedShelterId,
    filterStatus,
    searchKeyword,
    is3DMode,
    filteredShelters,
    stats,
    setSelectedShelter,
    setFilterStatus,
    setSearchKeyword,
    toggle3DMode,
    updateShelterStatus,
    addProcessRecord,
    addSupplementMaterial,
    getShelterFeedbacks,
    getShelterRecords,
    reanalyzeShelter,
    importFromCsv,
    resetToDefault
  };
}

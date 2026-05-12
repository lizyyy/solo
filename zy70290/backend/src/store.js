const store = {
  stopPoints: [],
  exhibitions: [],
  heatmaps: [],
  securityPatrols: [],
  problems: [],
  businessStatus: {
    currentStage: 'idle',
    stageHistory: [],
    currentBlock: null,
    suggestions: [],
    dataSummary: {
      totalStopPoints: 0,
      validStopPoints: 0,
      invalidStopPoints: 0,
      totalExhibitions: 0,
      heatmapGenerations: 0
    }
  },
  uploadHistory: [],
  heatmapHistory: []
};

export default store;

const DataGenerator = {
  cropTypes: ['RICE', 'WHEAT', 'CORN', 'COTTON', 'VEGETABLE'],
  
  generatePlot: (id, x, y) => {
    const cropType = DataGenerator.cropTypes[Math.floor(Math.random() * DataGenerator.cropTypes.length)];
    const area = Math.floor(Math.random() * 8) + 3;
    const slope = Math.floor(Math.random() * 15) + 1;
    const elevation = Math.floor(Math.random() * 50) + 1;
    return new Plot(id, x, y, cropType, area, slope, elevation);
  },

  generateSampleData: (plotCount, canalCount, totalWater) => {
    const system = new IrrigationSystem();
    const mapWidth = 800;
    const mapHeight = 400;
    const plotSize = 60;
    const spacing = 10;

    const cols = Math.floor(Math.sqrt(plotCount) + 1);
    const rows = Math.ceil(plotCount / cols);

    for (let i = 0; i < plotCount; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = (col + 1) * (plotSize + spacing) + 20;
      const y = (row + 1) * (plotSize + spacing) + 20;
      const plot = DataGenerator.generatePlot(`plot_${i + 1}`, x, y);
      system.addPlot(plot);
    }

    const canalCapacity = Math.floor(totalWater / canalCount);
    const canalNames = ['干渠', '支渠', '斗渠', '农渠', '毛渠'];
    
    for (let i = 0; i < canalCount; i++) {
      const startY = (i + 1) * (mapHeight / (canalCount + 1));
      const canal = new Canal(
        `canal_${i + 1}`,
        canalNames[i],
        canalCapacity,
        10,
        startY,
        mapWidth - 20,
        startY
      );
      system.addCanal(canal);
    }

    system.plots.forEach((plot, index) => {
      const canalIndex = index % system.canals.length;
      system.canals[canalIndex].addPlot(plot);
    });

    return system;
  }
};

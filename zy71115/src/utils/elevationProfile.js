export function drawElevationProfile(canvas, trailData, progress, filters) {
  if (!trailData || !trailData.trailPoints) return;
  
  const ctx = canvas.getContext('2d');
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  
  const width = rect.width;
  const height = rect.height;
  const padding = { top: 15, right: 15, bottom: 25, left: 50 };
  
  ctx.clearRect(0, 0, width, height);
  
  const points = trailData.trailPoints;
  const elevations = points.map(p => p.elevation);
  const minElev = Math.min(...elevations) - 50;
  const maxElev = Math.max(...elevations) + 50;
  const maxDist = points[points.length - 1].distance;
  
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.lineWidth = 1;
  
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartHeight / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    
    const elev = maxElev - ((maxElev - minElev) / 4) * i;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(elev) + 'm', padding.left - 8, y + 3);
  }
  
  const pathPoints = points.map((p, i) => {
    const x = padding.left + (p.distance / maxDist) * chartWidth;
    const y = padding.top + chartHeight - ((p.elevation - minElev) / (maxElev - minElev)) * chartHeight;
    return { x, y };
  });
  
  const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
  gradient.addColorStop(0, 'rgba(0, 212, 255, 0.8)');
  gradient.addColorStop(0.5, 'rgba(124, 58, 237, 0.8)');
  gradient.addColorStop(1, 'rgba(0, 212, 255, 0.3)');
  
  ctx.beginPath();
  ctx.moveTo(pathPoints[0].x, height - padding.bottom);
  pathPoints.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(pathPoints[pathPoints.length - 1].x, height - padding.bottom);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();
  
  ctx.beginPath();
  ctx.moveTo(pathPoints[0].x, pathPoints[0].y);
  pathPoints.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.strokeStyle = '#00d4ff';
  ctx.lineWidth = 2;
  ctx.stroke();
  
  if (filters.risk && trailData.riskSegments) {
    const riskColors = { low: 'rgba(255, 255, 0, 0.4)', medium: 'rgba(255, 136, 0, 0.4)', high: 'rgba(255, 0, 0, 0.4)' };
    
    trailData.riskSegments.forEach(risk => {
      if (filters.riskLevel !== 'all' && risk.level !== filters.riskLevel) return;
      
      const startX = padding.left + (risk.startDist / maxDist) * chartWidth;
      const endX = padding.left + (risk.endDist / maxDist) * chartWidth;
      
      ctx.fillStyle = riskColors[risk.level] || 'rgba(255, 0, 0, 0.3)';
      ctx.fillRect(startX, padding.top, endX - startX, chartHeight);
    });
  }
  
  if (filters.supply && trailData.supplyStations) {
    trailData.supplyStations.forEach(station => {
      const x = padding.left + (station.distance / maxDist) * chartWidth;
      
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, height - padding.bottom);
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.6)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
      
      ctx.beginPath();
      ctx.arc(x, padding.top + 5, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#00ff88';
      ctx.fill();
    });
  }
  
  if (filters.elevation && trailData.elevationMarkers) {
    trailData.elevationMarkers.forEach(marker => {
      const x = padding.left + (marker.distance / maxDist) * chartWidth;
      const y = padding.top + chartHeight - ((marker.elevation - minElev) / (maxElev - minElev)) * chartHeight;
      
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#00d4ff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }
  
  const progressX = padding.left + progress * chartWidth;
  const progressY = padding.top + chartHeight;
  
  ctx.beginPath();
  ctx.moveTo(progressX, padding.top);
  ctx.lineTo(progressX, progressY);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 4]);
  ctx.stroke();
  ctx.setLineDash([]);
  
  const progressPoint = pathPoints[Math.floor(progress * (pathPoints.length - 1))] || pathPoints[pathPoints.length - 1];
  ctx.beginPath();
  ctx.arc(progressPoint.x, progressPoint.y, 8, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#00d4ff';
  ctx.lineWidth = 3;
  ctx.stroke();
  
  ctx.beginPath();
  ctx.arc(progressPoint.x, progressPoint.y, 12, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(0, 212, 255, 0.5)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

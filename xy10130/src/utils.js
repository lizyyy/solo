export function distance2D(x1, z1, x2, z2) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  return Math.sqrt(dx * dx + dz * dz);
}

export function distance3D(x1, y1, z1, x2, y2, z2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dz = z2 - z1;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function lerpColor(color1, color2, t) {
  const r = lerp(color1[0], color2[0], t);
  const g = lerp(color1[1], color2[1], t);
  const b = lerp(color1[2], color2[2], t);
  return [r, g, b];
}

export function getHeatmapColor(value, colorScale) {
  value = clamp(value, 0, 1);
  
  for (let i = 0; i < colorScale.length - 1; i++) {
    const c1 = colorScale[i];
    const c2 = colorScale[i + 1];
    
    if (value >= c1.value && value <= c2.value) {
      const t = (value - c1.value) / (c2.value - c1.value);
      return lerpColor(c1.color, c2.color, t);
    }
  }
  
  return colorScale[colorScale.length - 1].color;
}

export function generateId() {
  return 'sensor_' + Math.random().toString(36).substr(2, 9);
}

export function formatNumber(num, decimals = 2) {
  return Number(num.toFixed(decimals));
}

export function downloadFile(content, filename, type = 'application/json') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e);
    reader.readAsText(file);
  });
}

export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

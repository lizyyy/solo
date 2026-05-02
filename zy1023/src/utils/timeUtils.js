export const formatTime = (seconds) => {
  if (!seconds || seconds < 0) return '00:00.000'
  
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 1000)
  
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`
}

export const formatTimeShort = (seconds) => {
  if (!seconds || seconds < 0) return '00:00'
  
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export const parseTime = (timeStr) => {
  if (!timeStr) return 0
  
  const parts = timeStr.split(':')
  if (parts.length === 2) {
    const [mins, secsPart] = parts
    const [secs, ms] = secsPart.split('.')
    return parseInt(mins || 0) * 60 + 
           parseInt(secs || 0) + 
           (parseInt(ms || 0) / 1000)
  }
  
  return parseFloat(timeStr) || 0
}

export const getTimeFromPixel = (pixel, containerWidth, duration, offset = 0) => {
  if (!duration || duration <= 0) return 0
  return (pixel / containerWidth) * duration + offset
}

export const getPixelFromTime = (time, containerWidth, duration, offset = 0) => {
  if (!duration || duration <= 0) return 0
  return ((time - offset) / duration) * containerWidth
}

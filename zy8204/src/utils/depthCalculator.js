export function calculateDepthIntervals(coreBoxes) {
  if (!Array.isArray(coreBoxes) || coreBoxes.length === 0) {
    return {
      intervals: [],
      totalDepth: 0,
      gaps: [],
      overlaps: []
    }
  }
  
  const sortedBoxes = [...coreBoxes].sort((a, b) => a.start_depth - b.start_depth)
  
  const intervals = sortedBoxes.map((box, index) => ({
    box_number: box.box_number,
    start_depth: box.start_depth,
    end_depth: box.end_depth,
    thickness: box.end_depth - box.start_depth,
    rqd: box.rqd,
    recovery_rate: box.recovery_rate,
    lithology: box.lithology,
    index
  }))
  
  const gaps = []
  const overlaps = []
  
  for (let i = 0; i < intervals.length - 1; i++) {
    const current = intervals[i]
    const next = intervals[i + 1]
    
    const gap = next.start_depth - current.end_depth
    
    if (gap > 0.0001) {
      gaps.push({
        between: [current.box_number, next.box_number],
        gap_start: current.end_depth,
        gap_end: next.start_depth,
        gap_size: gap,
        current_index: i,
        next_index: i + 1
      })
    } else if (gap < -0.0001) {
      overlaps.push({
        between: [current.box_number, next.box_number],
        overlap_start: next.start_depth,
        overlap_end: current.end_depth,
        overlap_size: -gap,
        current_index: i,
        next_index: i + 1
      })
    }
  }
  
  const minDepth = Math.min(...intervals.map(i => i.start_depth))
  const maxDepth = Math.max(...intervals.map(i => i.end_depth))
  
  return {
    intervals,
    totalDepth: maxDepth - minDepth,
    minDepth,
    maxDepth,
    gaps,
    overlaps,
    sortedBoxes
  }
}

export function calculateLithologyLayers(coreBoxes) {
  if (!Array.isArray(coreBoxes) || coreBoxes.length === 0) {
    return []
  }
  
  const sortedBoxes = [...coreBoxes].sort((a, b) => a.start_depth - b.start_depth)
  
  const layers = []
  let currentLayer = null
  
  sortedBoxes.forEach((box) => {
    if (!box.lithology) {
      return
    }
    
    if (!currentLayer || currentLayer.lithology !== box.lithology) {
      if (currentLayer) {
        layers.push(currentLayer)
      }
      currentLayer = {
        lithology: box.lithology,
        start_depth: box.start_depth,
        end_depth: box.end_depth,
        boxes: [box.box_number],
        thickness: box.end_depth - box.start_depth
      }
    } else {
      currentLayer.end_depth = box.end_depth
      currentLayer.boxes.push(box.box_number)
      currentLayer.thickness = currentLayer.end_depth - currentLayer.start_depth
    }
  })
  
  if (currentLayer) {
    layers.push(currentLayer)
  }
  
  return layers
}

export function calculateRQDAndRecoveryData(coreBoxes, depthScale = 1) {
  if (!Array.isArray(coreBoxes) || coreBoxes.length === 0) {
    return {
      rqdData: [],
      recoveryData: [],
      depthPoints: []
    }
  }
  
  const sortedBoxes = [...coreBoxes].sort((a, b) => a.start_depth - b.start_depth)
  
  const rqdData = []
  const recoveryData = []
  const depthPoints = []
  
  sortedBoxes.forEach((box) => {
    const midDepth = (box.start_depth + box.end_depth) / 2
    
    depthPoints.push(midDepth)
    
    if (box.rqd !== undefined && box.rqd !== null && box.rqd !== '') {
      rqdData.push({
        x: midDepth,
        y: parseFloat(box.rqd),
        box_number: box.box_number,
        start_depth: box.start_depth,
        end_depth: box.end_depth
      })
    }
    
    if (box.recovery_rate !== undefined && box.recovery_rate !== null && box.recovery_rate !== '') {
      recoveryData.push({
        x: midDepth,
        y: parseFloat(box.recovery_rate),
        box_number: box.box_number,
        start_depth: box.start_depth,
        end_depth: box.end_depth
      })
    }
  })
  
  return {
    rqdData,
    recoveryData,
    depthPoints,
    sortedBoxes
  }
}

export function mergeIntervalsByLithology(intervals) {
  if (!Array.isArray(intervals) || intervals.length === 0) {
    return []
  }
  
  const sorted = [...intervals].sort((a, b) => a.start_depth - b.start_depth)
  
  const merged = []
  let current = null
  
  sorted.forEach((interval) => {
    if (!interval.lithology) {
      merged.push({
        ...interval,
        boxes: [interval.box_number]
      })
      current = null
      return
    }
    
    if (!current || current.lithology !== interval.lithology) {
      if (current) {
        merged.push(current)
      }
      current = {
        ...interval,
        end_depth: interval.end_depth,
        thickness: interval.thickness,
        boxes: [interval.box_number]
      }
    } else {
      current.end_depth = interval.end_depth
      current.thickness = current.end_depth - current.start_depth
      current.boxes.push(interval.box_number)
    }
  })
  
  if (current) {
    merged.push(current)
  }
  
  return merged
}

export function findBoxAtDepth(coreBoxes, depth) {
  if (!Array.isArray(coreBoxes) || coreBoxes.length === 0) {
    return null
  }
  
  return coreBoxes.find(box => 
    depth >= box.start_depth && depth <= box.end_depth
  ) || null
}

export function getDepthRangeForBoxes(coreBoxes, boxNumbers) {
  const matchedBoxes = coreBoxes.filter(box => 
    boxNumbers.includes(box.box_number)
  )
  
  if (matchedBoxes.length === 0) {
    return null
  }
  
  return {
    start_depth: Math.min(...matchedBoxes.map(b => b.start_depth)),
    end_depth: Math.max(...matchedBoxes.map(b => b.end_depth)),
    boxes: matchedBoxes
  }
}

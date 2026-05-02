export const MARKER_TYPES = {
  DELETE: {
    id: 'DELETE',
    label: '删除',
    color: '#ef4444',
    bgColor: '#fef2f2',
    borderColor: '#fca5a5',
    icon: '🗑️'
  },
  TITLE: {
    id: 'TITLE',
    label: '标题候选',
    color: '#f59e0b',
    bgColor: '#fffbeb',
    borderColor: '#fcd34d',
    icon: '📌'
  },
  BGM: {
    id: 'BGM',
    label: '插BGM',
    color: '#3b82f6',
    bgColor: '#eff6ff',
    borderColor: '#93c5fd',
    icon: '🎵'
  },
  PICKUP: {
    id: 'PICKUP',
    label: '补录',
    color: '#8b5cf6',
    bgColor: '#f5f3ff',
    borderColor: '#c4b5fd',
    icon: '🔄'
  }
}

export const getMarkerType = (typeId) => {
  return MARKER_TYPES[typeId] || MARKER_TYPES.DELETE
}

export const getAllMarkerTypes = () => {
  return Object.values(MARKER_TYPES)
}

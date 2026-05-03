import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { Project, Room, Box, Item, BoxStatus } from '@/models/types'
import { RiskChecker } from '@/services/RiskChecker'
import { ImportExportService, CSV_TEMPLATE } from '@/services/ImportExportService'
import dayjs from 'dayjs'

const isElectron = typeof window !== 'undefined' && window.electronAPI

async function saveProjectToStorage(project) {
  if (!project) return
  
  const projectData = {
    ...project,
    updatedAt: dayjs().toISOString()
  }
  
  if (isElectron) {
    await window.electronAPI.saveProject(projectData)
  } else {
    localStorage.setItem('moving-box-current-project', JSON.stringify(projectData))
  }
}

async function loadProjectFromStorage(projectId) {
  if (isElectron) {
    const result = await window.electronAPI.loadProject(projectId)
    if (result.success) {
      return result.data
    }
    return null
  } else {
    const data = localStorage.getItem('moving-box-current-project')
    if (data) {
      return JSON.parse(data)
    }
    return null
  }
}

export const useProjectStore = defineStore('project', () => {
  const currentProject = ref(null)
  const projectsList = ref([])
  const selectedRoomId = ref(null)
  const selectedBoxId = ref(null)
  const searchKeyword = ref('')
  const filterTags = ref([])
  const risks = ref([])

  const hasProject = computed(() => currentProject.value !== null)
  
  const rooms = computed(() => currentProject.value?.rooms || [])
  const boxes = computed(() => currentProject.value?.boxes || [])
  const items = computed(() => currentProject.value?.items || [])
  const tags = computed(() => currentProject.value?.tags || [])
  
  const sourceRooms = computed(() => rooms.value.filter(r => r.isSource))
  const targetRooms = computed(() => rooms.value.filter(r => !r.isSource))

  const filteredItems = computed(() => {
    let result = [...items.value]
    
    if (searchKeyword.value) {
      const keyword = searchKeyword.value.toLowerCase()
      result = result.filter(item => 
        item.name.toLowerCase().includes(keyword) ||
        item.description?.toLowerCase().includes(keyword) ||
        item.responsiblePerson?.toLowerCase().includes(keyword)
      )
    }
    
    if (filterTags.value.length > 0) {
      result = result.filter(item => 
        filterTags.value.some(tag => item.tags.includes(tag))
      )
    }
    
    if (selectedRoomId.value) {
      result = result.filter(item => item.roomId === selectedRoomId.value)
    }
    
    if (selectedBoxId.value) {
      result = result.filter(item => item.boxId === selectedBoxId.value)
    }
    
    return result
  })

  const stats = computed(() => {
    if (!currentProject.value) {
      return {
        totalBoxes: 0,
        totalItems: 0,
        packedBoxes: 0,
        unpackedItems: 0,
        totalWeight: 0,
        riskCount: risks.value.length
      }
    }
    
    const totalItems = items.value.reduce((sum, item) => sum + item.quantity, 0)
    const unpackedItems = items.value.filter(i => !i.boxId).reduce((sum, item) => sum + item.quantity, 0)
    const totalWeight = items.value.reduce((sum, item) => sum + (item.weight * item.quantity), 0)
    const packedBoxes = boxes.value.filter(b => 
      [BoxStatus.PACKED, BoxStatus.MOVED, BoxStatus.ARRIVED].includes(b.status)
    ).length
    
    return {
      totalBoxes: boxes.value.length,
      totalItems,
      packedBoxes,
      unpackedItems,
      totalWeight,
      riskCount: risks.value.length
    }
  })

  function createNewProject(name, description = '', moveDate = null) {
    const defaultRooms = [
      new Room({ name: '客厅', isSource: true, order: 1 }),
      new Room({ name: '主卧', isSource: true, order: 2 }),
      new Room({ name: '次卧', isSource: true, order: 3 }),
      new Room({ name: '书房', isSource: true, order: 4 }),
      new Room({ name: '厨房', isSource: true, order: 5 }),
      new Room({ name: '卫生间', isSource: true, order: 6 }),
      new Room({ name: '新客厅', isSource: false, order: 1 }),
      new Room({ name: '新主卧', isSource: false, order: 2 }),
      new Room({ name: '新次卧', isSource: false, order: 3 }),
      new Room({ name: '新书房', isSource: false, order: 4 })
    ]
    
    currentProject.value = new Project({
      name,
      description,
      moveDate,
      rooms: defaultRooms
    })
    
    selectedRoomId.value = null
    selectedBoxId.value = null
    searchKeyword.value = ''
    filterTags.value = []
    
    updateRisks()
    saveCurrentProject()
    
    return currentProject.value
  }

  async function loadProject(projectId) {
    const data = await loadProjectFromStorage(projectId)
    if (data) {
      currentProject.value = data
      selectedRoomId.value = null
      selectedBoxId.value = null
      updateRisks()
      return true
    }
    return false
  }

  async function listProjects() {
    if (isElectron) {
      const result = await window.electronAPI.listProjects()
      if (result.success) {
        projectsList.value = result.projects
        return result.projects
      }
    }
    return []
  }

  async function deleteProject(projectId) {
    if (isElectron) {
      await window.electronAPI.deleteProject(projectId)
      if (currentProject.value?.id === projectId) {
        currentProject.value = null
      }
      await listProjects()
    }
  }

  async function saveCurrentProject() {
    if (currentProject.value) {
      await saveProjectToStorage(currentProject.value)
      await listProjects()
    }
  }

  function addRoom(room) {
    if (!currentProject.value) return
    const newRoom = new Room(room)
    currentProject.value.rooms.push(newRoom)
    saveCurrentProject()
    return newRoom
  }

  function updateRoom(roomId, updates) {
    if (!currentProject.value) return
    const room = currentProject.value.rooms.find(r => r.id === roomId)
    if (room) {
      Object.assign(room, updates)
      saveCurrentProject()
    }
  }

  function removeRoom(roomId) {
    if (!currentProject.value) return
    currentProject.value.rooms = currentProject.value.rooms.filter(r => r.id !== roomId)
    currentProject.value.items.forEach(item => {
      if (item.roomId === roomId) {
        item.roomId = null
      }
    })
    saveCurrentProject()
  }

  function addBox(boxData) {
    if (!currentProject.value) return
    
    let boxNumber = boxData.boxNumber
    if (!boxNumber) {
      const existingNumbers = currentProject.value.boxes.map(b => parseInt(b.boxNumber)).filter(n => !isNaN(n))
      boxNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1
    }
    
    const newBox = new Box({
      ...boxData,
      boxNumber: boxNumber.toString()
    })
    
    currentProject.value.boxes.push(newBox)
    saveCurrentProject()
    return newBox
  }

  function updateBox(boxId, updates) {
    if (!currentProject.value) return
    const box = currentProject.value.boxes.find(b => b.id === boxId)
    if (box) {
      Object.assign(box, updates)
      box.updatedAt = dayjs().toISOString()
      updateRisks()
      saveCurrentProject()
    }
  }

  function changeBoxStatus(boxId, newStatus, note = '') {
    if (!currentProject.value) return
    const box = currentProject.value.boxes.find(b => b.id === boxId)
    if (box) {
      box.changeStatus(newStatus, note)
      updateRisks()
      saveCurrentProject()
    }
  }

  function batchChangeBoxStatus(boxIds, newStatus, note = '') {
    boxIds.forEach(boxId => {
      changeBoxStatus(boxId, newStatus, note)
    })
  }

  function removeBox(boxId) {
    if (!currentProject.value) return
    currentProject.value.boxes = currentProject.value.boxes.filter(b => b.id !== boxId)
    currentProject.value.items.forEach(item => {
      if (item.boxId === boxId) {
        item.boxId = null
      }
    })
    if (selectedBoxId.value === boxId) {
      selectedBoxId.value = null
    }
    updateRisks()
    saveCurrentProject()
  }

  function addItem(itemData) {
    if (!currentProject.value) return
    const newItem = new Item(itemData)
    currentProject.value.items.push(newItem)
    updateRisks()
    saveCurrentProject()
    return newItem
  }

  function updateItem(itemId, updates) {
    if (!currentProject.value) return
    const item = currentProject.value.items.find(i => i.id === itemId)
    if (item) {
      item.update(updates)
      updateRisks()
      saveCurrentProject()
    }
  }

  function removeItem(itemId) {
    if (!currentProject.value) return
    currentProject.value.items = currentProject.value.items.filter(i => i.id !== itemId)
    updateRisks()
    saveCurrentProject()
  }

  function batchAddItems(itemsData) {
    if (!currentProject.value) return
    const newItems = itemsData.map(data => new Item(data))
    currentProject.value.items.push(...newItems)
    updateRisks()
    saveCurrentProject()
    return newItems
  }

  async function importItemsFromCSV() {
    if (!isElectron || !currentProject.value) return { items: [], errors: [] }
    
    const result = await window.electronAPI.importCsv()
    if (result.success && result.content) {
      const importResult = await ImportExportService.importFromCSV(result.content, currentProject.value)
      
      if (importResult.items.length > 0) {
        batchAddItems(importResult.items)
      }
      
      return importResult
    }
    
    return { items: [], errors: [], canceled: result.canceled }
  }

  async function exportMovingListCSV() {
    if (!currentProject.value) return false
    
    const content = ImportExportService.exportMovingListCSV(currentProject.value)
    const filename = `${currentProject.value.name}-搬运清单.csv`
    
    if (isElectron) {
      const result = await window.electronAPI.exportFile({
        filename,
        content,
        type: 'csv'
      })
      return result.success
    }
    
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
    return true
  }

  async function exportUrgentListMarkdown() {
    if (!currentProject.value) return false
    
    const content = ImportExportService.exportUrgentUnpackListMarkdown(currentProject.value)
    const filename = `${currentProject.value.name}-今晚先拆清单.md`
    
    if (isElectron) {
      const result = await window.electronAPI.exportFile({
        filename,
        content,
        type: 'md'
      })
      return result.success
    }
    
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
    return true
  }

  async function exportBoxLabelHTML(boxId) {
    if (!currentProject.value) return false
    
    const content = ImportExportService.exportBoxLabelHTML(currentProject.value, boxId)
    const box = currentProject.value.getBoxById(boxId)
    const filename = `${currentProject.value.name}-箱子#${box?.boxNumber || boxId}-标签.html`
    
    if (isElectron) {
      const result = await window.electronAPI.exportFile({
        filename,
        content,
        type: 'html'
      })
      return result.success
    }
    
    const blob = new Blob([content], { type: 'text/html;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
    return true
  }

  function updateRisks() {
    if (!currentProject.value) {
      risks.value = []
      return
    }
    
    const checker = new RiskChecker(currentProject.value)
    risks.value = checker.checkAll()
  }

  function setSelectedRoom(roomId) {
    selectedRoomId.value = roomId
    selectedBoxId.value = null
  }

  function setSelectedBox(boxId) {
    selectedBoxId.value = boxId
    selectedRoomId.value = null
  }

  function clearSelection() {
    selectedRoomId.value = null
    selectedBoxId.value = null
  }

  function toggleFilterTag(tag) {
    const index = filterTags.value.indexOf(tag)
    if (index > -1) {
      filterTags.value.splice(index, 1)
    } else {
      filterTags.value.push(tag)
    }
  }

  function clearFilterTags() {
    filterTags.value = []
  }

  function getBoxItems(boxId) {
    if (!currentProject.value) return []
    return currentProject.value.getItemsByBox(boxId)
  }

  function getBoxStats(boxId) {
    if (!currentProject.value) return { totalWeight: 0, totalItems: 0, itemCount: 0 }
    return currentProject.value.calculateBoxStats(boxId)
  }

  function getRoomById(roomId) {
    if (!currentProject.value) return null
    return currentProject.value.getRoomById(roomId)
  }

  function getBoxById(boxId) {
    if (!currentProject.value) return null
    return currentProject.value.getBoxById(boxId)
  }

  return {
    currentProject,
    projectsList,
    selectedRoomId,
    selectedBoxId,
    searchKeyword,
    filterTags,
    risks,
    
    hasProject,
    rooms,
    boxes,
    items,
    tags,
    sourceRooms,
    targetRooms,
    filteredItems,
    stats,
    
    createNewProject,
    loadProject,
    listProjects,
    deleteProject,
    saveCurrentProject,
    
    addRoom,
    updateRoom,
    removeRoom,
    
    addBox,
    updateBox,
    changeBoxStatus,
    batchChangeBoxStatus,
    removeBox,
    
    addItem,
    updateItem,
    removeItem,
    batchAddItems,
    
    importItemsFromCSV,
    exportMovingListCSV,
    exportUrgentListMarkdown,
    exportBoxLabelHTML,
    
    updateRisks,
    
    setSelectedRoom,
    setSelectedBox,
    clearSelection,
    toggleFilterTag,
    clearFilterTags,
    
    getBoxItems,
    getBoxStats,
    getRoomById,
    getBoxById
  }
})

const { STORAGE_KEYS, getStorageData, setStorageData, generateId, formatDate } = require('../../utils/storage.js')

Page({
  data: {
    tools: [],
    filteredTools: [],
    searchKeyword: '',
    showAddModal: false,
    showDetailModal: false,
    currentTool: null,
    filterType: 'all',
    toolTypes: ['全部', '缝纫机', '剪刀', '测量工具', '定位工具', '其他'],
    formData: {
      name: '',
      type: '缝纫机',
      brand: '',
      model: '',
      price: '',
      purchaseDate: '',
      supplier: '',
      status: '正常',
      lastMaintenance: '',
      nextMaintenance: '',
      warrantyExpiry: '',
      notes: ''
    }
  },

  onLoad() {
    this.loadTools()
  },

  onShow() {
    this.loadTools()
  },

  loadTools() {
    const tools = getStorageData(STORAGE_KEYS.TOOLS)
    this.setData({ tools, filteredTools: tools })
  },

  onSearchInput(e) {
    const keyword = e.detail.value.toLowerCase()
    this.setData({ searchKeyword: keyword })
    this.filterTools()
  },

  onTypeFilter(e) {
    const index = e.detail.value
    const type = this.data.toolTypes[index]
    this.setData({ filterType: type === '全部' ? 'all' : type })
    this.filterTools()
  },

  filterTools() {
    let tools = [...this.data.tools]
    const { searchKeyword, filterType } = this.data

    if (filterType !== 'all') {
      tools = tools.filter(t => t.type === filterType)
    }

    if (searchKeyword) {
      tools = tools.filter(t => 
        t.name.toLowerCase().includes(searchKeyword) ||
        t.type.toLowerCase().includes(searchKeyword) ||
        (t.brand && t.brand.toLowerCase().includes(searchKeyword))
      )
    }

    this.setData({ filteredTools: tools })
  },

  showAddModal() {
    this.setData({
      showAddModal: true,
      formData: {
        name: '',
        type: '缝纫机',
        brand: '',
        model: '',
        price: '',
        purchaseDate: this.formatDate(new Date()),
        supplier: '',
        status: '正常',
        lastMaintenance: '',
        nextMaintenance: '',
        warrantyExpiry: '',
        notes: ''
      }
    })
  },

  hideAddModal() {
    this.setData({ showAddModal: false })
  },

  hideDetailModal() {
    this.setData({ showDetailModal: false })
  },

  onFormInput(e) {
    const field = e.currentTarget.dataset.field
    const value = e.detail.value
    this.setData({ [`formData.${field}`]: value })
  },

  onPickerChange(e) {
    const field = e.currentTarget.dataset.field
    const value = e.detail.value
    const options = {
      type: ['缝纫机', '剪刀', '测量工具', '定位工具', '其他'],
      status: ['正常', '维修中', '待维护', '损坏']
    }
    if (options[field]) {
      this.setData({ [`formData.${field}`]: options[field][value] })
    }
  },

  onDateChange(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`formData.${field}`]: e.detail.value })
  },

  submitAddForm() {
    const { formData } = this.data
    if (!formData.name.trim()) {
      wx.showToast({ title: '请输入工具名称', icon: 'none' })
      return
    }

    const newTool = {
      id: generateId(),
      name: formData.name.trim(),
      type: formData.type,
      brand: formData.brand.trim(),
      model: formData.model.trim(),
      price: formData.price ? parseFloat(formData.price) : 0,
      purchaseDate: formData.purchaseDate,
      supplier: formData.supplier.trim(),
      status: formData.status,
      lastMaintenance: formData.lastMaintenance,
      nextMaintenance: formData.nextMaintenance,
      warrantyExpiry: formData.warrantyExpiry,
      notes: formData.notes.trim(),
      image: '',
      createTime: Date.now(),
      updateTime: Date.now()
    }

    const tools = [...this.data.tools, newTool]
    setStorageData(STORAGE_KEYS.TOOLS, tools)
    
    this.setData({ tools, showAddModal: false })
    this.filterTools()
    
    wx.showToast({ title: '添加成功', icon: 'success' })
  },

  viewDetail(e) {
    const id = e.currentTarget.dataset.id
    const tool = this.data.tools.find(t => t.id === id)
    if (tool) {
      this.setData({ currentTool: tool, showDetailModal: true })
    }
  },

  changeStatus(e) {
    const { id, status } = e.currentTarget.dataset
    const tools = this.data.tools.map(t => {
      if (t.id === id) {
        return { ...t, status, updateTime: Date.now() }
      }
      return t
    })
    
    setStorageData(STORAGE_KEYS.TOOLS, tools)
    this.setData({ tools })
    this.filterTools()
    
    wx.showToast({ title: '状态已更新', icon: 'success' })
  },

  deleteTool(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个工具记录吗？',
      success: (res) => {
        if (res.confirm) {
          const tools = this.data.tools.filter(t => t.id !== id)
          setStorageData(STORAGE_KEYS.TOOLS, tools)
          
          this.setData({ tools, showDetailModal: false })
          this.filterTools()
          
          wx.showToast({ title: '删除成功', icon: 'success' })
        }
      }
    })
  },

  formatDate(date) {
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    return `${year}-${month}-${day}`
  }
})

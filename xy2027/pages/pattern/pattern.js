const { STORAGE_KEYS, getStorageData, setStorageData, generateId, formatPrice } = require('../../utils/storage.js')

Page({
  data: {
    patterns: [],
    filteredPatterns: [],
    searchKeyword: '',
    showAddModal: false,
    showDetailModal: false,
    currentPattern: null,
    filterType: 'all',
    patternTypes: ['全部', '上衣', '裤子', '连衣裙', '外套', '裙子', '其他'],
    filterStatus: 'all',
    statusOptions: ['全部', '待开始', '进行中', '已完成'],
    formData: {
      name: '',
      type: '上衣',
      difficulty: '中等',
      sizes: '',
      fabricType: '',
      fabricQuantity: '',
      price: '',
      purchaseDate: '',
      source: '',
      status: '待开始',
      notes: ''
    }
  },

  onLoad() {
    this.loadPatterns()
  },

  onShow() {
    this.loadPatterns()
  },

  loadPatterns() {
    const patterns = getStorageData(STORAGE_KEYS.PATTERNS)
    this.setData({ patterns, filteredPatterns: patterns })
  },

  onSearchInput(e) {
    const keyword = e.detail.value.toLowerCase()
    this.setData({ searchKeyword: keyword })
    this.filterPatterns()
  },

  onTypeFilter(e) {
    const index = e.detail.value
    const type = this.data.patternTypes[index]
    this.setData({ filterType: type === '全部' ? 'all' : type })
    this.filterPatterns()
  },

  onStatusFilter(e) {
    const index = e.detail.value
    const status = this.data.statusOptions[index]
    this.setData({ filterStatus: status === '全部' ? 'all' : status })
    this.filterPatterns()
  },

  filterPatterns() {
    let patterns = [...this.data.patterns]
    const { searchKeyword, filterType, filterStatus } = this.data

    if (filterType !== 'all') {
      patterns = patterns.filter(p => p.type === filterType)
    }

    if (filterStatus !== 'all') {
      patterns = patterns.filter(p => p.status === filterStatus)
    }

    if (searchKeyword) {
      patterns = patterns.filter(p => 
        p.name.toLowerCase().includes(searchKeyword) ||
        p.type.toLowerCase().includes(searchKeyword) ||
        p.difficulty.toLowerCase().includes(searchKeyword)
      )
    }

    this.setData({ filteredPatterns: patterns })
  },

  showAddModal() {
    this.setData({
      showAddModal: true,
      formData: {
        name: '',
        type: '上衣',
        difficulty: '中等',
        sizes: '',
        fabricType: '',
        fabricQuantity: '',
        price: '',
        purchaseDate: this.formatDate(new Date()),
        source: '',
        status: '待开始',
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
    this.setData({
      [`formData.${field}`]: value
    })
  },

  onPickerChange(e) {
    const field = e.currentTarget.dataset.field
    const value = e.detail.value
    const options = {
      type: ['上衣', '裤子', '连衣裙', '外套', '裙子', '其他'],
      difficulty: ['简单', '中等', '困难'],
      status: ['待开始', '进行中', '已完成']
    }
    this.setData({ [`formData.${field}`]: options[field][value] })
  },

  onDateChange(e) {
    this.setData({
      'formData.purchaseDate': e.detail.value
    })
  },

  submitAddForm() {
    const { formData } = this.data
    
    if (!formData.name.trim()) {
      wx.showToast({ title: '请输入纸样名称', icon: 'none' })
      return
    }

    const sizesArray = formData.sizes ? formData.sizes.split(',').map(s => s.trim()) : []
    
    const newPattern = {
      id: generateId(),
      name: formData.name.trim(),
      type: formData.type,
      difficulty: formData.difficulty,
      sizes: sizesArray,
      fabricType: formData.fabricType.trim(),
      fabricQuantity: formData.fabricQuantity ? parseFloat(formData.fabricQuantity) : 0,
      price: formData.price ? parseFloat(formData.price) : 0,
      purchaseDate: formData.purchaseDate,
      source: formData.source.trim(),
      status: formData.status,
      completedProjects: 0,
      notes: formData.notes.trim(),
      image: '',
      createTime: Date.now(),
      updateTime: Date.now()
    }

    const patterns = [...this.data.patterns, newPattern]
    setStorageData(STORAGE_KEYS.PATTERNS, patterns)
    
    this.setData({ patterns, showAddModal: false })
    this.filterPatterns()
    
    wx.showToast({ title: '添加成功', icon: 'success' })
  },

  viewDetail(e) {
    const id = e.currentTarget.dataset.id
    const pattern = this.data.patterns.find(p => p.id === id)
    if (pattern) {
      this.setData({
        currentPattern: pattern,
        showDetailModal: true
      })
    }
  },

  changeStatus(e) {
    const { id, status } = e.currentTarget.dataset
    const patterns = this.data.patterns.map(p => {
      if (p.id === id) {
        return { ...p, status, updateTime: Date.now() }
      }
      return p
    })
    
    setStorageData(STORAGE_KEYS.PATTERNS, patterns)
    this.setData({ patterns })
    this.filterPatterns()
    
    wx.showToast({ title: '状态已更新', icon: 'success' })
  },

  deletePattern(e) {
    const id = e.currentTarget.dataset.id
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个纸样记录吗？',
      success: (res) => {
        if (res.confirm) {
          const patterns = this.data.patterns.filter(p => p.id !== id)
          setStorageData(STORAGE_KEYS.PATTERNS, patterns)
          
          this.setData({ patterns, showDetailModal: false })
          this.filterPatterns()
          
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

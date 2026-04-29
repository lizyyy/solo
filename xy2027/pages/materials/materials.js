const { STORAGE_KEYS, getStorageData, setStorageData, generateId, formatPrice } = require('../../utils/storage.js')

Page({
  data: {
    materials: [],
    filteredMaterials: [],
    searchKeyword: '',
    showAddModal: false,
    showDetailModal: false,
    currentMaterial: null,
    filterType: 'all',
    materialTypes: ['全部', '缝纫线', '拉链', '纽扣', '松紧带', '衬布', '其他'],
    lowStockCount: 0,
    formData: {
      name: '',
      type: '缝纫线',
      color: '',
      brand: '',
      quantity: '',
      unit: '卷',
      price: '',
      purchaseDate: '',
      supplier: '',
      minimumStock: '',
      notes: ''
    }
  },

  onLoad() {
    this.loadMaterials()
  },

  onShow() {
    this.loadMaterials()
  },

  loadMaterials() {
    const materials = getStorageData(STORAGE_KEYS.MATERIALS)
    const lowStockCount = materials.filter(m => m.quantity <= (m.minimumStock || 5)).length
    this.setData({ materials, filteredMaterials: materials, lowStockCount })
  },

  onSearchInput(e) {
    const keyword = e.detail.value.toLowerCase()
    this.setData({ searchKeyword: keyword })
    this.filterMaterials()
  },

  onTypeFilter(e) {
    const index = e.detail.value
    const type = this.data.materialTypes[index]
    this.setData({ filterType: type === '全部' ? 'all' : type })
    this.filterMaterials()
  },

  filterMaterials() {
    let materials = [...this.data.materials]
    const { searchKeyword, filterType } = this.data

    if (filterType !== 'all') {
      materials = materials.filter(m => m.type === filterType)
    }

    if (searchKeyword) {
      materials = materials.filter(m => 
        m.name.toLowerCase().includes(searchKeyword) ||
        m.type.toLowerCase().includes(searchKeyword) ||
        m.color.toLowerCase().includes(searchKeyword)
      )
    }

    this.setData({ filteredMaterials: materials })
  },

  showAddModal() {
    this.setData({
      showAddModal: true,
      formData: {
        name: '',
        type: '缝纫线',
        color: '',
        brand: '',
        quantity: '',
        unit: '卷',
        price: '',
        purchaseDate: this.formatDate(new Date()),
        supplier: '',
        minimumStock: '5',
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
    if (field === 'type') {
      const types = ['缝纫线', '拉链', '纽扣', '松紧带', '衬布', '其他']
      this.setData({ [`formData.${field}`]: types[value] })
    } else if (field === 'unit') {
      const units = ['卷', '条', '颗', '米', '件']
      this.setData({ [`formData.${field}`]: units[value] })
    }
  },

  onDateChange(e) {
    this.setData({ 'formData.purchaseDate': e.detail.value })
  },

  submitAddForm() {
    const { formData } = this.data
    if (!formData.name.trim()) {
      wx.showToast({ title: '请输入辅料名称', icon: 'none' })
      return
    }
    if (!formData.quantity || parseFloat(formData.quantity) <= 0) {
      wx.showToast({ title: '请输入有效数量', icon: 'none' })
      return
    }

    const quantity = parseFloat(formData.quantity)
    const price = formData.price ? parseFloat(formData.price) : 0
    const minimumStock = formData.minimumStock ? parseInt(formData.minimumStock) : 5

    const newMaterial = {
      id: generateId(),
      name: formData.name.trim(),
      type: formData.type,
      color: formData.color.trim() || '未指定',
      brand: formData.brand.trim(),
      quantity: quantity,
      unit: formData.unit,
      price: price,
      totalValue: quantity * price,
      purchaseDate: formData.purchaseDate,
      supplier: formData.supplier.trim(),
      minimumStock: minimumStock,
      notes: formData.notes.trim(),
      image: '',
      createTime: Date.now(),
      updateTime: Date.now()
    }

    const materials = [...this.data.materials, newMaterial]
    setStorageData(STORAGE_KEYS.MATERIALS, materials)
    
    this.setData({ materials, showAddModal: false })
    this.filterMaterials()
    this.checkLowStock(materials)
    
    wx.showToast({ title: '添加成功', icon: 'success' })
  },

  viewDetail(e) {
    const id = e.currentTarget.dataset.id
    const material = this.data.materials.find(m => m.id === id)
    if (material) {
      this.setData({ currentMaterial: material, showDetailModal: true })
    }
  },

  useMaterial(e) {
    const id = e.currentTarget.dataset.id
    const material = this.data.materials.find(m => m.id === id)
    
    if (!material) return
    
    wx.showModal({
      title: '使用辅料',
      content: `当前库存：${material.quantity}${material.unit}\n请输入使用数量`,
      editable: true,
      placeholderText: '请输入使用数量',
      success: (res) => {
        if (res.confirm && res.content) {
          const useQuantity = parseFloat(res.content)
          if (isNaN(useQuantity) || useQuantity <= 0) {
            wx.showToast({ title: '请输入有效数量', icon: 'none' })
            return
          }
          if (useQuantity > material.quantity) {
            wx.showToast({ title: '库存不足', icon: 'none' })
            return
          }

          const newQuantity = material.quantity - useQuantity
          const updatedMaterials = this.data.materials.map(m => {
            if (m.id === id) {
              return {
                ...m,
                quantity: newQuantity,
                totalValue: newQuantity * m.price,
                updateTime: Date.now()
              }
            }
            return m
          })

          setStorageData(STORAGE_KEYS.MATERIALS, updatedMaterials)
          
          this.setData({ materials: updatedMaterials, showDetailModal: false })
          this.filterMaterials()
          this.checkLowStock(updatedMaterials)
          
          wx.showToast({ title: `已使用 ${useQuantity}${material.unit}`, icon: 'success' })
        }
      }
    })
  },

  checkLowStock(materials) {
    const lowStockCount = materials.filter(m => m.quantity <= (m.minimumStock || 5)).length
    this.setData({ lowStockCount })
  },

  deleteMaterial(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个辅料记录吗？',
      success: (res) => {
        if (res.confirm) {
          const materials = this.data.materials.filter(m => m.id !== id)
          setStorageData(STORAGE_KEYS.MATERIALS, materials)
          
          this.setData({ materials, showDetailModal: false })
          this.filterMaterials()
          this.checkLowStock(materials)
          
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

const { STORAGE_KEYS, getStorageData, setStorageData, generateId, formatPrice } = require('../../utils/storage.js')

Page({
  data: {
    fabrics: [],
    filteredFabrics: [],
    searchKeyword: '',
    showAddModal: false,
    showEditModal: false,
    showDetailModal: false,
    currentFabric: null,
    filterType: 'all',
    fabricTypes: ['全部', '纯棉', '牛仔', '丝绸', '麻', '化纤', '针织', '其他'],
    formData: {
      name: '',
      type: '纯棉',
      color: '',
      quantity: '',
      unit: '米',
      price: '',
      purchaseDate: '',
      supplier: '',
      width: '',
      thickness: '中厚',
      purpose: '',
      notes: ''
    },
    totalValue: '0.00',
    totalQuantity: 0
  },

  onLoad() {
    this.loadFabrics()
  },

  onShow() {
    this.loadFabrics()
  },

  loadFabrics() {
    const fabrics = getStorageData(STORAGE_KEYS.FABRICS)
    this.setData({ fabrics, filteredFabrics: fabrics })
    this.calculateStats(fabrics)
  },

  calculateStats(fabrics) {
    let totalValue = 0
    let totalQuantity = 0
    fabrics.forEach(f => {
      totalValue += f.totalValue || 0
      totalQuantity += f.quantity || 0
    })
    this.setData({
      totalValue: formatPrice(totalValue),
      totalQuantity: totalQuantity.toFixed(1)
    })
  },

  onSearchInput(e) {
    const keyword = e.detail.value.toLowerCase()
    this.setData({ searchKeyword: keyword })
    this.filterFabrics()
  },

  onFilterChange(e) {
    const index = e.detail.value
    const type = this.data.fabricTypes[index]
    this.setData({ filterType: type === '全部' ? 'all' : type })
    this.filterFabrics()
  },

  filterFabrics() {
    let fabrics = [...this.data.fabrics]
    const { searchKeyword, filterType } = this.data

    if (filterType !== 'all') {
      fabrics = fabrics.filter(f => f.type === filterType)
    }

    if (searchKeyword) {
      fabrics = fabrics.filter(f => 
        f.name.toLowerCase().includes(searchKeyword) ||
        f.type.toLowerCase().includes(searchKeyword) ||
        f.color.toLowerCase().includes(searchKeyword) ||
        (f.supplier && f.supplier.toLowerCase().includes(searchKeyword))
      )
    }

    this.setData({ filteredFabrics: fabrics })
    this.calculateStats(fabrics)
  },

  showAddModal() {
    this.setData({
      showAddModal: true,
      formData: {
        name: '',
        type: '纯棉',
        color: '',
        quantity: '',
        unit: '米',
        price: '',
        purchaseDate: this.formatDate(new Date()),
        supplier: '',
        width: '',
        thickness: '中厚',
        purpose: '',
        notes: ''
      }
    })
  },

  hideAddModal() {
    this.setData({ showAddModal: false })
  },

  hideEditModal() {
    this.setData({ showEditModal: false })
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
    if (field === 'type') {
      const types = ['纯棉', '牛仔', '丝绸', '麻', '化纤', '针织', '其他']
      this.setData({ [`formData.${field}`]: types[value] })
    } else if (field === 'thickness') {
      const thicknesses = ['薄', '中薄', '中厚', '厚']
      this.setData({ [`formData.${field}`]: thicknesses[value] })
    } else if (field === 'unit') {
      const units = ['米', '码', '件']
      this.setData({ [`formData.${field}`]: units[value] })
    }
  },

  onDateChange(e) {
    this.setData({
      'formData.purchaseDate': e.detail.value
    })
  },

  submitAddForm() {
    const { formData } = this.data
    
    if (!formData.name.trim()) {
      wx.showToast({ title: '请输入面料名称', icon: 'none' })
      return
    }
    if (!formData.quantity || parseFloat(formData.quantity) <= 0) {
      wx.showToast({ title: '请输入有效数量', icon: 'none' })
      return
    }
    if (!formData.price || parseFloat(formData.price) < 0) {
      wx.showToast({ title: '请输入有效单价', icon: 'none' })
      return
    }

    const quantity = parseFloat(formData.quantity)
    const price = parseFloat(formData.price)
    
    const newFabric = {
      id: generateId(),
      name: formData.name.trim(),
      type: formData.type,
      color: formData.color.trim() || '未指定',
      quantity: quantity,
      unit: formData.unit,
      price: price,
      totalValue: quantity * price,
      purchaseDate: formData.purchaseDate,
      supplier: formData.supplier.trim() || '未指定',
      width: formData.width ? parseInt(formData.width) : 0,
      thickness: formData.thickness,
      purpose: formData.purpose.trim(),
      notes: formData.notes.trim(),
      image: '',
      createTime: Date.now(),
      updateTime: Date.now()
    }

    const fabrics = [...this.data.fabrics, newFabric]
    setStorageData(STORAGE_KEYS.FABRICS, fabrics)
    
    this.setData({ fabrics, showAddModal: false })
    this.filterFabrics()
    
    wx.showToast({ title: '添加成功', icon: 'success' })
  },

  viewDetail(e) {
    const id = e.currentTarget.dataset.id
    const fabric = this.data.fabrics.find(f => f.id === id)
    if (fabric) {
      this.setData({
        currentFabric: fabric,
        showDetailModal: true
      })
    }
  },

  editFabric(e) {
    const id = e.currentTarget.dataset.id
    const fabric = this.data.fabrics.find(f => f.id === id)
    if (fabric) {
      this.setData({
        currentFabric: fabric,
        formData: {
          name: fabric.name,
          type: fabric.type,
          color: fabric.color,
          quantity: fabric.quantity.toString(),
          unit: fabric.unit,
          price: fabric.price.toString(),
          purchaseDate: fabric.purchaseDate,
          supplier: fabric.supplier,
          width: fabric.width.toString(),
          thickness: fabric.thickness,
          purpose: fabric.purpose,
          notes: fabric.notes
        },
        showEditModal: true,
        showDetailModal: false
      })
    }
  },

  submitEditForm() {
    const { formData, currentFabric, fabrics } = this.data
    
    if (!formData.name.trim()) {
      wx.showToast({ title: '请输入面料名称', icon: 'none' })
      return
    }
    if (!formData.quantity || parseFloat(formData.quantity) <= 0) {
      wx.showToast({ title: '请输入有效数量', icon: 'none' })
      return
    }
    if (!formData.price || parseFloat(formData.price) < 0) {
      wx.showToast({ title: '请输入有效单价', icon: 'none' })
      return
    }

    const quantity = parseFloat(formData.quantity)
    const price = parseFloat(formData.price)
    
    const updatedFabrics = fabrics.map(f => {
      if (f.id === currentFabric.id) {
        return {
          ...f,
          name: formData.name.trim(),
          type: formData.type,
          color: formData.color.trim() || '未指定',
          quantity: quantity,
          unit: formData.unit,
          price: price,
          totalValue: quantity * price,
          purchaseDate: formData.purchaseDate,
          supplier: formData.supplier.trim() || '未指定',
          width: formData.width ? parseInt(formData.width) : 0,
          thickness: formData.thickness,
          purpose: formData.purpose.trim(),
          notes: formData.notes.trim(),
          updateTime: Date.now()
        }
      }
      return f
    })

    setStorageData(STORAGE_KEYS.FABRICS, updatedFabrics)
    
    this.setData({ fabrics: updatedFabrics, showEditModal: false })
    this.filterFabrics()
    
    wx.showToast({ title: '修改成功', icon: 'success' })
  },

  deleteFabric(e) {
    const id = e.currentTarget.dataset.id
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个面料记录吗？',
      success: (res) => {
        if (res.confirm) {
          const fabrics = this.data.fabrics.filter(f => f.id !== id)
          setStorageData(STORAGE_KEYS.FABRICS, fabrics)
          
          this.setData({ fabrics, showDetailModal: false })
          this.filterFabrics()
          
          wx.showToast({ title: '删除成功', icon: 'success' })
        }
      }
    })
  },

  useFabric(e) {
    const id = e.currentTarget.dataset.id
    const fabric = this.data.fabrics.find(f => f.id === id)
    
    if (!fabric) return
    
    wx.showModal({
      title: '使用面料',
      content: `当前库存：${fabric.quantity}${fabric.unit}\n请输入使用数量`,
      editable: true,
      placeholderText: '请输入使用数量',
      success: (res) => {
        if (res.confirm && res.content) {
          const useQuantity = parseFloat(res.content)
          if (isNaN(useQuantity) || useQuantity <= 0) {
            wx.showToast({ title: '请输入有效数量', icon: 'none' })
            return
          }
          if (useQuantity > fabric.quantity) {
            wx.showToast({ title: '库存不足', icon: 'none' })
            return
          }

          const newQuantity = fabric.quantity - useQuantity
          const updatedFabrics = this.data.fabrics.map(f => {
            if (f.id === id) {
              return {
                ...f,
                quantity: newQuantity,
                totalValue: newQuantity * f.price,
                updateTime: Date.now()
              }
            }
            return f
          })

          setStorageData(STORAGE_KEYS.FABRICS, updatedFabrics)
          
          this.setData({ fabrics: updatedFabrics, showDetailModal: false })
          this.filterFabrics()
          
          wx.showToast({ title: `已使用 ${useQuantity}${fabric.unit}`, icon: 'success' })
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

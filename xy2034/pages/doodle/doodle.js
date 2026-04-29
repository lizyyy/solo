const util = require('../../utils/util.js')

Page({
  data: {
    canvasWidth: 0,
    canvasHeight: 0,
    isDrawing: false,
    currentColor: '#333333',
    currentSize: 6,
    colors: [
      { value: '#333333', name: '黑色' },
      { value: '#ff6b6b', name: '红色' },
      { value: '#4ecdc4', name: '青色' },
      { value: '#ffe66d', name: '黄色' },
      { value: '#6B8DD6', name: '蓝色' },
      { value: '#a55eea', name: '紫色' },
      { value: '#fd79a8', name: '粉色' },
      { value: '#00d2d3', name: '薄荷' }
    ],
    sizes: [2, 4, 6, 10, 15],
    isEraser: false,
    history: [],
    historyIndex: -1,
    showTools: true
  },

  onLoad: function (options) {
    this.initCanvas()
  },

  initCanvas: function () {
    const that = this
    wx.getSystemInfo({
      success: function (res) {
        const canvasWidth = res.windowWidth - 40
        const canvasHeight = res.windowHeight - 320
        
        that.setData({
          canvasWidth: canvasWidth,
          canvasHeight: canvasHeight
        })
        
        that.initCanvasContext()
      }
    })
  },

  initCanvasContext: function () {
    const ctx = wx.createCanvasContext('doodleCanvas', this)
    this.ctx = ctx
    this.setCanvasStyle()
    ctx.draw()
    
    this.saveHistory()
  },

  setCanvasStyle: function () {
    const ctx = this.ctx
    ctx.setStrokeStyle(this.data.isEraser ? '#f5f7fa' : this.data.currentColor)
    ctx.setLineWidth(this.data.currentSize)
    ctx.setLineCap('round')
    ctx.setLineJoin('round')
  },

  touchStart: function (e) {
    const { x, y } = e.touches[0]
    this.ctx.beginPath()
    this.ctx.moveTo(x, y)
    
    this.setData({
      isDrawing: true,
      lastX: x,
      lastY: y
    })
    
    wx.vibrateShort({ type: 'light' })
  },

  touchMove: function (e) {
    if (!this.data.isDrawing) return
    
    const { x, y } = e.touches[0]
    this.ctx.lineTo(x, y)
    this.ctx.stroke()
    this.ctx.draw(true)
    
    this.setData({
      lastX: x,
      lastY: y
    })
  },

  touchEnd: function (e) {
    if (!this.data.isDrawing) return
    
    this.setData({ isDrawing: false })
    this.saveHistory()
  },

  selectColor: function (e) {
    const color = e.currentTarget.dataset.color
    this.setData({
      currentColor: color,
      isEraser: false
    })
    this.setCanvasStyle()
  },

  selectSize: function (e) {
    const size = e.currentTarget.dataset.size
    this.setData({ currentSize: size })
    this.setCanvasStyle()
  },

  toggleEraser: function () {
    const isEraser = !this.data.isEraser
    this.setData({ isEraser: isEraser })
    this.setCanvasStyle()
  },

  clearCanvas: function () {
    wx.showModal({
      title: '提示',
      content: '确定要清空画布吗？',
      success: (res) => {
        if (res.confirm) {
          const ctx = this.ctx
          ctx.setFillStyle('#ffffff')
          ctx.fillRect(0, 0, this.data.canvasWidth, this.data.canvasHeight)
          ctx.draw()
          this.setCanvasStyle()
          this.saveHistory()
          util.showToast('已清空画布')
        }
      }
    })
  },

  saveHistory: function () {
    wx.canvasToTempFilePath({
      canvasId: 'doodleCanvas',
      success: (res) => {
        const { history, historyIndex } = this.data
        const newHistory = history.slice(0, historyIndex + 1)
        newHistory.push(res.tempFilePath)
        
        if (newHistory.length > 20) {
          newHistory.shift()
        }
        
        this.setData({
          history: newHistory,
          historyIndex: newHistory.length - 1
        })
      },
      fail: (err) => {
        console.log('保存历史记录失败', err)
      }
    }, this)
  },

  undo: function () {
    const { history, historyIndex } = this.data
    
    if (historyIndex <= 0) {
      util.showToast('没有可撤销的操作')
      return
    }
    
    const newIndex = historyIndex - 1
    const tempFilePath = history[newIndex]
    
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.data.canvasWidth, this.data.canvasHeight)
    
    ctx.drawImage(tempFilePath, 0, 0, this.data.canvasWidth, this.data.canvasHeight)
    ctx.draw()
    
    this.setData({ historyIndex: newIndex })
    this.setCanvasStyle()
  },

  saveDoodle: function () {
    wx.showModal({
      title: '保存涂鸦',
      content: '是否保存当前涂鸦到相册？',
      success: (res) => {
        if (res.confirm) {
          this.saveToAlbum()
        }
      }
    })
  },

  saveToAlbum: function () {
    util.showLoading('保存中...')
    
    wx.canvasToTempFilePath({
      canvasId: 'doodleCanvas',
      success: (res) => {
        wx.saveImageToPhotosAlbum({
          filePath: res.tempFilePath,
          success: () => {
            util.hideLoading()
            util.showToast('保存成功', 'success')
          },
          fail: (err) => {
            util.hideLoading()
            if (err.errMsg.includes('auth deny')) {
              wx.showModal({
                title: '提示',
                content: '需要授权保存到相册',
                success: (modalRes) => {
                  if (modalRes.confirm) {
                    wx.openSetting()
                  }
                }
              })
            } else {
              util.showToast('保存失败')
            }
          }
        })
      },
      fail: (err) => {
        util.hideLoading()
        console.log('保存失败', err)
        util.showToast('保存失败')
      }
    }, this)
  },

  toggleTools: function () {
    this.setData({
      showTools: !this.data.showTools
    })
  }
})

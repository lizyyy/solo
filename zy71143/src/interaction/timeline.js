import * as THREE from 'three'

export class TimelineController {
  constructor(app) {
    this.app = app
    this.viewpoints = []
    this.currentIndex = 0
    this.isPlaying = false
    this.playInterval = null
    this.playSpeed = 1500
    
    this.setupEventListeners()
  }

  setupViewpoints(viewpointsGroup) {
    this.viewpoints = []
    viewpointsGroup.children.forEach((vpGroup, index) => {
      const head = vpGroup.children.find(c => c.geometry?.type === 'SphereGeometry')
      if (head) {
        this.viewpoints.push({
          group: vpGroup,
          position: head.position.clone(),
          data: vpGroup.userData.viewpointData,
          index
        })
      }
    })
    
    this.updateTimelineSlider()
    this.updateTimelineInfo()
  }

  setupEventListeners() {
    const slider = document.getElementById('timelineSlider')
    const btnPlay = document.getElementById('btnPlay')
    const btnPause = document.getElementById('btnPause')
    const btnStep = document.getElementById('btnStep')

    slider?.addEventListener('input', (e) => {
      const value = parseInt(e.target.value)
      this.setTimelinePosition(value)
    })

    btnPlay?.addEventListener('click', () => this.play())
    btnPause?.addEventListener('click', () => this.pause())
    btnStep?.addEventListener('click', () => this.step())
  }

  setTimelinePosition(percent) {
    if (this.viewpoints.length === 0) return
    
    const totalSteps = this.viewpoints.length - 1
    const index = Math.round((percent / 100) * totalSteps)
    this.goToViewpoint(Math.min(index, this.viewpoints.length - 1))
  }

  goToViewpoint(index) {
    if (index < 0 || index >= this.viewpoints.length) return
    
    this.currentIndex = index
    const vp = this.viewpoints[index]
    
    this.highlightViewpoint(vp)
    this.updateTimelineSlider()
    this.updateTimelineInfo()
    
    const analysis = this.app.sightlineAnalyzer.getAnalysisResults()
    const vpAnalysis = analysis.find(a => a.viewpointIndex === index)
    this.app.uiController.updateViewpointInfo(vp, vpAnalysis)
  }

  highlightViewpoint(vp) {
    this.viewpoints.forEach(v => {
      v.group.traverse(obj => {
        if (obj.isMesh && obj.material?.emissive) {
          obj.material.emissiveIntensity = 0
        }
      })
    })
    
    vp.group.traverse(obj => {
      if (obj.isMesh && obj.material) {
        if (obj.material.emissive !== undefined) {
          obj.material.emissive = new THREE.Color(0xe94560)
          obj.material.emissiveIntensity = 0.5
        }
      }
    })
  }

  updateTimelineSlider() {
    const slider = document.getElementById('timelineSlider')
    if (slider && this.viewpoints.length > 1) {
      const percent = (this.currentIndex / (this.viewpoints.length - 1)) * 100
      slider.value = percent
    }
  }

  updateTimelineInfo() {
    const posEl = document.getElementById('currentPosition')
    const vpEl = document.getElementById('currentViewpoint')
    
    if (posEl) {
      const percent = this.viewpoints.length > 1 
        ? Math.round((this.currentIndex / (this.viewpoints.length - 1)) * 100)
        : 0
      posEl.textContent = percent
    }
    
    if (vpEl && this.viewpoints[this.currentIndex]) {
      vpEl.textContent = this.viewpoints[this.currentIndex].data.name
    }
  }

  play() {
    if (this.isPlaying) return
    if (this.currentIndex >= this.viewpoints.length - 1) {
      this.currentIndex = 0
    }
    
    this.isPlaying = true
    this.playInterval = setInterval(() => {
      if (this.currentIndex < this.viewpoints.length - 1) {
        this.step()
      } else {
        this.pause()
      }
    }, this.playSpeed)
  }

  pause() {
    this.isPlaying = false
    if (this.playInterval) {
      clearInterval(this.playInterval)
      this.playInterval = null
    }
  }

  step() {
    if (this.currentIndex < this.viewpoints.length - 1) {
      this.goToViewpoint(this.currentIndex + 1)
    }
  }

  reset() {
    this.pause()
    this.currentIndex = 0
    this.goToViewpoint(0)
  }

  getCurrentViewpoint() {
    return this.viewpoints[this.currentIndex]
  }
}

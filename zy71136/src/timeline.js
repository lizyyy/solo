export class TimelineController {
  constructor(app) {
    this.app = app
    this.speeds = [1, 2, 4, 0.5]
    this.currentSpeedIndex = 0
    
    this.setupEventListeners()
  }
  
  setup(data) {
    this.data = data
    this.renderFlightsTimeline()
  }
  
  setupEventListeners() {
    document.getElementById('play-btn').addEventListener('click', () => {
      this.app.isPlaying = true
    })
    
    document.getElementById('pause-btn').addEventListener('click', () => {
      this.app.isPlaying = false
    })
    
    document.getElementById('speed-btn').addEventListener('click', () => {
      this.currentSpeedIndex = (this.currentSpeedIndex + 1) % this.speeds.length
      this.app.playbackSpeed = this.speeds[this.currentSpeedIndex]
      document.getElementById('speed-btn').textContent = this.app.playbackSpeed + 'x'
    })
    
    document.getElementById('timeline-slider').addEventListener('input', (e) => {
      if (this.data) {
        const percentage = e.target.value
        this.app.currentTime = (percentage / 100) * this.data.duration
        this.updateTimeDisplay(this.app.currentTime)
        this.app.vehicleManager.updateVehicles(this.app.currentTime)
        this.app.conflictDetector.update(this.app.currentTime, this.app.getVisibleVehicleNames())
      }
    })
  }
  
  renderFlightsTimeline() {
    const container = document.getElementById('flights-timeline')
    container.innerHTML = ''
    
    if (!this.data || !this.data.flights) return
    
    const totalDuration = this.data.duration
    const containerWidth = container.clientWidth
    
    this.data.flights.forEach(flight => {
      const startX = (flight.schedule.arrival / totalDuration) * containerWidth
      const width = ((flight.schedule.departure - flight.schedule.arrival) / totalDuration) * containerWidth
      
      const flightBar = document.createElement('div')
      flightBar.className = 'flight-bar'
      flightBar.style.left = startX + 'px'
      flightBar.style.width = Math.max(width, 40) + 'px'
      flightBar.textContent = flight.id
      flightBar.title = `${flight.id} - ${flight.airline}`
      
      flightBar.addEventListener('click', () => {
        this.app.currentTime = flight.schedule.arrival
        this.updateSlider(flight.schedule.arrival / totalDuration * 100)
        this.updateTimeDisplay(flight.schedule.arrival)
        this.app.vehicleManager.updateVehicles(flight.schedule.arrival)
        this.app.conflictDetector.update(flight.schedule.arrival, this.app.getVisibleVehicleNames())
      })
      
      container.appendChild(flightBar)
    })
  }
  
  updateSlider(percentage) {
    document.getElementById('timeline-slider').value = percentage
  }
  
  updateTimeDisplay(time) {
    const mins = Math.floor(time)
    const secs = Math.floor((time - mins) * 60)
    document.getElementById('current-time').textContent = 
      `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
}

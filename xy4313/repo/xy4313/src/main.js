import { DataParser } from './parser.js';
import { TrajectoryCalculator } from './trajectory.js';
import { RuleEngine } from './rules.js';
import { SceneRenderer } from './renderer.js';
import { TimelineController } from './timeline.js';
import { StateStorage } from './storage.js';
import { Exporter } from './exporter.js';
import { loadAllSampleData } from './sample-data.js';

class ForkliftBlindSpotApp {
  constructor() {
    this.parser = new DataParser();
    this.calculator = new TrajectoryCalculator();
    this.ruleEngine = new RuleEngine();
    this.renderer = null;
    this.timeline = new TimelineController();
    this.storage = new StateStorage();
    this.exporter = new Exporter();

    this.selectedEvent = null;
    this.events = [];

    this.init();
  }

  init() {
    const canvas = document.getElementById('three-canvas');
    if (canvas) {
      this.renderer = new SceneRenderer(canvas);
      this.renderer.startAnimation();
    }

    this.setupEventListeners();
    this.loadStoredSession();
  }

  setupEventListeners() {
    document.querySelectorAll('.sidebar-tab').forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });

    document.getElementById('shelves-file')?.addEventListener('change', (e) => 
      this.handleFileUpload(e, 'shelves'));
    document.getElementById('forklift-file')?.addEventListener('change', (e) => 
      this.handleFileUpload(e, 'forklift'));
    document.getElementById('near-miss-file')?.addEventListener('change', (e) => 
      this.handleFileUpload(e, 'nearMiss'));
    document.getElementById('camera-file')?.addEventListener('change', (e) => 
      this.handleFileUpload(e, 'camera'));

    document.getElementById('load-sample-btn')?.addEventListener('click', () => 
      this.loadSampleData());

    document.getElementById('play-btn')?.addEventListener('click', () => 
      this.togglePlayback());

    document.getElementById('speed-select')?.addEventListener('change', (e) => {
      this.timeline.setPlaybackSpeed(parseFloat(e.target.value));
    });

    document.getElementById('timeline-bar')?.addEventListener('click', (e) => 
      this.handleTimelineClick(e));

    document.getElementById('timeline-bar')?.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.handleTimelineClick(e);
    });

    document.addEventListener('mousemove', (e) => {
      if (this.isDragging) {
        this.handleTimelineClick(e);
      }
    });

    document.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    document.getElementById('export-md-btn')?.addEventListener('click', () => 
      this.exportMarkdown());
    document.getElementById('export-csv-btn')?.addEventListener('click', () => 
      this.exportCSV());
    document.getElementById('export-json-btn')?.addEventListener('click', () => 
      this.exportJSON());

    document.getElementById('close-modal-btn')?.addEventListener('click', () => 
      this.closeModal());
    document.getElementById('evidence-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'evidence-modal') this.closeModal();
    });

    this.timeline.onTimeUpdate = (timestamp, progress) => 
      this.handleTimeUpdate(timestamp, progress);
    this.timeline.onPlayStateChange = (isPlaying) => 
      this.updatePlayButton(isPlaying);
  }

  switchTab(tabName) {
    document.querySelectorAll('.sidebar-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    document.querySelectorAll('.sidebar-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === `${tabName}-panel`);
    });
  }

  async handleFileUpload(event, type) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      
      switch (type) {
        case 'shelves':
          this.parser.parseShelves(text);
          this.storage.updateData('shelves', this.parser.parsedData.shelves);
          this.updateFileStatus('shelves', `已加载: ${file.name}`);
          break;
        case 'forklift':
          this.parser.parseForkliftTrajectory(text);
          this.storage.updateData('forkliftTrajectory', this.parser.parsedData.forkliftTrajectory);
          this.updateFileStatus('forklift', `已加载: ${file.name}`);
          break;
        case 'nearMiss':
          this.parser.parseNearMissEvents(text);
          this.storage.updateData('nearMissEvents', this.parser.parsedData.nearMissEvents);
          this.updateFileStatus('near-miss', `已加载: ${file.name}`);
          break;
        case 'camera':
          this.parser.parseCameraAnnotations(text);
          this.storage.updateData('cameraAnnotations', this.parser.parsedData.cameraAnnotations);
          this.updateFileStatus('camera', `已加载: ${file.name}`);
          break;
      }

      this.processData();
    } catch (error) {
      console.error('文件解析失败:', error);
      alert(`文件解析失败: ${error.message}`);
    }
  }

  updateFileStatus(type, message) {
    const statusEl = document.getElementById(`${type}-status`);
    if (statusEl) {
      statusEl.textContent = message;
      statusEl.style.color = '#4ade80';
    }
  }

  loadSampleData() {
    const sampleData = loadAllSampleData();

    try {
      this.parser.parseShelves(sampleData.shelves);
      this.parser.parseForkliftTrajectory(sampleData.forkliftCSV);
      this.parser.parseNearMissEvents(sampleData.nearMissEvents);
      this.parser.parseCameraAnnotations(sampleData.cameraAnnotations);

      this.storage.createSession({
        name: '示例数据复盘',
        shelves: this.parser.parsedData.shelves,
        forkliftTrajectory: this.parser.parsedData.forkliftTrajectory,
        nearMissEvents: this.parser.parsedData.nearMissEvents,
        cameraAnnotations: this.parser.parsedData.cameraAnnotations
      });

      this.updateFileStatus('shelves', '已加载示例货架数据');
      this.updateFileStatus('forklift', '已加载示例轨迹数据');
      this.updateFileStatus('near-miss', '已加载示例事件数据');
      this.updateFileStatus('camera', '已加载示例摄像头数据');

      this.processData();
    } catch (error) {
      console.error('加载示例数据失败:', error);
      alert(`加载示例数据失败: ${error.message}`);
    }
  }

  processData() {
    if (!this.parser.isComplete()) {
      return;
    }

    const data = this.parser.getAllData();

    if (data.forkliftTrajectory) {
      this.calculator.loadTrajectory(data.forkliftTrajectory);

      const timeRange = this.calculator.getTimeRange();
      this.timeline.setTimeRange(timeRange.start, timeRange.end);

      if (this.renderer) {
        this.renderer.createTrajectoryLine(data.forkliftTrajectory);
      }
    }

    if (data.shelves && this.renderer) {
      this.renderer.loadShelves(data.shelves);
    }

    if (data.cameraAnnotations && this.renderer) {
      this.renderer.createCameraMarkers(data.cameraAnnotations);
    }

    const detectedEvents = this.ruleEngine.runAllChecks(
      data.forkliftTrajectory,
      data.shelves,
      data.nearMissEvents?.events || []
    );

    this.events = detectedEvents;
    this.storage.setDetectedEvents(detectedEvents);

    if (this.renderer) {
      this.renderer.createEventMarkers(detectedEvents);
    }

    this.updateEventList();
    this.updateStatistics();
    this.createEventMarkersOnTimeline();
    this.updateTimeDisplay();

    this.switchTab('events');
  }

  updateEventList() {
    const eventsEmpty = document.getElementById('events-empty');
    const eventsList = document.getElementById('events-list');
    const statsEmpty = document.getElementById('stats-empty');
    const statsContent = document.getElementById('stats-content');

    if (this.events.length === 0) {
      if (eventsEmpty) eventsEmpty.classList.remove('hidden');
      if (eventsList) eventsList.innerHTML = '';
      return;
    }

    if (eventsEmpty) eventsEmpty.classList.add('hidden');
    if (statsEmpty) statsEmpty.classList.add('hidden');
    if (statsContent) statsContent.classList.remove('hidden');

    const html = this.events.map((event, index) => this.createEventItem(event, index)).join('');
    
    if (eventsList) {
      eventsList.innerHTML = html;
      
      eventsList.querySelectorAll('.event-item').forEach(item => {
        item.addEventListener('click', () => {
          const eventIndex = parseInt(item.dataset.index);
          this.selectEvent(eventIndex);
        });
      });
    }
  }

  createEventItem(event, index) {
    const typeClass = event.type.replace('-', '_');
    const typeLabels = {
      'blind-spot': '盲区交汇',
      'overspeed': '超速',
      'no-entry': '禁行区穿越',
      'near-miss': '近失事件'
    };
    
    const subTypeLabel = event.subType ? 
      (event.subType === 'turning' ? '转弯时' : 
       event.subType === 'reverse' ? '倒车时' : 
       event.subType === 'temporary-obstacle' ? '临时障碍物' : '') : '';

    const severityColors = {
      'high': '#ef4444',
      'medium': '#f59e0b',
      'low': '#4ade80'
    };

    const reviewLabels = {
      'unreviewed': '待复核',
      'reviewed': '已复核',
      'confirmed': '已确认风险',
      'dismissed': '已驳回'
    };

    return `
      <div class="event-item" data-index="${index}">
        <div class="event-type ${typeClass}">
          ${typeLabels[event.type] || event.type}
          ${subTypeLabel ? `(${subTypeLabel})` : ''}
          <span style="float:right;color:${severityColors[event.severity] || '#888'}">
            ${event.severity === 'high' ? '高' : event.severity === 'medium' ? '中' : '低'}
          </span>
        </div>
        <div class="event-time">
          ${this.formatTime(event.timestamp)} | 
          ${reviewLabels[event.reviewStatus] || '待复核'}
        </div>
        ${this.selectedEvent === index ? `
          <div class="event-details">
            <dl>
              <dt>描述</dt>
              <dd>${event.description || '无详细描述'}</dd>
              ${event.maxSpeed ? `<dt>最大速度</dt><dd>${event.maxSpeed.toFixed(2)} km/h</dd>` : ''}
              ${event.duration ? `<dt>持续时间</dt><dd>${event.duration.toFixed(1)} 秒</dd>` : ''}
              ${event.shelfName ? `<dt>涉及货架</dt><dd>${event.shelfName}</dd>` : ''}
            </dl>
            <div class="review-section">
              <h4>复核意见</h4>
              <textarea class="review-textarea" placeholder="输入复核意见..." 
                data-event-id="${event.id}">${event.reviewNotes || ''}</textarea>
              <div class="review-status">
                <button class="status-btn ${event.reviewStatus === 'confirmed' ? 'selected' : ''}" 
                  data-status="confirmed" data-event-id="${event.id}">确认风险</button>
                <button class="status-btn ${event.reviewStatus === 'dismissed' ? 'selected' : ''}" 
                  data-status="dismissed" data-event-id="${event.id}">驳回</button>
                <button class="status-btn ${event.reviewStatus === 'reviewed' ? 'selected' : ''}" 
                  data-status="reviewed" data-event-id="${event.id}">标记已读</button>
              </div>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  selectEvent(index) {
    this.selectedEvent = this.selectedEvent === index ? null : index;
    
    if (this.selectedEvent !== null) {
      const event = this.events[index];
      this.timeline.goToEvent(event);
      
      if (this.renderer) {
        this.renderer.highlightEvent(index);
        this.renderer.focusOnEvent(event);
      }

      this.showEventDetails(event);
    }

    this.updateEventList();

    setTimeout(() => {
      document.querySelectorAll('.review-status .status-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const eventId = btn.dataset.eventId;
          const status = btn.dataset.status;
          this.updateEventReviewStatus(eventId, status);
        });
      });

      document.querySelectorAll('.review-textarea').forEach(textarea => {
        textarea.addEventListener('change', (e) => {
          e.stopPropagation();
          const eventId = textarea.dataset.eventId;
          const notes = textarea.value;
          this.updateEventReviewNotes(eventId, notes);
        });
      });
    }, 100);
  }

  updateEventReviewStatus(eventId, status) {
    this.storage.updateEventReview(eventId, {
      reviewStatus: status
    });
    
    const event = this.events.find(e => e.id === eventId);
    if (event) {
      event.reviewStatus = status;
    }
    
    this.updateEventList();
    this.updateStatistics();
  }

  updateEventReviewNotes(eventId, notes) {
    this.storage.updateEventReview(eventId, {
      reviewNotes: notes
    });
    
    const event = this.events.find(e => e.id === eventId);
    if (event) {
      event.reviewNotes = notes;
    }
  }

  showEventDetails(event) {
    const modal = document.getElementById('evidence-modal');
    const content = document.getElementById('evidence-content');

    if (!modal || !content) return;

    const typeLabels = {
      'blind-spot': '盲区交汇',
      'overspeed': '超速',
      'no-entry': '禁行区穿越',
      'near-miss': '近失事件'
    };

    const severityLabels = {
      'high': '高风险',
      'medium': '中风险',
      'low': '低风险'
    };

    let html = `
      <div style="margin-bottom:15px;">
        <strong>类型:</strong> ${typeLabels[event.type] || event.type}<br>
        <strong>严重程度:</strong> ${severityLabels[event.severity] || event.severity}<br>
        <strong>发生时间:</strong> ${this.formatTime(event.timestamp)}<br>
        <strong>位置:</strong> (${event.location?.x?.toFixed(2) || 'N/A'}, ${event.location?.z?.toFixed(2) || 'N/A'})
      </div>
      <div style="margin-bottom:15px;">
        <strong>描述:</strong><br>
        <p style="margin-top:8px;color:#ccd6f6;">${event.description || '无详细描述'}</p>
      </div>
    `;

    if (event.maxSpeed !== undefined) {
      html += `<div style="margin-bottom:10px;"><strong>最大速度:</strong> ${event.maxSpeed.toFixed(2)} km/h</div>`;
    }
    if (event.duration !== undefined) {
      html += `<div style="margin-bottom:10px;"><strong>持续时间:</strong> ${event.duration.toFixed(1)} 秒</div>`;
    }

    if (event.evidence && event.evidence.cameraFeeds && event.evidence.cameraFeeds.length > 0) {
      html += `
        <div style="margin-top:20px;">
          <strong>关联摄像头证据:</strong>
          <div class="evidence-images">
            ${event.evidence.cameraFeeds.map(feed => `
              <div class="evidence-img">
                📹 ${feed.cameraId || '摄像头'}<br>
                <small>${feed.description || '视频片段'}</small>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    if (event.involvedEntities && event.involvedEntities.length > 0) {
      html += `
        <div style="margin-top:20px;">
          <strong>涉及实体:</strong>
          <ul style="margin-top:10px;padding-left:20px;">
            ${event.involvedEntities.map(entity => `
              <li style="margin-bottom:5px;">
                ${entity.type}: ${entity.name || entity.id}
              </li>
            `).join('')}
          </ul>
        </div>
      `;
    }

    content.innerHTML = html;
    modal.classList.add('active');
  }

  closeModal() {
    const modal = document.getElementById('evidence-modal');
    if (modal) {
      modal.classList.remove('active');
    }
  }

  updateStatistics() {
    const stats = this.storage.getStatistics();
    if (!stats) return;

    const statTotal = document.getElementById('stat-total');
    const statBlindSpot = document.getElementById('stat-blind-spot');
    const statOverspeed = document.getElementById('stat-overspeed');
    const statNoEntry = document.getElementById('stat-no-entry');

    if (statTotal) statTotal.textContent = stats.total || 0;
    if (statBlindSpot) statBlindSpot.textContent = stats.byType?.['blind-spot'] || 0;
    if (statOverspeed) statOverspeed.textContent = stats.byType?.['overspeed'] || 0;
    if (statNoEntry) statNoEntry.textContent = stats.byType?.['no-entry'] || 0;
  }

  createEventMarkersOnTimeline() {
    const timelineBar = document.getElementById('timeline-bar');
    if (!timelineBar) return;

    timelineBar.querySelectorAll('.event-marker').forEach(m => m.remove());

    const timeRange = this.calculator.getTimeRange();
    if (timeRange.duration <= 0) return;

    this.events.forEach((event, index) => {
      const marker = document.createElement('div');
      marker.className = `event-marker ${event.type.replace('-', '_')}`;
      
      const position = ((event.timestamp - timeRange.start) / timeRange.duration) * 100;
      marker.style.left = `${position}%`;
      marker.title = `${event.description || event.type}`;
      
      marker.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectEvent(index);
      });
      
      timelineBar.appendChild(marker);
    });
  }

  handleTimelineClick(event) {
    const timelineBar = document.getElementById('timeline-bar');
    if (!timelineBar) return;

    const rect = timelineBar.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const progress = Math.max(0, Math.min(1, x / rect.width));
    
    this.timeline.setProgress(progress);
  }

  handleTimeUpdate(timestamp, progress) {
    const point = this.calculator.interpolateAtTimestamp(timestamp);
    
    if (point && this.renderer) {
      const rotationY = (point.direction ?? point.directionAngle ?? 0) * (Math.PI / 180);
      this.renderer.updateForkliftPosition(point.position, rotationY, point.isReversing);
      this.updateForkliftInfo(point);
    }

    this.updateTimelineUI(progress, timestamp);
  }

  updateTimelineUI(progress, timestamp) {
    const cursor = document.getElementById('timeline-cursor');
    const progressBar = document.getElementById('timeline-progress');

    if (cursor) {
      cursor.style.left = `${progress * 100}%`;
    }
    if (progressBar) {
      progressBar.style.width = `${progress * 100}%`;
    }

    const currentTimeEl = document.getElementById('current-time');
    if (currentTimeEl) {
      currentTimeEl.textContent = this.timeline.formatTimestamp(timestamp);
    }
  }

  updateForkliftInfo(point) {
    const infoForkliftId = document.getElementById('info-forklift-id');
    const infoSpeed = document.getElementById('info-speed');
    const infoDirection = document.getElementById('info-direction');
    const infoBlindSpot = document.getElementById('info-blind-spot');

    if (infoForkliftId) infoForkliftId.textContent = point.forkliftId || 'N/A';
    if (infoSpeed) infoSpeed.textContent = `${(point.speed ?? 0).toFixed(2)} km/h`;
    if (infoDirection) infoDirection.textContent = point.isReversing ? '倒车' : '前进';

    const data = this.storage.getData();
    if (data && data.shelves) {
      const blindSpots = this.calculator.getBlindSpotProximity(
        data.shelves,
        point.position,
        10
      );
      if (infoBlindSpot) {
        if (blindSpots.length > 0) {
          const closest = blindSpots.reduce((a, b) => a.distance < b.distance ? a : b);
          infoBlindSpot.textContent = `${closest.distance.toFixed(2)}m (${closest.shelf.name})`;
          infoBlindSpot.style.color = closest.distance < 3 ? '#ef4444' : '#f59e0b';
        } else {
          infoBlindSpot.textContent = '无临近盲区';
          infoBlindSpot.style.color = '#4ade80';
        }
      }
    }
  }

  updateTimeDisplay() {
    const totalTimeEl = document.getElementById('total-time');
    const timeRange = this.calculator.getTimeRange();
    
    if (totalTimeEl) {
      totalTimeEl.textContent = this.timeline.formatTimestamp(timeRange.end);
    }
  }

  togglePlayback() {
    this.timeline.toggle();
  }

  updatePlayButton(isPlaying) {
    const playBtn = document.getElementById('play-btn');
    if (playBtn) {
      playBtn.textContent = isPlaying ? '⏸' : '▶';
    }
  }

  exportMarkdown() {
    const session = this.storage.getCurrentSession();
    if (!session) {
      alert('请先加载数据');
      return;
    }
    this.exporter.downloadMarkdown(session);
  }

  exportCSV() {
    const session = this.storage.getCurrentSession();
    if (!session) {
      alert('请先加载数据');
      return;
    }
    this.exporter.downloadCSV(session);
  }

  exportJSON() {
    const session = this.storage.getCurrentSession();
    if (!session) {
      alert('请先加载数据');
      return;
    }
    this.exporter.downloadJSON(session);
  }

  loadStoredSession() {
    const session = this.storage.loadSession();
    if (!session) return;

    if (session.data.shelves) {
      this.parser.parsedData.shelves = session.data.shelves;
    }
    if (session.data.forkliftTrajectory) {
      this.parser.parsedData.forkliftTrajectory = session.data.forkliftTrajectory;
    }
    if (session.data.nearMissEvents) {
      this.parser.parsedData.nearMissEvents = session.data.nearMissEvents;
    }
    if (session.data.cameraAnnotations) {
      this.parser.parsedData.cameraAnnotations = session.data.cameraAnnotations;
    }

    if (session.derived.detectedEvents) {
      this.events = session.derived.detectedEvents;
    }

    if (this.parser.isComplete()) {
      this.processData();
    }
  }

  formatTime(timestamp) {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.forkliftApp = new ForkliftBlindSpotApp();
});

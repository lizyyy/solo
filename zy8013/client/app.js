const EVENT_TYPES = {
  CARD_CREATED: 'card_created',
  CARD_MOVED: 'card_moved',
  CARD_UPDATED: 'card_updated',
  CARD_DELETED: 'card_deleted',
  SYNC_REQUEST: 'sync_request',
  SYNC_RESPONSE: 'sync_response',
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  ROOM_JOINED: 'room_joined'
};

const CARD_STATUSES = {
  TODO: 'todo',
  IN_PROGRESS: 'in_progress',
  REVIEW: 'review',
  DONE: 'done'
};

const STATUS_LABELS = {
  [CARD_STATUSES.TODO]: '待办',
  [CARD_STATUSES.IN_PROGRESS]: '进行中',
  [CARD_STATUSES.REVIEW]: '审核中',
  [CARD_STATUSES.DONE]: '已完成'
};

class SchedulingWallClient {
  constructor() {
    this.ws = null;
    this.clientId = null;
    this.currentRoomId = null;
    this.cards = new Map();
    this.eventLog = [];
    this.members = [];
    this.selectedScriptId = null;
    this.editingCardId = null;
    this.draggedCardId = null;
    this.activeReplayId = null;

    this.initEventListeners();
    this.connect();
  }

  initEventListeners() {
    document.getElementById('joinRoomBtn').addEventListener('click', () => this.joinRoom());
    document.getElementById('createRoomBtn').addEventListener('click', () => this.createRoom());
    document.getElementById('leaveRoomBtn').addEventListener('click', () => this.leaveRoom());
    document.getElementById('resetRoomBtn').addEventListener('click', () => this.resetRoom());
    document.getElementById('refreshRoomsBtn').addEventListener('click', () => this.requestRooms());

    document.getElementById('addCardBtn').addEventListener('click', () => this.addCard());
    document.getElementById('newCardTitle').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.addCard();
    });

    document.getElementById('syncNowBtn').addEventListener('click', () => this.requestSync());
    document.getElementById('showDiffBtn').addEventListener('click', () => this.requestDiff());
    document.getElementById('startReplayBtn').addEventListener('click', () => this.startReplay());
    document.getElementById('stopReplayBtn').addEventListener('click', () => this.stopReplay());

    document.getElementById('toggleEventLog').addEventListener('click', () => this.toggleEventLog());
    document.getElementById('closeEventLog').addEventListener('click', () => this.closeEventLog());

    const modal = document.getElementById('cardEditModal');
    document.querySelector('.modal-close').addEventListener('click', () => this.closeCardEditModal());
    document.getElementById('cancelEditCard').addEventListener('click', () => this.closeCardEditModal());
    document.getElementById('saveEditCard').addEventListener('click', () => this.saveCardEdit());
    document.getElementById('deleteCardBtn').addEventListener('click', () => this.deleteCard());

    modal.addEventListener('click', (e) => {
      if (e.target === modal) this.closeCardEditModal();
    });

    this.setupDragAndDrop();
  }

  setupDragAndDrop() {
    const columns = document.querySelectorAll('.cards-container');
    
    columns.forEach(column => {
      column.addEventListener('dragover', (e) => {
        e.preventDefault();
        column.classList.add('drag-over');
      });

      column.addEventListener('dragleave', () => {
        column.classList.remove('drag-over');
      });

      column.addEventListener('drop', (e) => {
        e.preventDefault();
        column.classList.remove('drag-over');
        
        const status = column.closest('.column').dataset.status;
        if (this.draggedCardId && status) {
          this.moveCard(this.draggedCardId, status);
        }
        this.draggedCardId = null;
      });
    });
  }

  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    this.updateConnectionStatus('connecting');
    
    try {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.updateConnectionStatus('connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (e) {
          console.error('Failed to parse message:', e);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.updateConnectionStatus('disconnected');
        setTimeout(() => this.reconnect(), 3000);
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.updateConnectionStatus('disconnected');
      };
    } catch (e) {
      console.error('Failed to create WebSocket:', e);
      this.updateConnectionStatus('disconnected');
    }
  }

  reconnect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;
    console.log('Attempting to reconnect...');
    this.connect();
  }

  updateConnectionStatus(status) {
    const statusEl = document.getElementById('connectionStatus');
    statusEl.className = `status-${status}`;
    
    const statusTexts = {
      connected: '已连接',
      disconnected: '未连接',
      connecting: '连接中...'
    };
    statusEl.textContent = statusTexts[status] || status;
  }

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      this.showNotification('未连接到服务器', 'error');
    }
  }

  handleMessage(message) {
    console.log('Received:', message);
    
    switch (message.type) {
      case 'connected':
        this.clientId = message.clientId;
        document.getElementById('clientIdDisplay').textContent = `Client: ${this.clientId.substring(0, 8)}`;
        this.requestRooms();
        this.requestScripts();
        break;

      case EVENT_TYPES.ROOM_JOINED:
        this.handleRoomJoined(message);
        break;

      case 'room_left':
        this.handleRoomLeft();
        break;

      case 'member_joined':
      case 'member_left':
        this.members = message.members || [];
        this.renderMembers();
        break;

      case 'event_applied':
        this.handleEventApplied(message);
        break;

      case 'event_ack':
        this.handleEventAck(message);
        break;

      case EVENT_TYPES.SYNC_RESPONSE:
        this.handleSyncResponse(message);
        break;

      case 'rooms_list':
        this.renderRooms(message.rooms);
        break;

      case 'scripts_list':
        this.renderScripts(message.scripts);
        break;

      case 'replay_started':
        this.activeReplayId = message.replayId;
        this.showNotification(`回放开始: ${message.script}`, 'success');
        document.getElementById('stopReplayBtn').disabled = false;
        document.getElementById('startReplayBtn').disabled = true;
        break;

      case 'replay_result':
        if (!message.success) {
          this.showNotification(`回放失败: ${message.error}`, 'error');
        } else {
          this.showNotification('回放完成', 'success');
          this.activeReplayId = null;
          document.getElementById('stopReplayBtn').disabled = true;
          document.getElementById('startReplayBtn').disabled = !this.selectedScriptId;
        }
        break;

      case 'replay_stopped':
        this.activeReplayId = null;
        this.showNotification('回放已停止', 'info');
        document.getElementById('stopReplayBtn').disabled = true;
        document.getElementById('startReplayBtn').disabled = !this.selectedScriptId;
        break;

      case 'room_reset':
        this.cards.clear();
        this.eventLog = [];
        this.renderCards();
        this.renderEventLog();
        this.updateRoomStats();
        this.showNotification('房间已重置', 'info');
        break;

      case 'state_update':
        this.updateStateFromCards(message.cards);
        break;

      case 'diff_result':
        this.renderDiff(message.diff);
        break;

      case 'error':
        this.showNotification(message.message || '发生错误', 'error');
        break;
    }
  }

  handleRoomJoined(message) {
    this.currentRoomId = message.roomId;
    this.cards.clear();
    
    if (message.cards) {
      message.cards.forEach(card => {
        this.cards.set(card.id, card);
      });
    }
    
    if (message.events) {
      this.eventLog = message.events;
    }
    
    this.members = message.room?.members || [];

    document.getElementById('roomName').textContent = message.room?.name || message.roomId;
    document.getElementById('roomIdInput').value = message.roomId;
    
    this.enableRoomControls(true);
    this.renderCards();
    this.renderEventLog();
    this.renderMembers();
    this.updateRoomStats();

    this.showNotification(`已加入房间: ${message.room?.name || message.roomId}`, 'success');
  }

  handleRoomLeft() {
    this.currentRoomId = null;
    this.cards.clear();
    this.eventLog = [];
    this.members = [];

    document.getElementById('roomName').textContent = '未加入房间';
    this.enableRoomControls(false);
    this.renderCards();
    this.renderEventLog();
    this.renderMembers();
    this.updateRoomStats();

    this.showNotification('已离开房间', 'info');
  }

  handleEventApplied(message) {
    const { event, result } = message;
    
    this.eventLog.push(event);
    this.renderEventLog();

    if (result.isDuplicate) {
      console.log('Duplicate event ignored:', event.id);
      return;
    }

    this.applyEventToState(event);
    this.renderCards();
    this.updateRoomStats();

    this.sendClientState();
  }

  handleEventAck(message) {
    if (message.isDuplicate) {
      console.log('Event was duplicate:', message.eventId);
      this.showNotification('检测到重复事件，已忽略', 'warning');
    } else if (!message.success) {
      this.showNotification(`事件失败: ${message.error}`, 'error');
    }
  }

  handleSyncResponse(message) {
    this.cards.clear();
    message.cards.forEach(card => {
      this.cards.set(card.id, card);
    });
    
    if (message.missedEvents && message.missedEvents.length > 0) {
      this.eventLog = [...this.eventLog, ...message.missedEvents];
      this.showNotification(`同步完成，补发 ${message.missedEvents.length} 个事件`, 'success');
    } else {
      this.showNotification('同步完成', 'success');
    }

    this.renderCards();
    this.renderEventLog();
    this.updateRoomStats();
  }

  applyEventToState(event) {
    const { type, payload } = event;

    switch (type) {
      case EVENT_TYPES.CARD_CREATED:
        this.cards.set(payload.cardId, {
          id: payload.cardId,
          title: payload.title,
          status: payload.status || CARD_STATUSES.TODO,
          assignee: payload.assignee || null,
          createdAt: event.timestamp,
          updatedAt: event.timestamp
        });
        break;

      case EVENT_TYPES.CARD_MOVED:
        const movingCard = this.cards.get(payload.cardId);
        if (movingCard) {
          movingCard.status = payload.newStatus;
          movingCard.updatedAt = event.timestamp;
        }
        break;

      case EVENT_TYPES.CARD_UPDATED:
        const updatingCard = this.cards.get(payload.cardId);
        if (updatingCard) {
          if (payload.title !== undefined) updatingCard.title = payload.title;
          if (payload.assignee !== undefined) updatingCard.assignee = payload.assignee;
          updatingCard.updatedAt = event.timestamp;
        }
        break;

      case EVENT_TYPES.CARD_DELETED:
        this.cards.delete(payload.cardId);
        break;
    }
  }

  sendClientState() {
    if (!this.currentRoomId) return;
    
    const cardsMap = {};
    this.cards.forEach((card, id) => {
      cardsMap[id] = { ...card };
    });

    this.send({
      type: 'client_state',
      roomId: this.currentRoomId,
      state: {
        cards: cardsMap,
        lastEventSequence: this.eventLog.length > 0 
          ? Math.max(...this.eventLog.map(e => e.sequence || 0))
          : 0
      }
    });
  }

  enableRoomControls(enabled) {
    document.getElementById('leaveRoomBtn').disabled = !enabled;
    document.getElementById('resetRoomBtn').disabled = !enabled;
    document.getElementById('addCardBtn').disabled = !enabled;
    document.getElementById('newCardTitle').disabled = !enabled;
    document.getElementById('syncNowBtn').disabled = !enabled;
    document.getElementById('showDiffBtn').disabled = !enabled;
    document.getElementById('startReplayBtn').disabled = !enabled || !this.selectedScriptId;
  }

  joinRoom() {
    const roomId = document.getElementById('roomIdInput').value.trim();
    if (!roomId) {
      this.showNotification('请输入房间ID', 'warning');
      return;
    }

    this.send({
      type: EVENT_TYPES.JOIN_ROOM,
      roomId
    });
  }

  createRoom() {
    const roomId = 'room-' + Date.now();
    document.getElementById('roomIdInput').value = roomId;
    this.joinRoom();
  }

  leaveRoom() {
    if (!this.currentRoomId) return;
    
    this.send({
      type: EVENT_TYPES.LEAVE_ROOM,
      roomId: this.currentRoomId
    });
  }

  resetRoom() {
    if (!this.currentRoomId) return;
    
    if (confirm('确定要重置房间吗？所有卡片和事件将被清除。')) {
      this.send({
        type: 'reset_room',
        roomId: this.currentRoomId
      });
    }
  }

  requestRooms() {
    this.send({ type: 'get_rooms' });
  }

  requestScripts() {
    this.send({ type: 'get_scripts' });
  }

  requestSync() {
    if (!this.currentRoomId) return;
    
    const lastSequence = this.eventLog.length > 0 
      ? Math.max(...this.eventLog.map(e => e.sequence || 0))
      : 0;

    this.send({
      type: EVENT_TYPES.SYNC_REQUEST,
      roomId: this.currentRoomId,
      sinceSequence: lastSequence
    });
  }

  requestDiff() {
    if (!this.currentRoomId) return;
    
    this.send({
      type: 'get_diff',
      roomId: this.currentRoomId
    });
  }

  addCard() {
    if (!this.currentRoomId) return;
    
    const titleInput = document.getElementById('newCardTitle');
    const title = titleInput.value.trim();
    
    if (!title) {
      this.showNotification('请输入卡片标题', 'warning');
      return;
    }

    const cardId = 'card-' + Date.now();
    
    this.send({
      id: 'evt-' + Date.now(),
      type: EVENT_TYPES.CARD_CREATED,
      roomId: this.currentRoomId,
      payload: {
        cardId,
        title,
        status: CARD_STATUSES.TODO
      }
    });

    titleInput.value = '';
  }

  moveCard(cardId, newStatus) {
    if (!this.currentRoomId) return;
    
    const card = this.cards.get(cardId);
    if (!card || card.status === newStatus) return;

    this.send({
      id: 'evt-' + Date.now(),
      type: EVENT_TYPES.CARD_MOVED,
      roomId: this.currentRoomId,
      payload: {
        cardId,
        newStatus
      }
    });
  }

  openCardEditModal(cardId) {
    const card = this.cards.get(cardId);
    if (!card) return;

    this.editingCardId = cardId;
    
    document.getElementById('editCardTitle').value = card.title || '';
    document.getElementById('editCardAssignee').value = card.assignee || '';
    document.getElementById('editCardStatus').value = card.status;

    document.getElementById('cardEditModal').classList.remove('hidden');
  }

  closeCardEditModal() {
    this.editingCardId = null;
    document.getElementById('cardEditModal').classList.add('hidden');
  }

  saveCardEdit() {
    if (!this.editingCardId || !this.currentRoomId) return;

    const title = document.getElementById('editCardTitle').value.trim();
    const assignee = document.getElementById('editCardAssignee').value.trim() || null;
    const status = document.getElementById('editCardStatus').value;

    const card = this.cards.get(this.editingCardId);
    
    if (card.status !== status) {
      this.send({
        id: 'evt-' + Date.now(),
        type: EVENT_TYPES.CARD_MOVED,
        roomId: this.currentRoomId,
        payload: {
          cardId: this.editingCardId,
          newStatus: status
        }
      });
    }

    if (card.title !== title || card.assignee !== assignee) {
      this.send({
        id: 'evt-' + Date.now() + '-upd',
        type: EVENT_TYPES.CARD_UPDATED,
        roomId: this.currentRoomId,
        payload: {
          cardId: this.editingCardId,
          title,
          assignee
        }
      });
    }

    this.closeCardEditModal();
  }

  deleteCard() {
    if (!this.editingCardId || !this.currentRoomId) return;
    
    if (confirm('确定要删除这个卡片吗？')) {
      this.send({
        id: 'evt-' + Date.now(),
        type: EVENT_TYPES.CARD_DELETED,
        roomId: this.currentRoomId,
        payload: {
          cardId: this.editingCardId
        }
      });
      this.closeCardEditModal();
    }
  }

  updateStateFromCards(cards) {
    this.cards.clear();
    if (cards) {
      cards.forEach(card => {
        this.cards.set(card.id, card);
      });
    }
    this.renderCards();
    this.updateRoomStats();
  }

  renderRooms(rooms) {
    const container = document.getElementById('roomsList');
    
    if (!rooms || rooms.length === 0) {
      container.innerHTML = '<p class="empty-text">暂无房间</p>';
      return;
    }

    container.innerHTML = rooms.map(room => `
      <div class="room-item ${room.id === this.currentRoomId ? 'selected' : ''}" data-room-id="${room.id}">
        <div class="room-info">
          <span class="room-name">${room.name}</span>
        </div>
        <div class="room-stats">成员: ${room.members?.length || 0} | 事件: ${room.eventCount || 0} | 卡片: ${room.cardCount || 0}</div>
      </div>
    `).join('');

    container.querySelectorAll('.room-item').forEach(item => {
      item.addEventListener('click', () => {
        const roomId = item.dataset.roomId;
        document.getElementById('roomIdInput').value = roomId;
        this.joinRoom();
      });
    });
  }

  renderScripts(scripts) {
    const container = document.getElementById('scriptsList');
    
    if (!scripts || scripts.length === 0) {
      container.innerHTML = '<p class="empty-text">暂无脚本</p>';
      return;
    }

    container.innerHTML = scripts.map(script => `
      <div class="script-item ${script.id === this.selectedScriptId ? 'selected' : ''}" data-script-id="${script.id}">
        <div class="script-info">
          <span class="script-name">${script.name}</span>
        </div>
        <div class="script-desc">${script.description} (${script.eventCount} 事件)</div>
      </div>
    `).join('');

    container.querySelectorAll('.script-item').forEach(item => {
      item.addEventListener('click', () => {
        const scriptId = item.dataset.scriptId;
        
        document.querySelectorAll('.script-item').forEach(el => el.classList.remove('selected'));
        item.classList.add('selected');
        
        this.selectedScriptId = scriptId;
        if (this.currentRoomId) {
          document.getElementById('startReplayBtn').disabled = false;
        }
      });
    });
  }

  renderMembers() {
    const container = document.getElementById('membersList');
    
    if (!this.members || this.members.length === 0) {
      container.innerHTML = '<p class="empty-text">未加入房间</p>';
      return;
    }

    container.innerHTML = this.members.map(memberId => `
      <div class="member-item">
        <span class="member-dot"></span>
        <span class="member-id">${memberId === this.clientId ? '我 (' + memberId.substring(0, 8) + ')' : memberId.substring(0, 8)}</span>
      </div>
    `).join('');
  }

  renderCards() {
    const statusToColumn = {
      [CARD_STATUSES.TODO]: 'todoColumn',
      [CARD_STATUSES.IN_PROGRESS]: 'inProgressColumn',
      [CARD_STATUSES.REVIEW]: 'reviewColumn',
      [CARD_STATUSES.DONE]: 'doneColumn'
    };

    Object.values(CARD_STATUSES).forEach(status => {
      const columnId = statusToColumn[status];
      const column = document.getElementById(columnId);
      if (column) {
        column.innerHTML = '';
      }
    });

    if (this.cards.size === 0) {
      Object.values(CARD_STATUSES).forEach(status => {
        const columnId = statusToColumn[status];
        const column = document.getElementById(columnId);
        if (column) {
          column.innerHTML = '<p class="empty-text">暂无卡片</p>';
        }
      });
    } else {
      this.cards.forEach(card => {
        const columnId = statusToColumn[card.status];
        const column = document.getElementById(columnId);
        if (column) {
          const cardEl = this.createCardElement(card);
          column.appendChild(cardEl);
        }
      });
    }

    this.updateCardCounts();
  }

  createCardElement(card) {
    const div = document.createElement('div');
    div.className = 'card';
    div.draggable = true;
    div.dataset.cardId = card.id;

    const assigneeInitial = card.assignee ? card.assignee[0].toUpperCase() : '?';
    const assigneeDisplay = card.assignee ? card.assignee : '未分配';

    div.innerHTML = `
      <div class="card-title">${this.escapeHtml(card.title)}</div>
      <div class="card-meta">
        <div class="card-assignee">
          <span class="avatar">${assigneeInitial}</span>
          <span>${this.escapeHtml(assigneeDisplay)}</span>
        </div>
        <span class="card-id">${card.id.substring(0, 8)}</span>
      </div>
    `;

    div.addEventListener('dragstart', (e) => {
      this.draggedCardId = card.id;
      div.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });

    div.addEventListener('dragend', () => {
      div.classList.remove('dragging');
      this.draggedCardId = null;
    });

    div.addEventListener('dblclick', () => {
      this.openCardEditModal(card.id);
    });

    return div;
  }

  updateCardCounts() {
    const statuses = [
      { status: CARD_STATUSES.TODO, countEl: 'todoCount' },
      { status: CARD_STATUSES.IN_PROGRESS, countEl: 'inProgressCount' },
      { status: CARD_STATUSES.REVIEW, countEl: 'reviewCount' },
      { status: CARD_STATUSES.DONE, countEl: 'doneCount' }
    ];

    statuses.forEach(({ status, countEl }) => {
      const count = Array.from(this.cards.values()).filter(c => c.status === status).length;
      document.getElementById(countEl).textContent = count;
    });
  }

  updateRoomStats() {
    const eventCount = this.eventLog.length;
    const cardCount = this.cards.size;
    document.getElementById('roomStats').textContent = `事件: ${eventCount} | 卡片: ${cardCount}`;
  }

  renderEventLog() {
    const container = document.getElementById('eventLogContent');
    
    if (!this.eventLog || this.eventLog.length === 0) {
      container.innerHTML = '<p class="empty-text">暂无事件</p>';
      return;
    }

    const sortedEvents = [...this.eventLog].sort((a, b) => {
      if (a.sequence !== undefined && b.sequence !== undefined) {
        return a.sequence - b.sequence;
      }
      return a.timestamp - b.timestamp;
    });

    container.innerHTML = sortedEvents.map(event => {
      const time = new Date(event.timestamp).toLocaleTimeString();
      const payloadStr = JSON.stringify(event.payload, null, 2);
      const isDuplicate = event.isDuplicate;
      
      let className = 'event-item';
      if (isDuplicate) className += ' event-duplicate';
      
      const eventLabels = {
        [EVENT_TYPES.CARD_CREATED]: '创建卡片',
        [EVENT_TYPES.CARD_MOVED]: '移动卡片',
        [EVENT_TYPES.CARD_UPDATED]: '更新卡片',
        [EVENT_TYPES.CARD_DELETED]: '删除卡片'
      };

      return `
        <div class="${className}">
          <div class="event-header">
            <span class="event-type">${eventLabels[event.type] || event.type}</span>
            <span class="event-time">${time}</span>
          </div>
          <div class="event-id">Seq: ${event.sequence || '-'} | ID: ${event.id.substring(0, 12)}</div>
          <div class="event-payload"><code>${this.escapeHtml(payloadStr)}</code></div>
          ${isDuplicate ? '<div class="event-tag event-tag-duplicate">重复</div>' : ''}
        </div>
      `;
    }).join('');

    container.scrollTop = container.scrollHeight;
  }

  renderDiff(diffData) {
    const container = document.getElementById('diffDisplay');
    const content = document.getElementById('diffContent');
    
    if (!diffData || !diffData.diffs || diffData.diffs.length === 0) {
      content.innerHTML = '<p style="color: var(--success-color); font-size: 0.875rem;">✓ 无差异，客户端状态与服务端一致</p>';
      container.classList.remove('hidden');
      return;
    }

    content.innerHTML = diffData.diffs.map(diff => {
      let className = 'diff-item';
      let label = '';
      let details = '';

      switch (diff.type) {
        case 'card_missing':
          className += ' diff-missing';
          label = `缺少卡片: ${diff.cardId}`;
          details = `服务端有此卡片，但客户端没有`;
          break;
        case 'card_extra':
          className += ' diff-extra';
          label = `多余卡片: ${diff.cardId}`;
          details = `客户端有此卡片，但服务端没有`;
          break;
        case 'field_diff':
          className += ' diff-field';
          label = `字段差异: ${diff.cardId}`;
          details = `
            <div class="diff-field-name">${diff.field}</div>
            <div class="diff-values">
              <span class="diff-server">服务端: ${JSON.stringify(diff.serverValue)}</span>
              <span class="diff-client">客户端: ${JSON.stringify(diff.clientValue)}</span>
            </div>
          `;
          break;
      }

      return `<div class="${className}">
        <strong>${this.escapeHtml(label)}</strong>
        ${details}
      </div>`;
    }).join('');

    container.classList.remove('hidden');
    this.showNotification(`发现 ${diffData.diffs.length} 处差异`, 'warning');
  }

  toggleEventLog() {
    const panel = document.getElementById('eventLogPanel');
    panel.classList.toggle('visible');
  }

  closeEventLog() {
    document.getElementById('eventLogPanel').classList.remove('visible');
  }

  startReplay() {
    if (!this.currentRoomId || !this.selectedScriptId) return;
    
    this.send({
      type: 'start_replay',
      roomId: this.currentRoomId,
      scriptId: this.selectedScriptId
    });
  }

  stopReplay() {
    if (!this.activeReplayId) return;
    
    this.send({
      type: 'stop_replay',
      replayId: this.activeReplayId
    });
  }

  escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showNotification(message, type = 'info') {
    const container = document.getElementById('notifications');
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    container.appendChild(notification);

    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.schedulingWallClient = new SchedulingWallClient();
});

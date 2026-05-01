const CARD_STATUSES = {
  TODO: 'todo',
  IN_PROGRESS: 'in_progress',
  REVIEW: 'review',
  DONE: 'done'
};

const EVENT_TYPES = {
  CARD_CREATED: 'card_created',
  CARD_MOVED: 'card_moved',
  CARD_UPDATED: 'card_updated',
  CARD_DELETED: 'card_deleted',
  SYNC_REQUEST: 'sync_request',
  SYNC_RESPONSE: 'sync_response',
  JOIN_ROOM: 'join_room',
  LEAVE_ROOM: 'leave_room',
  ROOM_JOINED: 'room_joined',
  EVENT_REPLAY: 'event_replay',
  REPLAY_START: 'replay_start',
  REPLAY_STOP: 'replay_stop',
  REPLAY_EVENT: 'replay_event',
  REPLAY_COMPLETE: 'replay_complete',
  CLIENT_STATE: 'client_state',
  DIFF_ANNOTATION: 'diff_annotation'
};

const DEFAULT_ROOM = 'demo-room-1';

const STATUS_LABELS = {
  [CARD_STATUSES.TODO]: '待办',
  [CARD_STATUSES.IN_PROGRESS]: '进行中',
  [CARD_STATUSES.REVIEW]: '审核中',
  [CARD_STATUSES.DONE]: '已完成'
};

module.exports = {
  CARD_STATUSES,
  EVENT_TYPES,
  DEFAULT_ROOM,
  STATUS_LABELS
};

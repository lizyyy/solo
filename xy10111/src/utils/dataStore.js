const electronAPI = window.electronAPI;

const DATA_FILES = {
  MEETINGS: 'meetings.json',
  GROUPS: 'groups.json',
  DISPATCHES: 'dispatches.json',
};

const DEFAULT_DATA = {
  meetings: [],
  groups: [],
  dispatches: [],
};

export const dataStore = {
  async getMeetings() {
    return await electronAPI.getData(DATA_FILES.MEETINGS, DEFAULT_DATA.meetings);
  },

  async saveMeetings(meetings) {
    return await electronAPI.saveData(DATA_FILES.MEETINGS, meetings);
  },

  async getGroups() {
    return await electronAPI.getData(DATA_FILES.GROUPS, DEFAULT_DATA.groups);
  },

  async saveGroups(groups) {
    return await electronAPI.saveData(DATA_FILES.GROUPS, groups);
  },

  async getDispatches() {
    return await electronAPI.getData(DATA_FILES.DISPATCHES, DEFAULT_DATA.dispatches);
  },

  async saveDispatches(dispatches) {
    return await electronAPI.saveData(DATA_FILES.DISPATCHES, dispatches);
  },

  async getAllData() {
    return {
      meetings: await this.getMeetings(),
      groups: await this.getGroups(),
      dispatches: await this.getDispatches(),
    };
  },
};

export const validators = {
  isEmpty(value) {
    return value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
  },

  validateMeeting(meeting) {
    const errors = [];
    if (this.isEmpty(meeting.title)) {
      errors.push({ field: 'title', message: '会议标题不能为空' });
    }
    if (this.isEmpty(meeting.date)) {
      errors.push({ field: 'date', message: '会议日期不能为空' });
    }
    return errors;
  },

  validateGroup(group) {
    const errors = [];
    if (this.isEmpty(group.name)) {
      errors.push({ field: 'name', message: '小组名称不能为空' });
    }
    return errors;
  },

  validateAttachment(attachment, existingAttachments = []) {
    const errors = [];
    if (this.isEmpty(attachment.name)) {
      errors.push({ field: 'name', message: '附件名称不能为空' });
    }
    if (this.isEmpty(attachment.filePath)) {
      errors.push({ field: 'filePath', message: '文件路径不能为空' });
    }
    
    const duplicate = existingAttachments.find(a => 
      a.id !== attachment.id && 
      (a.name === attachment.name || a.originalPath === attachment.originalPath)
    );
    if (duplicate) {
      errors.push({ 
        field: 'name', 
        message: `附件名称或文件已存在：${duplicate.name}`,
        type: 'duplicate'
      });
    }
    return errors;
  },

  validateDispatch(dispatch) {
    const errors = [];
    if (this.isEmpty(dispatch.meetingId)) {
      errors.push({ field: 'meetingId', message: '请选择会议' });
    }
    if (this.isEmpty(dispatch.groupIds) || dispatch.groupIds.length === 0) {
      errors.push({ field: 'groupIds', message: '请至少选择一个小组' });
    }
    if (this.isEmpty(dispatch.attachmentIds) || dispatch.attachmentIds.length === 0) {
      errors.push({ field: 'attachmentIds', message: '请至少选择一个附件' });
    }
    return errors;
  },

  checkDuplicateDispatch(dispatch, existingDispatches, meetings) {
    const warnings = [];
    const sameMeetingDispatches = existingDispatches.filter(
      d => d.meetingId === dispatch.meetingId && d.status !== 'cancelled' && d.id !== dispatch.id
    );

    const meeting = meetings.find(m => m.id === dispatch.meetingId);
    const meetingAttachments = meeting ? meeting.attachments || [] : [];

    for (const existing of sameMeetingDispatches) {
      const sameGroups = dispatch.groupIds.filter(gId => existing.groupIds.includes(gId));
      const sameAttachments = dispatch.attachmentIds.filter(aId => existing.attachmentIds.includes(aId));
      
      if (sameGroups.length > 0 && sameAttachments.length > 0) {
        const groupNames = sameGroups.map(gId => {
          const group = meeting.groups?.find(g => g.id === gId);
          return group ? group.name : gId;
        }).join('、');
        
        const attachmentNames = sameAttachments.map(aId => {
          const att = meetingAttachments.find(a => a.id === aId);
          return att ? att.name : aId;
        }).join('、');

        warnings.push({
          type: 'duplicate_dispatch',
          message: `发现重复分发：小组「${groupNames}」已收到附件「${attachmentNames}」，上次分发时间：${new Date(existing.createdAt).toLocaleString()}`,
          existingDispatch: existing,
        });
      }
    }
    return warnings;
  },

  async checkFileExistence(filePath) {
    if (!filePath) return false;
    return await electronAPI.fileExists(filePath);
  },

  async checkMeetingAttachments(meeting) {
    const missingFiles = [];
    const attachments = meeting.attachments || [];
    
    for (const att of attachments) {
      const exists = await this.checkFileExistence(att.filePath);
      if (!exists) {
        missingFiles.push({
          ...att,
          error: '文件不存在',
        });
      }
    }
    return missingFiles;
  },
};

import type { RedemptionAnnouncement, AnnouncementType } from '@/types';

export const ANNOUNCEMENT_TYPE_TEXT: Record<AnnouncementType, string> = {
  PRE_ANNOUNCE: '提示性公告',
  FORMAL_ANNOUNCE: '正式公告',
  WITHDRAW_ANNOUNCE: '撤回公告',
  UPDATE_ANNOUNCE: '更新公告',
};

export const ANNOUNCEMENT_TYPE_COLOR: Record<AnnouncementType, string> = {
  PRE_ANNOUNCE: 'badge-info',
  FORMAL_ANNOUNCE: 'badge-success',
  WITHDRAW_ANNOUNCE: 'badge-danger',
  UPDATE_ANNOUNCE: 'badge-warning',
};

export class AnnouncementVersionService {
  detectAnnouncementChanges(announcements: RedemptionAnnouncement[]): {
    hasWithdrawal: boolean;
    hasUpdate: boolean;
    latestVersion: RedemptionAnnouncement | null;
    versionHistory: RedemptionAnnouncement[];
  } {
    const sorted = [...announcements].sort((a, b) => b.version - a.version);
    const latestVersion = sorted[0] || null;
    
    const hasWithdrawal = sorted.some(a => a.announcementType === 'WITHDRAW_ANNOUNCE');
    const hasUpdate = sorted.some(a => a.announcementType === 'UPDATE_ANNOUNCE');
    
    return {
      hasWithdrawal,
      hasUpdate,
      latestVersion,
      versionHistory: sorted,
    };
  }
  
  compareVersions(
    v1: RedemptionAnnouncement,
    v2: RedemptionAnnouncement
  ): { field: string; oldValue: string; newValue: string; diffType: 'CHANGE' | 'ADD' | 'REMOVE' }[] {
    const fieldsToCompare = ['redemptionDate', 'redemptionCode', 'title', 'content'] as const;
    const differences: { field: string; oldValue: string; newValue: string; diffType: 'CHANGE' | 'ADD' | 'REMOVE' }[] = [];
    
    for (const field of fieldsToCompare) {
      const v1Value = v1[field];
      const v2Value = v2[field];
      
      if (v1Value !== v2Value) {
        let diffType: 'CHANGE' | 'ADD' | 'REMOVE' = 'CHANGE';
        if (!v1Value && v2Value) diffType = 'ADD';
        if (v1Value && !v2Value) diffType = 'REMOVE';
        
        differences.push({
          field: this.getFieldDisplayName(field),
          oldValue: String(v1Value || '-'),
          newValue: String(v2Value || '-'),
          diffType,
        });
      }
    }
    
    return differences;
  }
  
  private getFieldDisplayName(field: string): string {
    const displayNames: Record<string, string> = {
      redemptionDate: '强赎实施日',
      redemptionCode: '强赎代码',
      title: '公告标题',
      content: '公告内容',
      announcementDate: '公告日期',
    };
    return displayNames[field] || field;
  }
  
  getAnnouncementStatus(announcements: RedemptionAnnouncement[]): {
    status: 'VALID' | 'UPDATED' | 'WITHDRAWN' | 'NONE';
    latestAnnouncement: RedemptionAnnouncement | null;
    statusText: string;
    versionHistory: RedemptionAnnouncement[];
  } {
    if (announcements.length === 0) {
      return {
        status: 'NONE',
        latestAnnouncement: null,
        statusText: '暂无公告',
        versionHistory: [],
      };
    }
    
    const { hasWithdrawal, hasUpdate, latestVersion, versionHistory } = this.detectAnnouncementChanges(announcements);
    
    if (hasWithdrawal) {
      return {
        status: 'WITHDRAWN',
        latestAnnouncement: latestVersion,
        statusText: '公告已撤回',
        versionHistory,
      };
    }
    
    if (hasUpdate) {
      return {
        status: 'UPDATED',
        latestAnnouncement: latestVersion,
        statusText: `公告已更新（V${latestVersion?.version || 1}）`,
        versionHistory,
      };
    }
    
    return {
      status: 'VALID',
      latestAnnouncement: latestVersion,
      statusText: '公告有效',
      versionHistory,
    };
  }
}

export const announcementVersionService = new AnnouncementVersionService();

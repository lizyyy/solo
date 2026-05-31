import type { FilterState, SourceType, ChangeType, RecordStatus } from '../types';

const DEFAULT_FILTER_STATE: FilterState = {
  page: 1,
  pageSize: 10,
};

export class UrlStateSync {
  static serialize(filterState: FilterState): string {
    const params = new URLSearchParams();
    
    if (filterState.studentId) {
      params.set('student', filterState.studentId);
    }
    if (filterState.dateRange) {
      params.set('from', filterState.dateRange[0]);
      params.set('to', filterState.dateRange[1]);
    }
    if (filterState.sourceTypes && filterState.sourceTypes.length > 0) {
      params.set('sources', filterState.sourceTypes.join(','));
    }
    if (filterState.changeTypes && filterState.changeTypes.length > 0) {
      params.set('changes', filterState.changeTypes.join(','));
    }
    if (filterState.statuses && filterState.statuses.length > 0) {
      params.set('statuses', filterState.statuses.join(','));
    }
    if (filterState.searchQuery) {
      params.set('q', filterState.searchQuery);
    }
    if (filterState.page !== 1) {
      params.set('page', String(filterState.page));
    }
    if (filterState.pageSize !== 10) {
      params.set('size', String(filterState.pageSize));
    }

    return params.toString();
  }

  static deserialize(searchParams: string | URLSearchParams): FilterState {
    const params = typeof searchParams === 'string' 
      ? new URLSearchParams(searchParams) 
      : searchParams;
    
    const state: FilterState = { ...DEFAULT_FILTER_STATE };

    const student = params.get('student');
    if (student) state.studentId = student;

    const from = params.get('from');
    const to = params.get('to');
    if (from && to) {
      state.dateRange = [from, to];
    }

    const sources = params.get('sources');
    if (sources) {
      state.sourceTypes = sources.split(',') as SourceType[];
    }

    const changes = params.get('changes');
    if (changes) {
      state.changeTypes = changes.split(',') as ChangeType[];
    }

    const statuses = params.get('statuses');
    if (statuses) {
      state.statuses = statuses.split(',') as RecordStatus[];
    }

    const q = params.get('q');
    if (q) {
      state.searchQuery = q;
    }

    const page = params.get('page');
    if (page) {
      const pageNum = parseInt(page, 10);
      if (!isNaN(pageNum) && pageNum > 0) {
        state.page = pageNum;
      }
    }

    const size = params.get('size');
    if (size) {
      const sizeNum = parseInt(size, 10);
      if (!isNaN(sizeNum) && sizeNum > 0) {
        state.pageSize = sizeNum;
      }
    }

    return state;
  }

  static syncToUrl(filterState: FilterState): void {
    const searchString = this.serialize(filterState);
    const url = new URL(window.location.href);
    if (searchString) {
      url.search = searchString;
    } else {
      url.search = '';
    }
    window.history.replaceState({}, '', url.toString());
  }

  static syncFromUrl(): FilterState {
    const params = new URLSearchParams(window.location.search);
    return this.deserialize(params);
  }

  static getStateHash(filterState: FilterState): string {
    const normalized: FilterState = {
      ...filterState,
      page: 1,
    };
    
    const keys = Object.keys(normalized).sort() as (keyof FilterState)[];
    const parts: string[] = [];
    
    for (const key of keys) {
      const value = normalized[key];
      if (value === undefined || value === null) continue;
      if (Array.isArray(value) && value.length === 0) continue;
      if (typeof value === 'string' && value === '') continue;
      
      const strValue = Array.isArray(value) ? value.sort().join(',') : String(value);
      parts.push(`${key}=${strValue}`);
    }
    
    return this.simpleHash(parts.join('&'));
  }

  private static simpleHash(str: string): string {
    let hash = 0;
    if (str.length === 0) return String(hash);
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return Math.abs(hash).toString(36);
  }

  static areStatesEqual(s1: FilterState, s2: FilterState): boolean {
    return this.getStateHash(s1) === this.getStateHash(s2);
  }

  static getRangeDescription(filterState: FilterState, totalCount: number, studentName?: string): string {
    const parts: string[] = [];

    if (studentName) {
      parts.push(`学生：${studentName}`);
    } else {
      parts.push('全部学生');
    }

    if (filterState.dateRange) {
      const [from, to] = filterState.dateRange;
      parts.push(`时间：${from} 至 ${to}`);
    } else {
      parts.push('时间：全部');
    }

    if (filterState.sourceTypes && filterState.sourceTypes.length > 0) {
      const sourceLabels: Record<SourceType, string> = {
        metronome: '节拍器',
        song_list: '选曲表',
        sheet_music: '曲谱',
      };
      parts.push(`来源：${filterState.sourceTypes.map(s => sourceLabels[s]).join('、')}`);
    }

    if (filterState.changeTypes && filterState.changeTypes.length > 0) {
      const changeLabels: Record<ChangeType, string> = {
        supplement: '补材料',
        revision: '改结论',
      };
      parts.push(`类型：${filterState.changeTypes.map(c => changeLabels[c]).join('、')}`);
    }

    if (filterState.statuses && filterState.statuses.length > 0) {
      const statusLabels: Record<RecordStatus, string> = {
        normal: '正常',
        duplicate: '重复统计',
        transposition_mismatch: '转调未同步',
      };
      parts.push(`状态：${filterState.statuses.map(s => statusLabels[s]).join('、')}`);
    }

    parts.push(`共 ${totalCount} 条记录`);

    return parts.join(' | ');
  }

  static getDefaultState(): FilterState {
    return { ...DEFAULT_FILTER_STATE };
  }

  static resetState(): FilterState {
    return { ...DEFAULT_FILTER_STATE };
  }
}

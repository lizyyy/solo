import { Parser } from 'json2csv';
import { Candidate, CandidateStatus, SourceChannel, ExportCandidate, CandidateQuery } from '../types';
import { candidateService } from './candidate.service';

export class ExportService {
  private mapStatusToChinese(status: CandidateStatus): string {
    const statusMap: Record<CandidateStatus, string> = {
      [CandidateStatus.PENDING_MERGE]: '待合并',
      [CandidateStatus.CONFLICT_REVIEW]: '冲突待审',
      [CandidateStatus.MERGED]: '已合并',
      [CandidateStatus.KEEP_INDEPENDENT]: '保留独立'
    };
    return statusMap[status] || status;
  }

  private mapSourceChannelToChinese(channel: SourceChannel): string {
    const channelMap: Record<SourceChannel, string> = {
      [SourceChannel.HEADHUNTER]: '猎头',
      [SourceChannel.OFFICIAL_WEBSITE]: '官网',
      [SourceChannel.INTERNAL_RECOMMENDATION]: '内推',
      [SourceChannel.ZHAOPIN]: '智联',
      [SourceChannel.LIEPIN]: '猎聘',
      [SourceChannel.BOSS]: 'BOSS直聘',
      [SourceChannel.OTHER]: '其他'
    };
    return channelMap[channel] || channel;
  }

  private formatDate(date: Date): string {
    return date.toISOString().replace('T', ' ').substring(0, 19);
  }

  private candidateToExportFormat(candidate: Candidate): ExportCandidate {
    return {
      '候选人ID': candidate.id,
      '姓名': candidate.name,
      '手机号': candidate.phone,
      '邮箱': candidate.email,
      '来源渠道': this.mapSourceChannelToChinese(candidate.sourceChannel),
      '状态': this.mapStatusToChinese(candidate.status),
      '应聘职位': candidate.position,
      '创建时间': this.formatDate(candidate.createdAt),
      '更新时间': this.formatDate(candidate.updatedAt),
      '合并到候选人ID': candidate.mergedIntoId,
      '冲突候选人ID': candidate.conflictCandidateIds?.join(', ')
    };
  }

  exportToCsv(query?: CandidateQuery): string {
    const result = candidateService.listCandidates({
      ...query,
      page: 1,
      pageSize: 10000
    });

    const exportData = result.data.map(c => this.candidateToExportFormat(c));
    
    const fields = [
      '候选人ID',
      '姓名',
      '手机号',
      '邮箱',
      '来源渠道',
      '状态',
      '应聘职位',
      '创建时间',
      '更新时间',
      '合并到候选人ID',
      '冲突候选人ID'
    ];

    const parser = new Parser({ fields });
    return '\uFEFF' + parser.parse(exportData);
  }

  exportToJson(query?: CandidateQuery): ExportCandidate[] {
    const result = candidateService.listCandidates({
      ...query,
      page: 1,
      pageSize: 10000
    });

    return result.data.map(c => this.candidateToExportFormat(c));
  }
}

export const exportService = new ExportService();

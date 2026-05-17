import axios from 'axios';
import { ServiceEntry, RepoProbeResult, ProcessingError } from './types';
import { ConfigManager } from './config';

export class RepoProbe {
  private configManager: ConfigManager;
  private verbose: boolean;
  private githubToken?: string;
  private errors: ProcessingError[] = [];

  constructor(configManager: ConfigManager, verbose: boolean = false, githubToken?: string) {
    this.configManager = configManager;
    this.verbose = verbose;
    this.githubToken = githubToken;
  }

  public async probeRepositories(services: ServiceEntry[]): Promise<{ results: Map<string, RepoProbeResult>; errors: ProcessingError[] }> {
    this.errors = [];
    const results = new Map<string, RepoProbeResult>();

    const servicesWithRepo = services.filter(s => s.repoUrl);
    
    if (servicesWithRepo.length === 0) {
      return { results, errors: this.errors };
    }

    const batchSize = 5;
    for (let i = 0; i < servicesWithRepo.length; i += batchSize) {
      const batch = servicesWithRepo.slice(i, i + batchSize);
      const promises = batch.map(service => this.probeSingleRepository(service));
      const batchResults = await Promise.all(promises);
      
      for (const result of batchResults) {
        results.set(result.serviceId, result);
      }
    }

    return { results, errors: this.errors };
  }

  private async probeSingleRepository(service: ServiceEntry): Promise<RepoProbeResult> {
    const repoUrl = service.repoUrl!;
    
    const result: RepoProbeResult = {
      serviceId: service.id,
      repoUrl,
      exists: false
    };

    try {
      const githubInfo = this.parseGithubUrl(repoUrl);
      
      if (githubInfo) {
        const apiResult = await this.queryGithubApi(githubInfo.owner, githubInfo.repo);
        result.exists = apiResult.exists;
        result.isArchived = apiResult.isArchived;
        result.lastCommitDate = apiResult.lastCommitDate;
      } else {
        const accessible = await this.checkUrlAccessible(repoUrl);
        result.exists = accessible;
      }

      return result;
    } catch (e: any) {
      this.errors.push({
        serviceId: service.id,
        serviceName: service.name,
        sourceFile: service.sourceFile,
        lineNumber: service.lineNumber,
        errorType: 'repo_check_error',
        message: `仓库探测失败: ${e.message}`
      });
      
      result.error = e.message;
      return result;
    }
  }

  private parseGithubUrl(url: string): { owner: string; repo: string } | null {
    const patterns = [
      /github\.com\/([^\/]+)\/([^\/\.]+)/,
      /github\.com:([^\/]+)\/([^\/\.]+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return {
          owner: match[1],
          repo: match[2].replace(/\.git$/, '')
        };
      }
    }

    return null;
  }

  private async queryGithubApi(owner: string, repo: string): Promise<{
    exists: boolean;
    isArchived?: boolean;
    lastCommitDate?: string;
  }> {
    const apiBase = this.configManager.getGithubApiBase();
    const timeout = this.configManager.getConfig().repoProbe.timeout;

    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json'
    };

    if (this.githubToken) {
      headers['Authorization'] = `token ${this.githubToken}`;
    }

    try {
      const response = await axios.get(`${apiBase}/repos/${owner}/${repo}`, {
        headers,
        timeout
      });

      const data = response.data;
      const lastCommitDate = data.pushed_at || data.updated_at;

      return {
        exists: true,
        isArchived: data.archived,
        lastCommitDate
      };
    } catch (e: any) {
      if (e.response?.status === 404) {
        return { exists: false };
      }
      if (e.response?.status === 403) {
        throw new Error('GitHub API限流，请提供 --github-token 参数');
      }
      throw e;
    }
  }

  private async checkUrlAccessible(url: string): Promise<boolean> {
    const timeout = this.configManager.getConfig().repoProbe.timeout;

    try {
      await axios.head(url, {
        timeout,
        validateStatus: () => true
      });
      return true;
    } catch {
      try {
        await axios.get(url, {
          timeout,
          validateStatus: () => true
        });
        return true;
      } catch {
        return false;
      }
    }
  }

  public isRepoOrphaned(result: RepoProbeResult): boolean {
    const criteria = this.configManager.getOrphanCriteria();
    
    if (!result.exists) {
      return true;
    }

    if (criteria.repoArchived && result.isArchived) {
      return true;
    }

    if (criteria.noCommitSinceDays && result.lastCommitDate) {
      const lastCommit = new Date(result.lastCommitDate);
      const daysSince = (Date.now() - lastCommit.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince > criteria.noCommitSinceDays) {
        return true;
      }
    }

    return false;
  }

  public getOrphanReason(result: RepoProbeResult): string {
    const criteria = this.configManager.getOrphanCriteria();
    
    if (!result.exists) {
      return '仓库不存在';
    }

    if (criteria.repoArchived && result.isArchived) {
      return '仓库已归档';
    }

    if (criteria.noCommitSinceDays && result.lastCommitDate) {
      const lastCommit = new Date(result.lastCommitDate);
      const daysSince = Math.floor((Date.now() - lastCommit.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince > criteria.noCommitSinceDays) {
        return `仓库超过 ${criteria.noCommitSinceDays} 天无提交 (最后提交: ${daysSince} 天前)`;
      }
    }

    return '';
  }
}

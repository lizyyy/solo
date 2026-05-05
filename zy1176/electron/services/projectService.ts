import { v4 as uuidv4 } from 'uuid';
import fs from 'fs-extra';
import path from 'path';
import { getDatabase } from '../database';
import { Project, FileEntry, SensitiveHit } from '../types';

export class ProjectService {
  createProject(folderPath: string, name: string): Project {
    const db = getDatabase();
    const id = uuidv4();
    
    db.prepare(`
      INSERT INTO projects (id, name, folder_path, status)
      VALUES (?, ?, ?, 'pending')
    `).run(id, name, folderPath);
    
    return this.getProject(id)!;
  }

  getProject(projectId: string): Project | null {
    const db = getDatabase();
    const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    
    if (!row) return null;
    
    return this.mapRowToProject(row);
  }

  getAllProjects(): Project[] {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all();
    
    return rows.map((row: any) => this.mapRowToProject(row));
  }

  deleteProject(projectId: string): void {
    const db = getDatabase();
    db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
  }

  getProjectFiles(projectId: string): FileEntry[] {
    const db = getDatabase();
    const rows = db.prepare(
      'SELECT * FROM files WHERE project_id = ? ORDER BY file_name'
    ).all(projectId);
    
    return rows.map((row: any) => this.mapRowToFileEntry(row));
  }

  getSensitiveHits(fileId: string): SensitiveHit[] {
    const db = getDatabase();
    const rows = db.prepare(
      'SELECT * FROM sensitive_hits WHERE file_id = ? ORDER BY start_offset'
    ).all(fileId);
    
    return rows.map((row: any) => this.mapRowToSensitiveHit(row));
  }

  updateHitStatus(hitId: string, status: string): void {
    const db = getDatabase();
    
    const hitRow = db.prepare(
      'SELECT file_id, status as old_status FROM sensitive_hits WHERE id = ?'
    ).get(hitId);
    
    if (!hitRow) return;
    
    db.prepare(`
      UPDATE sensitive_hits SET 
        status = ?, 
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(status, hitId);
    
    const fileId = hitRow.file_id;
    const counts = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
        SUM(CASE WHEN status = 'ignored' THEN 1 ELSE 0 END) as ignored
      FROM sensitive_hits
      WHERE file_id = ?
    `).get(fileId);
    
    db.prepare(`
      UPDATE files SET 
        sensitive_count = ?,
        confirmed_count = ?,
        ignored_count = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(counts.total, counts.confirmed, counts.ignored, fileId);
  }

  createSampleProject(): Project {
    const db = getDatabase();
    
    const sampleDir = this.createSampleData();
    
    const id = uuidv4();
    const projectName = '示例项目 - 客户会议纪要';
    
    db.prepare(`
      INSERT INTO projects (id, name, folder_path, status, description)
      VALUES (?, ?, ?, 'analyzed', ?)
    `).run(id, projectName, sampleDir, '包含各种敏感信息类型的示例项目，用于演示脱敏功能');
    
    this.createSampleFiles(id, sampleDir);
    
    return this.getProject(id)!;
  }

  private createSampleData(): string {
    const db = getDatabase();
    const dbPath = db.name;
    const sampleDir = path.join(path.dirname(dbPath), 'sample_data');
    
    fs.ensureDirSync(sampleDir);
    
    const sampleContent = `# 客户会议纪要

## 会议基本信息
- 会议时间：2024年1月15日 14:00-16:00
- 会议地点：线上视频会议
- 参会人员：
  - 我方：张三（项目经理）、李四（技术总监）
  - 客户：王五（ABC科技有限公司 CEO）、赵六（产品经理）

## 联系方式
- 客户对接人：王五
  - 电话：13812345678
  - 邮箱：wangwu@abctech.com
  - QQ：123456789
  - 微信：wangwu_abc

- 紧急联系人：赵六
  - 电话：13987654321
  - 邮箱：zhaoliu@abctech.com

## 项目背景
ABC科技有限公司是一家位于北京市海淀区中关村软件园的科技企业。

公司地址：北京市海淀区中关村软件园8号楼1001室

## 付款信息
本次合同总金额：500,000元
付款账户：中国工商银行
账号：6222021234567890123
开户行：工商银行北京中关村支行

## 身份证信息示例
张三：110101199001011234
李四：310101198505055678

## 车牌号
客户公司车辆：京A12345
我方车辆：沪B67890

## 会议内容摘要
1. 王五总表示对我方方案非常满意
2. 赵六经理提出了一些修改意见
3. 预计下周可以签署正式合同
4. 付款将在合同签署后30天内完成

## 下一步行动
- 张三：根据赵六的意见修改方案
- 李四：准备技术文档
- 王五：协调内部审批流程
`;
    
    fs.writeFileSync(path.join(sampleDir, '会议纪要.md'), sampleContent, 'utf-8');
    
    const csvContent = `客户名称,联系人,电话,邮箱,公司,地址
ABC科技,王五,13812345678,wangwu@abctech.com,ABC科技有限公司,北京市海淀区中关村软件园
XYZ公司,钱七,13611112222,qianqi@xyz.com,XYZ网络科技有限公司,上海市浦东新区张江高科技园区
`;
    
    fs.writeFileSync(path.join(sampleDir, '客户列表.csv'), csvContent, 'utf-8');
    
    const jsonContent = `{
  "project": "客户会议记录",
  "date": "2024-01-15",
  "participants": [
    {
      "name": "王五",
      "role": "CEO",
      "company": "ABC科技有限公司",
      "phone": "13812345678",
      "email": "wangwu@abctech.com"
    },
    {
      "name": "张三",
      "role": "项目经理",
      "phone": "13599998888",
      "email": "zhangsan@ourcompany.com"
    }
  ]
}
`;
    
    fs.writeFileSync(path.join(sampleDir, '会议数据.json'), jsonContent, 'utf-8');
    
    return sampleDir;
  }

  private createSampleFiles(projectId: string, sampleDir: string): void {
    const db = getDatabase();
    
    const files = [
      { name: '会议纪要.md', type: 'text' },
      { name: '客户列表.csv', type: 'text' },
      { name: '会议数据.json', type: 'text' },
    ];
    
    const insertFile = db.prepare(`
      INSERT INTO files (
        id, project_id, file_name, file_path, file_type, 
        file_size, mime_type, status, sensitive_count, confirmed_count, ignored_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'analyzed', 0, 0, 0)
    `);
    
    for (const file of files) {
      const filePath = path.join(sampleDir, file.name);
      const stat = fs.statSync(filePath);
      const id = uuidv4();
      
      insertFile.run(
        id, projectId, file.name, filePath, file.type,
        stat.size, 'text/plain'
      );
    }
  }

  private mapRowToProject(row: any): Project {
    return {
      id: row.id,
      name: row.name,
      folderPath: row.folder_path,
      description: row.description,
      status: row.status as Project['status'],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapRowToFileEntry(row: any): FileEntry {
    return {
      id: row.id,
      projectId: row.project_id,
      fileName: row.file_name,
      filePath: row.file_path,
      fileType: row.file_type as FileEntry['fileType'],
      fileSize: row.file_size,
      mimeType: row.mime_type,
      status: row.status as FileEntry['status'],
      sensitiveCount: row.sensitive_count,
      confirmedCount: row.confirmed_count,
      ignoredCount: row.ignored_count,
      maskOutputPath: row.mask_output_path,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapRowToSensitiveHit(row: any): SensitiveHit {
    return {
      id: row.id,
      fileId: row.file_id,
      ruleId: row.rule_id,
      ruleName: row.rule_name,
      category: row.category,
      matchedText: row.matched_text,
      replacementText: row.replacement_text,
      contextBefore: row.context_before,
      contextAfter: row.context_after,
      lineNumber: row.line_number,
      startOffset: row.start_offset,
      endOffset: row.end_offset,
      status: row.status as SensitiveHit['status'],
      confidence: row.confidence,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

import type { Material, MaterialType, Exception, MaterialStatus } from '@/types';

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function detectMaterialType(fileName: string): MaterialType {
  const lowerName = fileName.toLowerCase();
  
  if (lowerName.includes('wall') || lowerName.includes('墙') || lowerName.includes('展墙') || lowerName.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
    return 'wall_image';
  }
  if (lowerName.includes('insurance') || lowerName.includes('保险') || lowerName.includes('保单')) {
    return 'insurance_policy';
  }
  if (lowerName.includes('installation') || lowerName.includes('布展') || lowerName.includes('清单')) {
    return 'installation_list';
  }
  if (lowerName.includes('light') || lowerName.includes('灯光')) {
    return 'light_record';
  }
  if (lowerName.includes('remark') || lowerName.includes('备注') || lowerName.includes('note') || lowerName.match(/\.(txt|md)$/)) {
    return 'remark';
  }
  return 'attachment';
}

export function detectMaterialStatus(fileName: string, content?: string): MaterialStatus {
  const lowerName = fileName.toLowerCase();
  
  if (lowerName.includes('late') || lowerName.includes('晚到') || lowerName.includes('补传')) {
    return 'late';
  }
  if (lowerName.includes('corrected') || lowerName.includes('更正') || lowerName.includes('修正')) {
    return 'corrected';
  }
  return 'normal';
}

export function checkDuplicate(
  newFileName: string,
  newFileSize: number,
  existingMaterials: Material[]
): { isDuplicate: boolean; duplicateOf?: string } {
  const duplicate = existingMaterials.find(m => {
    if (m.fileName === newFileName && m.fileSize === newFileSize) {
      return true;
    }
    if (Math.abs((m.fileSize || 0) - newFileSize) < 100) {
      return true;
    }
    return false;
  });

  return {
    isDuplicate: !!duplicate,
    duplicateOf: duplicate?.id,
  };
}

export interface ParsedFile {
  name: string;
  type: MaterialType;
  status: MaterialStatus;
  metadata: Record<string, any>;
}

export function parseFileName(fileName: string): ParsedFile {
  const cleanName = fileName.replace(/\.[^/.]+$/, '');
  const type = detectMaterialType(fileName);
  const status = detectMaterialStatus(fileName);
  
  const metadata: Record<string, any> = {
    originalName: fileName,
    extension: fileName.split('.').pop(),
  };

  const artistMatch = cleanName.match(/[【\[]([^】\]]+)[】\]]/);
  if (artistMatch) {
    metadata.artist = artistMatch[1];
  }

  const dateMatch = cleanName.match(/(\d{4}[-_]?\d{2}[-_]?\d{2})/);
  if (dateMatch) {
    metadata.date = dateMatch[1];
  }

  const versionMatch = cleanName.match(/[vV](\d+\.?\d*)/);
  if (versionMatch) {
    metadata.version = versionMatch[1];
  }

  return {
    name: cleanName,
    type,
    status,
    metadata,
  };
}

export function checkMissingMaterials(materials: Material[]): Exception[] {
  const exceptions: Exception[] = [];
  const types = materials.map(m => m.type);

  const hasWallImage = types.includes('wall_image');
  const hasInsurance = types.includes('insurance_policy');
  const hasInstallationList = types.includes('installation_list');

  if (!hasInsurance) {
    exceptions.push({
      id: generateId(),
      handoverId: '',
      type: 'missing_insurance',
      severity: 'high',
      description: '缺少保险单文件',
      status: 'open',
      createdAt: new Date().toISOString(),
    });
  }

  return exceptions;
}

export async function generateChecksum(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

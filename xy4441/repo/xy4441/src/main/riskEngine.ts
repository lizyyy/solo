import { v4 as uuidv4 } from 'uuid';
import {
  SceneSchedule,
  CostumeItem,
  WashRecord,
  AlterationRecord,
  ReferencePhoto,
  RiskItem,
  RiskType,
} from '../shared/types';

interface RiskContext {
  scenes: SceneSchedule[];
  costumes: CostumeItem[];
  washRecords: WashRecord[];
  alterationRecords: AlterationRecord[];
  photos: ReferencePhoto[];
  today: string;
}

type RiskDetector = (context: RiskContext) => RiskItem[];

export class RiskEngine {
  private detectors: RiskDetector[] = [
    this.detectMissingItems.bind(this),
    this.detectWashConflicts.bind(this),
    this.detectSizeUnconfirmed.bind(this),
    this.detectPhotoMismatch.bind(this),
    this.detectAlterationDelay.bind(this),
  ];

  analyze(
    scenes: SceneSchedule[],
    costumes: CostumeItem[],
    washRecords: WashRecord[],
    alterationRecords: AlterationRecord[],
    photos: ReferencePhoto[]
  ): RiskItem[] {
    const context: RiskContext = {
      scenes,
      costumes,
      washRecords,
      alterationRecords,
      photos,
      today: new Date().toISOString().split('T')[0],
    };

    const allRisks: RiskItem[] = [];
    for (const detector of this.detectors) {
      const risks = detector(context);
      allRisks.push(...risks);
    }

    return allRisks;
  }

  private createRisk(
    type: RiskType,
    severity: 'high' | 'medium' | 'low',
    title: string,
    description: string,
    extra: Partial<RiskItem> = {}
  ): RiskItem {
    const now = new Date().toISOString();
    return {
      id: uuidv4(),
      type,
      severity,
      title,
      description,
      isResolved: false,
      createdAt: now,
      updatedAt: now,
      ...extra,
    };
  }

  // 检测缺件：某场次需要的服装不存在或状态异常
  private detectMissingItems(context: RiskContext): RiskItem[] {
    const risks: RiskItem[] = [];
    const { scenes, costumes } = context;

    // 构建 barcode -> costume 的映射
    const costumeMap = new Map<string, CostumeItem>();
    costumes.forEach((c) => costumeMap.set(c.barcode, c));

    // 按日期排序场次，优先检测近期的
    const sortedScenes = [...scenes].sort((a, b) => 
      a.shootDate.localeCompare(b.shootDate)
    );

    for (const scene of sortedScenes) {
      const daysUntilShoot = this.daysBetween(context.today, scene.shootDate);
      
      // 只检测未来7天内和过去的场次（问题可能已存在）
      if (daysUntilShoot > 7 && daysUntilShoot > 0) continue;

      // 构建该场景每个角色应该有的服装
      // 这里假设从 costumes 中的 scenes 字段来判断
      const sceneCostumes = costumes.filter((c) => 
        c.scenes.includes(scene.sceneNumber)
      );

      // 检查每个角色在该场景中是否有服装
      for (const character of scene.characters) {
        const characterCostumes = sceneCostumes.filter((c) => c.character === character);
        
        if (characterCostumes.length === 0) {
          risks.push(this.createRisk(
            'missing_item',
            daysUntilShoot <= 0 ? 'high' : daysUntilShoot <= 2 ? 'high' : 'medium',
            `${scene.sceneNumber}场 ${character} 缺服装`,
            `场次 ${scene.sceneNumber}(${scene.shootDate}) 需要角色 ${character} 的服装，但未找到匹配的服装记录。`,
            {
              sceneNumber: scene.sceneNumber,
              character,
              affectedDate: scene.shootDate,
            }
          ));
        }

        // 检查服装状态
        for (const costume of characterCostumes) {
          if (['lost'].includes(costume.status)) {
            risks.push(this.createRisk(
              'missing_item',
              'high',
              `${costume.barcode} ${costume.itemName} 丢失`,
              `服装 ${costume.barcode}(${costume.itemName}) 状态为丢失，需要用于场次 ${scene.sceneNumber}(${scene.shootDate})。`,
              {
                sceneNumber: scene.sceneNumber,
                character,
                barcode: costume.barcode,
                costumeId: costume.id,
                affectedDate: scene.shootDate,
              }
            ));
          }
        }
      }
    }

    return risks;
  }

  // 检测清洗冲突：某场次拍摄时服装还在清洗中
  private detectWashConflicts(context: RiskContext): RiskItem[] {
    const risks: RiskItem[] = [];
    const { scenes, costumes, washRecords } = context;

    // 构建 barcode -> costume 的映射
    const costumeMap = new Map<string, CostumeItem>();
    costumes.forEach((c) => costumeMap.set(c.barcode, c));

    // 找出未完成的清洗记录
    const activeWashes = washRecords.filter((w) => 
      ['pending', 'in_progress'].includes(w.status)
    );

    for (const wash of activeWashes) {
      const costume = costumeMap.get(wash.barcode);
      if (!costume) continue;

      // 找到该服装需要使用的场次
      const affectedScenes = scenes.filter((s) => 
        costume.scenes.includes(s.sceneNumber)
      );

      for (const scene of affectedScenes) {
        const shootDate = scene.shootDate;
        
        // 如果没有预计归还日期，或者预计归还日期晚于拍摄日期
        if (!wash.expectedReturnDate || wash.expectedReturnDate > shootDate) {
          const daysUntilShoot = this.daysBetween(context.today, shootDate);
          
          risks.push(this.createRisk(
            'wash_conflict',
            daysUntilShoot <= 2 ? 'high' : 'medium',
            `${costume.barcode} 清洗冲突`,
            `服装 ${costume.barcode}(${costume.itemName}) 正在清洗中。` +
            (wash.expectedReturnDate 
              ? `预计归还日期 ${wash.expectedReturnDate}，但场次 ${scene.sceneNumber}(${shootDate}) 需要在 ${shootDate} 使用。`
              : `暂无预计归还日期，场次 ${scene.sceneNumber}(${shootDate}) 需要在 ${shootDate} 使用。`),
            {
              sceneNumber: scene.sceneNumber,
              character: costume.character,
              barcode: costume.barcode,
              costumeId: costume.id,
              affectedDate: shootDate,
            }
          ));
        }
      }
    }

    return risks;
  }

  // 检测尺码未确认：改衣记录未确认，且需要用于近期场次
  private detectSizeUnconfirmed(context: RiskContext): RiskItem[] {
    const risks: RiskItem[] = [];
    const { scenes, costumes, alterationRecords } = context;

    // 构建 barcode -> costume 的映射
    const costumeMap = new Map<string, CostumeItem>();
    costumes.forEach((c) => costumeMap.set(c.barcode, c));

    // 找出未确认的改衣记录
    const unconfirmedAlterations = alterationRecords.filter((a) => !a.isConfirmed);

    for (const alteration of unconfirmedAlterations) {
      const costume = costumeMap.get(alteration.barcode);
      if (!costume) continue;

      // 找到该服装需要使用的场次
      const affectedScenes = scenes.filter((s) => 
        costume.scenes.includes(s.sceneNumber)
      );

      for (const scene of affectedScenes) {
        const daysUntilShoot = this.daysBetween(context.today, scene.shootDate);
        
        if (daysUntilShoot > 7) continue;

        risks.push(this.createRisk(
          'size_unconfirmed',
          daysUntilShoot <= 2 ? 'high' : 'medium',
          `${costume.barcode} 尺码改动未确认`,
          `服装 ${costume.barcode}(${costume.itemName}) 的尺码改动尚未确认。` +
          `当前尺码: ${alteration.currentSize || '未知'} → 目标尺码: ${alteration.targetSize || '未知'}。` +
          `该服装需要用于场次 ${scene.sceneNumber}(${scene.shootDate})，距离拍摄还有 ${Math.max(0, daysUntilShoot)} 天。`,
          {
            sceneNumber: scene.sceneNumber,
            character: costume.character,
            barcode: costume.barcode,
            costumeId: costume.id,
            affectedDate: scene.shootDate,
          }
        ));
      }
    }

    return risks;
  }

  // 检测照片编号不匹配：场次表中的服装与照片编号对应不上
  private detectPhotoMismatch(context: RiskContext): RiskItem[] {
    const risks: RiskItem[] = [];
    const { scenes, costumes, photos } = context;

    // 构建 barcode -> 照片列表 的映射
    const photoMap = new Map<string, ReferencePhoto[]>();
    photos.forEach((p) => {
      if (p.barcode) {
        const existing = photoMap.get(p.barcode) || [];
        existing.push(p);
        photoMap.set(p.barcode, existing);
      }
    });

    // 检查每个服装是否有对应的连续性照片
    for (const costume of costumes) {
      const costumePhotos = photoMap.get(costume.barcode) || [];
      const continuityPhotos = costumePhotos.filter((p) => p.photoType === 'continuity');

      // 找到该服装需要使用的场次
      const affectedScenes = scenes.filter((s) => 
        costume.scenes.includes(s.sceneNumber)
      );

      if (affectedScenes.length === 0) continue;

      if (continuityPhotos.length === 0) {
        // 检查最近的场次
        const upcomingScenes = affectedScenes
          .filter((s) => this.daysBetween(context.today, s.shootDate) <= 7)
          .sort((a, b) => a.shootDate.localeCompare(b.shootDate));

        if (upcomingScenes.length > 0) {
          const nextScene = upcomingScenes[0];
          const daysUntilShoot = this.daysBetween(context.today, nextScene.shootDate);

          risks.push(this.createRisk(
            'photo_mismatch',
            daysUntilShoot <= 3 ? 'high' : 'low',
            `${costume.barcode} 缺少连续性照片`,
            `服装 ${costume.barcode}(${costume.itemName} - ${costume.character}) ` +
            `没有对应的连续性照片。该服装需要用于场次 ${nextScene.sceneNumber}(${nextScene.shootDate})。`,
            {
              sceneNumber: nextScene.sceneNumber,
              character: costume.character,
              barcode: costume.barcode,
              costumeId: costume.id,
              affectedDate: nextScene.shootDate,
            }
          ));
        }
      } else {
        // 检查照片是否与所有场次匹配
        for (const scene of affectedScenes) {
          const scenePhotos = continuityPhotos.filter((p) => 
            p.sceneNumber === scene.sceneNumber
          );

          if (scenePhotos.length === 0) {
            const daysUntilShoot = this.daysBetween(context.today, scene.shootDate);
            if (daysUntilShoot <= 7) {
              risks.push(this.createRisk(
                'photo_mismatch',
                daysUntilShoot <= 3 ? 'medium' : 'low',
                `${scene.sceneNumber}场 ${costume.barcode} 照片缺失`,
                `服装 ${costume.barcode}(${costume.itemName}) 有连续性照片，` +
                `但没有场次 ${scene.sceneNumber}(${scene.shootDate}) 的对应照片。`,
                {
                  sceneNumber: scene.sceneNumber,
                  character: costume.character,
                  barcode: costume.barcode,
                  costumeId: costume.id,
                  affectedDate: scene.shootDate,
                }
              ));
            }
          }
        }
      }
    }

    return risks;
  }

  // 检测改衣延迟：改衣记录预计完成日期已过但未完成
  private detectAlterationDelay(context: RiskContext): RiskItem[] {
    const risks: RiskItem[] = [];
    const { scenes, costumes, alterationRecords } = context;

    // 构建 barcode -> costume 的映射
    const costumeMap = new Map<string, CostumeItem>();
    costumes.forEach((c) => costumeMap.set(c.barcode, c));

    // 找出未完成且已延迟的改衣记录
    const delayedAlterations = alterationRecords.filter((a) => {
      if (['completed'].includes(a.status)) return false;
      if (!a.expectedCompletion) return false;
      return a.expectedCompletion < context.today;
    });

    for (const alteration of delayedAlterations) {
      const costume = costumeMap.get(alteration.barcode);
      if (!costume) continue;

      // 找到该服装需要使用的场次
      const affectedScenes = scenes.filter((s) => 
        costume.scenes.includes(s.sceneNumber)
      );

      for (const scene of affectedScenes) {
        const daysUntilShoot = this.daysBetween(context.today, scene.shootDate);
        const daysDelayed = this.daysBetween(alteration.expectedCompletion!, context.today);

        risks.push(this.createRisk(
          'alteration_delay',
          daysUntilShoot <= 2 ? 'high' : 'medium',
          `${costume.barcode} 改衣延迟 ${daysDelayed} 天`,
          `服装 ${costume.barcode}(${costume.itemName}) 的改衣工作预计于 ${alteration.expectedCompletion} 完成，` +
          `但至今已延迟 ${daysDelayed} 天。该服装需要用于场次 ${scene.sceneNumber}(${scene.shootDate})，` +
          `距离拍摄还有 ${Math.max(0, daysUntilShoot)} 天。`,
          {
            sceneNumber: scene.sceneNumber,
            character: costume.character,
            barcode: costume.barcode,
            costumeId: costume.id,
            affectedDate: scene.shootDate,
          }
        ));
      }
    }

    return risks;
  }

  private daysBetween(date1: string, date2: string): number {
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffTime = d2.getTime() - d1.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}

export const riskEngine = new RiskEngine();

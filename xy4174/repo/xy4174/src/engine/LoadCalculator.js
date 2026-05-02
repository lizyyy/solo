import { Vector3, LoadResult, sceneManager } from '../models/SceneModel.js';

class LoadCalculator {
  constructor() {
    this.lastResult = null;
  }

  calculate(scene = null) {
    const targetScene = scene || sceneManager.currentScene;
    const result = new LoadResult();

    for (const point of targetScene.hangingPoints) {
      result.hangingPointLoads[point.id] = {
        id: point.id,
        name: point.name,
        load: 0,
        maxSafeLoad: point.getMaxSafeLoad(),
        maxLoad: point.maxLoad,
        percentage: 0,
        isOverloaded: false
      };
    }

    let totalWeight = 0;
    let weightedPosition = new Vector3(0, 0, 0);

    for (const truss of targetScene.trusses) {
      const trussResult = this.calculateTrussLoads(truss, targetScene);
      
      totalWeight += trussResult.totalWeight;
      
      if (trussResult.totalWeight > 0) {
        const weightedTrussPos = truss.position.multiply(trussResult.totalWeight);
        weightedPosition = weightedPosition.add(weightedTrussPos);
      }

      for (const pointId in trussResult.pointLoads) {
        if (result.hangingPointLoads[pointId]) {
          result.hangingPointLoads[pointId].load += trussResult.pointLoads[pointId];
        }
      }
    }

    for (const cw of targetScene.counterweights) {
      totalWeight += cw.weight;
      const weightedCwPos = cw.position.multiply(cw.weight);
      weightedPosition = weightedPosition.add(weightedCwPos);
    }

    result.totalWeight = totalWeight;

    if (totalWeight > 0) {
      result.centerOfGravity = weightedPosition.multiply(1 / totalWeight);
    }

    for (const pointId in result.hangingPointLoads) {
      const loadInfo = result.hangingPointLoads[pointId];
      const point = targetScene.getHangingPointById(pointId);
      
      if (point) {
        point.currentLoad = loadInfo.load;
      }
      
      if (loadInfo.maxSafeLoad > 0) {
        loadInfo.percentage = (loadInfo.load / loadInfo.maxSafeLoad) * 100;
      }
      
      loadInfo.isOverloaded = loadInfo.load > loadInfo.maxSafeLoad;

      if (loadInfo.isOverloaded) {
        result.addError(
          `吊点 "${loadInfo.name}" 超载: ${loadInfo.load.toFixed(1)}kg / ${loadInfo.maxSafeLoad.toFixed(1)}kg (${loadInfo.percentage.toFixed(1)}%)`,
          pointId
        );
      } else if (loadInfo.percentage > 80) {
        result.addWarning(
          `吊点 "${loadInfo.name}" 载荷超过80%: ${loadInfo.load.toFixed(1)}kg / ${loadInfo.maxSafeLoad.toFixed(1)}kg (${loadInfo.percentage.toFixed(1)}%)`,
          pointId
        );
      }
    }

    this.checkBalance(result, targetScene);
    this.lastResult = result;
    targetScene.loadResult = result;

    return result;
  }

  calculateTrussLoads(truss, scene) {
    const result = {
      totalWeight: 0,
      pointLoads: {}
    };

    const trussWeight = truss.weightPerMeter * truss.length;
    result.totalWeight = trussWeight;

    const devicePositions = [];
    for (const deviceId of truss.devices) {
      const device = scene.getDeviceById(deviceId);
      if (device) {
        result.totalWeight += device.weight;
        
        const relativeX = device.position.x - truss.position.x;
        devicePositions.push({
          weight: device.weight,
          relativeX: relativeX
        });
      }
    }

    const hangingPoints = [];
    for (const pointId of truss.hangingPoints) {
      const point = scene.getHangingPointById(pointId);
      if (point) {
        const relativeX = point.position.x - truss.position.x;
        hangingPoints.push({
          id: pointId,
          relativeX: relativeX,
          position: point.position.clone()
        });
      }
    }

    if (hangingPoints.length === 0) {
      return result;
    }

    hangingPoints.sort((a, b) => a.relativeX - b.relativeX);

    if (hangingPoints.length === 1) {
      result.pointLoads[hangingPoints[0].id] = result.totalWeight;
    } else if (hangingPoints.length === 2) {
      const p1 = hangingPoints[0];
      const p2 = hangingPoints[1];
      const span = p2.relativeX - p1.relativeX;

      if (span <= 0) {
        result.pointLoads[p1.id] = result.totalWeight / 2;
        result.pointLoads[p2.id] = result.totalWeight / 2;
      } else {
        const trussLeft = truss.position.x - truss.length / 2;
        const trussRight = truss.position.x + truss.length / 2;
        
        const trussCOG = (trussLeft + trussRight) / 2;
        let totalMoment = (trussCOG - truss.position.x) * trussWeight;
        
        for (const dev of devicePositions) {
          totalMoment += dev.relativeX * dev.weight;
        }

        const load2 = totalMoment / span;
        const load1 = result.totalWeight - load2;

        result.pointLoads[p1.id] = Math.max(0, load1);
        result.pointLoads[p2.id] = Math.max(0, load2);
      }
    } else {
      const avgLoad = result.totalWeight / hangingPoints.length;
      for (const point of hangingPoints) {
        result.pointLoads[point.id] = avgLoad;
      }
    }

    return result;
  }

  checkBalance(result, scene) {
    const stage = scene.stage;
    const cog = result.centerOfGravity;

    const stageCenterX = stage.position.x;
    const stageCenterZ = stage.position.z;

    const offsetX = cog.x - stageCenterX;
    const offsetZ = cog.z - stageCenterZ;

    const maxAllowedOffsetX = stage.width * 0.25;
    const maxAllowedOffsetZ = stage.depth * 0.25;

    if (Math.abs(offsetX) > maxAllowedOffsetX || Math.abs(offsetZ) > maxAllowedOffsetZ) {
      result.addError(
        `重心偏移超过允许范围: X方向偏移${offsetX > 0 ? '+' : ''}${offsetX.toFixed(2)}m, Z方向偏移${offsetZ > 0 ? '+' : ''}${offsetZ.toFixed(2)}m`,
        null
      );
      result.isBalanced = false;
    } else if (Math.abs(offsetX) > maxAllowedOffsetX * 0.5 || Math.abs(offsetZ) > maxAllowedOffsetZ * 0.5) {
      result.addWarning(
        `重心偏移接近限制: X方向偏移${offsetX > 0 ? '+' : ''}${offsetX.toFixed(2)}m, Z方向偏移${offsetZ > 0 ? '+' : ''}${offsetZ.toFixed(2)}m`,
        null
      );
    }

    this.checkSinglePointLoads(result, scene);
  }

  checkSinglePointLoads(result, scene) {
    for (const truss of scene.trusses) {
      if (truss.hangingPoints.length === 0) {
        result.addWarning(
          `桁架 "${truss.name}" 没有连接任何吊点`,
          truss.id
        );
      } else if (truss.hangingPoints.length === 1) {
        const point = scene.getHangingPointById(truss.hangingPoints[0]);
        if (point && truss.getTotalWeight() > 100) {
          result.addWarning(
            `桁架 "${truss.name}" 仅使用单点吊装 (${point.name})，建议至少2点吊装`,
            truss.id
          );
        }
      }
    }
  }

  suggestCounterweights(scene = null) {
    const targetScene = scene || sceneManager.currentScene;
    const suggestions = [];

    const loadResult = this.calculate(targetScene);
    
    if (!loadResult.isBalanced || loadResult.hasIssues()) {
      const cog = loadResult.centerOfGravity;
      const stage = targetScene.stage;
      
      const stageCenterX = stage.position.x;
      const stageCenterZ = stage.position.z;
      
      const offsetX = cog.x - stageCenterX;
      const offsetZ = cog.z - stageCenterZ;
      
      if (Math.abs(offsetX) > 0.5 || Math.abs(offsetZ) > 0.5) {
        const suggestedX = -offsetX * 2;
        const suggestedZ = -offsetZ * 2;
        
        const suggestedWeight = Math.min(
          loadResult.totalWeight * 0.15,
          Math.abs(offsetX) * 100 + Math.abs(offsetZ) * 100
        );

        if (suggestedWeight > 10) {
          suggestions.push({
            type: 'counterweight',
            position: new Vector3(
              stageCenterX + suggestedX,
              cog.y,
              stageCenterZ + suggestedZ
            ),
            weight: Math.round(suggestedWeight),
            reason: `平衡重心偏移: 当前重心位于(${cog.x.toFixed(2)}, ${cog.z.toFixed(2)})，偏离中心`,
            estimatedEffect: `预计可将重心偏移减少约${Math.min(80, Math.round(Math.abs(offsetX) + Math.abs(offsetZ)) * 10)}%`
          });
        }
      }
    }

    for (const pointId in loadResult.hangingPointLoads) {
      const loadInfo = loadResult.hangingPointLoads[pointId];
      if (loadInfo.isOverloaded) {
        const point = targetScene.getHangingPointById(pointId);
        if (point) {
          const excessLoad = loadInfo.load - loadInfo.maxSafeLoad;
          
          suggestions.push({
            type: 'redistribute',
            targetPointId: pointId,
            targetPointName: loadInfo.name,
            excessLoad: excessLoad,
            currentLoad: loadInfo.load,
            maxSafeLoad: loadInfo.maxSafeLoad,
            reason: `吊点超载 ${excessLoad.toFixed(1)}kg`,
            action: '建议减少该吊点承载的设备重量，或增加额外吊点分担载荷'
          });
        }
      }
    }

    for (const truss of targetScene.trusses) {
      if (truss.hangingPoints.length === 1) {
        const totalWeight = truss.getTotalWeight();
        if (totalWeight > 50) {
          suggestions.push({
            type: 'additional_hanging_point',
            targetTrussId: truss.id,
            targetTrussName: truss.name,
            currentPoints: 1,
            suggestedPoints: 2,
            reason: `桁架 "${truss.name}" 重${totalWeight.toFixed(1)}kg，仅使用单点吊装`,
            action: '建议增加至少1个吊点，采用两点吊装以提高安全性'
          });
        }
      }
    }

    return suggestions;
  }

  getLoadDistributionSummary(scene = null) {
    const targetScene = scene || sceneManager.currentScene;
    const result = this.calculate(targetScene);

    const summary = {
      totalWeight: result.totalWeight,
      centerOfGravity: result.centerOfGravity.toJSON(),
      isBalanced: result.isBalanced,
      hangingPoints: [],
      warnings: result.warnings,
      errors: result.errors,
      suggestions: this.suggestCounterweights(targetScene)
    };

    for (const pointId in result.hangingPointLoads) {
      const loadInfo = result.hangingPointLoads[pointId];
      const point = targetScene.getHangingPointById(pointId);
      
      summary.hangingPoints.push({
        id: pointId,
        name: loadInfo.name,
        currentLoad: loadInfo.load,
        maxSafeLoad: loadInfo.maxSafeLoad,
        maxLoad: loadInfo.maxLoad,
        percentage: loadInfo.percentage,
        isOverloaded: loadInfo.isOverloaded,
        position: point ? point.position.toJSON() : null,
        motorType: point ? point.motorType : 'unknown'
      });
    }

    return summary;
  }
}

const loadCalculator = new LoadCalculator();

export {
  LoadCalculator,
  loadCalculator
};

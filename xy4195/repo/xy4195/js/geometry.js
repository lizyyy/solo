// 几何计算核心模块
const Geometry = {
    // 计算灯束形状
    calculateLightBeam: function(light, viewMode = 'plan') {
        // 灯的位置和角度
        const { position, angle, beamAngle, intensity } = light;
        
        // 光束角转换为弧度
        const beamHalfAngleRad = Utils.degToRad(beamAngle / 2);
        
        // 根据视图模式计算不同的投影
        if (viewMode === 'plan') {
            // 平面图：从上往下看，忽略Z轴高度
            return this.calculatePlanViewBeam(light);
        } else {
            // 侧视图：从侧面看，通常是X-Z平面
            return this.calculateSectionViewBeam(light);
        }
    },
    
    // 计算平面图中的灯束
    calculatePlanViewBeam: function(light) {
        const { position, angle, beamAngle } = light;
        const beamHalfAngleRad = Utils.degToRad(beamAngle / 2);
        
        // 主方向角（y轴角度）
        const mainAngleRad = Utils.degToRad(angle.y);
        
        // 计算光束的两个边界方向
        const leftAngleRad = mainAngleRad - beamHalfAngleRad;
        const rightAngleRad = mainAngleRad + beamHalfAngleRad;
        
        // 光束的最大投射距离（根据灯的高度和角度计算）
        // 假设投射到地面/展柜表面
        const maxDistance = this.calculateBeamLength(light);
        
        // 计算光束在平面上的多边形
        const origin = { x: position.x, y: position.y };
        
        // 左边界点
        const leftPoint = {
            x: origin.x + Math.cos(leftAngleRad) * maxDistance,
            y: origin.y + Math.sin(leftAngleRad) * maxDistance
        };
        
        // 右边界点
        const rightPoint = {
            x: origin.x + Math.cos(rightAngleRad) * maxDistance,
            y: origin.y + Math.sin(rightAngleRad) * maxDistance
        };
        
        // 光束在特定距离处的宽度
        const beamWidth = 2 * maxDistance * Math.tan(beamHalfAngleRad);
        
        return {
            origin: origin,
            leftPoint: leftPoint,
            rightPoint: rightPoint,
            maxDistance: maxDistance,
            beamWidth: beamWidth,
            mainAngle: angle.y,
            beamHalfAngle: beamAngle / 2,
            polygon: [origin, leftPoint, rightPoint]
        };
    },
    
    // 计算侧视图中的灯束
    calculateSectionViewBeam: function(light) {
        const { position, angle, beamAngle } = light;
        const beamHalfAngleRad = Utils.degToRad(beamAngle / 2);
        
        // 侧视图中，主要考虑X-Z平面
        // angle.x 是倾斜角（相对于水平面的角度）
        const tiltAngleRad = Utils.degToRad(angle.x);
        
        // 计算光束的上下边界
        const topAngleRad = tiltAngleRad + beamHalfAngleRad;
        const bottomAngleRad = tiltAngleRad - beamHalfAngleRad;
        
        // 最大投射距离
        const maxDistance = this.calculateBeamLength(light);
        
        // 原点（灯的位置在侧视图中）
        // 侧视图中，我们通常以展柜的某个截面来展示
        // 这里简化处理，假设展示的是 X-Z 平面
        const origin = { x: position.x, y: position.z };
        
        // 上边界点
        const topPoint = {
            x: origin.x + Math.cos(topAngleRad) * maxDistance,
            y: origin.y - Math.sin(topAngleRad) * maxDistance // Y轴向下为正
        };
        
        // 下边界点
        const bottomPoint = {
            x: origin.x + Math.cos(bottomAngleRad) * maxDistance,
            y: origin.y - Math.sin(bottomAngleRad) * maxDistance
        };
        
        return {
            origin: origin,
            topPoint: topPoint,
            bottomPoint: bottomPoint,
            maxDistance: maxDistance,
            tiltAngle: angle.x,
            beamHalfAngle: beamAngle / 2,
            polygon: [origin, topPoint, bottomPoint]
        };
    },
    
    // 计算光束的有效长度
    calculateBeamLength: function(light) {
        // 根据灯的高度和角度计算光束长度
        // 假设光束投射到地面或展柜表面
        const { position, angle } = light;
        
        // 如果灯在展柜内部或上方，计算到展柜底部/表面的距离
        // 这里简化处理，返回一个基于高度和角度的计算值
        const tiltAngleRad = Utils.degToRad(angle.x);
        
        // 灯的高度（z坐标）
        const lightHeight = position.z;
        
        // 如果灯朝下，计算到地面的距离
        if (angle.x < 90) {
            // 倾斜角越小（越水平），光束越长
            const horizontalFactor = Math.cos(tiltAngleRad);
            const baseLength = lightHeight / Math.sin(tiltAngleRad || 0.01);
            return Math.max(baseLength, 2); // 最小2米
        }
        
        return 5; // 默认5米
    },
    
    // 计算照度在某点的数值
    calculateIlluminance: function(light, targetPoint) {
        // 简单的照度计算模型
        // E = I * cos(theta) / r^2
        // 其中 I 是光强，theta 是入射角，r 是距离
        
        const { position, intensity, beamAngle, angle } = light;
        
        // 计算距离
        const distance = Utils.distance(
            position.x, position.y,
            targetPoint.x, targetPoint.y
        );
        
        // 计算灯到目标点的实际3D距离
        const distance3D = Math.sqrt(
            Math.pow(targetPoint.x - position.x, 2) +
            Math.pow(targetPoint.y - position.y, 2) +
            Math.pow((targetPoint.z || 0) - position.z, 2)
        );
        
        // 计算光束主方向与目标点的夹角
        const mainAngleRad = Utils.degToRad(angle.y);
        const targetAngleRad = Utils.angle(
            position.x, position.y,
            targetPoint.x, targetPoint.y
        );
        
        const angleDiff = Math.abs(targetAngleRad - mainAngleRad);
        
        // 检查目标点是否在光束范围内
        const beamHalfAngleRad = Utils.degToRad(beamAngle / 2);
        if (angleDiff > beamHalfAngleRad) {
            return 0; // 不在光束范围内
        }
        
        // 计算入射角（考虑Z轴）
        const tiltAngleRad = Utils.degToRad(angle.x);
        const verticalAngle = Math.atan2(
            (targetPoint.z || 0) - position.z,
            distance
        );
        const verticalAngleDiff = Math.abs(verticalAngle - (Math.PI / 2 - tiltAngleRad));
        
        if (verticalAngleDiff > beamHalfAngleRad) {
            return 0;
        }
        
        // 计算衰减因子（光束边缘衰减）
        const horizontalFactor = Math.cos(angleDiff / beamHalfAngleRad * Math.PI / 2);
        const verticalFactor = Math.cos(verticalAngleDiff / beamHalfAngleRad * Math.PI / 2);
        const beamFactor = horizontalFactor * verticalFactor;
        
        // 计算入射角余弦
        const incidenceAngle = Math.PI / 2 - tiltAngleRad;
        const cosIncidence = Math.cos(incidenceAngle);
        
        // 计算照度
        const illuminance = (intensity * cosIncidence * beamFactor) / 
                           Math.max(Math.pow(distance3D, 2), 0.01);
        
        return Math.max(illuminance, 0);
    },
    
    // 计算眩光风险
    calculateGlareRisk: function(light, displayCase, viewerPosition) {
        // 眩光风险评估
        // 考虑因素：
        // 1. 灯的亮度
        // 2. 灯与观察者的角度
        // 3. 玻璃反射
        // 4. 周围环境亮度
        
        const risks = [];
        
        // 检查直接眩光
        const directGlare = this.checkDirectGlare(light, viewerPosition);
        if (directGlare) {
            risks.push({
                type: 'direct',
                severity: directGlare.severity,
                description: directGlare.description,
                lightId: light.id
            });
        }
        
        // 检查反射眩光（玻璃反射）
        const reflectionGlare = this.checkReflectionGlare(light, displayCase, viewerPosition);
        if (reflectionGlare) {
            risks.push({
                type: 'reflection',
                severity: reflectionGlare.severity,
                description: reflectionGlare.description,
                lightId: light.id,
                caseId: displayCase.id
            });
        }
        
        return risks;
    },
    
    // 检查直接眩光
    checkDirectGlare: function(light, viewerPosition) {
        // 计算灯到观察者的角度
        const angleToViewer = Utils.angle(
            light.position.x, light.position.y,
            viewerPosition.x, viewerPosition.y
        );
        
        // 灯的主照射方向
        const mainAngleRad = Utils.degToRad(light.angle.y);
        
        // 计算角度差
        let angleDiff = Math.abs(angleToViewer - mainAngleRad);
        if (angleDiff > Math.PI) {
            angleDiff = 2 * Math.PI - angleDiff;
        }
        
        // 计算垂直角度
        const verticalAngle = Math.atan2(
            viewerPosition.z - light.position.z,
            Utils.distance(light.position.x, light.position.y, 
                          viewerPosition.x, viewerPosition.y)
        );
        
        const tiltAngleRad = Utils.degToRad(light.angle.x);
        const verticalAngleDiff = Math.abs(verticalAngle - (Math.PI / 2 - tiltAngleRad));
        
        // 计算距离
        const distance = Math.sqrt(
            Math.pow(viewerPosition.x - light.position.x, 2) +
            Math.pow(viewerPosition.y - light.position.y, 2) +
            Math.pow(viewerPosition.z - light.position.z, 2)
        );
        
        // 评估眩光风险
        // 基于 UGR (Unified Glare Rating) 简化模型
        const beamHalfAngleRad = Utils.degToRad(light.beamAngle / 2);
        
        // 如果观察者在光束范围内
        const inBeam = angleDiff < beamHalfAngleRad && verticalAngleDiff < beamHalfAngleRad;
        
        if (inBeam && distance < 5) {
            // 计算亮度
            const luminance = light.intensity / Math.max(distance * distance, 0.1);
            
            if (luminance > 500) {
                return {
                    severity: 'high',
                    description: `灯具 ${light.id} 直接照射观众，可能造成严重眩光`
                };
            } else if (luminance > 200) {
                return {
                    severity: 'medium',
                    description: `灯具 ${light.id} 可能造成中度眩光`
                };
            }
        }
        
        // 检查是否在视野范围内但不在光束中心
        const fieldOfViewAngle = Utils.degToRad(60); // 人眼视野约60度
        if (angleDiff < fieldOfViewAngle && distance < 8) {
            const edgeFactor = 1 - (angleDiff / fieldOfViewAngle);
            const luminance = light.intensity * edgeFactor / Math.max(distance * distance, 0.1);
            
            if (luminance > 100) {
                return {
                    severity: 'low',
                    description: `灯具 ${light.id} 在视野边缘，可能造成轻微不适`
                };
            }
        }
        
        return null;
    },
    
    // 检查反射眩光
    checkReflectionGlare: function(light, displayCase, viewerPosition) {
        if (!displayCase.glass || !displayCase.glass.front) {
            return null;
        }
        
        // 计算灯在玻璃上的反射点
        const reflectionPoint = this.calculateReflectionPoint(
            light.position,
            viewerPosition,
            displayCase
        );
        
        if (!reflectionPoint) {
            return null;
        }
        
        // 检查反射点是否在玻璃范围内
        const glassBounds = this.getGlassBounds(displayCase);
        const onGlass = Utils.pointInRect(
            reflectionPoint.x, reflectionPoint.y,
            glassBounds.x, glassBounds.y,
            glassBounds.width, glassBounds.height
        );
        
        if (!onGlass) {
            return null;
        }
        
        // 计算反射光强度
        const reflectivity = displayCase.glass.reflectivity || 0.08;
        const lightToGlass = Utils.distance(
            light.position.x, light.position.y,
            reflectionPoint.x, reflectionPoint.y
        );
        const glassToViewer = Utils.distance(
            reflectionPoint.x, reflectionPoint.y,
            viewerPosition.x, viewerPosition.y
        );
        
        const totalDistance = lightToGlass + glassToViewer;
        const reflectedIntensity = light.intensity * reflectivity / 
                                   Math.max(totalDistance * totalDistance, 0.1);
        
        // 评估反射眩光风险
        if (reflectedIntensity > 300) {
            return {
                severity: 'high',
                description: `展柜 ${displayCase.id} 玻璃反射灯具 ${light.id} 的光线，可能严重遮挡文物视线`
            };
        } else if (reflectedIntensity > 100) {
            return {
                severity: 'medium',
                description: `展柜 ${displayCase.id} 玻璃反射灯具 ${light.id} 的光线，可能影响观赏`
            };
        } else if (reflectedIntensity > 50) {
            return {
                severity: 'low',
                description: `展柜 ${displayCase.id} 有轻微玻璃反射`
            };
        }
        
        return null;
    },
    
    // 计算反射点
    calculateReflectionPoint: function(lightPos, viewerPos, displayCase) {
        // 简化的反射点计算
        // 假设玻璃是展柜的前表面
        const glassX = displayCase.position.x;
        const glassY = displayCase.position.y;
        const glassWidth = displayCase.width;
        const glassHeight = displayCase.height;
        
        // 找到灯相对于玻璃的镜像点
        const mirrorLightPos = {
            x: 2 * glassX - lightPos.x,
            y: lightPos.y,
            z: lightPos.z
        };
        
        // 计算镜像点到观察者的线与玻璃的交点
        const intersection = Utils.lineIntersection(
            mirrorLightPos.x, mirrorLightPos.y,
            viewerPos.x, viewerPos.y,
            glassX, glassY,
            glassX + glassWidth, glassY
        );
        
        return intersection;
    },
    
    // 获取玻璃边界
    getGlassBounds: function(displayCase) {
        // 简化：假设玻璃在展柜前面
        return {
            x: displayCase.position.x,
            y: displayCase.position.y,
            width: displayCase.width,
            height: displayCase.height
        };
    },
    
    // 计算说明牌可见区
    calculateInfoPanelVisibility: function(displayCase, viewerPaths) {
        const visibilityZones = [];
        const infoPanel = displayCase.infoPanel;
        
        if (!infoPanel) {
            return visibilityZones;
        }
        
        // 说明牌位置（展柜坐标系转世界坐标系）
        const panelWorldX = displayCase.position.x + infoPanel.position.x;
        const panelWorldY = displayCase.position.y + infoPanel.position.y;
        
        // 检查每条动线的可见性
        for (const path of viewerPaths) {
            const pathVisibility = {
                pathId: path.id,
                visiblePoints: [],
                blockedPoints: [],
                visibilityRatio: 0
            };
            
            for (const point of path.points) {
                const isVisible = this.checkPointToPanelVisibility(
                    point, 
                    { x: panelWorldX, y: panelWorldY, z: infoPanel.position.z || 1.0 },
                    displayCase
                );
                
                if (isVisible) {
                    pathVisibility.visiblePoints.push(point);
                } else {
                    pathVisibility.blockedPoints.push(point);
                }
            }
            
            pathVisibility.visibilityRatio = 
                pathVisibility.visiblePoints.length / Math.max(path.points.length, 1);
            
            visibilityZones.push(pathVisibility);
        }
        
        return visibilityZones;
    },
    
    // 检查从某个点是否能看到说明牌
    checkPointToPanelVisibility: function(viewerPoint, panelPoint, displayCase) {
        // 简化的可见性检查
        // 检查视线是否被展柜其他部分阻挡
        // 这里简化处理：主要检查距离和角度
        
        // 计算距离
        const distance = Utils.distance(
            viewerPoint.x, viewerPoint.y,
            panelPoint.x, panelPoint.y
        );
        
        // 太远看不见
        if (distance > 10) {
            return false;
        }
        
        // 计算视角
        const viewAngle = Utils.angle(
            viewerPoint.x, viewerPoint.y,
            panelPoint.x, panelPoint.y
        );
        
        // 假设人眼舒适视角为±30度
        const comfortableAngle = Utils.degToRad(30);
        
        // 这里可以添加更复杂的阻挡检查
        // 例如检查视线是否穿过展柜的不透明部分
        
        return true;
    },
    
    // 综合评估所有风险
    evaluateAllRisks: function(data) {
        const allRisks = [];
        const { cases, lights, artifacts, paths } = data;
        
        // 1. 照度超标风险
        for (const artifact of artifacts) {
            for (const light of lights) {
                // 简化：假设文物位置在展柜中心
                const artifactPos = {
                    x: artifact.position?.x || 0,
                    y: artifact.position?.y || 0,
                    z: artifact.position?.z || 0.5
                };
                
                const illuminance = this.calculateIlluminance(light, artifactPos);
                
                if (illuminance > artifact.maxIlluminance) {
                    allRisks.push({
                        type: 'illuminance',
                        severity: illuminance > artifact.maxIlluminance * 2 ? 'high' : 'medium',
                        description: `文物 "${artifact.name}" 照度超标: 计算值 ${illuminance.toFixed(0)} lux，限值 ${artifact.maxIlluminance} lux`,
                        artifactId: artifact.id,
                        lightId: light.id,
                        illuminance: illuminance,
                        maxIlluminance: artifact.maxIlluminance
                    });
                }
            }
        }
        
        // 2. 眩光风险
        for (const light of lights) {
            for (const caseItem of cases) {
                // 检查动线中的每个点
                for (const path of paths) {
                    for (const point of path.points) {
                        const glareRisks = this.calculateGlareRisk(light, caseItem, point);
                        allRisks.push(...glareRisks);
                    }
                }
            }
        }
        
        // 3. 可见性风险
        for (const caseItem of cases) {
            if (caseItem.infoPanel) {
                const visibilityZones = this.calculateInfoPanelVisibility(caseItem, paths);
                
                for (const zone of visibilityZones) {
                    if (zone.visibilityRatio < 0.7) {
                        allRisks.push({
                            type: 'visibility',
                            severity: zone.visibilityRatio < 0.3 ? 'high' : 
                                     zone.visibilityRatio < 0.5 ? 'medium' : 'low',
                            description: `展柜 ${caseItem.id} 说明牌在动线 ${zone.pathId} 上可见度不足: ${(zone.visibilityRatio * 100).toFixed(0)}%`,
                            caseId: caseItem.id,
                            pathId: zone.pathId,
                            visibilityRatio: zone.visibilityRatio
                        });
                    }
                }
            }
        }
        
        // 按严重程度排序
        const severityOrder = { high: 0, medium: 1, low: 2 };
        allRisks.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
        
        return allRisks;
    },
    
    // 生成调整建议
    generateAdjustmentSuggestions: function(risks, data) {
        const suggestions = [];
        
        for (const risk of risks) {
            const suggestion = this.generateSingleSuggestion(risk, data);
            if (suggestion) {
                suggestions.push(suggestion);
            }
        }
        
        return suggestions;
    },
    
    generateSingleSuggestion: function(risk, data) {
        switch (risk.type) {
            case 'illuminance':
                return {
                    risk: risk,
                    actions: [
                        `降低灯具 ${risk.lightId} 的强度`,
                        `调整灯具 ${risk.lightId} 的照射角度`,
                        `增加灯具 ${risk.lightId} 与文物的距离`,
                        `使用漫射滤镜或扩散板`
                    ],
                    priority: risk.severity
                };
                
            case 'reflection':
                return {
                    risk: risk,
                    actions: [
                        `重新定位灯具 ${risk.lightId}，避免直接照射玻璃`,
                        `调整灯具 ${risk.lightId} 的角度，改变反射方向`,
                        `使用偏光滤镜`,
                        `考虑使用低反射玻璃`
                    ],
                    priority: risk.severity
                };
                
            case 'direct':
                return {
                    risk: risk,
                    actions: [
                        `调整灯具 ${risk.lightId} 的角度，避免直射观众`,
                        `使用遮光板或格栅`,
                        `将灯具 ${risk.lightId} 移至视野外`
                    ],
                    priority: risk.severity
                };
                
            case 'visibility':
                return {
                    risk: risk,
                    actions: [
                        `调整说明牌位置或角度`,
                        `增加说明牌的照明`,
                        `优化动线 ${risk.pathId} 的观展路线`,
                        `考虑使用电子显示屏`
                    ],
                    priority: risk.severity
                };
                
            default:
                return null;
        }
    }
};

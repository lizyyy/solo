import { CollisionDetector } from './CollisionDetector.js';

export class EchoCalculator {
    static SOUND_SPEED_AIR = 343;
    static SOUND_SPEED_WALL = 3400;
    static TIME_UNIT_CONVERSIONS = {
        s: 1,
        ms: 0.001,
        us: 0.000001,
        ns: 0.000000001
    };

    static calculateEchoTime(distance, soundSpeed = this.SOUND_SPEED_AIR) {
        return (2 * distance) / soundSpeed;
    }

    static calculateDistanceFromEcho(echoTime, soundSpeed = this.SOUND_SPEED_AIR) {
        return (echoTime * soundSpeed) / 2;
    }

    static calculateRoundTripTime(pathPoints, soundSpeed = this.SOUND_SPEED_AIR) {
        if (pathPoints.length < 2) return 0;
        
        let totalDistance = 0;
        for (let i = 1; i < pathPoints.length; i++) {
            totalDistance += Math.sqrt(
                Math.pow(pathPoints[i].x - pathPoints[i-1].x, 2) +
                Math.pow(pathPoints[i].y - pathPoints[i-1].y, 2)
            );
        }
        
        return totalDistance / soundSpeed;
    }

    static convertTime(value, fromUnit, toUnit) {
        const fromFactor = this.TIME_UNIT_CONVERSIONS[fromUnit] || 1;
        const toFactor = this.TIME_UNIT_CONVERSIONS[toUnit] || 1;
        return value * fromFactor / toFactor;
    }

    static validateTimeUnit(unit) {
        return Object.keys(this.TIME_UNIT_CONVERSIONS).includes(unit);
    }

    static getTimeUnitLabel(unit) {
        const labels = {
            s: '秒 (s)',
            ms: '毫秒 (ms)',
            us: '微秒 (μs)',
            ns: '纳秒 (ns)'
        };
        return labels[unit] || unit;
    }

    static detectTimeUnitErrors(echoData, expectedUnit = 's') {
        const errors = [];
        
        for (const echo of echoData) {
            if (echo.timeUnit && echo.timeUnit !== expectedUnit) {
                const convertedTime = this.convertTime(echo.time, echo.timeUnit, expectedUnit);
                errors.push({
                    type: 'time_unit',
                    severity: 'warning',
                    description: `时间单位不匹配：预期 ${expectedUnit}，实际 ${echo.timeUnit}`,
                    location: echo.point || null,
                    expected: { unit: expectedUnit, value: convertedTime },
                    actual: { unit: echo.timeUnit, value: echo.time }
                });
            }
            
            if (echo.time <= 0) {
                errors.push({
                    type: 'time_unit',
                    severity: 'error',
                    description: '回声时间必须为正数',
                    location: echo.point || null,
                    expected: '> 0',
                    actual: echo.time
                });
            }
            
            if (echo.time > 10) {
                errors.push({
                    type: 'time_unit',
                    severity: 'warning',
                    description: `回声时间异常大 (${echo.time}s)，可能存在单位错误`,
                    location: echo.point || null,
                    expected: '< 10s',
                    actual: echo.time
                });
            }
        }
        
        return errors;
    }

    static calculateReflectionLaw(incidentAngle, reflectionAngle, tolerance = 1) {
        const incidentDeg = (incidentAngle * 180) / Math.PI;
        const reflectionDeg = (reflectionAngle * 180) / Math.PI;
        
        const angleOfIncidence = 90 - Math.abs(incidentDeg);
        const angleOfReflection = 90 - Math.abs(reflectionDeg);
        
        const difference = Math.abs(angleOfIncidence - angleOfReflection);
        const followsLaw = difference <= tolerance;
        
        return {
            angleOfIncidence: angleOfIncidence,
            angleOfReflection: angleOfReflection,
            difference: difference,
            followsLaw: followsLaw,
            tolerance: tolerance
        };
    }

    static detectReflectionAngleErrors(reflections, tolerance = 1) {
        const errors = [];
        
        for (let i = 0; i < reflections.length; i++) {
            const reflection = reflections[i];
            const result = this.calculateReflectionLaw(
                reflection.incidentAngle,
                reflection.reflectionAngle,
                tolerance
            );
            
            if (!result.followsLaw) {
                errors.push({
                    type: 'reflection_angle',
                    severity: 'error',
                    description: `反射角不遵循反射定律：入射角 ${result.angleOfIncidence.toFixed(1)}°，反射角 ${result.angleOfReflection.toFixed(1)}°，差值 ${result.difference.toFixed(1)}°`,
                    location: reflection.point,
                    expected: {
                        angleOfIncidence: result.angleOfIncidence,
                        angleOfReflection: result.angleOfIncidence,
                        tolerance: tolerance
                    },
                    actual: {
                        angleOfIncidence: result.angleOfIncidence,
                        angleOfReflection: result.angleOfReflection,
                        difference: result.difference
                    },
                    reflectionIndex: i
                });
            }
        }
        
        return errors;
    }

    static detectWallPenetration(path, walls, threshold = 0.1) {
        const errors = [];
        
        for (let i = 1; i < path.length; i++) {
            const p1 = path[i-1];
            const p2 = path[i];
            
            for (const wall of walls) {
                const hit = CollisionDetector.lineIntersection(
                    { x: p1.x, y: p1.y },
                    { x: p2.x, y: p2.y },
                    { x: wall.x1, y: wall.y1 },
                    { x: wall.x2, y: wall.y2 }
                );
                
                if (hit && hit.t > threshold && hit.t < 1 - threshold) {
                    if (!p2.isReflection) {
                        errors.push({
                            type: 'wall_penetration',
                            severity: 'critical',
                            description: `声波路径穿透墙体：墙体ID ${wall.id}`,
                            location: { x: hit.x, y: hit.y },
                            expected: '声波应被墙体反射或吸收',
                            actual: '声波穿透墙体',
                            wallId: wall.id,
                            pathSegment: i
                        });
                    }
                }
            }
        }
        
        return errors;
    }

    static analyzeEchoData(echoes) {
        const analysis = {
            totalEchoes: echoes.length,
            averageTime: 0,
            averageDistance: 0,
            averageIntensity: 0,
            materialBreakdown: {},
            timeRange: { min: Infinity, max: -Infinity },
            distanceRange: { min: Infinity, max: -Infinity }
        };
        
        if (echoes.length === 0) return analysis;
        
        let totalTime = 0;
        let totalDistance = 0;
        let totalIntensity = 0;
        
        for (const echo of echoes) {
            totalTime += echo.time;
            totalDistance += echo.distance;
            totalIntensity += echo.intensity;
            
            analysis.timeRange.min = Math.min(analysis.timeRange.min, echo.time);
            analysis.timeRange.max = Math.max(analysis.timeRange.max, echo.time);
            analysis.distanceRange.min = Math.min(analysis.distanceRange.min, echo.distance);
            analysis.distanceRange.max = Math.max(analysis.distanceRange.max, echo.distance);
            
            analysis.materialBreakdown[echo.wallMaterial] = 
                (analysis.materialBreakdown[echo.wallMaterial] || 0) + 1;
        }
        
        analysis.averageTime = totalTime / echoes.length;
        analysis.averageDistance = totalDistance / echoes.length;
        analysis.averageIntensity = totalIntensity / echoes.length;
        
        return analysis;
    }

    static generateEchoReport(wave, echoes) {
        const analysis = this.analyzeEchoData(echoes);
        
        return {
            waveId: wave.id,
            startTime: wave.startTime || 0,
            totalPropagationTime: wave.getTotalTime(),
            totalPropagationDistance: wave.getTotalDistance(),
            reflectionCount: wave.reflections.length,
            echoAnalysis: analysis,
            echoes: echoes.map((e, i) => ({
                index: i + 1,
                time: e.time,
                distance: e.distance,
                intensity: e.intensity,
                material: e.wallMaterial,
                position: e.point
            })),
            generatedAt: Date.now()
        };
    }
}

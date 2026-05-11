const BusinessLogic = {
    INTENSITY_THRESHOLDS: {
        high: 8,
        medium: 5
    },

    COURSE_TYPE_WEIGHTS: {
        '芭蕾': 1.2,
        '现代舞': 1.0,
        '爵士': 1.5,
        '街舞': 1.8,
        '拉丁': 1.3,
        '瑜伽': 0.5,
        '普拉提': 0.6,
        '中国舞': 1.1,
        '儿童舞蹈': 0.8,
        '考级集训': 2.0
    },

    CLEANING_INTERVALS: {
        high: {
            daily: true,
            deepCleanDays: 3,
            description: '高强度使用：每日吸尘，每3天深度清洁'
        },
        medium: {
            daily: false,
            deepCleanDays: 5,
            description: '中等强度使用：隔日清洁，每5天深度清洁'
        },
        low: {
            daily: false,
            deepCleanDays: 7,
            description: '低强度使用：每3天清洁，每周深度清洁'
        }
    },

    DAMAGE_RISK_MATRIX: {
        high: {
            threshold: 0.6,
            risk: '高风险',
            description: '高强度区域需要重点关注'
        },
        medium: {
            threshold: 0.3,
            risk: '中等风险',
            description: '定期检查，预防性维护'
        },
        low: {
            threshold: 0.1,
            risk: '低风险',
            description: '常规检查即可'
        }
    },

    processCourseIntensity(classrooms) {
        if (!classrooms || classrooms.length === 0) {
            throw new Error('没有教室数据可处理');
        }

        const results = [];

        for (const classroom of classrooms) {
            const result = this.analyzeClassroomIntensity(classroom);
            results.push(result);
        }

        return results;
    },

    analyzeClassroomIntensity(classroom) {
        if (!classroom.courses || classroom.courses.length === 0) {
            throw new Error(`教室 ${classroom.name} (${classroom.id}) 没有课程数据`);
        }

        let totalWeightedHours = 0;
        let totalCourses = 0;
        const courseDetails = [];

        for (const course of classroom.courses) {
            const weight = this.COURSE_TYPE_WEIGHTS[course.type] || 1.0;
            const weightedHours = course.hours * weight;
            
            totalWeightedHours += weightedHours;
            totalCourses++;

            courseDetails.push({
                type: course.type,
                hours: course.hours,
                weight: weight,
                weightedHours: weightedHours
            });
        }

        const avgWeightedHoursPerCourse = totalWeightedHours / totalCourses;

        let intensity, intensityScore;
        if (avgWeightedHoursPerCourse >= this.INTENSITY_THRESHOLDS.high) {
            intensity = 'high';
            intensityScore = 3;
        } else if (avgWeightedHoursPerCourse >= this.INTENSITY_THRESHOLDS.medium) {
            intensity = 'medium';
            intensityScore = 2;
        } else {
            intensity = 'low';
            intensityScore = 1;
        }

        return {
            ...classroom,
            intensity: intensity,
            intensityScore: intensityScore,
            totalWeightedHours: Math.round(totalWeightedHours * 100) / 100,
            avgWeightedHours: Math.round(avgWeightedHoursPerCourse * 100) / 100,
            courseAnalysis: courseDetails
        };
    },

    generateCleaningPlans(classrooms) {
        if (!classrooms || classrooms.length === 0) {
            throw new Error('没有教室数据可生成清洁计划');
        }

        const plans = [];
        const today = new Date();

        for (const classroom of classrooms) {
            if (!classroom.intensity) {
                throw new Error(`教室 ${classroom.name} 未进行强度分析，请先处理课程强度`);
            }

            const interval = this.CLEANING_INTERVALS[classroom.intensity];
            const lastCleaning = new Date(classroom.lastCleaningDate);
            const daysSinceLastClean = Math.floor((today - lastCleaning) / (1000 * 60 * 60 * 24));

            const nextCleaningDate = new Date(lastCleaning);
            nextCleaningDate.setDate(nextCleaningDate.getDate() + interval.deepCleanDays);

            const needsUrgentClean = daysSinceLastClean > interval.deepCleanDays;
            const cleaningPriority = needsUrgentClean ? 'urgent' : 
                                    daysSinceLastClean > interval.deepCleanDays * 0.7 ? 'high' : 'normal';

            const plan = {
                id: Utils.generateId(),
                classroomId: classroom.id,
                classroomName: classroom.name,
                intensity: classroom.intensity,
                intensityScore: classroom.intensityScore,
                lastCleaningDate: classroom.lastCleaningDate,
                daysSinceLastClean: daysSinceLastClean,
                interval: interval,
                nextCleaningDate: Utils.formatDateShort(nextCleaningDate),
                needsUrgentClean: needsUrgentClean,
                priority: cleaningPriority,
                tasks: this.generateCleaningTasks(classroom, interval)
            };

            plans.push(plan);
        }

        return plans.sort((a, b) => {
            const priorityOrder = { urgent: 0, high: 1, normal: 2 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });
    },

    generateCleaningTasks(classroom, interval) {
        const tasks = [];

        if (interval.daily) {
            tasks.push({
                type: 'daily',
                description: '每日地面吸尘',
                frequency: '每日'
            });
        }

        tasks.push({
            type: 'regular',
            description: '使用中性清洁剂拖地',
            frequency: interval.daily ? '每日' : '隔日'
        });

        tasks.push({
            type: 'deep',
            description: '使用专业地胶清洗机深度清洁',
            frequency: `每${interval.deepCleanDays}天`
        });

        if (classroom.area > 100) {
            tasks.push({
                type: 'special',
                description: '大区域重点清洁（入口、中心区域）',
                frequency: '每次深度清洁'
            });
        }

        tasks.push({
            type: 'inspection',
            description: '检查地胶边缘、接缝和损伤情况',
            frequency: '每次清洁'
        });

        return tasks;
    },

    trackDamageAreas(classrooms, cleaningPlans) {
        if (!classrooms || classrooms.length === 0) {
            throw new Error('没有教室数据可进行损伤追踪');
        }

        const allDamageRecords = [];

        for (const classroom of classrooms) {
            const records = this.analyzeDamageForClassroom(classroom, cleaningPlans);
            allDamageRecords.push(...records);
        }

        return allDamageRecords;
    },

    analyzeDamageForClassroom(classroom, cleaningPlans) {
        if (!classroom.intensity) {
            throw new Error(`教室 ${classroom.name} 未进行强度分析`);
        }

        const plan = cleaningPlans.find(p => p.classroomId === classroom.id);
        if (!plan) {
            throw new Error(`教室 ${classroom.name} 没有清洁计划`);
        }

        const records = [];

        const entryAreaRisk = this.calculateDamageRisk(
            classroom.intensity,
            plan.daysSinceLastClean,
            1.5
        );

        records.push({
            id: Utils.generateId(),
            classroomId: classroom.id,
            classroomName: classroom.name,
            area: '入口区域',
            risk: entryAreaRisk.risk,
            riskLevel: entryAreaRisk.level,
            description: entryAreaRisk.description,
            factors: ['高人流区域', '鞋底带入砂砾'],
            maintenanceAction: this.getMaintenanceAction(entryAreaRisk.level, '入口区域')
        });

        const centerAreaRisk = this.calculateDamageRisk(
            classroom.intensity,
            plan.daysSinceLastClean,
            1.2
        );

        records.push({
            id: Utils.generateId(),
            classroomId: classroom.id,
            classroomName: classroom.name,
            area: '中心活动区域',
            risk: centerAreaRisk.risk,
            riskLevel: centerAreaRisk.level,
            description: centerAreaRisk.description,
            factors: ['频繁跳跃、旋转', '高强度摩擦'],
            maintenanceAction: this.getMaintenanceAction(centerAreaRisk.level, '中心活动区域')
        });

        const edgeAreaRisk = this.calculateDamageRisk(
            classroom.intensity,
            plan.daysSinceLastClean,
            0.8
        );

        records.push({
            id: Utils.generateId(),
            classroomId: classroom.id,
            classroomName: classroom.name,
            area: '边缘与接缝',
            risk: edgeAreaRisk.risk,
            riskLevel: edgeAreaRisk.level,
            description: edgeAreaRisk.description,
            factors: ['边缘起翘风险', '接缝处积水'],
            maintenanceAction: this.getMaintenanceAction(edgeAreaRisk.level, '边缘与接缝')
        });

        if (plan.needsUrgentClean) {
            records.push({
                id: Utils.generateId(),
                classroomId: classroom.id,
                classroomName: classroom.name,
                area: '整体',
                risk: '紧急',
                riskLevel: 4,
                description: '超期未清洁，存在大面积损伤风险',
                factors: ['已超过清洁周期', plan.daysSinceLastClean + '天未清洁'],
                maintenanceAction: '立即安排紧急清洁和全面检查'
            });
        }

        return records;
    },

    calculateDamageRisk(intensity, daysSinceClean, areaMultiplier = 1) {
        const intensityMultiplier = {
            high: 3,
            medium: 2,
            low: 1
        };

        const baseScore = (intensityMultiplier[intensity] * daysSinceClean * 0.1) * areaMultiplier;
        const normalizedScore = Math.min(baseScore / 10, 1);

        let level, risk, description;
        if (normalizedScore >= this.DAMAGE_RISK_MATRIX.high.threshold) {
            level = 3;
            risk = this.DAMAGE_RISK_MATRIX.high.risk;
            description = this.DAMAGE_RISK_MATRIX.high.description;
        } else if (normalizedScore >= this.DAMAGE_RISK_MATRIX.medium.threshold) {
            level = 2;
            risk = this.DAMAGE_RISK_MATRIX.medium.risk;
            description = this.DAMAGE_RISK_MATRIX.medium.description;
        } else {
            level = 1;
            risk = this.DAMAGE_RISK_MATRIX.low.risk;
            description = this.DAMAGE_RISK_MATRIX.low.description;
        }

        return {
            level,
            risk,
            description,
            score: Math.round(normalizedScore * 100) / 100
        };
    },

    getMaintenanceAction(riskLevel, area) {
        const actions = {
            1: `常规检查：下次清洁时检查${area}`,
            2: `预防性维护：下周对${area}进行重点检查`,
            3: `紧急处理：3天内对${area}进行专业检查`,
            4: `立即行动：今天就需要检查和处理`
        };
        return actions[riskLevel] || actions[1];
    },

    calculateStatistics(classrooms, cleaningPlans, damageRecords) {
        const stats = {
            summary: {
                totalClassrooms: classrooms.length,
                highIntensity: 0,
                mediumIntensity: 0,
                lowIntensity: 0
            },
            cleaning: {
                totalPlans: cleaningPlans.length,
                urgent: 0,
                highPriority: 0,
                normalPriority: 0,
                avgDaysSinceClean: 0
            },
            damage: {
                totalRecords: damageRecords.length,
                critical: 0,
                highRisk: 0,
                mediumRisk: 0,
                lowRisk: 0
            },
            recommendations: [],
            generationTime: new Date().toISOString()
        };

        let totalDaysSinceClean = 0;

        for (const classroom of classrooms) {
            if (classroom.intensity === 'high') stats.summary.highIntensity++;
            else if (classroom.intensity === 'medium') stats.summary.mediumIntensity++;
            else stats.summary.lowIntensity++;
        }

        for (const plan of cleaningPlans) {
            if (plan.priority === 'urgent') stats.cleaning.urgent++;
            else if (plan.priority === 'high') stats.cleaning.highPriority++;
            else stats.cleaning.normalPriority++;

            totalDaysSinceClean += plan.daysSinceLastClean;
        }

        stats.cleaning.avgDaysSinceClean = cleaningPlans.length > 0 
            ? Math.round(totalDaysSinceClean / cleaningPlans.length * 10) / 10 
            : 0;

        for (const record of damageRecords) {
            if (record.risk === '紧急') stats.damage.critical++;
            else if (record.risk === '高风险') stats.damage.highRisk++;
            else if (record.risk === '中等风险') stats.damage.mediumRisk++;
            else stats.damage.lowRisk++;
        }

        if (stats.cleaning.urgent > 0) {
            stats.recommendations.push({
                level: 'critical',
                text: `有 ${stats.cleaning.urgent} 个教室需要紧急清洁，请立即处理`
            });
        }

        if (stats.damage.critical > 0) {
            stats.recommendations.push({
                level: 'critical',
                text: `检测到 ${stats.damage.critical} 个紧急损伤区域，需要立即检查`
            });
        }

        if (stats.damage.highRisk > 0) {
            stats.recommendations.push({
                level: 'high',
                text: `有 ${stats.damage.highRisk} 个高风险区域，建议本周内检查`
            });
        }

        if (stats.summary.highIntensity > 0) {
            stats.recommendations.push({
                level: 'info',
                text: `${stats.summary.highIntensity} 个高强度教室，建议增加清洁频率`
            });
        }

        return stats;
    },

    getSampleData() {
        return [
            {
                id: 'CR001',
                name: '一楼芭蕾教室',
                area: 80,
                lastCleaningDate: '2026-05-08',
                courses: [
                    { type: '芭蕾', hours: 6 },
                    { type: '儿童舞蹈', hours: 4 },
                    { type: '考级集训', hours: 3 }
                ]
            },
            {
                id: 'CR002',
                name: '二楼街舞教室',
                area: 100,
                lastCleaningDate: '2026-05-10',
                courses: [
                    { type: '街舞', hours: 8 },
                    { type: '爵士', hours: 5 },
                    { type: '现代舞', hours: 3 }
                ]
            },
            {
                id: 'CR003',
                name: '三楼瑜伽教室',
                area: 60,
                lastCleaningDate: '2026-05-05',
                courses: [
                    { type: '瑜伽', hours: 4 },
                    { type: '普拉提', hours: 3 }
                ]
            },
            {
                id: 'CR004',
                name: '四楼中国舞教室',
                area: 120,
                lastCleaningDate: '2026-05-09',
                courses: [
                    { type: '中国舞', hours: 5 },
                    { type: '芭蕾', hours: 4 },
                    { type: '拉丁', hours: 3 }
                ]
            }
        ];
    }
};

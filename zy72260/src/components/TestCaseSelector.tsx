import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  FlaskConical,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Play,
  FileText,
  Shield,
  ArrowRight,
} from 'lucide-react';
import { TestCaseType, Route } from '@/types';
import { testCases, getTestCaseFileBlob, createFileFromBlob } from '@/data/testCases';
import { parsePointCloudLog, parseSafetyRadiusTable } from '@/utils/fileParser';
import { detectConflicts, saveConflicts } from '@/utils/conflictDetector';
import { createRouteFromWaypoints, recalculateAllRoutes } from '@/utils/routeCalculator';
import { createInitialSelfChecks, runAllSelfChecks } from '@/utils/selfCheckEngine';
import { useAppStore } from '@/store';
import { db, clearAllData } from '@/db';
import { cn } from '@/lib/utils';

interface TestCaseSelectorProps {
  onTestCaseLoaded?: (type: TestCaseType) => void;
}

export default function TestCaseSelector({ onTestCaseLoaded }: TestCaseSelectorProps) {
  const [loadingType, setLoadingType] = useState<TestCaseType | null>(null);

  const operator = useAppStore((s) => s.operator);
  const setPointCloudLog = useAppStore((s) => s.setPointCloudLog);
  const setSafetyRadiusTable = useAppStore((s) => s.setSafetyRadiusTable);
  const setRoutes = useAppStore((s) => s.setRoutes);
  const addRoute = useAppStore((s) => s.addRoute);
  const setConflicts = useAppStore((s) => s.setConflicts);
  const setSelfChecks = useAppStore((s) => s.setSelfChecks);
  const completeStep = useAppStore((s) => s.completeStep);
  const setCurrentStep = useAppStore((s) => s.setCurrentStep);
  const setWorkflow = useAppStore((s) => s.setWorkflow);
  const resetAll = useAppStore((s) => s.resetAll);

  const loadTestCase = async (type: TestCaseType) => {
    setLoadingType(type);
    try {
      await clearAllData();
      resetAll();

      const testCase = testCases[type];
      
      const pointCloudFile = createFileFromBlob(
        getTestCaseFileBlob(testCase, 'point_cloud'),
        testCase.pointCloudData.filename
      );
      const pcResult = await parsePointCloudLog(pointCloudFile, operator);
      setPointCloudLog(pcResult.log);

      const initialRoute = createRouteFromWaypoints(pcResult.log.route);
      await db.routes.put(initialRoute);
      setRoutes([initialRoute]);

      if (testCase.safetyRadiusData) {
        const safetyFile = createFileFromBlob(
          getTestCaseFileBlob(testCase, 'safety_radius'),
          testCase.safetyRadiusData.filename
        );
        const srResult = await parseSafetyRadiusTable(safetyFile, operator);
        setSafetyRadiusTable(srResult.table);

        const conflicts = detectConflicts(pcResult.log, srResult.table);
        await saveConflicts(conflicts);
        setConflicts(conflicts);

        const updatedExhibits = pcResult.log.exhibits.map((exhibit) => {
          const safetyEntry = srResult.table.exhibits.find(
            (e) => e.exhibitId === exhibit.exhibitId
          );
          const pendingConflict = conflicts.find(
            (c) => c.exhibitId === exhibit.exhibitId && c.status === 'pending'
          );
          return {
            ...exhibit,
            safetyRadius: safetyEntry?.safetyRadius,
            radiusSource: pendingConflict ? undefined : 'safety_table' as const,
          };
        });
        setPointCloudLog({
          ...pcResult.log,
          exhibits: updatedExhibits,
        });
      }

      if (testCase.supplementaryRoute && testCase.supplementaryRoute.waypoints) {
        const suppRoute: Route = createRouteFromWaypoints(
          testCase.supplementaryRoute.waypoints,
          true,
          testCase.supplementaryRoute.reportedLength
        );
        suppRoute.reviewStatus = testCase.supplementaryRoute.reviewStatus || 'pending';
        suppRoute.lengthRecalculated = testCase.supplementaryRoute.lengthRecalculated || false;
        await db.routes.put(suppRoute);
        addRoute(suppRoute);

        const allRoutes = [initialRoute, suppRoute];
        const recalcRoutes = await recalculateAllRoutes(allRoutes);
        setRoutes(recalcRoutes);

        setWorkflow({
          lastSupplementaryTime: suppRoute.supplementaryTime,
          lastRouteCalcTime: recalcRoutes[0].recalcTime,
        });
      } else {
        setWorkflow({
          lastRouteCalcTime: initialRoute.recalcTime,
        });
      }

      const checks = createInitialSelfChecks();
      const results = await runAllSelfChecks(
        pcResult.log,
        testCase.safetyRadiusData ? await db.safetyRadiusTables.orderBy('importTime').reverse().first() : null,
        await db.routes.toArray(),
        testCase.safetyRadiusData ? await db.conflicts.toArray() : [],
        [],
        {
          lastSupplementaryTime: testCase.supplementaryRoute ? new Date().toISOString() : undefined,
          lastRouteCalcTime: initialRoute.recalcTime,
        }
      );
      setSelfChecks(results);

      completeStep('import_point_cloud');
      if (testCase.safetyRadiusData) {
        completeStep('import_safety_radius');
        setCurrentStep('export');
      } else {
        setCurrentStep('import_safety_radius');
      }

      onTestCaseLoaded?.(type);
    } catch (error) {
      console.error('Failed to load test case:', error);
      alert('加载测试用例失败：' + (error as Error).message);
    } finally {
      setLoadingType(null);
    }
  };

  const getTypeIcon = (type: TestCaseType) => {
    switch (type) {
      case 'normal':
        return <CheckCircle className="w-6 h-6 text-success-500" />;
      case 'wrong_caliber':
        return <AlertTriangle className="w-6 h-6 text-danger-500" />;
      case 'supplementary':
        return <XCircle className="w-6 h-6 text-warning-500" />;
    }
  };

  const getTypeColor = (type: TestCaseType) => {
    switch (type) {
      case 'normal':
        return 'border-success-300 hover:border-success-400 hover:bg-success-50';
      case 'wrong_caliber':
        return 'border-danger-300 hover:border-danger-400 hover:bg-danger-50';
      case 'supplementary':
        return 'border-warning-300 hover:border-warning-400 hover:bg-warning-50';
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h4 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
        <FlaskConical className="w-4 h-4 text-survey-600" />
        快速测试用例
      </h4>
      <p className="text-xs text-gray-500 mb-4">
        点击加载预设测试数据，验证工具功能
      </p>
      <div className="space-y-3">
        {(Object.keys(testCases) as TestCaseType[]).map((type) => {
          const tc = testCases[type];
          const isLoading = loadingType === type;

          return (
            <motion.div
              key={type}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className={cn(
                'border-2 rounded-lg p-3 cursor-pointer transition-all',
                getTypeColor(type),
                isLoading && 'opacity-50 cursor-not-allowed'
              )}
              onClick={() => !isLoading && loadTestCase(type)}
            >
              <div className="flex items-start gap-3">
                {isLoading ? (
                  <div className="w-6 h-6 border-2 border-survey-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  getTypeIcon(type)
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800">
                      {tc.name}
                    </span>
                    <span className="text-xs text-gray-400">
                      预期：{tc.expectedConflicts}个冲突 · {tc.expectedPendingReviews}项待复核
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">
                    {tc.description}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3" />
                      点云日志
                    </span>
                    <ArrowRight className="w-3 h-3" />
                    <span className="flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      安全半径表
                    </span>
                    {tc.supplementaryRoute && (
                      <>
                        <ArrowRight className="w-3 h-3" />
                        <span className="text-warning-600">含补录路线</span>
                      </>
                    )}
                  </div>
                </div>
                <Play className="w-5 h-5 text-gray-400" />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/store/useAppStore";
import ImportCard from "@/components/ImportCard";
import {
  parseOrbitalElements,
  parseTelemetrySegments,
  parseWindowTables,
} from "@/utils/csv";
import { Orbit, Activity, CalendarRange, Play } from "lucide-react";

export default function Import() {
  const {
    orbitalElements,
    telemetrySegments,
    windowTables,
    addOrbitalElements,
    addTelemetrySegments,
    addWindowTables,
    loadData,
  } = useAppStore();

  useEffect(() => {
    loadData();
  }, [loadData]);

  const [oeErrors, setOeErrors] = useState<string[]>([]);
  const [oeWarnings, setOeWarnings] = useState<string[]>([]);
  const [tsErrors, setTsErrors] = useState<string[]>([]);
  const [tsWarnings, setTsWarnings] = useState<string[]>([]);
  const [wtErrors, setWtErrors] = useState<string[]>([]);
  const [wtWarnings, setWtWarnings] = useState<string[]>([]);

  const handleOrbital = useCallback(
    async (file: File) => {
      const result = await parseOrbitalElements(file);
      setOeErrors(result.errors);
      setOeWarnings(result.warnings);
      if (result.data.length > 0) {
        await addOrbitalElements(result.data);
      }
    },
    [addOrbitalElements]
  );

  const handleTelemetry = useCallback(
    async (file: File) => {
      const result = await parseTelemetrySegments(file);
      setTsErrors(result.errors);
      setTsWarnings(result.warnings);
      if (result.data.length > 0) {
        await addTelemetrySegments(result.data);
      }
    },
    [addTelemetrySegments]
  );

  const handleWindow = useCallback(
    async (file: File) => {
      const result = await parseWindowTables(file);
      setWtErrors(result.errors);
      setWtWarnings(result.warnings);
      if (result.data.length > 0) {
        await addWindowTables(result.data);
      }
    },
    [addWindowTables]
  );

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-slate-700/50">
        <h1 className="text-lg font-semibold text-slate-100">数据导入</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          支持 CSV / JSON 格式，导入后自动存入本地 IndexedDB
        </p>
      </div>

      <div className="flex-1 overflow-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ImportCard
            title="轨道根数"
            icon={<Orbit className="w-4 h-4 text-blue-400" />}
            accept=".csv,.json"
            onFile={handleOrbital}
            errors={oeErrors}
            warnings={oeWarnings}
            count={orbitalElements.length}
          />
          <ImportCard
            title="遥测片段"
            icon={<Activity className="w-4 h-4 text-violet-400" />}
            accept=".csv,.json"
            onFile={handleTelemetry}
            errors={tsErrors}
            warnings={tsWarnings}
            count={telemetrySegments.length}
          />
          <ImportCard
            title="窗口表"
            icon={<CalendarRange className="w-4 h-4 text-emerald-400" />}
            accept=".csv,.json"
            onFile={handleWindow}
            errors={wtErrors}
            warnings={wtWarnings}
            count={windowTables.length}
          />
        </div>

        <div className="mt-8 rounded-lg border border-slate-700/30 bg-[#0f1a2e] p-4">
          <h3 className="text-sm font-medium text-slate-300 mb-3">数据概览</h3>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-semibold text-blue-400">
                {orbitalElements.length}
              </p>
              <p className="text-xs text-slate-500">轨道根数</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-violet-400">
                {telemetrySegments.length}
              </p>
              <p className="text-xs text-slate-500">遥测片段</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-emerald-400">
                {windowTables.length}
              </p>
              <p className="text-xs text-slate-500">窗口表</p>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-medium text-slate-300 mb-2">CSV 格式参考</h3>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-[11px]">
            <div className="rounded border border-slate-700/30 bg-[#0a1120] p-3 font-mono text-slate-400">
              <p className="text-blue-400 mb-1">轨道根数</p>
              <p>epochTime, semiMajorAxis,</p>
              <p>eccentricity, inclination,</p>
              <p>raan, argPerigee,</p>
              <p>trueAnomaly, source</p>
            </div>
            <div className="rounded border border-slate-700/30 bg-[#0a1120] p-3 font-mono text-slate-400">
              <p className="text-violet-400 mb-1">遥测片段</p>
              <p>startTime, endTime,</p>
              <p>starSensorId, status,</p>
              <p>frameCount,</p>
              <p>expectedFrameCount, source</p>
            </div>
            <div className="rounded border border-slate-700/30 bg-[#0a1120] p-3 font-mono text-slate-400">
              <p className="text-emerald-400 mb-1">窗口表</p>
              <p>startTime, endTime,</p>
              <p>windowName, windowType</p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3 p-4 rounded-lg border border-amber-400/20 bg-amber-400/5">
          <Play className="w-4 h-4 text-amber-400 flex-shrink-0" />
          <p className="text-xs text-slate-400">
            导入完成后，前往「遮挡分析」页运行自动判断。系统将基于轨道根数几何与遥测数据自动识别遮挡事件，并输出判断理由与缺帧溯源。
          </p>
        </div>
      </div>
    </div>
  );
}

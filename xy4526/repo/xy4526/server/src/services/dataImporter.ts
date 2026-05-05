import * as XLSX from 'xlsx';
import {
  Node,
  Pipe,
  Valve,
  PumpCurve,
  TemperatureData,
  DataImportResult,
} from '../models/types.js';

export class DataImporter {
  importFromJSON(jsonData: string): DataImportResult {
    try {
      const data = JSON.parse(jsonData);
      const errors: string[] = [];
      const warnings: string[] = [];

      const nodes = this.validateNodes(data.nodes, errors, warnings);
      const pipes = this.validatePipes(data.pipes, nodes, errors, warnings);
      const valves = this.validateValves(data.valves, pipes, errors, warnings);
      const pumpCurve = this.validatePumpCurve(data.pumpCurve, errors, warnings);
      const temperatureData = this.validateTemperatureData(data.temperatureData, nodes, errors, warnings);

      if (errors.length > 0) {
        return {
          success: false,
          message: '数据导入失败，存在错误',
          errors,
          warnings,
        };
      }

      return {
        success: true,
        message: '数据导入成功',
        data: {
          nodes,
          pipes,
          valves,
          pumpCurve,
          temperatureData,
        },
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      return {
        success: false,
        message: `JSON解析失败: ${error instanceof Error ? error.message : String(error)}`,
        errors: [`JSON格式错误: ${error instanceof Error ? error.message : String(error)}`],
      };
    }
  }

  importFromExcel(buffer: ArrayBuffer): DataImportResult {
    try {
      const workbook = XLSX.read(buffer, { type: 'array' });
      const errors: string[] = [];
      const warnings: string[] = [];

      const nodes = this.parseNodesFromExcel(workbook, errors, warnings);
      const pipes = this.parsePipesFromExcel(workbook, nodes, errors, warnings);
      const valves = this.parseValvesFromExcel(workbook, pipes, errors, warnings);
      const pumpCurve = this.parsePumpCurveFromExcel(workbook, errors, warnings);
      const temperatureData = this.parseTemperatureDataFromExcel(workbook, nodes, errors, warnings);

      if (errors.length > 0) {
        return {
          success: false,
          message: 'Excel导入失败，存在错误',
          errors,
          warnings,
        };
      }

      return {
        success: true,
        message: 'Excel数据导入成功',
        data: {
          nodes,
          pipes,
          valves,
          pumpCurve,
          temperatureData,
        },
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      return {
        success: false,
        message: `Excel解析失败: ${error instanceof Error ? error.message : String(error)}`,
        errors: [`Excel格式错误: ${error instanceof Error ? error.message : String(error)}`],
      };
    }
  }

  private validateNodes(
    nodesData: any[],
    errors: string[],
    warnings: string[]
  ): Node[] {
    if (!nodesData || !Array.isArray(nodesData)) {
      errors.push('节点数据格式错误，应为数组');
      return [];
    }

    const nodes: Node[] = [];
    const nodeIds = new Set<string>();

    for (const [index, nodeData] of nodesData.entries()) {
      if (!nodeData.id) {
        errors.push(`节点 ${index + 1}: 缺少id字段`);
        continue;
      }

      if (nodeIds.has(nodeData.id)) {
        errors.push(`节点 ${index + 1}: id重复 (${nodeData.id})`);
        continue;
      }

      if (!['building', 'unit', 'branch'].includes(nodeData.type)) {
        warnings.push(`节点 ${nodeData.id}: 类型不规范，应为 building/unit/branch`);
      }

      nodeIds.add(nodeData.id);
      nodes.push({
        id: String(nodeData.id),
        name: String(nodeData.name || `节点${nodeData.id}`),
        type: nodeData.type || 'branch',
        parentId: nodeData.parentId ? String(nodeData.parentId) : undefined,
        x: Number(nodeData.x) || 0,
        y: Number(nodeData.y) || 0,
      });
    }

    return nodes;
  }

  private validatePipes(
    pipesData: any[],
    nodes: Node[],
    errors: string[],
    warnings: string[]
  ): Pipe[] {
    if (!pipesData || !Array.isArray(pipesData)) {
      errors.push('管道数据格式错误，应为数组');
      return [];
    }

    const nodeIds = new Set(nodes.map(n => n.id));
    const pipes: Pipe[] = [];
    const pipeIds = new Set<string>();

    for (const [index, pipeData] of pipesData.entries()) {
      if (!pipeData.id) {
        errors.push(`管道 ${index + 1}: 缺少id字段`);
        continue;
      }

      if (pipeIds.has(pipeData.id)) {
        errors.push(`管道 ${index + 1}: id重复 (${pipeData.id})`);
        continue;
      }

      if (!nodeIds.has(pipeData.fromNodeId)) {
        errors.push(`管道 ${pipeData.id}: 起点节点不存在 (${pipeData.fromNodeId})`);
      }

      if (!nodeIds.has(pipeData.toNodeId)) {
        errors.push(`管道 ${pipeData.id}: 终点节点不存在 (${pipeData.toNodeId})`);
      }

      if (pipeData.diameter <= 0) {
        errors.push(`管道 ${pipeData.id}: 管径必须大于0`);
      }

      if (pipeData.length <= 0) {
        warnings.push(`管道 ${pipeData.id}: 管长应为正数`);
      }

      pipeIds.add(pipeData.id);
      pipes.push({
        id: String(pipeData.id),
        name: String(pipeData.name || `管道${pipeData.id}`),
        fromNodeId: String(pipeData.fromNodeId),
        toNodeId: String(pipeData.toNodeId),
        diameter: Number(pipeData.diameter) || 100,
        length: Number(pipeData.length) || 10,
        roughness: Number(pipeData.roughness) || 0.15,
        flowRate: pipeData.flowRate ? Number(pipeData.flowRate) : undefined,
        pressureDrop: pipeData.pressureDrop ? Number(pipeData.pressureDrop) : undefined,
      });
    }

    return pipes;
  }

  private validateValves(
    valvesData: any[],
    pipes: Pipe[],
    errors: string[],
    warnings: string[]
  ): Valve[] {
    if (!valvesData || !Array.isArray(valvesData)) {
      warnings.push('未找到阀门数据');
      return [];
    }

    const pipeIds = new Set(pipes.map(p => p.id));
    const valves: Valve[] = [];
    const valveIds = new Set<string>();

    for (const [index, valveData] of valvesData.entries()) {
      if (!valveData.id) {
        errors.push(`阀门 ${index + 1}: 缺少id字段`);
        continue;
      }

      if (valveIds.has(valveData.id)) {
        errors.push(`阀门 ${index + 1}: id重复 (${valveData.id})`);
        continue;
      }

      if (!pipeIds.has(valveData.pipeId)) {
        errors.push(`阀门 ${valveData.id}: 所属管道不存在 (${valveData.pipeId})`);
      }

      if (valveData.opening < 0 || valveData.opening > 100) {
        warnings.push(`阀门 ${valveData.id}: 开度应在0-100之间，当前为${valveData.opening}`);
      }

      valveIds.add(valveData.id);
      valves.push({
        id: String(valveData.id),
        name: String(valveData.name || `阀门${valveData.id}`),
        pipeId: String(valveData.pipeId),
        opening: Math.max(0, Math.min(100, Number(valveData.opening) || 50)),
        kvValue: Number(valveData.kvValue) || 100,
        notes: valveData.notes ? String(valveData.notes) : undefined,
      });
    }

    return valves;
  }

  private validatePumpCurve(
    curveData: any,
    errors: string[],
    warnings: string[]
  ): PumpCurve {
    if (!curveData) {
      errors.push('缺少水泵曲线数据');
      return {
        id: 'default-pump',
        name: '默认水泵',
        points: [
          { flowRate: 0, head: 30 },
          { flowRate: 50, head: 25 },
          { flowRate: 100, head: 18 },
          { flowRate: 150, head: 10 },
        ],
        maxFlowRate: 150,
        maxHead: 30,
      };
    }

    if (!curveData.points || !Array.isArray(curveData.points) || curveData.points.length < 2) {
      errors.push('水泵曲线点数据不足，至少需要2个点');
    }

    const points = (curveData.points || []).map((p: any) => ({
      flowRate: Number(p.flowRate) || 0,
      head: Number(p.head) || 0,
    }));

    return {
      id: String(curveData.id || 'pump-1'),
      name: String(curveData.name || '水泵'),
      points,
      maxFlowRate: Number(curveData.maxFlowRate) || Math.max(...points.map(p => p.flowRate)),
      maxHead: Number(curveData.maxHead) || Math.max(...points.map(p => p.head)),
      efficiency: curveData.efficiency ? Number(curveData.efficiency) : undefined,
    };
  }

  private validateTemperatureData(
    tempData: any[],
    nodes: Node[],
    errors: string[],
    warnings: string[]
  ): TemperatureData[] {
    if (!tempData || !Array.isArray(tempData)) {
      warnings.push('未找到温度数据');
      return [];
    }

    const nodeIds = new Set(nodes.map(n => n.id));
    const temperatures: TemperatureData[] = [];

    for (const [index, data] of tempData.entries()) {
      if (!data.nodeId) {
        errors.push(`温度数据 ${index + 1}: 缺少nodeId字段`);
        continue;
      }

      if (!nodeIds.has(data.nodeId)) {
        warnings.push(`温度数据 ${index + 1}: 节点不存在 (${data.nodeId})`);
      }

      if (data.supplyTemp <= data.returnTemp) {
        warnings.push(`温度数据 ${data.nodeId}: 供水温度应高于回水温度`);
      }

      temperatures.push({
        nodeId: String(data.nodeId),
        supplyTemp: Number(data.supplyTemp) || 60,
        returnTemp: Number(data.returnTemp) || 45,
        timestamp: data.timestamp || new Date().toISOString(),
      });
    }

    return temperatures;
  }

  private parseNodesFromExcel(
    workbook: XLSX.WorkBook,
    errors: string[],
    warnings: string[]
  ): Node[] {
    const sheet = workbook.Sheets['节点'] || workbook.Sheets['Nodes'];
    if (!sheet) {
      errors.push('Excel中未找到"节点"或"Nodes"工作表');
      return [];
    }

    const data = XLSX.utils.sheet_to_json(sheet);
    return this.validateNodes(data, errors, warnings);
  }

  private parsePipesFromExcel(
    workbook: XLSX.WorkBook,
    nodes: Node[],
    errors: string[],
    warnings: string[]
  ): Pipe[] {
    const sheet = workbook.Sheets['管道'] || workbook.Sheets['Pipes'];
    if (!sheet) {
      errors.push('Excel中未找到"管道"或"Pipes"工作表');
      return [];
    }

    const data = XLSX.utils.sheet_to_json(sheet);
    return this.validatePipes(data, nodes, errors, warnings);
  }

  private parseValvesFromExcel(
    workbook: XLSX.WorkBook,
    pipes: Pipe[],
    errors: string[],
    warnings: string[]
  ): Valve[] {
    const sheet = workbook.Sheets['阀门'] || workbook.Sheets['Valves'];
    if (!sheet) {
      warnings.push('Excel中未找到"阀门"或"Valves"工作表，将使用默认阀门数据');
      return [];
    }

    const data = XLSX.utils.sheet_to_json(sheet);
    return this.validateValves(data, pipes, errors, warnings);
  }

  private parsePumpCurveFromExcel(
    workbook: XLSX.WorkBook,
    errors: string[],
    warnings: string[]
  ): PumpCurve {
    const infoSheet = workbook.Sheets['水泵信息'] || workbook.Sheets['PumpInfo'];
    const curveSheet = workbook.Sheets['水泵曲线'] || workbook.Sheets['PumpCurve'];

    let pumpInfo: any = {};
    if (infoSheet) {
      const infoData = XLSX.utils.sheet_to_json(infoSheet);
      if (infoData.length > 0) {
        pumpInfo = infoData[0];
      }
    }

    let points: { flowRate: number; head: number }[] = [];
    if (curveSheet) {
      const curveData = XLSX.utils.sheet_to_json(curveSheet);
      points = curveData.map((p: any) => ({
        flowRate: Number(p.flowRate || p.流量 || 0),
        head: Number(p.head || p.扬程 || 0),
      }));
    }

    if (points.length === 0) {
      points = [
        { flowRate: 0, head: 30 },
        { flowRate: 50, head: 25 },
        { flowRate: 100, head: 18 },
        { flowRate: 150, head: 10 },
      ];
      warnings.push('未找到水泵曲线数据，使用默认曲线');
    }

    return {
      id: String(pumpInfo.id || pumpInfo.ID || 'pump-1'),
      name: String(pumpInfo.name || pumpInfo.名称 || '水泵'),
      points,
      maxFlowRate: Number(pumpInfo.maxFlowRate || pumpInfo.最大流量 || Math.max(...points.map(p => p.flowRate))),
      maxHead: Number(pumpInfo.maxHead || pumpInfo.最大扬程 || Math.max(...points.map(p => p.head))),
      efficiency: pumpInfo.efficiency || pumpInfo.效率 ? Number(pumpInfo.efficiency || pumpInfo.效率) : undefined,
    };
  }

  private parseTemperatureDataFromExcel(
    workbook: XLSX.WorkBook,
    nodes: Node[],
    errors: string[],
    warnings: string[]
  ): TemperatureData[] {
    const sheet = workbook.Sheets['温度数据'] || workbook.Sheets['Temperature'];
    if (!sheet) {
      warnings.push('Excel中未找到"温度数据"或"Temperature"工作表');
      return [];
    }

    const data = XLSX.utils.sheet_to_json(sheet);
    return this.validateTemperatureData(data, nodes, errors, warnings);
  }
}

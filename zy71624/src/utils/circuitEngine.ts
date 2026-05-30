import { v4 as uuidv4 } from 'uuid';
import type {
  Circuit,
  CircuitComponent,
  Wire,
  CircuitNode,
  Bar,
  Incident,
  IncidentType,
} from '@/types';

class UnionFind {
  private parent: Map<string, string>;
  private rank: Map<string, number>;

  constructor() {
    this.parent = new Map();
    this.rank = new Map();
  }

  makeSet(nodeId: string): void {
    if (!this.parent.has(nodeId)) {
      this.parent.set(nodeId, nodeId);
      this.rank.set(nodeId, 0);
    }
  }

  find(nodeId: string): string {
    if (!this.parent.has(nodeId)) {
      this.makeSet(nodeId);
      return nodeId;
    }
    if (this.parent.get(nodeId) !== nodeId) {
      this.parent.set(nodeId, this.find(this.parent.get(nodeId)!));
    }
    return this.parent.get(nodeId)!;
  }

  union(nodeId1: string, nodeId2: string): void {
    const root1 = this.find(nodeId1);
    const root2 = this.find(nodeId2);

    if (root1 === root2) return;

    const rank1 = this.rank.get(root1) || 0;
    const rank2 = this.rank.get(root2) || 0;

    if (rank1 < rank2) {
      this.parent.set(root1, root2);
    } else if (rank1 > rank2) {
      this.parent.set(root2, root1);
    } else {
      this.parent.set(root2, root1);
      this.rank.set(root1, rank1 + 1);
    }
  }

  connected(nodeId1: string, nodeId2: string): boolean {
    return this.find(nodeId1) === this.find(nodeId2);
  }

  getGroups(): Map<string, string[]> {
    const groups = new Map<string, string[]>();
    for (const nodeId of this.parent.keys()) {
      const root = this.find(nodeId);
      if (!groups.has(root)) {
        groups.set(root, []);
      }
      groups.get(root)!.push(nodeId);
    }
    return groups;
  }
}

interface CircuitAnalysisResult {
  circuit: Circuit;
  incidents: Incident[];
  barVoltages: Map<number, number>;
}

interface TopologyInfo {
  seriesPaths: string[][];
  parallelGroups: string[][];
  powerSources: CircuitComponent[];
  loads: CircuitComponent[];
}

export class CircuitEngine {
  private uf: UnionFind;

  constructor() {
    this.uf = new UnionFind();
  }

  analyze(circuit: Circuit, bars: Bar[]): CircuitAnalysisResult {
    const incidents: Incident[] = [];
    const barVoltages = new Map<number, number>();

    const { components, wires } = circuit;

    this.uf = new UnionFind();
    components.forEach(comp => {
      comp.nodes.forEach(node => this.uf.makeSet(node.id));
    });

    wires.forEach(wire => {
      if (wire.fromNodeId && wire.toNodeId) {
        this.uf.union(wire.fromNodeId, wire.toNodeId);
      }
    });

    const shortResult = this.detectShortCircuit(components, wires);
    if (shortResult.hasShort) {
      const incident = this.createIncident(
        'short_circuit',
        shortResult.description,
        shortResult.sourceWireId,
        undefined,
        50
      );
      incidents.push(incident);
      return {
        circuit: { ...circuit, hasShort: true, status: 'error' },
        incidents,
        barVoltages,
      };
    }

    const topology = this.analyzeTopology(components, wires);
    const { updatedComponents, updatedWires, voltageMap, currentMap } = this.calculateVoltagesAndCurrents(
      components,
      wires,
      topology
    );

    const parallelErrors = this.checkParallelCurrents(updatedComponents, updatedWires, currentMap);
    parallelErrors.forEach(error => {
      incidents.push(this.createIncident(
        'parallel_current_error',
        error.description,
        error.wireId,
        error.componentId,
        20
      ));
    });

    updatedComponents.forEach(comp => {
      if (comp.type === 'bar' && comp.properties.barId !== undefined) {
        const barId = comp.properties.barId;
        const nodeVoltages = comp.nodes.map(n => voltageMap.get(n.id) || 0);
        const voltage = Math.abs(nodeVoltages[0] - nodeVoltages[1]);
        barVoltages.set(barId, voltage);

        const bar = bars.find(b => b.id === barId);
        if (bar) {
          if (voltage > bar.requiredVoltage * 1.2) {
            incidents.push(this.createIncident(
              'overvoltage',
              `吧台 ${bar.name} 过压: ${voltage.toFixed(1)}V > ${(bar.requiredVoltage * 1.2).toFixed(1)}V`,
              undefined,
              comp.id,
              15
            ));
          } else if (voltage < bar.requiredVoltage * 0.8 && voltage > 0) {
            incidents.push(this.createIncident(
              'undervoltage',
              `吧台 ${bar.name} 欠压: ${voltage.toFixed(1)}V < ${(bar.requiredVoltage * 0.8).toFixed(1)}V`,
              undefined,
              comp.id,
              10
            ));
          }
        }
      }

      if (comp.properties.ratedVoltage) {
        const nodeVoltages = comp.nodes.map(n => voltageMap.get(n.id) || 0);
        const compVoltage = Math.abs(nodeVoltages[0] - nodeVoltages[1]);
        if (compVoltage > comp.properties.ratedVoltage * 1.5) {
          incidents.push(this.createIncident(
            'overvoltage',
            `元件过压损坏: ${compVoltage.toFixed(1)}V > ${(comp.properties.ratedVoltage * 1.5).toFixed(1)}V`,
            undefined,
            comp.id,
            30
          ));
        }
      }
    });

    const updatedNodes = updatedComponents.map(comp => ({
      ...comp,
      nodes: comp.nodes.map(node => ({
        ...node,
        voltage: voltageMap.get(node.id) || 0,
        current: currentMap.get(node.id) || 0,
      })),
    }));

    const finalWires = updatedWires.map(wire => ({
      ...wire,
      current: currentMap.get(wire.id) || 0,
      isActive: (currentMap.get(wire.id) || 0) > 0.01,
    }));

    const totalVoltage = this.calculateTotalVoltage(updatedComponents, voltageMap);
    const totalCurrent = this.calculateTotalCurrent(updatedWires, currentMap);

    return {
      circuit: {
        ...circuit,
        components: updatedNodes,
        wires: finalWires,
        totalVoltage,
        totalCurrent,
        hasShort: false,
        status: incidents.length > 0 ? 'error' : 'active',
      },
      incidents,
      barVoltages,
    };
  }

  private detectShortCircuit(
    components: CircuitComponent[],
    wires: Wire[]
  ): { hasShort: boolean; description: string; sourceWireId?: string } {
    const powerComponents = components.filter(c => c.type === 'power');

    for (const power of powerComponents) {
      if (power.nodes.length < 2) continue;

      const positiveNode = power.nodes[0];
      const negativeNode = power.nodes[1];

      for (const wire of wires) {
        const node1 = this.getNodeById(components, wire.fromNodeId);
        const node2 = this.getNodeById(components, wire.toNodeId);

        if (!node1 || !node2) continue;

        const comp1 = components.find(c => c.id === node1.componentId);
        const comp2 = components.find(c => c.id === node2.componentId);

        if (
          comp1?.type === 'power' &&
          comp2?.type === 'power' &&
          this.uf.connected(wire.fromNodeId, wire.toNodeId)
        ) {
          const posConnected = this.uf.connected(wire.fromNodeId, positiveNode.id) ||
            this.uf.connected(wire.toNodeId, positiveNode.id);
          const negConnected = this.uf.connected(wire.fromNodeId, negativeNode.id) ||
            this.uf.connected(wire.toNodeId, negativeNode.id);

          if (posConnected && negConnected) {
            return {
              hasShort: true,
              description: '电源正负极直接短路！电流过大，电路停摆。',
              sourceWireId: wire.id,
            };
          }
        }

        if (comp1?.type === 'switch' && comp2?.type === 'switch') {
          if (this.uf.connected(wire.fromNodeId, positiveNode.id) &&
              this.uf.connected(wire.toNodeId, negativeNode.id)) {
            return {
              hasShort: true,
              description: '开关误接导致电源短路！请检查接线。',
              sourceWireId: wire.id,
            };
          }
        }
      }

      if (this.uf.connected(positiveNode.id, negativeNode.id)) {
        const hasLoad = components.some(c =>
          (c.type === 'bulb' || c.type === 'resistor' || c.type === 'bar') &&
          c.nodes.some(n => this.uf.connected(n.id, positiveNode.id))
        );

        if (!hasLoad) {
          return {
            hasShort: true,
            description: '电路中没有负载，电源直接短路！',
          };
        }
      }
    }

    return { hasShort: false, description: '' };
  }

  private analyzeTopology(components: CircuitComponent[], wires: Wire[]): TopologyInfo {
    const powerSources = components.filter(c => c.type === 'power');
    const loads = components.filter(c =>
      c.type === 'bulb' || c.type === 'resistor' || c.type === 'bar'
    );

    const nodeToComponent = new Map<string, CircuitComponent>();
    components.forEach(comp => {
      comp.nodes.forEach(node => nodeToComponent.set(node.id, comp));
    });

    const adjacency = new Map<string, string[]>();
    wires.forEach(wire => {
      if (!adjacency.has(wire.fromNodeId)) adjacency.set(wire.fromNodeId, []);
      if (!adjacency.has(wire.toNodeId)) adjacency.set(wire.toNodeId, []);
      adjacency.get(wire.fromNodeId)!.push(wire.toNodeId);
      adjacency.get(wire.toNodeId)!.push(wire.fromNodeId);
    });

    const seriesPaths: string[][] = [];
    const parallelGroups: string[][] = [];

    const groups = this.uf.getGroups();
    for (const [, nodeIds] of groups) {
      const groupComponents = new Set<string>();
      nodeIds.forEach(nodeId => {
        const comp = nodeToComponent.get(nodeId);
        if (comp && comp.type !== 'power') {
          groupComponents.add(comp.id);
        }
      });

      if (groupComponents.size > 1) {
        const compList = Array.from(groupComponents);
        const isSeries = this.isSeriesConnection(compList, adjacency, nodeToComponent, wires);
        if (isSeries) {
          seriesPaths.push(compList);
        } else {
          parallelGroups.push(compList);
        }
      }
    }

    return { seriesPaths, parallelGroups, powerSources, loads };
  }

  private isSeriesConnection(
    componentIds: string[],
    adjacency: Map<string, string[]>,
    nodeToComponent: Map<string, CircuitComponent>,
    wires: Wire[]
  ): boolean {
    if (componentIds.length < 2) return true;

    const componentNodeCount = new Map<string, number>();
    componentIds.forEach(id => {
      const comp = nodeToComponent.get(id);
      if (comp) {
        componentNodeCount.set(id, comp.nodes.length);
      }
    });

    const connectionCount = new Map<string, number>();
    wires.forEach(wire => {
      const comp1 = nodeToComponent.get(wire.fromNodeId);
      const comp2 = nodeToComponent.get(wire.toNodeId);
      if (comp1 && componentIds.includes(comp1.id)) {
        connectionCount.set(comp1.id, (connectionCount.get(comp1.id) || 0) + 1);
      }
      if (comp2 && componentIds.includes(comp2.id)) {
        connectionCount.set(comp2.id, (connectionCount.get(comp2.id) || 0) + 1);
      }
    });

    let endCount = 0;
    for (const id of componentIds) {
      const expectedConnections = (componentNodeCount.get(id) || 2);
      const actualConnections = connectionCount.get(id) || 0;
      if (actualConnections === 1) {
        endCount++;
      } else if (actualConnections > expectedConnections) {
        return false;
      }
    }

    return endCount <= 2;
  }

  private calculateVoltagesAndCurrents(
    components: CircuitComponent[],
    wires: Wire[],
    topology: TopologyInfo
  ): {
    updatedComponents: CircuitComponent[];
    updatedWires: Wire[];
    voltageMap: Map<string, number>;
    currentMap: Map<string, number>;
  } {
    const voltageMap = new Map<string, number>();
    const currentMap = new Map<string, number>();

    const { powerSources } = topology;

    const groundNode = this.findGroundNode(components, wires);
    if (groundNode) {
      voltageMap.set(groundNode.id, 0);
    }

    powerSources.forEach(power => {
      if (power.nodes.length >= 2 && power.properties.voltage) {
        const sourceVoltage = power.properties.voltage;
        const posNode = power.nodes[0];
        const negNode = power.nodes[1];

        voltageMap.set(posNode.id, sourceVoltage);
        voltageMap.set(negNode.id, 0);
      }
    });

    const groups = this.uf.getGroups();
    for (const [, nodeIds] of groups) {
      let groupVoltage = 0;
      let hasPower = false;

      for (const nodeId of nodeIds) {
        if (voltageMap.has(nodeId)) {
          groupVoltage = voltageMap.get(nodeId)!;
          hasPower = true;
          break;
        }
      }

      if (hasPower) {
        nodeIds.forEach(nodeId => {
          if (!voltageMap.has(nodeId)) {
            voltageMap.set(nodeId, groupVoltage);
          }
        });
      }
    }

    this.propagateVoltages(components, wires, voltageMap, topology);
    this.calculateBranchCurrents(components, wires, voltageMap, currentMap, topology);

    const updatedComponents = components.map(comp => ({ ...comp }));
    const updatedWires = wires.map(wire => ({ ...wire }));

    return { updatedComponents, updatedWires, voltageMap, currentMap };
  }

  private findGroundNode(components: CircuitComponent[], wires: Wire[]): CircuitNode | null {
    const powerComponents = components.filter(c => c.type === 'power');
    for (const power of powerComponents) {
      if (power.nodes.length >= 2) {
        return power.nodes[1];
      }
    }
    return null;
  }

  private propagateVoltages(
    components: CircuitComponent[],
    wires: Wire[],
    voltageMap: Map<string, number>,
    topology: TopologyInfo
  ): void {
    const { seriesPaths, parallelGroups } = topology;

    seriesPaths.forEach(path => {
      const pathComponents = path
        .map(id => components.find(c => c.id === id))
        .filter(Boolean) as CircuitComponent[];

      let totalResistance = 0;
      pathComponents.forEach(comp => {
        if (comp.properties.resistance) {
          totalResistance += comp.properties.resistance;
        }
      });

      if (totalResistance > 0) {
        let currentVoltage = voltageMap.get(pathComponents[0].nodes[0].id) || 0;

        pathComponents.forEach(comp => {
          const resistance = comp.properties.resistance || 0;
          const voltageDrop = totalResistance > 0 ? (resistance / totalResistance) * currentVoltage : 0;

          if (comp.nodes.length >= 2) {
            const inNode = comp.nodes[0];
            const outNode = comp.nodes[1];

            if (!voltageMap.has(inNode.id)) {
              voltageMap.set(inNode.id, currentVoltage);
            }
            voltageMap.set(outNode.id, currentVoltage - voltageDrop);
            currentVoltage -= voltageDrop;
          }
        });
      }
    });

    parallelGroups.forEach(group => {
      const groupComponents = group
        .map(id => components.find(c => c.id === id))
        .filter(Boolean) as CircuitComponent[];

      if (groupComponents.length > 0) {
        const firstComp = groupComponents[0];
        const inputVoltage = voltageMap.get(firstComp.nodes[0].id) || 0;
        const outputVoltage = voltageMap.get(firstComp.nodes[1].id) || 0;
        const voltageAcross = inputVoltage - outputVoltage;

        groupComponents.forEach(comp => {
          if (comp.nodes.length >= 2) {
            if (!voltageMap.has(comp.nodes[0].id)) {
              voltageMap.set(comp.nodes[0].id, inputVoltage);
            }
            if (!voltageMap.has(comp.nodes[1].id)) {
              voltageMap.set(comp.nodes[1].id, outputVoltage);
            }
          }
        });
      }
    });
  }

  private calculateBranchCurrents(
    components: CircuitComponent[],
    wires: Wire[],
    voltageMap: Map<string, number>,
    currentMap: Map<string, number>,
    topology: TopologyInfo
  ): void {
    const { seriesPaths, parallelGroups } = topology;

    seriesPaths.forEach(path => {
      const pathComponents = path
        .map(id => components.find(c => c.id === id))
        .filter(Boolean) as CircuitComponent[];

      if (pathComponents.length >= 2) {
        const firstComp = pathComponents[0];
        const lastComp = pathComponents[pathComponents.length - 1];

        const vIn = voltageMap.get(firstComp.nodes[0].id) || 0;
        const vOut = voltageMap.get(lastComp.nodes[1].id) || 0;
        const totalVoltage = vIn - vOut;

        let totalResistance = 0;
        pathComponents.forEach(comp => {
          if (comp.properties.resistance) {
            totalResistance += comp.properties.resistance;
          }
        });

        const current = totalResistance > 0 ? totalVoltage / totalResistance : 0;

        pathComponents.forEach(comp => {
          comp.nodes.forEach(node => {
            currentMap.set(node.id, current);
          });
        });
      }
    });

    parallelGroups.forEach(group => {
      const groupComponents = group
        .map(id => components.find(c => c.id === id))
        .filter(Boolean) as CircuitComponent[];

      groupComponents.forEach(comp => {
        if (comp.nodes.length >= 2) {
          const vIn = voltageMap.get(comp.nodes[0].id) || 0;
          const vOut = voltageMap.get(comp.nodes[1].id) || 0;
          const voltageAcross = vIn - vOut;
          const resistance = comp.properties.resistance || 1;
          const current = voltageAcross / resistance;

          comp.nodes.forEach(node => {
            currentMap.set(node.id, current);
          });
        }
      });
    });

    wires.forEach(wire => {
      const fromCurrent = currentMap.get(wire.fromNodeId) || 0;
      const toCurrent = currentMap.get(wire.toNodeId) || 0;
      const avgCurrent = (Math.abs(fromCurrent) + Math.abs(toCurrent)) / 2;
      currentMap.set(wire.id, avgCurrent);
    });
  }

  private checkParallelCurrents(
    components: CircuitComponent[],
    wires: Wire[],
    currentMap: Map<string, number>
  ): Array<{ description: string; wireId?: string; componentId?: string }> {
    const errors: Array<{ description: string; wireId?: string; componentId?: string }> = [];

    const groups = this.uf.getGroups();
    for (const [, nodeIds] of groups) {
      const parallelComponents = components.filter(comp =>
        comp.type !== 'power' &&
        comp.nodes.some(n => nodeIds.includes(n.id))
      );

      if (parallelComponents.length > 1) {
        let totalCurrent = 0;
        const currents: number[] = [];

        parallelComponents.forEach(comp => {
          if (comp.nodes.length >= 2) {
            const current = currentMap.get(comp.nodes[0].id) || 0;
            currents.push(Math.abs(current));
            totalCurrent += Math.abs(current);
          }
        });

        if (currents.length > 1) {
          const avgCurrent = totalCurrent / currents.length;
          const maxDeviation = Math.max(...currents.map(c => Math.abs(c - avgCurrent) / avgCurrent));

          if (maxDeviation > 0.5 && avgCurrent > 0.1) {
            errors.push({
              description: `并联支路电流分配不均，最大偏差${(maxDeviation * 100).toFixed(0)}%，请检查电阻配置。`,
            });
          }
        }
      }
    }

    return errors;
  }

  private calculateTotalVoltage(components: CircuitComponent[], voltageMap: Map<string, number>): number {
    const powers = components.filter(c => c.type === 'power');
    if (powers.length === 0) return 0;

    let totalVoltage = 0;
    powers.forEach(power => {
      if (power.nodes.length >= 2 && power.properties.voltage) {
        const v1 = voltageMap.get(power.nodes[0].id) || 0;
        const v2 = voltageMap.get(power.nodes[1].id) || 0;
        totalVoltage += Math.abs(v1 - v2);
      }
    });

    return totalVoltage;
  }

  private calculateTotalCurrent(wires: Wire[], currentMap: Map<string, number>): number {
    let totalCurrent = 0;
    wires.forEach(wire => {
      const current = currentMap.get(wire.id) || 0;
      totalCurrent += Math.abs(current);
    });
    return totalCurrent / Math.max(wires.length, 1);
  }

  private getNodeById(components: CircuitComponent[], nodeId: string): CircuitNode | null {
    for (const comp of components) {
      const node = comp.nodes.find(n => n.id === nodeId);
      if (node) return node;
    }
    return null;
  }

  private createIncident(
    type: IncidentType,
    description: string,
    sourceWireId?: string,
    sourceComponentId?: string,
    penalty: number = 10
  ): Incident {
    return {
      id: uuidv4(),
      type,
      timestamp: Date.now(),
      gameTime: 0,
      description,
      sourceWireId,
      sourceComponentId,
      resolved: false,
      snapshotId: uuidv4(),
      penalty,
    };
  }
}

export const circuitEngine = new CircuitEngine();

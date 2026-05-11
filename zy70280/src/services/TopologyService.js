const { NetworkNode, Valve, Pipe, Community, Hospital, FireHydrant, PriorityUser } = require('../models');

class TopologyService {
  static async buildNetworkGraph() {
    const nodes = await NetworkNode.findAll();
    const pipes = await Pipe.findAll();
    const valves = await Valve.findAll();
    
    const graph = {
      nodes: {},
      edges: []
    };
    
    nodes.forEach(node => {
      graph.nodes[node.id] = {
        id: node.id,
        name: node.name,
        type: node.nodeType,
        longitude: node.longitude,
        latitude: node.latitude,
        connectedNodes: []
      };
    });
    
    pipes.forEach(pipe => {
      graph.edges.push({
        id: pipe.id,
        startNodeId: pipe.startNodeId,
        endNodeId: pipe.endNodeId,
        status: pipe.status
      });
      
      if (graph.nodes[pipe.startNodeId] && graph.nodes[pipe.endNodeId]) {
        graph.nodes[pipe.startNodeId].connectedNodes.push(pipe.endNodeId);
        graph.nodes[pipe.endNodeId].connectedNodes.push(pipe.startNodeId);
      }
    });
    
    return graph;
  }
  
  static async getValvesForNode(nodeId) {
    return await Valve.findAll({
      where: { networkNodeId: nodeId }
    });
  }
  
  static async findAffectedNodesByValves(valveIds) {
    const graph = await this.buildNetworkGraph();
    const valves = await Valve.findAll({
      where: { id: valveIds }
    });
    
    const affectedNodeIds = new Set();
    const blockedEdges = new Set();
    
    for (const valve of valves) {
      if (!graph.nodes[valve.networkNodeId]) continue;
      
      const node = graph.nodes[valve.networkNodeId];
      const connectedNodes = node.connectedNodes;
      
      for (const connectedNodeId of connectedNodes) {
        blockedEdges.add(`${valve.networkNodeId}-${connectedNodeId}`);
        blockedEdges.add(`${connectedNodeId}-${valve.networkNodeId}`);
      }
    }
    
    const sourceNodes = Object.values(graph.nodes)
      .filter(node => node.type === 'source')
      .map(node => node.id);
    
    const reachableFromSource = new Set();
    const queue = [...sourceNodes];
    const visited = new Set();
    
    while (queue.length > 0) {
      const current = queue.shift();
      if (visited.has(current)) continue;
      visited.add(current);
      reachableFromSource.add(current);
      
      const node = graph.nodes[current];
      if (!node) continue;
      
      for (const neighbor of node.connectedNodes) {
        const edgeKey = `${current}-${neighbor}`;
        if (!blockedEdges.has(edgeKey) && !visited.has(neighbor)) {
          queue.push(neighbor);
        }
      }
    }
    
    const allNodeIds = new Set(Object.keys(graph.nodes));
    for (const nodeId of allNodeIds) {
      if (!reachableFromSource.has(nodeId)) {
        affectedNodeIds.add(nodeId);
      }
    }
    
    return Array.from(affectedNodeIds);
  }
  
  static async analyzeImpact(valveIds) {
    const affectedNodeIds = await this.findAffectedNodesByValves(valveIds);
    
    const [communities, hospitals, fireHydrants, priorityUsers] = await Promise.all([
      Community.findAll({
        where: { networkNodeId: affectedNodeIds }
      }),
      Hospital.findAll({
        where: { networkNodeId: affectedNodeIds }
      }),
      FireHydrant.findAll({
        where: { networkNodeId: affectedNodeIds }
      }),
      PriorityUser.findAll({
        where: { networkNodeId: affectedNodeIds }
      })
    ]);
    
    const totalHouseholds = communities.reduce((sum, c) => sum + c.households, 0);
    const totalPopulation = communities.reduce((sum, c) => sum + (c.population || 0), 0);
    
    return {
      affectedNodeIds,
      communities,
      hospitals,
      fireHydrants,
      priorityUsers,
      totalHouseholds,
      totalPopulation
    };
  }
  
  static async recommendValves(pipeId) {
    const pipe = await Pipe.findByPk(pipeId);
    if (!pipe) {
      throw new Error(`管道 ${pipeId} 不存在`);
    }
    
    const startValves = await Valve.findAll({
      where: { networkNodeId: pipe.startNodeId }
    });
    
    const endValves = await Valve.findAll({
      where: { networkNodeId: pipe.endNodeId }
    });
    
    return {
      startValves,
      endValves,
      recommended: [...startValves, ...endValves].filter(v => v.status === 'open')
    };
  }
}

module.exports = TopologyService;
const PathNode = require('./PathNode');

class PathManager {
  constructor() {
    this.nodes = new Map();
    this.connections = [];
  }

  addNode(node) {
    this.nodes.set(node.id, node);
    return this;
  }

  addNodes(nodes) {
    nodes.forEach(node => this.addNode(PathNode.fromJSON(node)));
    return this;
  }

  addConnection(fromId, toId) {
    if (this.nodes.has(fromId) && this.nodes.has(toId)) {
      const existing = this.connections.find(
        c => (c.from === fromId && c.to === toId) || (c.from === toId && c.to === fromId)
      );
      if (!existing) {
        this.connections.push({ from: fromId, to: toId });
      }
    }
    return this;
  }

  addConnections(connections) {
    connections.forEach(c => this.addConnection(c.from, c.to));
    return this;
  }

  getNode(id) {
    return this.nodes.get(id);
  }

  getAllNodes() {
    return Array.from(this.nodes.values());
  }

  getNeighbors(nodeId) {
    const neighbors = [];
    this.connections.forEach(c => {
      if (c.from === nodeId) neighbors.push(this.nodes.get(c.to));
      else if (c.to === nodeId) neighbors.push(this.nodes.get(c.from));
    });
    return neighbors.filter(n => n !== undefined);
  }

  calculateTotalDistance(nodeIds) {
    let distance = 0;
    for (let i = 0; i < nodeIds.length - 1; i++) {
      const node1 = this.getNode(nodeIds[i]);
      const node2 = this.getNode(nodeIds[i + 1]);
      if (node1 && node2) {
        distance += node1.distanceTo(node2);
      }
    }
    return distance;
  }

  calculateTotalElevationGain(nodeIds) {
    let gain = 0;
    for (let i = 0; i < nodeIds.length - 1; i++) {
      const node1 = this.getNode(nodeIds[i]);
      const node2 = this.getNode(nodeIds[i + 1]);
      if (node1 && node2) {
        const diff = node2.elevation - node1.elevation;
        if (diff > 0) gain += diff;
      }
    }
    return gain;
  }

  calculateTotalElevationLoss(nodeIds) {
    let loss = 0;
    for (let i = 0; i < nodeIds.length - 1; i++) {
      const node1 = this.getNode(nodeIds[i]);
      const node2 = this.getNode(nodeIds[i + 1]);
      if (node1 && node2) {
        const diff = node1.elevation - node2.elevation;
        if (diff > 0) loss += diff;
      }
    }
    return loss;
  }

  getElevationProfile(nodeIds) {
    return nodeIds.map(id => {
      const node = this.getNode(id);
      return node ? { id: node.id, name: node.name, elevation: node.elevation } : null;
    }).filter(p => p !== null);
  }

  findShortestPath(startId, endId, useElevation = false) {
    const distances = new Map();
    const previous = new Map();
    const unvisited = new Set(this.nodes.keys());

    this.nodes.forEach((_, id) => {
      distances.set(id, id === startId ? 0 : Infinity);
      previous.set(id, null);
    });

    while (unvisited.size > 0) {
      let currentId = null;
      let minDist = Infinity;
      unvisited.forEach(id => {
        if (distances.get(id) < minDist) {
          minDist = distances.get(id);
          currentId = id;
        }
      });

      if (currentId === null || currentId === endId) break;
      unvisited.delete(currentId);

      const currentNode = this.getNode(currentId);
      if (!currentNode) continue;

      this.getNeighbors(currentId).forEach(neighbor => {
        if (!unvisited.has(neighbor.id)) return;
        
        let distance = currentNode.distanceTo(neighbor);
        if (useElevation) {
          const elevationDiff = Math.abs(currentNode.elevationDiff(neighbor));
          distance += elevationDiff * 0.1;
        }

        const alt = distances.get(currentId) + distance;
        if (alt < distances.get(neighbor.id)) {
          distances.set(neighbor.id, alt);
          previous.set(neighbor.id, currentId);
        }
      });
    }

    const path = [];
    let current = endId;
    while (current !== null) {
      path.unshift(current);
      current = previous.get(current);
    }

    return path.length > 1 && path[0] === startId ? path : null;
  }
}

module.exports = PathManager;

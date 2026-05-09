class PathNode {
  constructor(id, name, x, y, elevation, type = 'normal') {
    this.id = id;
    this.name = name;
    this.x = x;
    this.y = y;
    this.elevation = elevation;
    this.type = type;
    this.riskLevel = 0;
    this.visited = false;
  }

  static fromJSON(json) {
    const node = new PathNode(json.id, json.name, json.x, json.y, json.elevation, json.type);
    if (json.riskLevel !== undefined) node.riskLevel = json.riskLevel;
    if (json.visited !== undefined) node.visited = json.visited;
    return node;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      x: this.x,
      y: this.y,
      elevation: this.elevation,
      type: this.type,
      riskLevel: this.riskLevel,
      visited: this.visited
    };
  }

  distanceTo(other) {
    return Math.sqrt(Math.pow(this.x - other.x, 2) + Math.pow(this.y - other.y, 2));
  }

  elevationDiff(other) {
    return other.elevation - this.elevation;
  }
}

module.exports = PathNode;

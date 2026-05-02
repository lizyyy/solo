import { Trace, Span, ClockSkewWarning } from './types';

export class TraceBuilder {
  buildTree(trace: Trace): TraceTree {
    const warnings: ClockSkewWarning[] = [];
    const spanMap = new Map<string, SpanNode>();

    for (const span of trace.spans) {
      this.detectClockSkew(span, warnings);
      const node = new SpanNode(span);
      spanMap.set(span.spanId, node);
    }

    for (const span of trace.spans) {
      const node = spanMap.get(span.spanId)!;
      if (span.parentSpanId && spanMap.has(span.parentSpanId)) {
        const parent = spanMap.get(span.parentSpanId)!;
        parent.addChild(node);
        node.setParent(parent);
      }
    }

    const rootNodes = Array.from(spanMap.values()).filter(n => !n.parent);
    const orphans = Array.from(spanMap.values()).filter(n => n.parent === null && n.span.parentSpanId !== undefined);

    return new TraceTree(trace.traceId, rootNodes, spanMap, orphans, warnings);
  }

  private detectClockSkew(span: Span, warnings: ClockSkewWarning[]): void {
    if (span.endTime < span.startTime) {
      warnings.push({
        traceId: span.traceId,
        spanId: span.spanId,
        issue: 'end_before_start',
        details: `Span ${span.spanId} has endTime (${span.endTime}) before startTime (${span.startTime})`,
      });
    }
  }

  checkParentChildTiming(parent: Span, child: Span, warnings: ClockSkewWarning[]): void {
    if (child.endTime > parent.endTime) {
      warnings.push({
        traceId: parent.traceId,
        spanId: child.spanId,
        issue: 'parent_end_after_child',
        details: `Child span ${child.spanId} ends after parent ${parent.spanId}`,
      });
    }
  }
}

export class SpanNode {
  readonly span: Span;
  private children: SpanNode[] = [];
  public parent: SpanNode | null = null;

  constructor(span: Span) {
    this.span = span;
  }

  addChild(node: SpanNode): void {
    this.children.push(node);
  }

  getChildren(): SpanNode[] {
    return this.children;
  }

  setParent(parent: SpanNode): void {
    this.parent = parent;
  }

  getDepth(): number {
    let depth = 0;
    let current: SpanNode | null = this.parent;
    while (current) {
      depth++;
      current = current.parent;
    }
    return depth;
  }

  getPath(): string[] {
    const path: string[] = [];
    let current: SpanNode | null = this;
    while (current) {
      path.unshift(current.span.operationName);
      current = current.parent;
    }
    return path;
  }
}

export class TraceTree {
  readonly traceId: string;
  readonly rootNodes: SpanNode[];
  readonly spanMap: Map<string, SpanNode>;
  readonly orphanNodes: SpanNode[];
  readonly clockSkewWarnings: ClockSkewWarning[];

  constructor(
    traceId: string,
    rootNodes: SpanNode[],
    spanMap: Map<string, SpanNode>,
    orphanNodes: SpanNode[],
    clockSkewWarnings: ClockSkewWarning[]
  ) {
    this.traceId = traceId;
    this.rootNodes = rootNodes;
    this.spanMap = spanMap;
    this.orphanNodes = orphanNodes;
    this.clockSkewWarnings = clockSkewWarnings;
  }

  getAllSpans(): Span[] {
    return Array.from(this.spanMap.values()).map(n => n.span);
  }

  getSpanById(spanId: string): Span | undefined {
    return this.spanMap.get(spanId)?.span;
  }

  hasError(): boolean {
    for (const node of this.spanMap.values()) {
      if (node.span.status.code !== 0) {
        return true;
      }
    }
    return false;
  }

  getErrorSpans(): Span[] {
    return Array.from(this.spanMap.values())
      .filter(n => n.span.status.code !== 0)
      .map(n => n.span);
  }

  getErrorPath(): string[] | null {
    const errorSpans = this.getErrorSpans();
    if (errorSpans.length === 0) return null;

    for (const errorSpan of errorSpans) {
      const node = this.spanMap.get(errorSpan.spanId);
      if (node) {
        return node.getPath();
      }
    }
    return null;
  }

  getDuration(): number {
    let minTime = Infinity;
    let maxTime = -Infinity;
    for (const node of this.spanMap.values()) {
      minTime = Math.min(minTime, node.span.startTime);
      maxTime = Math.max(maxTime, node.span.endTime);
    }
    return maxTime - minTime;
  }

  findBlindPaths(droppedSpanIds: Set<string>): string[][] {
    const blindPaths: string[][] = [];

    for (const [spanId, node] of this.spanMap.entries()) {
      if (droppedSpanIds.has(spanId)) continue;

      if (node.parent && droppedSpanIds.has(node.parent.span.spanId)) {
        const path = this.collectPathFromRoot(node);
        blindPaths.push(path);
      }
    }

    return blindPaths;
  }

  private collectPathFromRoot(node: SpanNode): string[] {
    const path: string[] = [];
    let current: SpanNode | null = node;
    while (current) {
      path.push(current.span.operationName);
      current = current.parent;
    }
    return path.reverse();
  }
}
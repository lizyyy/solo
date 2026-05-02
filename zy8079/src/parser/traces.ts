import * as fs from 'fs';
import * as readline from 'readline';
import { Span, Trace } from '../model/types';

export class TracesParser {
  async parseFile(filePath: string): Promise<Trace[]> {
    const spans = await this.parseSpansFromJsonl(filePath);
    return this.groupSpansIntoTraces(spans);
  }

  private async parseSpansFromJsonl(filePath: string): Promise<Span[]> {
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
    const spans: Span[] = [];

    for await (const line of rl) {
      if (line.trim()) {
        const json = JSON.parse(line);
        spans.push(this.normalizeSpan(json));
      }
    }

    return spans;
  }

  private normalizeSpan(raw: Record<string, unknown>): Span {
    return {
      traceId: raw.traceId as string || raw.trace_id as string,
      spanId: raw.spanId as string || raw.span_id as string,
      parentSpanId: raw.parentSpanId as string || raw.parent_span_id as string,
      serviceName: raw.serviceName as string || raw.service_name as string || 'unknown',
      operationName: raw.operationName as string || raw.name as string || raw.operation_name as string,
      startTime: typeof raw.startTime === 'number' ? raw.startTime : 
                 typeof raw.start_time === 'number' ? raw.start_time :
                 new Date(raw.startTime as string || raw.start_time as string).getTime(),
      endTime: typeof raw.endTime === 'number' ? raw.endTime :
               typeof raw.end_time === 'number' ? raw.end_time :
               new Date(raw.endTime as string || raw.end_time as string).getTime(),
      status: this.normalizeStatus(raw.status),
      attributes: (raw.attributes as Record<string, unknown>) || {},
      events: (raw.events as SpanEvent[]) || [],
    };
  }

  private normalizeStatus(status: unknown): SpanStatus {
    if (typeof status === 'number') {
      return { code: status };
    }
    if (typeof status === 'object' && status !== null) {
      const s = status as Record<string, unknown>;
      return { code: s.code as number, message: s.message as string };
    }
    return { code: 0 };
  }

  private groupSpansIntoTraces(spans: Span[]): Trace[] {
    const traceMap = new Map<string, Trace>();

    for (const span of spans) {
      if (!traceMap.has(span.traceId)) {
        traceMap.set(span.traceId, {
          traceId: span.traceId,
          spans: [],
          startTime: span.startTime,
          endTime: span.endTime,
        });
      }
      const trace = traceMap.get(span.traceId)!;
      trace.spans.push(span);
      trace.startTime = Math.min(trace.startTime, span.startTime);
      trace.endTime = Math.max(trace.endTime, span.endTime);
    }

    for (const trace of traceMap.values()) {
      trace.rootSpan = trace.spans.find(s => !s.parentSpanId);
    }

    return Array.from(traceMap.values());
  }
}

interface SpanEvent {
  name: string;
  timestamp: number;
  attributes?: Record<string, unknown>;
}

interface SpanStatus {
  code: number;
  message?: string;
}
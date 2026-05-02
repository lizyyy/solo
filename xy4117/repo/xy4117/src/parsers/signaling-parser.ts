import { 
  SignalingEvent, 
  LogSource,
  RTCIceCandidateInit,
  RTCPeerConnectionState,
  RTCIceConnectionState
} from '../types';
import { BaseParser } from './base';
import { safeJsonParse, isObject, parseTimestamp } from '../utils';

interface RawSignalingEvent {
  timestamp?: number;
  time?: string | number;
  type?: string;
  event?: string;
  subtype?: string;
  direction?: 'send' | 'receive';
  sdp?: string;
  candidate?: RTCIceCandidateInit;
  connectionState?: RTCPeerConnectionState;
  iceConnectionState?: RTCIceConnectionState;
  error?: {
    name: string;
    message: string;
  };
  [key: string]: unknown;
}

export class SignalingParser extends BaseParser {
  protected getSourceType(): 'signaling' {
    return 'signaling';
  }

  async parse(content: string): Promise<{
    events: SignalingEvent[];
    source: LogSource;
  }> {
    const rawEvents = this.parseContent(content);
    
    if (rawEvents.length === 0) {
      throw new Error('没有找到有效的信令日志数据');
    }

    const events = rawEvents.map(event => this.convertToSignalingEvent(event));
    
    const { start, end } = this.getTimeRange(events);
    const source = this.createLogSource(start, end);

    return { events, source };
  }

  private parseContent(content: string): RawSignalingEvent[] {
    const parsed = safeJsonParse(content);
    
    if (Array.isArray(parsed)) {
      return parsed.filter(isObject).map(item => this.normalizeRawEvent(item));
    }
    
    if (isObject(parsed)) {
      if (this.looksLikeSignalingEvent(parsed)) {
        return [this.normalizeRawEvent(parsed)];
      }
      
      const values = Object.values(parsed);
      const objectValues = values.filter(isObject);
      if (objectValues.length > 0 && objectValues.some(v => this.looksLikeSignalingEvent(v))) {
        return objectValues.filter(v => this.looksLikeSignalingEvent(v)).map(v => this.normalizeRawEvent(v));
      }
    }

    const lines = content.trim().split('\n');
    if (lines.length > 0) {
      const events: RawSignalingEvent[] = [];
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        try {
          const parsedLine = JSON.parse(line);
          if (isObject(parsedLine) && this.looksLikeSignalingEvent(parsedLine)) {
            events.push(this.normalizeRawEvent(parsedLine));
          }
        } catch {
          const textEvent = this.tryParseTextLine(line, i);
          if (textEvent) {
            events.push(textEvent);
          }
        }
      }
      
      if (events.length > 0) {
        return events;
      }
    }

    return [];
  }

  private looksLikeSignalingEvent(obj: Record<string, unknown>): boolean {
    const signalingKeywords = ['offer', 'answer', 'candidate', 'ice', 'sdp', 'connectionstate', 'state'];
    const keys = Object.keys(obj).map(k => k.toLowerCase());
    
    for (const keyword of signalingKeywords) {
      if (keys.some(k => k.includes(keyword))) {
        return true;
      }
    }
    
    if ('type' in obj && typeof obj.type === 'string') {
      const type = obj.type.toLowerCase();
      if (['offer', 'answer', 'ice_candidate', 'ice-restart', 'renegotiation', 'error', 'state_change'].includes(type)) {
        return true;
      }
    }
    
    return false;
  }

  private normalizeRawEvent(obj: Record<string, unknown>): RawSignalingEvent {
    const event: RawSignalingEvent = {};
    
    if ('timestamp' in obj && typeof obj.timestamp === 'number') {
      event.timestamp = obj.timestamp;
    } else if ('time' in obj) {
      event.time = obj.time as string | number;
    }
    
    if ('type' in obj && typeof obj.type === 'string') {
      event.type = obj.type;
    } else if ('event' in obj && typeof obj.event === 'string') {
      event.event = obj.event;
    }
    
    if ('subtype' in obj && typeof obj.subtype === 'string') {
      event.subtype = obj.subtype;
    }
    
    if ('direction' in obj && (obj.direction === 'send' || obj.direction === 'receive')) {
      event.direction = obj.direction;
    } else if ('from' in obj || 'sent' in obj) {
      event.direction = 'send';
    } else if ('to' in obj || 'received' in obj) {
      event.direction = 'receive';
    }
    
    if ('sdp' in obj && typeof obj.sdp === 'string') {
      event.sdp = obj.sdp;
    }
    
    if ('candidate' in obj && isObject(obj.candidate)) {
      const candidateObj = obj.candidate as Record<string, unknown>;
      event.candidate = {
        candidate: String(candidateObj.candidate || ''),
        sdpMid: candidateObj.sdpMid !== undefined ? String(candidateObj.sdpMid) : undefined,
        sdpMLineIndex: candidateObj.sdpMLineIndex !== undefined ? Number(candidateObj.sdpMLineIndex) : undefined,
        usernameFragment: candidateObj.usernameFragment !== undefined ? String(candidateObj.usernameFragment) : undefined
      };
    }
    
    if ('connectionState' in obj || 'peerConnectionState' in obj) {
      event.connectionState = (obj.connectionState || obj.peerConnectionState) as RTCPeerConnectionState;
    }
    
    if ('iceConnectionState' in obj || 'iceState' in obj) {
      event.iceConnectionState = (obj.iceConnectionState || obj.iceState) as RTCIceConnectionState;
    }
    
    if ('error' in obj && isObject(obj.error)) {
      event.error = {
        name: String((obj.error as Record<string, unknown>).name || 'Error'),
        message: String((obj.error as Record<string, unknown>).message || '')
      };
    }

    return event;
  }

  private tryParseTextLine(line: string, index: number): RawSignalingEvent | null {
    const timeMatch = line.match(/^\[?(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)\]?/);
    const simpleTimeMatch = line.match(/^(\d{2}:\d{2}:\d{2}(?:\.\d+)?)/);
    
    let timestamp: number | undefined;
    
    if (timeMatch) {
      timestamp = parseTimestamp(timeMatch[1]);
    } else if (simpleTimeMatch) {
      timestamp = parseTimestamp(simpleTimeMatch[1]);
    }

    const lowerLine = line.toLowerCase();
    let type: string | undefined;
    let subtype: string | undefined;
    let direction: 'send' | 'receive' | undefined;

    if (lowerLine.includes('offer')) {
      type = 'signaling_event';
      subtype = 'offer';
    } else if (lowerLine.includes('answer')) {
      type = 'signaling_event';
      subtype = 'answer';
    } else if (lowerLine.includes('ice') && lowerLine.includes('restart')) {
      type = 'signaling_event';
      subtype = 'ice_restart';
    } else if (lowerLine.includes('candidate')) {
      type = 'signaling_event';
      subtype = 'ice_candidate';
    } else if (lowerLine.includes('renegotiation') || lowerLine.includes('renegotiate')) {
      type = 'signaling_event';
      subtype = 'renegotiation';
    } else if (lowerLine.includes('connection') && lowerLine.includes('state')) {
      type = 'signaling_event';
      subtype = 'connection_state_change';
    } else if (lowerLine.includes('error')) {
      type = 'signaling_event';
      subtype = 'error';
    }

    if (lowerLine.includes('send') || lowerLine.includes('sent') || lowerLine.includes('->')) {
      direction = 'send';
    } else if (lowerLine.includes('receive') || lowerLine.includes('received') || lowerLine.includes('<-')) {
      direction = 'receive';
    }

    if (type || timestamp) {
      return {
        timestamp: timestamp || Date.now() + index * 1000,
        type,
        subtype,
        direction
      };
    }

    return null;
  }

  private convertToSignalingEvent(rawEvent: RawSignalingEvent): SignalingEvent {
    const timestamp = this.extractTimestamp(rawEvent);
    const subtype = this.determineSubtype(rawEvent);
    const direction = rawEvent.direction || 'receive';

    const event: SignalingEvent = {
      timestamp: this.adjustTimestamp(timestamp),
      type: 'signaling_event',
      source: 'signaling',
      subtype,
      direction,
      rawData: rawEvent
    };

    if (rawEvent.sdp) {
      event.sdp = rawEvent.sdp;
    }
    if (rawEvent.candidate) {
      event.candidate = rawEvent.candidate;
    }
    if (rawEvent.connectionState) {
      event.connectionState = rawEvent.connectionState;
    }
    if (rawEvent.iceConnectionState) {
      event.iceConnectionState = rawEvent.iceConnectionState;
    }
    if (rawEvent.error) {
      event.error = rawEvent.error;
    }

    return event;
  }

  private extractTimestamp(rawEvent: RawSignalingEvent): number {
    if (typeof rawEvent.timestamp === 'number') {
      return rawEvent.timestamp;
    }
    
    if (rawEvent.time !== undefined) {
      try {
        return parseTimestamp(rawEvent.time);
      } catch {
        return Date.now();
      }
    }
    
    return Date.now();
  }

  private determineSubtype(rawEvent: RawSignalingEvent): SignalingEvent['subtype'] {
    const typeStr = (rawEvent.type || rawEvent.event || rawEvent.subtype || '').toLowerCase();
    
    if (typeStr.includes('offer')) {
      return 'offer';
    }
    if (typeStr.includes('answer')) {
      return 'answer';
    }
    if (typeStr.includes('ice_restart') || typeStr.includes('ice-restart') || (typeStr.includes('ice') && typeStr.includes('restart'))) {
      return 'ice_restart';
    }
    if (typeStr.includes('candidate')) {
      return 'ice_candidate';
    }
    if (typeStr.includes('renegotiation') || typeStr.includes('renegotiate')) {
      return 'renegotiation';
    }
    if (typeStr.includes('error')) {
      return 'error';
    }
    if (typeStr.includes('state') || typeStr.includes('change')) {
      return 'connection_state_change';
    }
    
    return 'connection_state_change';
  }
}

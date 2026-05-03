import * as fs from 'fs';
import * as path from 'path';
import {
  MasterPlaylist,
  VariantInfo,
  AlternativeRendition,
  VariantPlaylist,
  SegmentInfo,
  DiscontinuityInfo,
  EncryptionKeyInfo,
} from '../types';

export class M3U8Parser {
  parseMasterPlaylist(content: string): MasterPlaylist {
    const lines = content.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    
    if (lines[0] !== '#EXTM3U') {
      throw new Error('Invalid M3U8 file: missing #EXTM3U header');
    }

    const master: MasterPlaylist = {
      version: 1,
      variants: [],
      alternativeRenditions: [],
      rawContent: content,
    };

    let i = 1;
    while (i < lines.length) {
      const line = lines[i];

      if (line.startsWith('#EXT-X-VERSION:')) {
        master.version = parseInt(line.substring('#EXT-X-VERSION:'.length), 10);
      } else if (line.startsWith('#EXT-X-STREAM-INF:')) {
        const variant = this.parseVariantInf(line, lines[i + 1]);
        if (variant) {
          master.variants.push(variant);
          i++;
        }
      } else if (line.startsWith('#EXT-X-MEDIA:')) {
        const rendition = this.parseAlternativeRendition(line);
        if (rendition) {
          master.alternativeRenditions.push(rendition);
        }
      }

      i++;
    }

    return master;
  }

  parseVariantPlaylist(content: string, fileName: string): VariantPlaylist {
    const lines = content.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

    if (lines[0] !== '#EXTM3U') {
      throw new Error('Invalid M3U8 file: missing #EXTM3U header');
    }

    const playlist: VariantPlaylist = {
      version: 1,
      targetDuration: 0,
      mediaSequence: 0,
      isEnded: false,
      isLive: true,
      segments: [],
      discontinuities: [],
      encryptionKeys: [],
      rawContent: content,
      fileName,
    };

    let currentSequence = 0;
    let currentTime = 0;
    let discontinuitySequence = 0;
    let currentEncryption: EncryptionKeyInfo | null = null;
    let lastProgramDateTime: Date | null = null;

    let i = 1;
    while (i < lines.length) {
      const line = lines[i];

      if (line.startsWith('#EXT-X-VERSION:')) {
        playlist.version = parseInt(line.substring('#EXT-X-VERSION:'.length), 10);
      } else if (line.startsWith('#EXT-X-TARGETDURATION:')) {
        playlist.targetDuration = parseInt(line.substring('#EXT-X-TARGETDURATION:'.length), 10);
      } else if (line.startsWith('#EXT-X-MEDIA-SEQUENCE:')) {
        playlist.mediaSequence = parseInt(line.substring('#EXT-X-MEDIA-SEQUENCE:'.length), 10);
        currentSequence = playlist.mediaSequence;
      } else if (line === '#EXT-X-ENDLIST') {
        playlist.isEnded = true;
        playlist.isLive = false;
      } else if (line === '#EXT-X-DISCONTINUITY') {
        playlist.discontinuities.push({
          sequenceNumber: currentSequence,
        });
        discontinuitySequence++;
      } else if (line.startsWith('#EXT-X-KEY:')) {
        const key = this.parseEncryptionKey(line, currentSequence);
        playlist.encryptionKeys.push(key);
        currentEncryption = key;
      } else if (line.startsWith('#EXT-X-PROGRAM-DATE-TIME:')) {
        const dateStr = line.substring('#EXT-X-PROGRAM-DATE-TIME:'.length);
        lastProgramDateTime = new Date(dateStr);
      } else if (line.startsWith('#EXTINF:')) {
        const segment = this.parseSegment(
          line,
          lines[i + 1],
          currentSequence,
          currentTime,
          discontinuitySequence,
          lastProgramDateTime,
          currentEncryption
        );
        if (segment) {
          playlist.segments.push(segment);
          currentTime += segment.duration;
          currentSequence++;
          if (lastProgramDateTime) {
            lastProgramDateTime = new Date(lastProgramDateTime.getTime() + segment.duration * 1000);
          }
          i++;
        }
      }

      i++;
    }

    return playlist;
  }

  private parseVariantInf(streamInfLine: string, uriLine: string): VariantInfo | null {
    if (!uriLine || uriLine.startsWith('#')) {
      return null;
    }

    const attributes = this.parseAttributes(streamInfLine.substring('#EXT-X-STREAM-INF:'.length));
    const variant: VariantInfo = {
      bandwidth: parseInt(attributes.get('BANDWIDTH') || '0', 10),
      codecs: attributes.get('CODECS') || '',
      uri: uriLine,
    };

    if (attributes.has('AVERAGE-BANDWIDTH')) {
      variant.averageBandwidth = parseInt(attributes.get('AVERAGE-BANDWIDTH')!, 10);
    }

    if (attributes.has('RESOLUTION')) {
      const res = attributes.get('RESOLUTION')!.split('x');
      variant.resolution = {
        width: parseInt(res[0], 10),
        height: parseInt(res[1], 10),
      };
    }

    if (attributes.has('FRAME-RATE')) {
      variant.frameRate = parseFloat(attributes.get('FRAME-RATE')!);
    }

    if (attributes.has('NAME')) {
      variant.name = attributes.get('NAME')!.replace(/"/g, '');
    }

    return variant;
  }

  private parseAlternativeRendition(line: string): AlternativeRendition | null {
    const attributes = this.parseAttributes(line.substring('#EXT-X-MEDIA:'.length));
    const type = attributes.get('TYPE') as 'AUDIO' | 'VIDEO' | 'SUBTITLES' | 'CLOSED-CAPTIONS';

    if (!type) return null;

    const rendition: AlternativeRendition = {
      type,
      groupId: attributes.get('GROUP-ID') || '',
      name: attributes.get('NAME') || '',
    };

    if (attributes.has('URI')) {
      rendition.uri = attributes.get('URI')!.replace(/"/g, '');
    }

    if (attributes.has('LANGUAGE')) {
      rendition.language = attributes.get('LANGUAGE')!.replace(/"/g, '');
    }

    if (attributes.has('DEFAULT')) {
      rendition.isDefault = attributes.get('DEFAULT') === 'YES';
    }

    if (attributes.has('AUTOSELECT')) {
      rendition.autoselect = attributes.get('AUTOSELECT') === 'YES';
    }

    return rendition;
  }

  private parseEncryptionKey(line: string, segmentStart: number): EncryptionKeyInfo {
    const attributes = this.parseAttributes(line.substring('#EXT-X-KEY:'.length));
    const method = attributes.get('METHOD') as 'NONE' | 'AES-128' | 'SAMPLE-AES' || 'NONE';

    const key: EncryptionKeyInfo = {
      method,
      segmentSequenceStart: segmentStart,
    };

    if (attributes.has('URI')) {
      key.uri = attributes.get('URI')!.replace(/"/g, '');
    }

    if (attributes.has('IV')) {
      key.iv = attributes.get('IV');
    }

    if (attributes.has('KEYFORMAT')) {
      key.keyFormat = attributes.get('KEYFORMAT')!.replace(/"/g, '');
    }

    if (attributes.has('KEYFORMATVERSIONS')) {
      key.keyFormatVersions = attributes.get('KEYFORMATVERSIONS');
    }

    return key;
  }

  private parseSegment(
    extInfLine: string,
    uriLine: string,
    sequenceNumber: number,
    startTime: number,
    discontinuitySequence: number,
    programDateTime: Date | null,
    encryptionKey: EncryptionKeyInfo | null
  ): SegmentInfo | null {
    if (!uriLine || uriLine.startsWith('#')) {
      return null;
    }

    const durationMatch = extInfLine.match(/#EXTINF:([\d.]+)(?:,(.*))?/);
    if (!durationMatch) {
      return null;
    }

    const duration = parseFloat(durationMatch[1]);

    const segment: SegmentInfo = {
      uri: uriLine,
      duration,
      sequenceNumber,
      startTime,
      endTime: startTime + duration,
      discontinuitySequence: discontinuitySequence > 0 ? discontinuitySequence : undefined,
      programDateTime: programDateTime || undefined,
    };

    if (encryptionKey && encryptionKey.method !== 'NONE') {
      segment.encryptionKeyId = encryptionKey.uri;
    }

    return segment;
  }

  private parseAttributes(attrString: string): Map<string, string> {
    const attrs = new Map<string, string>();
    const regex = /([A-Z0-9-]+)=(?:"([^"]*)"|([^,]+))/g;
    let match;

    while ((match = regex.exec(attrString)) !== null) {
      const key = match[1];
      const value = match[2] || match[3];
      if (value !== undefined) {
        attrs.set(key, value);
      }
    }

    return attrs;
  }

  async parseMasterPlaylistFile(filePath: string): Promise<MasterPlaylist> {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return this.parseMasterPlaylist(content);
  }

  async parseVariantPlaylistFile(filePath: string): Promise<VariantPlaylist> {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const fileName = path.basename(filePath);
    return this.parseVariantPlaylist(content, fileName);
  }
}

export default M3U8Parser;

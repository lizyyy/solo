class ChangelogParser {
  constructor() {
    this.versionRegex = /^##\s*\[?([^\]]+)\]?\s*(?:-\s*(.+))?$/;
    this.dateRegex = /\b(\d{4}[-/]\d{2}[-/]\d{2})\b/;
    this.entryRegex = /^[-*+]\s+(.+)$/;
    this.sectionRegex = /^###\s+(.+)$/;
  }

  parse(content) {
    const lines = content.split('\n');
    const entries = [];
    let currentVersion = null;
    let currentDate = null;
    let currentSection = null;
    let entryIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (!line) continue;

      const versionMatch = line.match(this.versionRegex);
      if (versionMatch) {
        currentVersion = versionMatch[1].trim();
        const dateMatch = versionMatch[2]?.match(this.dateRegex) || line.match(this.dateRegex);
        currentDate = dateMatch ? dateMatch[1] : null;
        currentSection = null;
        continue;
      }

      const sectionMatch = line.match(this.sectionRegex);
      if (sectionMatch) {
        currentSection = sectionMatch[1].trim();
        continue;
      }

      const entryMatch = line.match(this.entryRegex);
      if (entryMatch) {
        const fullContent = this.collectFullContent(lines, i);
        entryIndex++;

        entries.push({
          id: `entry-${entryIndex}`,
          lineNumber: i + 1,
          version: currentVersion,
          date: currentDate,
          section: currentSection,
          content: fullContent.content,
          raw: fullContent.raw,
          lines: fullContent.lines
        });

        i = fullContent.endLine - 1;
      }
    }

    return entries;
  }

  collectFullContent(lines, startIndex) {
    const rawLines = [lines[startIndex]];
    const contentLines = [lines[startIndex].replace(/^[-*+]\s+/, '')];
    let endIndex = startIndex;

    for (let i = startIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      if (!trimmed) {
        if (contentLines.length > 1 && contentLines[contentLines.length - 1] !== '') {
          contentLines.push('');
        }
        rawLines.push(line);
        continue;
      }

      if (/^[-*+]\s+/.test(line) || /^#{1,3}\s+/.test(line)) {
        break;
      }

      if (/^\s{2,}/.test(line) || /^\s*\d+\.\s+/.test(line) || /^\s*[-*+]\s+/.test(line)) {
        rawLines.push(line);
        contentLines.push(line.trim());
        endIndex = i;
        continue;
      }

      break;
    }

    while (contentLines.length > 0 && contentLines[contentLines.length - 1] === '') {
      contentLines.pop();
      rawLines.pop();
    }

    return {
      content: contentLines.join(' ').replace(/\s+/g, ' ').trim(),
      raw: rawLines.join('\n'),
      lines: [startIndex + 1, endIndex + 1],
      endLine: endIndex + 1
    };
  }

  parseUnstructured(content) {
    const entries = [];
    const lines = content.split('\n');
    let entryIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (!line || /^#/.test(line)) continue;

      if (line.length > 5 && (line.length < 200 || /^[-*+]\s+/.test(line) || /^\d+\.\s+/.test(line))) {
        entryIndex++;
        const content = line.replace(/^[-*+]\s+/, '').replace(/^\d+\.\s+/, '');

        entries.push({
          id: `entry-${entryIndex}`,
          lineNumber: i + 1,
          version: null,
          date: null,
          section: null,
          content: content,
          raw: line,
          lines: [i + 1, i + 1]
        });
      }
    }

    return entries;
  }
}

module.exports = ChangelogParser;

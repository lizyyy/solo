import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { MarkdownParser } from '../src/parser';
import { generateSlug, makeUniqueAnchor, isUrl, isAnchor, isLocalLink, parseAnchorFromHref } from '../src/utils';

describe('MarkdownParser', () => {
  let parser: MarkdownParser;
  let tempDir: string;

  beforeEach(() => {
    parser = new MarkdownParser({ caseSensitiveAnchors: false });
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docguard-test-'));
  });

  afterEach(() => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
  });

  describe('Link Parsing', () => {
    it('should parse standard markdown links', () => {
      const content = `
# Test

[Link Text](https://example.com)
[Local Link](./other.md)
[Anchor Link](#section)
`;
      const { links } = parser.parse(content, 'test.md');

      expect(links.length).toBe(3);
      expect(links[0].type).toBe('external');
      expect(links[0].href).toBe('https://example.com');
      expect(links[1].type).toBe('local');
      expect(links[1].href).toBe('./other.md');
      expect(links[2].type).toBe('anchor');
      expect(links[2].href).toBe('#section');
    });

    it('should parse markdown images', () => {
      const content = `
![Alt Text](./image.png)
![Alt with title](./image.jpg "Title")
`;
      const { links } = parser.parse(content, 'test.md');

      expect(links.length).toBe(2);
      expect(links[0].type).toBe('image');
      expect(links[0].href).toBe('./image.png');
      expect(links[0].alt).toBe('Alt Text');
      expect(links[1].title).toBe('Title');
    });

    it('should parse external images', () => {
      const content = `![External Image](https://example.com/image.png)`;
      const { links } = parser.parse(content, 'test.md');

      expect(links.length).toBe(1);
      expect(links[0].type).toBe('external');
    });

    it('should parse HTML links', () => {
      const content = `<a href="./other.md">HTML Link</a>`;
      const { links } = parser.parse(content, 'test.md');

      expect(links.length).toBe(1);
      expect(links[0].type).toBe('local');
      expect(links[0].href).toBe('./other.md');
    });

    it('should parse HTML img tags', () => {
      const content = `<img src="./image.png" alt="HTML Image">`;
      const { links } = parser.parse(content, 'test.md');

      expect(links.length).toBe(1);
      expect(links[0].type).toBe('image');
      expect(links[0].href).toBe('./image.png');
    });

    it('should skip links inside code blocks', () => {
      const content = `
\`\`\`
[Link in code](https://example.com)
\`\`\`
`;
      const { links } = parser.parse(content, 'test.md');

      expect(links.length).toBe(0);
    });

    it('should skip links inside MDX comment blocks', () => {
      const content = `
{/* 
[Commented link](https://example.com)
*/}
`;
      const { links } = parser.parse(content, 'test.md');

      expect(links.length).toBe(0);
    });

    it('should parse reference-style links', () => {
      const content = `
[Link Text][ref]

[ref]: https://example.com
`;
      const { links } = parser.parse(content, 'test.md');

      expect(links.length).toBe(1);
      expect(links[0].type).toBe('local');
      expect(links[0].href).toBe('[ref]');
    });
  });

  describe('Heading Parsing', () => {
    it('should parse ATX headings', () => {
      const content = `
# H1

## H2

### H3

#### H4
`;
      const { headings } = parser.parse(content, 'test.md');

      expect(headings.length).toBe(4);
      expect(headings[0].level).toBe(1);
      expect(headings[0].text).toBe('H1');
      expect(headings[0].anchor).toBe('h1');
      expect(headings[1].level).toBe(2);
      expect(headings[1].anchor).toBe('h2');
    });

    it('should handle duplicate headings with numbered anchors', () => {
      const content = `
## Section

## Section
`;
      const { headings } = parser.parse(content, 'test.md');

      expect(headings.length).toBe(2);
      expect(headings[0].anchor).toBe('section');
      expect(headings[1].anchor).toBe('section-1');
    });

    it('should parse headings with special characters', () => {
      const content = `
## Hello World!

## What's Up?

## 中文标题
`;
      const { headings } = parser.parse(content, 'test.md');

      expect(headings.length).toBe(3);
      expect(headings[0].anchor).toBe('hello-world');
      expect(headings[1].anchor).toBe('whats-up');
    });

    it('should skip headings inside code blocks', () => {
      const content = `
\`\`\`markdown
# Not a heading
\`\`\`
`;
      const { headings } = parser.parse(content, 'test.md');

      expect(headings.length).toBe(0);
    });
  });

  describe('Line and Column Tracking', () => {
    it('should track line numbers for links', () => {
      const content = `Line 1

Line 3
[Link](https://example.com)

Line 6
![Image](./img.png)
`;
      const { links } = parser.parse(content, 'test.md');

      expect(links[0].line).toBe(4);
      expect(links[1].line).toBe(7);
    });
  });
});

describe('Utils', () => {
  describe('generateSlug', () => {
    it('should generate lowercase slugs by default', () => {
      expect(generateSlug('Hello World')).toBe('hello-world');
      expect(generateSlug('HELLO')).toBe('hello');
    });

    it('should preserve case when caseSensitive is true', () => {
      expect(generateSlug('Hello World', true)).toBe('Hello-World');
    });

    it('should replace spaces and underscores with hyphens', () => {
      expect(generateSlug('hello_world foo')).toBe('hello-world-foo');
    });

    it('should remove special characters', () => {
      expect(generateSlug('hello!@#$%^&*()world')).toBe('helloworld');
    });

    it('should trim leading and trailing hyphens', () => {
      expect(generateSlug('-hello-world-')).toBe('hello-world');
    });

    it('should collapse multiple hyphens', () => {
      expect(generateSlug('hello--world')).toBe('hello-world');
    });
  });

  describe('makeUniqueAnchor', () => {
    it('should return base slug when not in set', () => {
      const existing = new Set<string>();
      expect(makeUniqueAnchor('section', existing)).toBe('section');
      expect(existing.has('section')).toBe(true);
    });

    it('should add numeric suffix when duplicate exists', () => {
      const existing = new Set(['section']);
      expect(makeUniqueAnchor('section', existing)).toBe('section-1');
      expect(existing.has('section-1')).toBe(true);
    });

    it('should increment counter for multiple duplicates', () => {
      const existing = new Set(['section', 'section-1']);
      expect(makeUniqueAnchor('section', existing)).toBe('section-2');
    });
  });

  describe('URL/Link Type Detection', () => {
    it('should detect valid URLs', () => {
      expect(isUrl('https://example.com')).toBe(true);
      expect(isUrl('http://example.com')).toBe(true);
      expect(isUrl('ftp://example.com')).toBe(true);
    });

    it('should detect invalid URLs', () => {
      expect(isUrl('./path/to/file')).toBe(false);
      expect(isUrl('#anchor')).toBe(false);
      expect(isUrl('not a url')).toBe(false);
    });

    it('should detect anchors', () => {
      expect(isAnchor('#section')).toBe(true);
      expect(isAnchor('./file.md#section')).toBe(true);
      expect(isAnchor('https://example.com#section')).toBe(false);
    });

    it('should detect local links', () => {
      expect(isLocalLink('./file.md')).toBe(true);
      expect(isLocalLink('../other/file.md')).toBe(true);
      expect(isLocalLink('path/to/file')).toBe(true);
    });

    it('should not detect external URLs as local links', () => {
      expect(isLocalLink('https://example.com')).toBe(false);
    });
  });

  describe('parseAnchorFromHref', () => {
    it('should parse pure anchors', () => {
      expect(parseAnchorFromHref('#section')).toEqual({ anchor: 'section' });
    });

    it('should parse file + anchor', () => {
      expect(parseAnchorFromHref('./file.md#section')).toEqual({
        file: './file.md',
        anchor: 'section'
      });
    });

    it('should parse file without anchor', () => {
      expect(parseAnchorFromHref('./file.md')).toEqual({ file: './file.md' });
    });
  });
});

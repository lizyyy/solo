import { Parser } from './index';

describe('Parser', () => {
  describe('parseFrontmatter', () => {
    it('should parse YAML frontmatter', () => {
      const parser = new Parser({ basePath: '/test' });
      const content = `---
title: Test Title
description: Test Description
---
# Hello World`;

      const result = parser.parseFrontmatter(content);
      
      expect(result.frontmatter).toEqual({
        title: 'Test Title',
        description: 'Test Description',
      });
      expect(result.content).toContain('# Hello World');
    });

    it('should handle empty frontmatter', () => {
      const parser = new Parser({ basePath: '/test' });
      const content = `---
---
# Hello World`;

      const result = parser.parseFrontmatter(content);
      
      expect(result.frontmatter).toEqual({});
      expect(result.content).toContain('# Hello World');
    });

    it('should handle no frontmatter', () => {
      const parser = new Parser({ basePath: '/test' });
      const content = '# Hello World\n\nThis is some content.';

      const result = parser.parseFrontmatter(content);
      
      expect(result.frontmatter).toEqual({});
      expect(result.content).toBe(content);
    });

    it('should handle invalid YAML gracefully', () => {
      const parser = new Parser({ basePath: '/test' });
      const content = `---
[invalid yaml
---
# Hello World`;

      const result = parser.parseFrontmatter(content);
      
      expect(result.frontmatter).toEqual({});
    });
  });

  describe('parseMarkdown', () => {
    it('should parse basic markdown', async () => {
      const parser = new Parser({ basePath: '/test' });
      const content = `# Title

## Section 1

This is some text.

## Section 2

More text.
`;

      const result = await parser.parseMarkdown(content, 'test.md');
      
      expect(result.sections).toHaveLength(3);
      expect(result.sections[0].title).toBe('Title');
      expect(result.sections[0].level).toBe(1);
      expect(result.sections[1].title).toBe('Section 1');
      expect(result.sections[1].level).toBe(2);
    });

    it('should parse links', async () => {
      const parser = new Parser({ basePath: '/test' });
      const content = `# Title

[Internal Link](other.md)
[External Link](https://example.com)
[Anchor Link](#section)
`;

      const result = await parser.parseMarkdown(content, 'test.md');
      
      expect(result.links).toHaveLength(3);
      expect(result.links[0].type).toBe('internal');
      expect(result.links[1].type).toBe('external');
      expect(result.links[2].type).toBe('anchor');
    });

    it('should parse images', async () => {
      const parser = new Parser({ basePath: '/test' });
      const content = `# Title

![Alt Text](image.png)
![Another Image](https://example.com/image.jpg)
`;

      const result = await parser.parseMarkdown(content, 'test.md');
      
      expect(result.images).toHaveLength(2);
      expect(result.images[0].src).toBe('image.png');
      expect(result.images[0].alt).toBe('Alt Text');
    });

    it('should parse code blocks', async () => {
      const parser = new Parser({ basePath: '/test' });
      const content = `# Title

\`\`\`javascript
console.log('Hello');
\`\`\`

\`\`\`python
print('Hello')
\`\`\`
`;

      const result = await parser.parseMarkdown(content, 'test.md');
      
      expect(result.codeSnippets).toHaveLength(2);
      expect(result.codeSnippets[0].language).toBe('javascript');
      expect(result.codeSnippets[1].language).toBe('python');
    });

    it('should include section information in code snippets', async () => {
      const parser = new Parser({ basePath: '/test' });
      const content = `# Title

## JavaScript Section

\`\`\`javascript
console.log('Hello');
\`\`\`

## Python Section

\`\`\`python
print('Hello')
\`\`\`
`;

      const result = await parser.parseMarkdown(content, 'test.md');
      
      expect(result.codeSnippets[0].section).toContain('JavaScript');
      expect(result.codeSnippets[1].section).toContain('Python');
    });

    it('should detect dangerous code', async () => {
      const parser = new Parser({ basePath: '/test' });
      const content = `# Title

\`\`\`bash
rm -rf /data
\`\`\`

\`\`\`javascript
eval('console.log(1)')
\`\`\`
`;

      const result = await parser.parseMarkdown(content, 'test.md');
      
      expect(result.codeSnippets[0].isDangerous).toBe(true);
      expect(result.codeSnippets[1].isDangerous).toBe(true);
    });
  });

  describe('parseHtml', () => {
    it('should parse HTML with links and images', async () => {
      const parser = new Parser({ basePath: '/test' });
      const content = `<!DOCTYPE html>
<html>
<head>
  <title>Test</title>
</head>
<body>
  <h1>Title</h1>
  <h2>Section 1</h2>
  <a href="other.md">Internal Link</a>
  <a href="https://example.com">External Link</a>
  <img src="image.png" alt="Alt Text">
</body>
</html>
`;

      const result = await parser.parseHtml(content, 'test.html');
      
      expect(result.links.length).toBeGreaterThan(0);
      expect(result.images.length).toBeGreaterThan(0);
    });

    it('should handle HTML frontmatter', async () => {
      const parser = new Parser({ basePath: '/test' });
      const content = `---
title: HTML Page
---
<!DOCTYPE html>
<html>
<body>
  <h1>Hello</h1>
</body>
</html>
`;

      const result = await parser.parseHtml(content, 'test.html');
      
      expect(result.frontmatter).toEqual({ title: 'HTML Page' });
    });
  });
});

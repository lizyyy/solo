const cheerio = require('cheerio');
const csstree = require('css-tree');
const { isHtmlFile, isJsxTsxFile, isCssFile, findLineNumber, findNearbyCode } = require('./file-finder');

function parseHtmlWithRegex(fileData) {
  const { content, lines, filePath } = fileData;
  const elements = [];
  
  const imgPattern = /<img[^>]*\/?>/gi;
  let match;
  
  while ((match = imgPattern.exec(content)) !== null) {
    const imgTag = match[0];
    const srcMatch = imgTag.match(/src\s*=\s*(["'])(.*?)\1/i);
    const altMatch = imgTag.match(/alt\s*=\s*(["'])(.*?)\1/i);
    const titleMatch = imgTag.match(/title\s*=\s*(["'])(.*?)\1/i);
    
    const beforeMatch = content.substring(0, match.index);
    const lineNumber = beforeMatch.split('\n').length;
    
    elements.push({
      type: 'img',
      tagName: 'img',
      src: srcMatch ? srcMatch[2] : '',
      alt: altMatch ? altMatch[2] : undefined,
      title: titleMatch ? titleMatch[2] : undefined,
      hasAlt: !!altMatch,
      altText: altMatch ? altMatch[2] : '',
      isDecorative: altMatch && altMatch[2] === '',
      lineNumber,
      outerHtml: imgTag,
      context: findNearbyCode(lines, lineNumber)
    });
  }
  
  const buttonPattern = /<button[^>]*>[\s\S]*?<\/button>|<button[^>]*\/>/gi;
  while ((match = buttonPattern.exec(content)) !== null) {
    const btnTag = match[0];
    const ariaLabelMatch = btnTag.match(/aria-label\s*=\s*(["'])(.*?)\1/i);
    const ariaLabelledbyMatch = btnTag.match(/aria-labelledby\s*=\s*(["'])(.*?)\1/i);
    const roleMatch = btnTag.match(/role\s*=\s*(["'])(.*?)\1/i);
    
    const textContentMatch = btnTag.match(/>([\s\S]*?)<\//);
    const textContent = textContentMatch ? textContentMatch[1].trim() : '';
    
    const hasText = textContent.length > 0;
    const hasAriaLabel = !!(ariaLabelMatch && ariaLabelMatch[2].trim().length > 0);
    const hasAriaLabelledby = !!(ariaLabelledbyMatch && ariaLabelledbyMatch[2].trim().length > 0);
    
    const beforeMatch = content.substring(0, match.index);
    const lineNumber = beforeMatch.split('\n').length;
    
    elements.push({
      type: 'button',
      tagName: 'button',
      textContent,
      ariaLabel: ariaLabelMatch ? ariaLabelMatch[2] : undefined,
      ariaLabelledby: ariaLabelledbyMatch ? ariaLabelledbyMatch[2] : undefined,
      hasReadableText: hasText || hasAriaLabel || hasAriaLabelledby,
      lineNumber,
      outerHtml: btnTag,
      context: findNearbyCode(lines, lineNumber)
    });
    
    if (roleMatch && roleMatch[2].toLowerCase() === 'button') {
      elements.push({
        type: 'aria-element',
        tagName: 'button',
        ariaAttributes: ariaLabelMatch ? { 'aria-label': ariaLabelMatch[2] } : {},
        role: 'button',
        hasRole: true,
        lineNumber,
        outerHtml: btnTag,
        context: findNearbyCode(lines, lineNumber)
      });
    }
  }
  
  const linkPattern = /<a[^>]*>[\s\S]*?<\/a>|<a[^>]*\/>/gi;
  while ((match = linkPattern.exec(content)) !== null) {
    const linkTag = match[0];
    const hrefMatch = linkTag.match(/href\s*=\s*(["'])(.*?)\1/i);
    const ariaLabelMatch = linkTag.match(/aria-label\s*=\s*(["'])(.*?)\1/i);
    const ariaLabelledbyMatch = linkTag.match(/aria-labelledby\s*=\s*(["'])(.*?)\1/i);
    const roleMatch = linkTag.match(/role\s*=\s*(["'])(.*?)\1/i);
    
    const textContentMatch = linkTag.match(/>([\s\S]*?)<\//);
    const textContent = textContentMatch ? textContentMatch[1].trim() : '';
    
    const hasText = textContent.length > 0;
    const hasAriaLabel = !!(ariaLabelMatch && ariaLabelMatch[2].trim().length > 0);
    const hasAriaLabelledby = !!(ariaLabelledbyMatch && ariaLabelledbyMatch[2].trim().length > 0);
    
    const beforeMatch = content.substring(0, match.index);
    const lineNumber = beforeMatch.split('\n').length;
    
    elements.push({
      type: 'link',
      tagName: 'a',
      href: hrefMatch ? hrefMatch[2] : undefined,
      textContent,
      ariaLabel: ariaLabelMatch ? ariaLabelMatch[2] : undefined,
      ariaLabelledby: ariaLabelledbyMatch ? ariaLabelledbyMatch[2] : undefined,
      hasReadableText: hasText || hasAriaLabel || hasAriaLabelledby,
      lineNumber,
      outerHtml: linkTag,
      context: findNearbyCode(lines, lineNumber)
    });
    
    if (roleMatch && roleMatch[2].toLowerCase() === 'link') {
      elements.push({
        type: 'aria-element',
        tagName: 'a',
        ariaAttributes: ariaLabelMatch ? { 'aria-label': ariaLabelMatch[2] } : {},
        role: 'link',
        hasRole: true,
        lineNumber,
        outerHtml: linkTag,
        context: findNearbyCode(lines, lineNumber)
      });
    }
  }
  
  const inputPattern = /<(input|textarea|select)[^>]*\/?>|<(input|textarea|select)[^>]*>[\s\S]*?<\/\2>/gi;
  while ((match = inputPattern.exec(content)) !== null) {
    const inputTag = match[0];
    const tagName = match[1] || match[2];
    const idMatch = inputTag.match(/id\s*=\s*(["'])(.*?)\1/i);
    const nameMatch = inputTag.match(/name\s*=\s*(["'])(.*?)\1/i);
    const typeMatch = inputTag.match(/type\s*=\s*(["'])(.*?)\1/i);
    const ariaLabelMatch = inputTag.match(/aria-label\s*=\s*(["'])(.*?)\1/i);
    const ariaLabelledbyMatch = inputTag.match(/aria-labelledby\s*=\s*(["'])(.*?)\1/i);
    const placeholderMatch = inputTag.match(/placeholder\s*=\s*(["'])(.*?)\1/i);
    
    const beforeMatch = content.substring(0, match.index);
    const lineNumber = beforeMatch.split('\n').length;
    
    elements.push({
      type: 'form-control',
      tagName: tagName.toLowerCase(),
      id: idMatch ? idMatch[2] : undefined,
      name: nameMatch ? nameMatch[2] : undefined,
      inputType: typeMatch ? typeMatch[2] : 'text',
      ariaLabel: ariaLabelMatch ? ariaLabelMatch[2] : undefined,
      ariaLabelledby: ariaLabelledbyMatch ? ariaLabelledbyMatch[2] : undefined,
      placeholder: placeholderMatch ? placeholderMatch[2] : undefined,
      hasAriaLabel: !!(ariaLabelMatch && ariaLabelMatch[2].trim().length > 0),
      hasAriaLabelledby: !!(ariaLabelledbyMatch && ariaLabelledbyMatch[2].trim().length > 0),
      hasPlaceholder: !!(placeholderMatch && placeholderMatch[2].trim().length > 0),
      hasId: !!idMatch,
      lineNumber,
      outerHtml: inputTag,
      context: findNearbyCode(lines, lineNumber)
    });
    
    if (idMatch) {
      elements.push({
        type: 'element-with-id',
        tagName: tagName.toLowerCase(),
        id: idMatch[2],
        lineNumber,
        outerHtml: `id="${idMatch[2]}"`,
        context: findNearbyCode(lines, lineNumber)
      });
    }
  }
  
  const idPattern = /id\s*=\s*(["'])(.*?)\1/gi;
  const idMatches = new Map();
  while ((match = idPattern.exec(content)) !== null) {
    const idValue = match[2];
    if (!idMatches.has(idValue)) {
      idMatches.set(idValue, []);
    }
    const beforeMatch = content.substring(0, match.index);
    const lineNumber = beforeMatch.split('\n').length;
    idMatches.get(idValue).push({ lineNumber, match: match[0] });
  }
  
  for (const [idValue, occurrences] of idMatches) {
    for (const occurrence of occurrences) {
      const existing = elements.filter(e => e.type === 'element-with-id' && e.id === idValue && e.lineNumber === occurrence.lineNumber);
      if (existing.length === 0) {
        elements.push({
          type: 'element-with-id',
          tagName: 'unknown',
          id: idValue,
          lineNumber: occurrence.lineNumber,
          outerHtml: occurrence.match,
          context: findNearbyCode(lines, occurrence.lineNumber)
        });
      }
    }
  }
  
  const tabindexPattern = /tabindex\s*=\s*(["'])(-?\d+)\1/gi;
  while ((match = tabindexPattern.exec(content)) !== null) {
    const tabindex = match[2];
    const tabIndexNum = parseInt(tabindex, 10);
    
    const beforeMatch = content.substring(0, match.index);
    const lineNumber = beforeMatch.split('\n').length;
    
    elements.push({
      type: 'tabindex',
      tagName: 'unknown',
      tabindex,
      tabIndexNum: isNaN(tabIndexNum) ? null : tabIndexNum,
      isPositive: !isNaN(tabIndexNum) && tabIndexNum > 0,
      isNegative: !isNaN(tabIndexNum) && tabIndexNum < 0,
      lineNumber,
      outerHtml: match[0],
      context: findNearbyCode(lines, lineNumber)
    });
  }
  
  const ariaPattern = /(aria-[a-zA-Z-]+|role)\s*=\s*(["'])(.*?)\2/gi;
  const ariaElements = new Map();
  while ((match = ariaPattern.exec(content)) !== null) {
    const attrName = match[1];
    const attrValue = match[3];
    
    const beforeMatch = content.substring(0, match.index);
    const lineNumber = beforeMatch.split('\n').length;
    
    const key = lineNumber;
    if (!ariaElements.has(key)) {
      ariaElements.set(key, {
        type: 'aria-element',
        tagName: 'unknown',
        ariaAttributes: {},
        role: undefined,
        hasRole: false,
        lineNumber,
        outerHtml: '',
        context: findNearbyCode(lines, lineNumber)
      });
    }
    
    const element = ariaElements.get(key);
    if (attrName.toLowerCase() === 'role') {
      element.role = attrValue;
      element.hasRole = true;
    } else {
      element.ariaAttributes[attrName] = attrValue;
    }
  }
  
  for (const element of ariaElements.values()) {
    elements.push(element);
  }
  
  return {
    type: 'html',
    filePath,
    elements,
    rawContent: content
  };
}

function parseHtml(fileData) {
  const { content, lines, filePath } = fileData;
  let $;
  
  try {
    $ = cheerio.load(content, { 
      xmlMode: false, 
      decodeEntities: false,
      recognizeSelfClosing: true
    });
  } catch (error) {
    console.warn(`⚠️ cheerio 解析失败，使用备用解析方式: ${filePath}`);
    return parseHtmlWithRegex(fileData);
  }

  const elements = [];
  
  $('img').each((index, element) => {
    const el = $(element);
    const src = el.attr('src') || '';
    const alt = el.attr('alt');
    const title = el.attr('title');
    const outerHtml = $.html(element);
    
    const lineNumber = findLineInLines(lines, outerHtml, src, 'img');
    
    elements.push({
      type: 'img',
      tagName: 'img',
      src,
      alt,
      title,
      hasAlt: alt !== undefined,
      altText: alt || '',
      isDecorative: alt === '',
      lineNumber,
      outerHtml,
      context: findNearbyCode(lines, lineNumber)
    });
  });

  $('button').each((index, element) => {
    const el = $(element);
    const textContent = el.text().trim();
    const ariaLabel = el.attr('aria-label');
    const ariaLabelledby = el.attr('aria-labelledby');
    const hasText = textContent.length > 0;
    const hasAriaLabel = ariaLabel && ariaLabel.trim().length > 0;
    const hasAriaLabelledby = ariaLabelledby && ariaLabelledby.trim().length > 0;
    const outerHtml = $.html(element);
    
    const lineNumber = findLineInLines(lines, outerHtml, 'button', 'button');
    
    elements.push({
      type: 'button',
      tagName: 'button',
      textContent,
      ariaLabel,
      ariaLabelledby,
      hasReadableText: hasText || hasAriaLabel || hasAriaLabelledby,
      lineNumber,
      outerHtml,
      context: findNearbyCode(lines, lineNumber)
    });
  });

  $('a').each((index, element) => {
    const el = $(element);
    const href = el.attr('href');
    const textContent = el.text().trim();
    const ariaLabel = el.attr('aria-label');
    const ariaLabelledby = el.attr('aria-labelledby');
    const hasText = textContent.length > 0;
    const hasAriaLabel = ariaLabel && ariaLabel.trim().length > 0;
    const hasAriaLabelledby = ariaLabelledby && ariaLabelledby.trim().length > 0;
    const outerHtml = $.html(element);
    
    const lineNumber = findLineInLines(lines, outerHtml, href || 'a href', 'a');
    
    elements.push({
      type: 'link',
      tagName: 'a',
      href,
      textContent,
      ariaLabel,
      ariaLabelledby,
      hasReadableText: hasText || hasAriaLabel || hasAriaLabelledby,
      lineNumber,
      outerHtml,
      context: findNearbyCode(lines, lineNumber)
    });
  });

  $('input, textarea, select').each((index, element) => {
    const el = $(element);
    const tagName = element.tagName.toLowerCase();
    const id = el.attr('id');
    const name = el.attr('name');
    const type = el.attr('type') || 'text';
    const ariaLabel = el.attr('aria-label');
    const ariaLabelledby = el.attr('aria-labelledby');
    const placeholder = el.attr('placeholder');
    const hasAriaLabel = ariaLabel && ariaLabel.trim().length > 0;
    const hasAriaLabelledby = ariaLabelledby && ariaLabelledby.trim().length > 0;
    const hasPlaceholder = placeholder && placeholder.trim().length > 0;
    
    const outerHtml = $.html(element);
    const lineNumber = findLineInLines(lines, outerHtml, id || name || `type="${type}"`, tagName);
    
    const formElement = {
      type: 'form-control',
      tagName,
      id,
      name,
      inputType: type,
      ariaLabel,
      ariaLabelledby,
      placeholder,
      hasAriaLabel,
      hasAriaLabelledby,
      hasPlaceholder,
      hasId: !!id,
      lineNumber,
      outerHtml,
      context: findNearbyCode(lines, lineNumber)
    };
    
    elements.push(formElement);
  });

  $('[id]').each((index, element) => {
    const el = $(element);
    const id = el.attr('id');
    const tagName = element.tagName.toLowerCase();
    const outerHtml = $.html(element);
    const lineNumber = findLineInLines(lines, outerHtml, `id="${id}"`, tagName);
    
    elements.push({
      type: 'element-with-id',
      tagName,
      id,
      lineNumber,
      outerHtml,
      context: findNearbyCode(lines, lineNumber)
    });
  });

  $('[tabindex]').each((index, element) => {
    const el = $(element);
    const tabindex = el.attr('tabindex');
    const tabIndexNum = parseInt(tabindex, 10);
    const tagName = element.tagName.toLowerCase();
    const outerHtml = $.html(element);
    const lineNumber = findLineInLines(lines, outerHtml, `tabindex="${tabindex}"`, tagName);
    
    elements.push({
      type: 'tabindex',
      tagName,
      tabindex,
      tabIndexNum: isNaN(tabIndexNum) ? null : tabIndexNum,
      isPositive: !isNaN(tabIndexNum) && tabIndexNum > 0,
      isNegative: !isNaN(tabIndexNum) && tabIndexNum < 0,
      lineNumber,
      outerHtml,
      context: findNearbyCode(lines, lineNumber)
    });
  });

  $('*').each((index, element) => {
    const el = $(element);
    const tagName = element.tagName.toLowerCase();
    const outerHtml = $.html(element);
    
    const ariaAttributes = {};
    Object.keys(element.attribs || {}).forEach(attr => {
      if (attr.startsWith('aria-')) {
        ariaAttributes[attr] = element.attribs[attr];
      }
    });
    
    const role = el.attr('role');
    
    if (Object.keys(ariaAttributes).length > 0 || role) {
      const lineNumber = findLineInLines(lines, outerHtml, role || Object.keys(ariaAttributes)[0] || 'aria-', tagName);
      
      elements.push({
        type: 'aria-element',
        tagName,
        ariaAttributes,
        role,
        hasRole: !!role,
        lineNumber,
        outerHtml,
        context: findNearbyCode(lines, lineNumber)
      });
    }
  });

  return {
    type: 'html',
    filePath,
    elements,
    $,
    rawContent: content
  };
}

function parseJsxTsx(fileData) {
  const { content, lines, filePath } = fileData;
  const elements = [];
  
  const imgPattern = /<img[^>]*\/?>/g;
  let match;
  
  while ((match = imgPattern.exec(content)) !== null) {
    const imgTag = match[0];
    const srcMatch = imgTag.match(/src\s*=\s*(["'])(.*?)\1/);
    const altMatch = imgTag.match(/alt\s*=\s*(["'])(.*?)\1/);
    const titleMatch = imgTag.match(/title\s*=\s*(["'])(.*?)\1/);
    
    const beforeMatch = content.substring(0, match.index);
    const lineNumber = beforeMatch.split('\n').length;
    
    elements.push({
      type: 'img',
      tagName: 'img',
      src: srcMatch ? srcMatch[2] : '',
      alt: altMatch ? altMatch[2] : undefined,
      title: titleMatch ? titleMatch[2] : undefined,
      hasAlt: !!altMatch,
      altText: altMatch ? altMatch[2] : '',
      isDecorative: altMatch && altMatch[2] === '',
      lineNumber,
      outerHtml: imgTag,
      context: findNearbyCode(lines, lineNumber)
    });
  }
  
  const buttonPattern = /<button[^>]*>[\s\S]*?<\/button>|<button[^>]*\/>/g;
  while ((match = buttonPattern.exec(content)) !== null) {
    const btnTag = match[0];
    const ariaLabelMatch = btnTag.match(/aria-label\s*=\s*(["'])(.*?)\1/);
    const ariaLabelledbyMatch = btnTag.match(/aria-labelledby\s*=\s*(["'])(.*?)\1/);
    
    const textContentMatch = btnTag.match(/>([\s\S]*?)</);
    const textContent = textContentMatch ? textContentMatch[1].trim() : '';
    
    const hasText = textContent.length > 0;
    const hasAriaLabel = !!(ariaLabelMatch && ariaLabelMatch[2].trim().length > 0);
    const hasAriaLabelledby = !!(ariaLabelledbyMatch && ariaLabelledbyMatch[2].trim().length > 0);
    
    const beforeMatch = content.substring(0, match.index);
    const lineNumber = beforeMatch.split('\n').length;
    
    elements.push({
      type: 'button',
      tagName: 'button',
      textContent,
      ariaLabel: ariaLabelMatch ? ariaLabelMatch[2] : undefined,
      ariaLabelledby: ariaLabelledbyMatch ? ariaLabelledbyMatch[2] : undefined,
      hasReadableText: hasText || hasAriaLabel || hasAriaLabelledby,
      lineNumber,
      outerHtml: btnTag,
      context: findNearbyCode(lines, lineNumber)
    });
  }
  
  const linkPattern = /<a[^>]*>[\s\S]*?<\/a>|<a[^>]*\/>/g;
  while ((match = linkPattern.exec(content)) !== null) {
    const linkTag = match[0];
    const hrefMatch = linkTag.match(/href\s*=\s*(["'])(.*?)\1/);
    const ariaLabelMatch = linkTag.match(/aria-label\s*=\s*(["'])(.*?)\1/);
    const ariaLabelledbyMatch = linkTag.match(/aria-labelledby\s*=\s*(["'])(.*?)\1/);
    
    const textContentMatch = linkTag.match(/>([\s\S]*?)</);
    const textContent = textContentMatch ? textContentMatch[1].trim() : '';
    
    const hasText = textContent.length > 0;
    const hasAriaLabel = !!(ariaLabelMatch && ariaLabelMatch[2].trim().length > 0);
    const hasAriaLabelledby = !!(ariaLabelledbyMatch && ariaLabelledbyMatch[2].trim().length > 0);
    
    const beforeMatch = content.substring(0, match.index);
    const lineNumber = beforeMatch.split('\n').length;
    
    elements.push({
      type: 'link',
      tagName: 'a',
      href: hrefMatch ? hrefMatch[2] : undefined,
      textContent,
      ariaLabel: ariaLabelMatch ? ariaLabelMatch[2] : undefined,
      ariaLabelledby: ariaLabelledbyMatch ? ariaLabelledbyMatch[2] : undefined,
      hasReadableText: hasText || hasAriaLabel || hasAriaLabelledby,
      lineNumber,
      outerHtml: linkTag,
      context: findNearbyCode(lines, lineNumber)
    });
  }
  
  const inputPattern = /<(input|textarea|select)[^>]*\/?>|<(input|textarea|select)[^>]*>[\s\S]*?<\/\2>/g;
  while ((match = inputPattern.exec(content)) !== null) {
    const inputTag = match[0];
    const tagName = match[1] || match[2];
    const idMatch = inputTag.match(/id\s*=\s*(["'])(.*?)\1/);
    const nameMatch = inputTag.match(/name\s*=\s*(["'])(.*?)\1/);
    const typeMatch = inputTag.match(/type\s*=\s*(["'])(.*?)\1/);
    const ariaLabelMatch = inputTag.match(/aria-label\s*=\s*(["'])(.*?)\1/);
    const ariaLabelledbyMatch = inputTag.match(/aria-labelledby\s*=\s*(["'])(.*?)\1/);
    const placeholderMatch = inputTag.match(/placeholder\s*=\s*(["'])(.*?)\1/);
    
    const beforeMatch = content.substring(0, match.index);
    const lineNumber = beforeMatch.split('\n').length;
    
    elements.push({
      type: 'form-control',
      tagName,
      id: idMatch ? idMatch[2] : undefined,
      name: nameMatch ? nameMatch[2] : undefined,
      inputType: typeMatch ? typeMatch[2] : 'text',
      ariaLabel: ariaLabelMatch ? ariaLabelMatch[2] : undefined,
      ariaLabelledby: ariaLabelledbyMatch ? ariaLabelledbyMatch[2] : undefined,
      placeholder: placeholderMatch ? placeholderMatch[2] : undefined,
      hasAriaLabel: !!(ariaLabelMatch && ariaLabelMatch[2].trim().length > 0),
      hasAriaLabelledby: !!(ariaLabelledbyMatch && ariaLabelledbyMatch[2].trim().length > 0),
      hasPlaceholder: !!(placeholderMatch && placeholderMatch[2].trim().length > 0),
      hasId: !!idMatch,
      lineNumber,
      outerHtml: inputTag,
      context: findNearbyCode(lines, lineNumber)
    });
  }
  
  const idPattern = /id\s*=\s*(["'])(.*?)\1/g;
  const idMatches = {};
  while ((match = idPattern.exec(content)) !== null) {
    const idValue = match[2];
    if (!idMatches[idValue]) {
      idMatches[idValue] = [];
    }
    const beforeMatch = content.substring(0, match.index);
    const lineNumber = beforeMatch.split('\n').length;
    idMatches[idValue].push({
      lineNumber,
      match: match[0]
    });
  }
  
  for (const [idValue, occurrences] of Object.entries(idMatches)) {
    for (const occurrence of occurrences) {
      elements.push({
        type: 'element-with-id',
        tagName: 'unknown',
        id: idValue,
        lineNumber: occurrence.lineNumber,
        outerHtml: occurrence.match,
        context: findNearbyCode(lines, occurrence.lineNumber)
      });
    }
  }
  
  const tabindexPattern = /tabindex\s*=\s*(["'])(-?\d+)\1/g;
  while ((match = tabindexPattern.exec(content)) !== null) {
    const tabindex = match[2];
    const tabIndexNum = parseInt(tabindex, 10);
    
    const beforeMatch = content.substring(0, match.index);
    const lineNumber = beforeMatch.split('\n').length;
    
    elements.push({
      type: 'tabindex',
      tagName: 'unknown',
      tabindex,
      tabIndexNum: isNaN(tabIndexNum) ? null : tabIndexNum,
      isPositive: !isNaN(tabIndexNum) && tabIndexNum > 0,
      isNegative: !isNaN(tabIndexNum) && tabIndexNum < 0,
      lineNumber,
      outerHtml: match[0],
      context: findNearbyCode(lines, lineNumber)
    });
  }
  
  const ariaPattern = /(aria-[a-zA-Z-]+|role)\s*=\s*(["'])(.*?)\2/g;
  const ariaElements = new Map();
  while ((match = ariaPattern.exec(content)) !== null) {
    const attrName = match[1];
    const attrValue = match[3];
    
    const beforeMatch = content.substring(0, match.index);
    const lineNumber = beforeMatch.split('\n').length;
    
    const key = lineNumber;
    if (!ariaElements.has(key)) {
      ariaElements.set(key, {
        type: 'aria-element',
        tagName: 'unknown',
        ariaAttributes: {},
        role: undefined,
        hasRole: false,
        lineNumber,
        outerHtml: '',
        context: findNearbyCode(lines, lineNumber)
      });
    }
    
    const element = ariaElements.get(key);
    if (attrName === 'role') {
      element.role = attrValue;
      element.hasRole = true;
    } else {
      element.ariaAttributes[attrName] = attrValue;
    }
  }
  
  for (const element of ariaElements.values()) {
    elements.push(element);
  }
  
  return {
    type: 'jsx',
    filePath,
    elements,
    rawContent: content
  };
}

function parseCss(fileData) {
  const { content, lines, filePath } = fileData;
  const colorRules = [];
  
  try {
    const ast = csstree.parse(content);
    
    csstree.walk(ast, (node) => {
      if (node.type === 'Rule') {
        const selector = csstree.generate(node.prelude);
        const declarations = [];
        
        csstree.walk(node.block, (child) => {
          if (child.type === 'Declaration') {
            const property = child.property;
            const value = csstree.generate(child.value);
            
            if (property === 'color' || 
                property === 'background' || 
                property === 'background-color' ||
                property === 'opacity') {
              declarations.push({
                property,
                value,
                rawValue: value
              });
            }
          }
        });
        
        if (declarations.length > 0) {
          const startLine = node.loc?.start?.line || 1;
          colorRules.push({
            selector,
            declarations,
            lineNumber: startLine,
            context: findNearbyCode(lines, startLine)
          });
        }
      }
    });
  } catch (error) {
    console.warn(`CSS 解析警告 ${filePath}: ${error.message}`);
    
    const colorPattern = /(?:^|\{)\s*(color|background(?:-color)?|opacity)\s*:\s*([^;]+);/gm;
    let match;
    
    while ((match = colorPattern.exec(content)) !== null) {
      const beforeMatch = content.substring(0, match.index);
      const lineNumber = beforeMatch.split('\n').length;
      
      colorRules.push({
        selector: 'unknown',
        declarations: [{
          property: match[1],
          value: match[2].trim(),
          rawValue: match[2].trim()
        }],
        lineNumber,
        context: findNearbyCode(lines, lineNumber)
      });
    }
  }
  
  return {
    type: 'css',
    filePath,
    colorRules,
    elements: [],
    rawContent: content
  };
}

function findLineInLines(lines, outerHtml, identifier, tagName) {
  const searchTerms = [
    outerHtml.substring(0, 50),
    `<${tagName}`,
    identifier
  ].filter(Boolean);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const term of searchTerms) {
      if (line.includes(term)) {
        return i + 1;
      }
    }
  }
  
  return 1;
}

function parseFile(fileData) {
  const { filePath } = fileData;
  
  if (isHtmlFile(filePath)) {
    return parseHtml(fileData);
  }
  
  if (isJsxTsxFile(filePath)) {
    return parseJsxTsx(fileData);
  }
  
  if (isCssFile(filePath)) {
    return parseCss(fileData);
  }
  
  return {
    type: 'unknown',
    filePath,
    rawContent: fileData.content
  };
}

module.exports = {
  parseFile,
  parseHtml,
  parseJsxTsx,
  parseCss
};

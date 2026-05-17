import yaml from 'yaml';

export function parseYamlWithLocation(content, filePath) {
  const documents = [];
  const errors = [];
  
  try {
    const parsedDocs = yaml.parseAllDocuments(content);
    
    parsedDocs.forEach((doc, index) => {
      if (doc.errors.length > 0) {
        doc.errors.forEach(err => {
          errors.push({
            filePath,
            documentIndex: index,
            line: err.linePos ? err.linePos.line : null,
            column: err.linePos ? err.linePos.col : null,
            message: err.message,
            raw: err.source ? content.split('\n')[err.linePos.line - 1] : null
          });
        });
      } else {
        const result = extractWorkloadsWithLocation(doc, filePath, index, content);
        documents.push({
          filePath,
          documentIndex: index,
          ...result
        });
      }
    });
  } catch (err) {
    errors.push({
      filePath,
      documentIndex: 0,
      line: null,
      column: null,
      message: err.message,
      raw: null
    });
  }
  
  return { documents, errors };
}

function extractWorkloadsWithLocation(doc, filePath, docIndex, content) {
  const workloads = [];
  const data = doc.toJS();
  const lines = content.split('\n');
  
  if (!data || typeof data !== 'object') {
    return { workloads: [], data: null };
  }
  
  const kind = data.kind;
  const metadata = data.metadata || {};
  const name = metadata.name || 'unknown';
  const namespace = metadata.namespace || 'default';
  
  const workloadTypes = ['Deployment', 'StatefulSet', 'DaemonSet', 'CronJob', 'Job', 'Pod', 'ReplicaSet'];
  
  if (workloadTypes.includes(kind)) {
    const containers = extractContainers(data);
    const initContainers = extractInitContainers(data);
    
    containers.forEach((container, idx) => {
      const location = findImageLocation(doc, container.name, idx, 'containers');
      workloads.push({
        kind,
        name,
        namespace,
        containerName: container.name,
        image: container.image,
        expectedTag: extractTag(container.image),
        expectedRepository: extractRepository(container.image),
        filePath,
        documentIndex: docIndex,
        line: location ? location.line : null,
        column: location ? location.column : null,
        rawLine: location ? lines[location.line - 1] : null,
        containerType: 'container',
        containerIndex: idx
      });
    });
    
    initContainers.forEach((container, idx) => {
      const location = findImageLocation(doc, container.name, idx, 'initContainers');
      workloads.push({
        kind,
        name,
        namespace,
        containerName: container.name,
        image: container.image,
        expectedTag: extractTag(container.image),
        expectedRepository: extractRepository(container.image),
        filePath,
        documentIndex: docIndex,
        line: location ? location.line : null,
        column: location ? location.column : null,
        rawLine: location ? lines[location.line - 1] : null,
        containerType: 'initContainer',
        containerIndex: idx
      });
    });
  }
  
  return { workloads, data };
}

function extractContainers(data) {
  const containers = [];
  
  if (data.spec?.template?.spec?.containers) {
    containers.push(...data.spec.template.spec.containers);
  } else if (data.spec?.jobTemplate?.spec?.template?.spec?.containers) {
    containers.push(...data.spec.jobTemplate.spec.template.spec.containers);
  } else if (data.spec?.containers) {
    containers.push(...data.spec.containers);
  }
  
  return containers;
}

function extractInitContainers(data) {
  const containers = [];
  
  if (data.spec?.template?.spec?.initContainers) {
    containers.push(...data.spec.template.spec.initContainers);
  } else if (data.spec?.jobTemplate?.spec?.template?.spec?.initContainers) {
    containers.push(...data.spec.jobTemplate.spec.template.spec.initContainers);
  } else if (data.spec?.initContainers) {
    containers.push(...data.spec.initContainers);
  }
  
  return containers;
}

function findImageLocation(doc, containerName, containerIndex, containerType) {
  const visit = (node, path = []) => {
    if (!node || typeof node !== 'object') return null;
    
    if (node.type === 'PLAIN' && node.value && typeof node.value === 'string' && node.value.includes('/')) {
      const pathStr = path.join('.');
      if (pathStr.includes(`${containerType}.${containerIndex}.image`)) {
        return {
          line: node.rangeAsLinePos ? node.rangeAsLinePos.start.line : null,
          column: node.rangeAsLinePos ? node.rangeAsLinePos.start.col : null
        };
      }
    }
    
    for (const key in node) {
      const result = visit(node[key], [...path, key]);
      if (result) return result;
    }
    
    if (Array.isArray(node.items)) {
      for (let i = 0; i < node.items.length; i++) {
        const result = visit(node.items[i], [...path, i.toString()]);
        if (result) return result;
      }
    }
    
    return null;
  };
  
  return visit(doc.contents);
}

export function extractTag(image) {
  if (!image) return null;
  
  const digestMatch = image.match(/@sha256:[a-f0-9]{64}$/);
  if (digestMatch) {
    return `@sha256:...`;
  }
  
  const parts = image.split(':');
  if (parts.length > 1) {
    const lastPart = parts[parts.length - 1];
    if (!lastPart.includes('/') && !lastPart.includes('@')) {
      return lastPart;
    }
  }
  
  return 'latest';
}

export function extractRepository(image) {
  if (!image) return null;
  
  const withoutDigest = image.replace(/@sha256:[a-f0-9]{64}$/, '');
  const parts = withoutDigest.split(':');
  
  if (parts.length > 1) {
    const lastPart = parts[parts.length - 1];
    if (!lastPart.includes('/')) {
      return parts.slice(0, -1).join(':');
    }
  }
  
  return withoutDigest;
}

export function parseMultipleYamls(fileContents) {
  const allWorkloads = [];
  const allErrors = [];
  
  for (const { filePath, content } of fileContents) {
    const { documents, errors } = parseYamlWithLocation(content, filePath);
    allErrors.push(...errors);
    
    for (const doc of documents) {
      allWorkloads.push(...doc.workloads);
    }
  }
  
  return { workloads: allWorkloads, parseErrors: allErrors };
}
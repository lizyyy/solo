import { KubeConfig, CoreV1Api, AppsV1Api, BatchV1Api } from '@kubernetes/client-node';

export async function getClusterImages(options = {}) {
  const { namespace = 'default', kubeconfigPath = null, context = null } = options;
  
  const kc = new KubeConfig();
  
  if (kubeconfigPath) {
    kc.loadFromFile(kubeconfigPath);
  } else {
    kc.loadFromDefault();
  }
  
  if (context) {
    kc.setCurrentContext(context);
  }
  
  const coreV1Api = kc.makeApiClient(CoreV1Api);
  const appsV1Api = kc.makeApiClient(AppsV1Api);
  const batchV1Api = kc.makeApiClient(BatchV1Api);
  
  const clusterImages = [];
  const errors = [];
  
  try {
    const podsResponse = await coreV1Api.listPodForAllNamespaces();
    const pods = podsResponse.body.items;
    
    for (const pod of pods) {
      if (namespace !== 'all' && pod.metadata.namespace !== namespace) continue;
      
      const podImages = extractImagesFromPod(pod);
      clusterImages.push(...podImages);
    }
  } catch (err) {
    errors.push({
      type: 'pods_list',
      message: err.message,
      namespace
    });
  }
  
  return { clusterImages, errors };
}

function extractImagesFromPod(pod) {
  const images = [];
  const spec = pod.spec;
  const status = pod.status;
  
  const containerStatuses = status?.containerStatuses || [];
  const initContainerStatuses = status?.initContainerStatuses || [];
  const ephemeralContainerStatuses = status?.ephemeralContainerStatuses || [];
  
  containerStatuses.forEach((containerStatus, idx) => {
    const container = spec.containers?.[idx];
    images.push({
      namespace: pod.metadata.namespace,
      podName: pod.metadata.name,
      workload: extractWorkloadName(pod),
      workloadKind: extractWorkloadKind(pod),
      containerName: containerStatus.name,
      containerType: 'container',
      containerIndex: idx,
      specImage: container?.image || containerStatus.image,
      actualImage: containerStatus.imageID,
      actualDigest: extractDigest(containerStatus.imageID),
      ready: containerStatus.ready,
      restartCount: containerStatus.restartCount,
      nodeName: spec.nodeName
    });
  });
  
  initContainerStatuses.forEach((containerStatus, idx) => {
    const container = spec.initContainers?.[idx];
    images.push({
      namespace: pod.metadata.namespace,
      podName: pod.metadata.name,
      workload: extractWorkloadName(pod),
      workloadKind: extractWorkloadKind(pod),
      containerName: containerStatus.name,
      containerType: 'initContainer',
      containerIndex: idx,
      specImage: container?.image || containerStatus.image,
      actualImage: containerStatus.imageID,
      actualDigest: extractDigest(containerStatus.imageID),
      ready: containerStatus.ready,
      restartCount: containerStatus.restartCount,
      nodeName: spec.nodeName
    });
  });
  
  ephemeralContainerStatuses.forEach((containerStatus, idx) => {
    images.push({
      namespace: pod.metadata.namespace,
      podName: pod.metadata.name,
      workload: extractWorkloadName(pod),
      workloadKind: extractWorkloadKind(pod),
      containerName: containerStatus.name,
      containerType: 'ephemeralContainer',
      containerIndex: idx,
      specImage: containerStatus.image,
      actualImage: containerStatus.imageID,
      actualDigest: extractDigest(containerStatus.imageID),
      ready: containerStatus.ready,
      restartCount: containerStatus.restartCount,
      nodeName: spec.nodeName
    });
  });
  
  return images;
}

function extractWorkloadName(pod) {
  const ownerReferences = pod.metadata.ownerReferences || [];
  
  for (const owner of ownerReferences) {
    if (['ReplicaSet', 'StatefulSet', 'DaemonSet', 'Job', 'Deployment'].includes(owner.kind)) {
      if (owner.kind === 'ReplicaSet') {
        return owner.name.replace(/-[a-f0-9]+$/, '');
      }
      return owner.name;
    }
  }
  
  return pod.metadata.name;
}

function extractWorkloadKind(pod) {
  const ownerReferences = pod.metadata.ownerReferences || [];
  
  for (const owner of ownerReferences) {
    if (['ReplicaSet', 'StatefulSet', 'DaemonSet', 'Job', 'Deployment'].includes(owner.kind)) {
      if (owner.kind === 'ReplicaSet') {
        return 'Deployment';
      }
      return owner.kind;
    }
  }
  
  return 'Pod';
}

export function extractDigest(imageID) {
  if (!imageID) return null;
  
  const match = imageID.match(/sha256:([a-f0-9]{64})/);
  return match ? match[0] : null;
}

export function getCurrentContext() {
  const kc = new KubeConfig();
  kc.loadFromDefault();
  return kc.getCurrentContext();
}

export async function getNamespaces() {
  const kc = new KubeConfig();
  kc.loadFromDefault();
  const coreV1Api = kc.makeApiClient(CoreV1Api);
  
  try {
    const response = await coreV1Api.listNamespace();
    return response.body.items.map(ns => ns.metadata.name);
  } catch (err) {
    return ['default'];
  }
}
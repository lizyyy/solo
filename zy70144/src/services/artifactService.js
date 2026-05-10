const { v4: uuidv4 } = require('uuid');
const { table, insert, updateById } = require('../config/database');
const auditService = require('./auditService');

function createArtifact(name, version, repository, metadata = {}, actor = 'system') {
  const now = new Date().toISOString();
  const id = uuidv4();

  const existing = table('artifacts')
    .where('name', '=', name)
    .where('version', '=', version)
    .where('repository', '=', repository)
    .get();
  
  if (existing) {
    throw new Error('制品已存在');
  }

  insert('artifacts', {
    id,
    name,
    version,
    repository,
    stage: 'test',
    created_at: now,
    updated_at: now
  });

  const metadataEntries = Object.entries(metadata);
  for (const [key, value] of metadataEntries) {
    insert('artifact_metadata', {
      id: uuidv4(),
      artifact_id: id,
      key,
      value: String(value),
      created_at: now
    });
  }

  auditService.logAction('artifact', id, 'create', actor, {
    name, version, repository, metadata
  });

  return getArtifactById(id);
}

function getArtifactById(id) {
  const artifact = table('artifacts').where('id', '=', id).get();
  if (!artifact) return null;

  const metadata = table('artifact_metadata')
    .where('artifact_id', '=', id)
    .all();
  
  const metadataMap = metadata.reduce((acc, m) => {
    acc[m.key] = m.value;
    return acc;
  }, {});

  return { ...artifact, metadata: metadataMap };
}

function getArtifactByNameVersion(name, version, repository) {
  const artifact = table('artifacts')
    .where('name', '=', name)
    .where('version', '=', version)
    .where('repository', '=', repository)
    .get();
  
  if (!artifact) return null;
  return getArtifactById(artifact.id);
}

function listArtifacts(stage, limit = 100) {
  let query = table('artifacts');
  
  if (stage) {
    query = query.where('stage', '=', stage);
  }
  
  return query
    .orderBy('created_at', 'DESC')
    .limit(limit)
    .all();
}

function updateArtifactStage(artifactId, newStage, actor = 'system') {
  const artifact = table('artifacts').where('id', '=', artifactId).get();
  if (!artifact) {
    throw new Error('制品不存在');
  }
  const oldStage = artifact.stage;

  updateById('artifacts', artifactId, {
    stage: newStage,
    updated_at: new Date().toISOString()
  });

  auditService.logAction('artifact', artifactId, 'stage_change', actor, {
    from: oldStage,
    to: newStage
  });

  return getArtifactById(artifactId);
}

function addMetadata(artifactId, key, value, actor = 'system') {
  const artifact = table('artifacts').where('id', '=', artifactId).get();
  if (!artifact) {
    return null;
  }

  insert('artifact_metadata', {
    id: uuidv4(),
    artifact_id: artifactId,
    key,
    value: String(value),
    created_at: new Date().toISOString()
  });

  auditService.logAction('artifact', artifactId, 'metadata_add', actor, { key, value });
  return getArtifactById(artifactId);
}

module.exports = {
  createArtifact,
  getArtifactById,
  getArtifactByNameVersion,
  listArtifacts,
  updateArtifactStage,
  addMetadata
};

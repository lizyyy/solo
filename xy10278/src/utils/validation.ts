import { Artwork, DataValidationError, Light, Wall } from '../types';

export const validateWall = (wall: Wall): DataValidationError[] => {
  const errors: DataValidationError[] = [];
  const artworkIds = new Set<string>();
  const artworkNames = new Set<string>();
  const lightIds = new Set<string>();
  const lightNames = new Set<string>();

  if (!wall.id || wall.id.trim() === '') {
    errors.push({
      type: 'missing',
      field: 'wall.id',
      message: '墙面ID不能为空'
    });
  }

  if (!wall.name || wall.name.trim() === '') {
    errors.push({
      type: 'missing',
      field: 'wall.name',
      message: '墙面名称不能为空'
    });
  }

  if (wall.width <= 0) {
    errors.push({
      type: 'invalid',
      field: 'wall.width',
      message: '墙面宽度必须大于0'
    });
  }

  if (wall.height <= 0) {
    errors.push({
      type: 'invalid',
      field: 'wall.height',
      message: '墙面高度必须大于0'
    });
  }

  for (const artwork of wall.artworks) {
    const artworkErrors = validateArtwork(artwork, wall);
    errors.push(...artworkErrors);

    if (artworkIds.has(artwork.id)) {
      errors.push({
        type: 'duplicate',
        field: 'artwork.id',
        message: `作品ID重复: ${artwork.id}`,
        id: artwork.id
      });
    }
    artworkIds.add(artwork.id);

    if (artworkNames.has(artwork.name)) {
      errors.push({
        type: 'duplicate',
        field: 'artwork.name',
        message: `作品名称重复: ${artwork.name}`,
        id: artwork.id
      });
    }
    artworkNames.add(artwork.name);
  }

  for (const light of wall.lights) {
    const lightErrors = validateLight(light, wall);
    errors.push(...lightErrors);

    if (lightIds.has(light.id)) {
      errors.push({
        type: 'duplicate',
        field: 'light.id',
        message: `灯光ID重复: ${light.id}`,
        id: light.id
      });
    }
    lightIds.add(light.id);

    if (lightNames.has(light.name)) {
      errors.push({
        type: 'duplicate',
        field: 'light.name',
        message: `灯光名称重复: ${light.name}`,
        id: light.id
      });
    }
    lightNames.add(light.name);
  }

  return errors;
};

export const validateArtwork = (artwork: Artwork, wall: Wall): DataValidationError[] => {
  const errors: DataValidationError[] = [];

  if (!artwork.id || artwork.id.trim() === '') {
    errors.push({
      type: 'missing',
      field: 'artwork.id',
      message: '作品ID不能为空',
      id: artwork.id
    });
  }

  if (!artwork.name || artwork.name.trim() === '') {
    errors.push({
      type: 'missing',
      field: 'artwork.name',
      message: '作品名称不能为空',
      id: artwork.id
    });
  }

  if (artwork.width <= 0) {
    errors.push({
      type: 'invalid',
      field: 'artwork.width',
      message: '作品宽度必须大于0',
      id: artwork.id
    });
  }

  if (artwork.height <= 0) {
    errors.push({
      type: 'invalid',
      field: 'artwork.height',
      message: '作品高度必须大于0',
      id: artwork.id
    });
  }

  if (artwork.x < 0) {
    errors.push({
      type: 'invalid',
      field: 'artwork.x',
      message: '作品X坐标不能为负数',
      id: artwork.id
    });
  }

  if (artwork.y < 0) {
    errors.push({
      type: 'invalid',
      field: 'artwork.y',
      message: '作品Y坐标不能为负数',
      id: artwork.id
    });
  }

  if (artwork.x + artwork.width > wall.width) {
    errors.push({
      type: 'invalid',
      field: 'artwork.x',
      message: '作品超出墙面右侧边界',
      id: artwork.id
    });
  }

  if (artwork.y + artwork.height > wall.height) {
    errors.push({
      type: 'invalid',
      field: 'artwork.y',
      message: '作品超出墙面顶部边界',
      id: artwork.id
    });
  }

  return errors;
};

export const validateLight = (light: Light, wall: Wall): DataValidationError[] => {
  const errors: DataValidationError[] = [];

  if (!light.id || light.id.trim() === '') {
    errors.push({
      type: 'missing',
      field: 'light.id',
      message: '灯光ID不能为空',
      id: light.id
    });
  }

  if (!light.name || light.name.trim() === '') {
    errors.push({
      type: 'missing',
      field: 'light.name',
      message: '灯光名称不能为空',
      id: light.id
    });
  }

  if (light.x < 0) {
    errors.push({
      type: 'invalid',
      field: 'light.x',
      message: '灯光X坐标不能为负数',
      id: light.id
    });
  }

  if (light.x > wall.width) {
    errors.push({
      type: 'invalid',
      field: 'light.x',
      message: '灯光X坐标超出墙面范围',
      id: light.id
    });
  }

  if (light.intensity <= 0) {
    errors.push({
      type: 'invalid',
      field: 'light.intensity',
      message: '灯光强度必须大于0',
      id: light.id
    });
  }

  if (light.spread <= 0 || light.spread > 360) {
    errors.push({
      type: 'invalid',
      field: 'light.spread',
      message: '灯光照射角度必须在0-360度之间',
      id: light.id
    });
  }

  return errors;
};

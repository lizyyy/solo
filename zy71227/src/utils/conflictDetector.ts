import type { Artwork, Conflict } from '../types';

export function checkDuplicateIds(artworks: Artwork[]): Conflict[] {
  const idCounts: Record<string, number> = {};
  const conflicts: Conflict[] = [];

  artworks.forEach(artwork => {
    idCounts[artwork.id] = (idCounts[artwork.id] || 0) + 1;
  });

  Object.entries(idCounts).forEach(([id, count]) => {
    if (count > 1) {
      conflicts.push({
        artworkId: id,
        type: 'duplicate_id',
        message: `发现 ${count} 个作品使用了相同的 ID: ${id}`
      });
    }
  });

  return conflicts;
}

export function checkValueRangeConflicts(artwork: Artwork): Conflict[] {
  const conflicts: Conflict[] = [];
  const reasonableMin = 1000;
  const reasonableMax = 500000;

  if (artwork.estimatedValue < reasonableMin || artwork.estimatedValue > reasonableMax) {
    conflicts.push({
      artworkId: artwork.id,
      type: 'value_range',
      message: `估值 ${artwork.estimatedValue.toLocaleString()} 超出合理范围 (${reasonableMin.toLocaleString()} - ${reasonableMax.toLocaleString()})`
    });
  }

  if (artwork.baseRoyaltyRate < 0 || artwork.baseRoyaltyRate > 50) {
    conflicts.push({
      artworkId: artwork.id,
      type: 'royalty_rate',
      message: `基础版税率 ${artwork.baseRoyaltyRate}% 超出合理范围 (0% - 50%)`
    });
  }

  return conflicts;
}

export function checkRoyaltyRateConflicts(artwork: Artwork, boothRate: number): Conflict[] {
  const conflicts: Conflict[] = [];

  if (boothRate < artwork.baseRoyaltyRate * 0.5) {
    conflicts.push({
      artworkId: artwork.id,
      type: 'royalty_rate',
      message: `展位版税率 ${boothRate}% 低于艺术家要求的 ${artwork.baseRoyaltyRate}% 的50%`
    });
  }

  if (boothRate > 30) {
    conflicts.push({
      artworkId: artwork.id,
      type: 'royalty_rate',
      message: `版税率 ${boothRate}% 过高，可能降低藏家竞拍意愿`
    });
  }

  return conflicts;
}

export function markConflicts(artworks: Artwork[]): Artwork[] {
  const allConflicts: Record<string, string[]> = {};

  const idConflicts = checkDuplicateIds(artworks);
  idConflicts.forEach(conflict => {
    if (!allConflicts[conflict.artworkId]) {
      allConflicts[conflict.artworkId] = [];
    }
    allConflicts[conflict.artworkId].push(conflict.message);
  });

  return artworks.map(artwork => {
    const valueConflicts = checkValueRangeConflicts(artwork);
    const artworkConflicts = [
      ...(allConflicts[artwork.id] || []),
      ...valueConflicts.map(c => c.message)
    ];

    return {
      ...artwork,
      conflictStatus: artworkConflicts.length > 0 ? 'flagged' : 'none',
      conflictDetails: artworkConflicts
    };
  });
}

export function resolveConflict(artwork: Artwork, conflictIndex: number): Artwork {
  const newDetails = [...artwork.conflictDetails];
  newDetails.splice(conflictIndex, 1);

  return {
    ...artwork,
    conflictStatus: newDetails.length > 0 ? 'flagged' : 'resolved',
    conflictDetails: newDetails
  };
}

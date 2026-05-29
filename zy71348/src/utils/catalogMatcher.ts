import type { InventoryRecord, AlbumGroup } from '@/types';

export function normalizeCatalogNumber(cn: string): string {
  if (!cn) return '';
  return cn
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/[-_./]/g, '')
    .trim();
}

export function normalizeAlbumName(name: string): string {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\u4e00-\u9fa5\s]/g, '')
    .trim();
}

export function isDuplicateCatalogNumber(
  newCatalogNumber: string,
  existingRecords: InventoryRecord[],
  excludeId?: string
): boolean {
  const normalized = normalizeCatalogNumber(newCatalogNumber);
  return existingRecords.some(
    (r) =>
      r.id !== excludeId && normalizeCatalogNumber(r.catalogNumber) === normalized
  );
}

export function findDuplicateRecord(
  newCatalogNumber: string,
  existingRecords: InventoryRecord[],
  excludeId?: string
): InventoryRecord | undefined {
  const normalized = normalizeCatalogNumber(newCatalogNumber);
  return existingRecords.find(
    (r) =>
      r.id !== excludeId && normalizeCatalogNumber(r.catalogNumber) === normalized
  );
}

export function findAlbumMatches(
  albumName: string,
  catalogNumber: string,
  records: InventoryRecord[],
  excludeId?: string
): InventoryRecord[] {
  const normalizedAlbum = normalizeAlbumName(albumName);
  const normalizedCatalog = normalizeCatalogNumber(catalogNumber);

  return records.filter((r) => {
    if (r.id === excludeId) return false;
    if (normalizeCatalogNumber(r.catalogNumber) === normalizedCatalog) return false;
    return normalizeAlbumName(r.albumName) === normalizedAlbum;
  });
}

export function findOrCreateAlbumGroup(
  albumName: string,
  artist: string,
  albumGroups: AlbumGroup[],
  existingMatches: InventoryRecord[],
  createId: () => string
): AlbumGroup {
  const normalizedAlbum = normalizeAlbumName(albumName);
  const normalizedArtist = artist.toLowerCase().trim();

  let group = albumGroups.find(
    (g) =>
      normalizeAlbumName(g.albumName) === normalizedAlbum &&
      g.artist.toLowerCase().trim() === normalizedArtist
  );

  if (!group && existingMatches.length > 0) {
    const matchGroupId = existingMatches[0].albumGroupId;
    group = albumGroups.find((g) => g.id === matchGroupId);
  }

  if (!group) {
    group = {
      id: createId(),
      albumName,
      artist,
      recordIds: [],
    };
  }

  return group;
}

export function generateVersionTag(
  catalogNumber: string,
  groupCount: number
): string {
  const normalized = normalizeCatalogNumber(catalogNumber);
  const suffix = groupCount > 0 ? ` v${groupCount + 1}` : '';
  return `${normalized}${suffix}`;
}

export function generateVersionTagForGroup(
  catalogNumber: string,
  groupSize: number
): string {
  const normalized = normalizeCatalogNumber(catalogNumber);
  if (groupSize === 0) return normalized;
  return `${normalized} v${groupSize + 1}`;
}

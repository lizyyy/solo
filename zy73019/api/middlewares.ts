process.removeAllListeners('warning');

import multer from 'multer';
import { TrackRepo } from './repos/trackRepo.js';

export function aliasConflictDetector(
  petName: string,
  aliases: string[],
  trackIdToSkip?: string,
): string | null {
  return TrackRepo.checkAliasConflicts(petName, aliases, trackIdToSkip);
}

const storage = multer.memoryStorage();

export const multerUpload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});

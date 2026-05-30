import db from './api/db/index.js';
import CopyrightRepo from './api/repositories/CopyrightRepo.js';

const copyrightRepo = new CopyrightRepo();

console.log('=== 所有版权记录 ===');
const all = copyrightRepo.findAll();
console.log(JSON.stringify(all, null, 2));

console.log('\n=== 按曲目分组的版权记录 ===');
const trackMap = new Map<string, any[]>();
for (const c of all) {
  if (!trackMap.has(c.trackId)) {
    trackMap.set(c.trackId, []);
  }
  trackMap.get(c.trackId)!.push(c);
}

for (const [trackId, copyrights] of trackMap) {
  console.log(`\n曲目 ${trackId}:`);
  console.log(`  版权记录数: ${copyrights.length}`);
  for (const c of copyrights) {
    console.log(`    - ${c.id}: status=${c.status}, warningLevel=${c.warningLevel}, updatedAt=${c.updatedAt}`);
  }
  const hasHigh = copyrightRepo.hasHighWarningByTrackId(trackId);
  console.log(`  hasHighWarningByTrackId: ${hasHigh}`);
  const found = copyrightRepo.findByTrackId(trackId);
  console.log(`  findByTrackId 返回: ${found?.id}, status=${found?.status}, warningLevel=${found?.warningLevel}`);
}

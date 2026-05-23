const { Parser } = require('json2csv');
const { allQuery } = require('../models/database');
const sampleService = require('./sampleService');
const batchService = require('./batchService');
const logService = require('./logService');

async function exportBatchDetails(batchId) {
  const batch = await batchService.getBatchById(batchId);
  if (!batch) {
    throw new Error('æ‰¹æ¡¤ä¸å¯—');
  }

  const samples = await sampleService.getSamplesByBatch(batchId);
  const logs = await logService.getLogsByBatch(batchId);

  const sampleDetails = samples.map(sample => ({
    æ‰¹æ¡£å–: batch.batch_no,
    æŸ¥åœ¨æ•°å¼„]: sample.sample_no,
    æ·µç‹.êNeè¿œ: sample.sample_name,
    æ·µç‹.ç·“å¿é¡µ: sample.sample_type,
    æ•°é‡ˆØ[\Kœ]X[]Kˆ9c%ù/cNˆØ[\K[š]ˆ9c!z(áNˆØ[\KœXÚØYÙKˆ9§¡9¡#: jÔ[™ÜÎˆØ[\TÙ\šXÙK™Ù]İ]\Ñ\ØÜš\[ÛŠØ[\Kœİ]\ÊKˆ9i#yªª9«(y¥lˆØ[\Kœ™XÚXÚ×ØÛİ[ˆ9e#yª*9îá:+¨NˆØ[\Kœ™XÚXÚ×Ü™\İ[ˆ9i,z-éWNˆØ[\Kœ™[X\šÂˆJJNÂ‚ˆÛÛœİÙÑ]Z[ÈHÙÜË›X\
ÙÈOˆ
Âˆ9¥ay/gù¥éy§&ÈÙË›Ü\˜][Û—İ[YKˆ9¥l9/g9àjùàjó¢Æöu6W'f–6RævWD÷W&F–öäFW67&—F–öâ†Æöræ÷W&F–öå÷G—R’À¢ZJ~zº¾X©niibst: log.handler,
    åå›¾ç‰‡å log.reason,
    æ¸±çŠ¶æ€å¤§: log.old_status ? batchService.getStatusDescription(log.old_status) : '',
    &–B8ièNhHÎˆÙË›™]×Üİ]\ÈÈ˜]ÚÙ\šXÙK™Ù]İ]\Ñ\ØÜš\[ÛŠÙË›™]×Üİ]\ÊHˆ	ÉËˆ:/áùgaNˆÙË™]Z[ˆJJNÂ‚ˆ™]\›ˆÂˆ˜]Ú[™›ÎˆÂˆ9¢ny¨hùcå¨ˆ˜]Ú˜˜]ÚÛ›Ëˆ:` y¨"ù.®ˆ˜]ÚœÙ[™\‹ˆ9¥ayg.ù¥éy§&È[Ûˆˆ˜]Úœ™XÙZ]™WÙ]Kˆ9§¡9¡#: jÕ[Nˆ˜]ÚÙ\šXÙK™Ù]İ]\Ñ\ØÜš\[ÛŠ˜]Úœİ]\ÊKˆ9i#º-¡{ï"Nˆ˜]Úœ™[X\šÂˆKˆØ[\\ÎˆØ[\Q]Z[ËˆÙÜÎˆÙÑ]Z[ËˆØ[\PÛİ[ˆØ[\\Ë›[™İˆÙĞÛİ[ˆÙÜË›[™İˆNÂŸB‚˜\Ş[˜È[˜İ[Ûˆ^ÜØ[\\ÕĞÔÕš[\œÈHßJHÂˆÛÛœİØ[\\ÈH]ØZ]Ø[\TÙ\šXÙKœÙX\˜ÚØ[\\Êš[\œÊNÂˆˆÛÛœİšY[ÈHÂˆ	ù¢ny¨hùcå‰Ë	ù§éyg*9¥l9o!IË	ù­íùdàyd#yb¥‰Ë	ù«^ùã¢ùîäùg¯zhmIËˆ	ù¥l:aãÉË	ùc%ù/cÉË	ùàjùã#	Ë	ù§¡9¡#: h:lines',
    'å¤æ¨¨æŒ¡æ•°', 'åœºæ §ç»„è­Ú', 'åˆ™/x6_at1'
  ];

  const data = samples.map(s => ({
    'æˆ¹æ¢ƒå–': s.batch_no,
    'æŸ¥åœ¨æ•°å¼„]': s.sample_no,
    'æ·µç‹.åŠ–å“: s.sample_name,
    'æ­{ç‹ç»“å½é¡µ': s.sample_type,
    'æ•°é‡': s.quantity,
    'åŒ—ä½': s.unit,
    'ç«çŒŒ': s.package,
    'æ„æ„Œè«Tiles': sampleService.getStatusDescription(s.status),
    'æ”Œæª¨æ¬¡æ•°': s.recheck_count,
    'åœºæ §ç»„î ê÷ÛˆËœ™XÚXÚ×Ü™\İ[ˆ	ùb&KŞ—Ø]IÎˆË˜Ü™X]YØ]ˆJJNÂ‚ˆÛÛœİœÛÛŒ˜Üİ”\œÙ\ˆH™]È\œÙ\ŠÈšY[ÈJNÂˆÛÛœİÜİˆHœÛÛŒ˜Üİ”\œÙ\‹œ\œÙJ]JNÂ‚ˆ™]\›ˆÂˆÜİ‹ˆÛİ[ˆØ[\\Ë›[™İˆ]BˆNÂŸB‚›[Ù[K™^ÜÈHÂˆ^Ü˜]Ú]Z[Ëˆ^ÜØ[\\ÕĞÔÕ‚ŸNÂ
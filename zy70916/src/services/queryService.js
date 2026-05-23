const { run, get, all } = require('../models/database');
const { Parser } = require('json2csv');

async function queryTrackRecords(filters = {}) {
  let query = `
    SELECT 
      tr.*,
      so.order_no,
      so.address,
      so.district,
      so.scheduled_date,
      so.distance_km,
      ep.name as elderly_name,
      n.name as nurse_name,
      n.qualifications as nurse_qualifications,
      n.skills as nurse_skills,
      b.name as batch_name,
      b.batch_no
    FROM track_records tr
    LEFT JOIN service_orders so ON tr.service_order_id = so.id
    LEFT JOIN elderly_profiles ep ON tr.elderly_id = ep.elderly_id
    LEFT JOIN nurses n ON tr.nurse_id = n.nurse_id
    LEFT JOIN batches b ON tr.batch_id = b.id
    WHERE 1=1
  `;
  const params = [];

  if (filters.nurse_qualifications) {
    query += ' AND n.qualifications LIKE ?';
    params.push(`%+${filters.nurse_qualifications}%`);
  }

  if (filters.service_type) {
    query += ' AND tr.service_type = ?';
    params.push(filters.service_type);
  }

  if (filters.service_items) {
    query += ' AND so.service_items LIKE ?';
    params.push(`%%{filters.service_items}%`);
  }

  if (filters.route_keyword) {
    query += ' AND (so.address LIKE ? OR so.district LIKE ? OR tr.route_info LIKE ?)';
    const keyword = `%%{filters.route_keyword}%`;
    params.push(keyword, keyword, keyword);
  }

  if (filters.nurse_id) {
    query += ' AND tr.nurse_id = ?';
    params.push(filters.nurse_id);
  }

  if (filters.elderly_id) {
    query += ' AND tr.elderly_id = ?';
    params.push(filters.elderly_id);
  }

  if (filters.batch_id) {
    query += ' AND tr.batch_id = ?';
    params.push(filters.batch_id);
  }

  if (filters.status) {
    query += ' AND tr.status = ?';
    params.push(filters.status);
  }

  if (filters.action) {
    query += ' AND tr.action = ?';
    params.push(filters.action);
  }

  if (filters.start_date) {
    query += ' AND tr.handled_at >= ?';
    params.push(filters.start_date);
  }

  if (filters.end_date) {
    query += ' AND tr.handled_at <= ?';
    params.push(filters.end_date);
  }

  query += ' ORDER BY tr.handled_at DESC';

  const records = await all(query, params);
  return records.map(record => (
    ...record,
    route_source: parseRouteSource(record)
  });
}

function parseRouteSource(record) {
  const sources = [];
  if (record.address) {
    sources.push({ type: 'æœ‰åŠ åœ¨èŸ, value: record.address });
  }
  if (record.district) {
    sources.push({ type: 'åª¢yb¨9c!¹gã‹˜[YNˆ™XÛÜ™™\ÝšXÝJNÂˆBˆYˆ
™XÛÜ™™\Ý[˜ÙWÚÛJHÂˆÛÝ\˜Ù\Ëœ\Ú
È\Nˆ	º-éyå*:+ ¹î¯ÉË˜[YNˆ	Ü™XÛÜ™™\Ý[˜ÙWÚÛ_yak9.í˜JNÂˆBˆYˆ
™XÛÜ™œ›Ý]WÚ[™›ÊHÂˆžHÂˆÛÛœÝ›Ý]HH”ÓÓ‹œ\œÙJ™XÛÜ™œ›Ý]WÚ[™›ÊNÂˆYˆ
›Ý]K™\Ý[˜ÙWÚÛJHÂˆÛÝ\˜Ù\Ëœ\Ú
È\Nˆ	ùìîùîçú+¨yë¥ùêîùè z)á˜[YNˆ	Ü›Ý]K™\Ý[˜ÙWÚÛ_yå«9.íšJNÂˆBˆHØ]Ú
JHßBˆBˆ™]\›ˆÛÝ\˜Ù\ÎÂŸB‚˜\Þ[˜È[˜Ý[ÛˆÙ]˜XÚÔ™XÛÜ™žRY
Y
HÂˆ™]\›ˆ]ØZ]Ù]
ˆÑSPÕˆ‹Š‹ˆÛË›Ü™\—Û›ËˆÛË˜Y™\ÜËˆÛË™\ÝšXÝˆÛËœÙ\šXÙWÚ][\ËˆÛËœØÚY[YÙ]KˆÛËœÚÚ[ÛX]ÚÜÝ]\ËˆÛË˜Ø[˜Ù[Ü™X\ÛÛ‹ˆ\›˜[YH\È[\›WÛ˜[YKˆ\œÛ™H\È[\›WÜÛ™Kˆ\šX[ÜÝ]\Ëˆ‹›˜[YH\È\œÙWÛ˜[YKˆ‹œ]X[YšXØ][ÛœÈ\È\œÙWÜ]X[YšXØ][ÛœËˆ‹œÚÚ[È\È\œÙWÜÚÚ[Ëˆ‹™\ÝšXÝ\È\œÙWÙ\ÝšXÝˆ‹›˜[YH\È˜]ÚÛ˜[YKˆ‹˜˜]ÚÛ›Âˆ”“ÓH˜XÚ×Ü™XÛÜ™È‚ˆQ•“ÒSˆÙ\šXÙWÛÜ™\œÈÛÈÓˆ‹œÙ\šXÙWÛÜ™\—ÚYHÛËšYˆQ•“ÒS‚VÆFW&Ç•÷&öf–ÆW2WôâG"æVÆFW&Ç•ö–BÒWæVÆFW&Ç•ö–@¢ÄTeB¤ô”âçW'6W2âôâG"æçW'6Uö–BÒâæçW'6Uö–@¢ÄTeB¤ô”â&F6†W2"ôâG"æ&F6…ö–BÒ"æ–@¢t„U$RG"æ–BÒð¢ÈÚYJNÂŸB‚˜\Þ[˜È[˜Ý[ÛˆÙ]Ü™\•˜XÚÒ\ÝÜžJÜ™\’Y
HÂˆ™]\›ˆ]ØZ][
ˆÑSPÕˆ‹Š‹ˆ‹›˜[YH\È\œÙWÛ˜[YBˆ”“ÓH˜XÚ×Ü™XÛÜ™È‚ˆQ•“ÒSˆ\œÙ\ÈˆÓˆ‹›\œÙWÚYH‹›\œÙWÚYˆÒT‘H‹œÙ\šXÙWÛÜ™\—ÚYHÂˆÔ‘Tˆ–H‹š[™YØ]TÐÂˆÛÜ™\’YJNÂŸB‚™[˜Ý[Ûˆ^ÜÐÜÝŠ™XÛÜ™ÊHÂˆÛÛœÝšY[ÈHÂˆÈX™[ˆ	ú+¬9oeyï%¹cåˆ°, value: 'record_no' },
    { label: 'æœåŠ¡å•å·', value: 'order_no' },
    { label: 'æ‹“æ¬§', value: 'batch_name' },
    { label: 'è€äººå¬å“å', value: 'elderly_name' },
    { label: &æ¹‹–Ž¯–žO–B4œ°Ù…±Õ”è€¹ÕÉÍ•}¹…µ”œô°(€€€ì±…‰•°è€›šæ.Z:¾‹XN‹JŽjÛBrÂfÇVS¢vçW'6U÷VÆ–f–6F–öç2rÒÀ¢²Æ&VÃ¢v~iÈÞXª{Jþi[rÂfÇVS¢w6W'f–6U÷G—RrÒÀ¢²Æ&VÃ¢~x«nhrÂfÇVS¢w7FGW2rÒÀ¢²Æ&VÃ¢~i/¾KÙ¢rÂfÇVS¢v7F–öârÒÀ¢²Æ&VÃ¢~XéþYºrÂfÇVS¢w&V6öârÒÀ¢²Æ&VÃ¢~ZHNynK«¢rÂfÇVS¢v†æFÆVEö'’rÒÀ¢²Æ&VÃ¢ni!9ä!¹¥äé•~˜œ°Ù…±Õ”è€¡…¹‘±•‘}…Ðœô°(€€€ì±…‰•°è€Ÿšr'–*ƒ–r£¢~4°Ù…±Õ”è€…‘‘É•ÍÌœô°(€€€ì±…‰•°è€žZª'–*ƒ–2–~8°Ù…±Õ”è€‘¥ÍÑÉ¥Ðœô°(€€€ì±…‰•°è€ëè¥»žŠèæ˜Ž,,Ù…±Õ”è€¡È¤€ôøÈ¹É½ÕÑ•}Í½ÕÉ”ü¹µ…À¡Ì€ôø€‘íÌ¹ÑåÁ•ôè‘ì¹Ù…±Õ•ñ€¤¹©½¥¸ œð€œ¤€|°(€tì((€½¹ÍÐ©Í½¸ÉÍÙA…ÉÍ•È€ô¹•ÜA…ÉÍ•È¡ì™¥•±‘Ìô¤ì(€É•ÑÕÉ¸©Í½¸ÉÍÙA…ÉÍ•È¹Á…ÉÍ”¡É•½É‘Ì¤ì)ô()…Íå¹Œ™Õ¹Ñ¥½¸•ÑMÑ…Ñ¥ÍÑ¥Ì ¤ì(€É•ÑÕÉ¸ì(€€€‰åMÑ…ÑÕÌè…Ý…¥Ð…±°¡M1	PÍÑ…ÑÕÌ°=9UP ¨¤…Ì½Õ¹ÐI=4ÑÉ…­}É•½É‘ÌI=U@	dÍÑ…ÑÕÍ€¤°(€€€‰åÑ¥½¸è…Ý…¥Ð…±°¡M1	P…Ñ¥½¸°=9UP ¨¤…Ì½Õ¹ÐI=4ÑÉ…­}É•½É‘ÌI=U@	d…Ñ¥½¹€¤°(€€€‰å9ÕÉÍ”è…Ý…¥Ð…±°¡€(€€€€€M1P¹ÕÉÍ•}¥°¹ÕÉÍ•}¹…µ”°=U9P ¤…Ì½Õ¹Ð€(€€€€€I=4€ (€€€€€€€M1PÑÈ¹¹ÕÉÍ•}¥°¸¹¹…µ”…Ì¹ÕÉÍ•}¹…µ”€(€€€€€€€I=4ÑÉ…­}É•½É‘ÌÑÈ€(€€€€€€€1P)=%8¹ÕÉÍ•Ì¸=8ÑÈ¹¹ÕÉÍ•}¥€ô¸¹¹ÕÉÍ•}¥€(€€€€€€€]!IÑÈ¹¹ÕÉÍ•}¥%L9=P9U10(€€€€€€¤€(€€€€€I=U@	d¹ÕÉÍ•}¥(€€€€¤°(€€€µ½¹Ñ¡±äè…Ý…¥Ð…±°¡€(€€€€€M1PÍÑÉ™Ñ¥µ” œ•d´•´œ°¡…¹‘±•‘}…Ð¤…Ìµ½¹Ñ °=9UP ¨¤…Ì½Õ¹Ð€(€€€€€I=4ÑÉ…­}É•½É‘Ì€(€€€€€I=U@	dµ½¹Ñ €(€€€€€=IH	dµ½¹Ñ M€(€€€€€1%5%P€ÄÈ(€€€€¤(€ôì)ô()µ½‘Õ±”¹•áÁ½ÉÑÌ€ôì(€ÅÕ•ÉåQÉ…­I•½É‘Ì°(€•ÑQÉ…­I•½É‘	å%°(€•Ñ=É‘•ÉQÉ…­!¥ÍÑ½Éä°(€•áÁ½ÉÑQ½ÍØ°(€•ÑMÑ…Ñ¥ÍÑ¥Ì)ôì(
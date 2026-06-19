const fs = require('fs');
const path = '/Users/lzy/pro/solo/workspaces/zy72287/slope-step-annotation/src/store/annotationStore.ts';
let content = fs.readFileSync(path, 'utf8');

const oldPattern1 = "const COORD_METRIC_PATTERN = /[xXyY]\\s*[:=]\\s*[\\d.]+/\nconst COORD_LNG_LAT_PATTERN = /(?:经度|纬度|lng|lat|longitude|latitude)\\s*[:/=：]\\s*[\\d.]+/i";
const newPattern1 = "const COORD_METRIC_PATTERN = /[xXyY]\\s*[:=]\\s*[\\d.]+/\nconst COORD_LNG_LAT_PATTERN = /(?:经度|纬度|lng|lat|longitude|latitude)\\s*[:=：]\\s*[\\d.]+/i\nconst LNG_LAT_COMPOUND_PATTERN = /(经度\\s*\\/\\s*纬度|纬度\\s*\\/\\s*经度)\\s*[:=：]\\s*([\\d.]+)\\s*\\/\\s*([\\d.]+)/i";

if (content.includes(oldPattern1)) {
  content = content.replace(oldPattern1, newPattern1);
  console.log('Replaced pattern block');
} else {
  console.log('Old pattern NOT found - may already be fixed?');
}

const oldParse = `  const hasMetric = COORD_METRIC_PATTERN.test(raw)
  const hasLngLat = COORD_LNG_LAT_PATTERN.test(raw)

  const isMixed = hasMetric && hasLngLat
  let mixedDetail: string | undefined
  if (isMixed) {
    mixedDetail = \`原始值"\${raw}"同时包含经纬度和米制坐标\`
  }

  const coord: CoordValue = {
    system: hasMetric && !hasLngLat ? 'local_metric' : 'wgs84',
    raw,
    isMixed,
    mixedDetail,
  }

  const lngMatch = raw.match(/(?:经度|lng|longitude)\\s*[:/=：]\\s*([\\d.]+)/i)
  const latMatch = raw.match(/(?:纬度|lat|latitude)\\s*[:/=：]\\s*([\\d.]+)/i)
  if (lngMatch) coord.lng = parseFloat(lngMatch[1])
  if (latMatch) coord.lat = parseFloat(latMatch[1])`;

const newParse = `  const hasMetric = COORD_METRIC_PATTERN.test(raw)
  const hasLngLat =
    COORD_LNG_LAT_PATTERN.test(raw) || LNG_LAT_COMPOUND_PATTERN.test(raw)

  const isMixed = hasMetric && hasLngLat
  let mixedDetail: string | undefined
  if (isMixed) {
    mixedDetail = \`原始值"\${raw}"同时包含经纬度和米制坐标\`
  }

  const coord: CoordValue = {
    system: hasMetric && !hasLngLat ? 'local_metric' : 'wgs84',
    raw,
    isMixed,
    mixedDetail,
  }

  const compoundMatch = raw.match(LNG_LAT_COMPOUND_PATTERN)
  if (compoundMatch) {
    const firstIsLng = /^经度/.test(compoundMatch[1])
    const firstVal = parseFloat(compoundMatch[2])
    const secondVal = parseFloat(compoundMatch[3])
    if (firstIsLng) {
      coord.lng = firstVal
      coord.lat = secondVal
    } else {
      coord.lat = firstVal
      coord.lng = secondVal
    }
  } else {
    const lngMatch = raw.match(/(?:经度|lng|longitude)\\s*[:=：]\\s*([\\d.]+)/i)
    const latMatch = raw.match(/(?:纬度|lat|latitude)\\s*[:=：]\\s*([\\d.]+)/i)
    if (lngMatch) coord.lng = parseFloat(lngMatch[1])
    if (latMatch) coord.lat = parseFloat(latMatch[1])
  }`;

if (content.includes(oldParse)) {
  content = content.replace(oldParse, newParse);
  console.log('Replaced parseCoord body');
} else {
  console.log('Old parse body NOT found');
}

fs.writeFileSync(path, content, 'utf8');
console.log('Done. File size:', fs.statSync(path).size);

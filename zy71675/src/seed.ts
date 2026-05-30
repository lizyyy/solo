import 'reflect-metadata';
import { AppDataSource } from './data-source';
import { TrackService } from './services/TrackService';
import { VersionService } from './services/VersionService';
import { PlatformSpecService } from './services/PlatformSpecService';
import { DeliveryService } from './services/DeliveryService';
import { AnomalyService } from './services/AnomalyService';
import { Platform, AudioFormat, ImageFormat } from './entities/enums';

async function seed() {
  console.log('Starting database seeding...');
  await AppDataSource.initialize();
  console.log('Database connected');

  const trackService = new TrackService();
  const versionService = new VersionService();
  const platformSpecService = new PlatformSpecService();
  const deliveryService = new DeliveryService();
  const anomalyService = new AnomalyService();

  // === 创建平台规格 ===
  console.log('Creating platform specs...');

  const spotifySpec = await platformSpecService.createPlatformSpec({
    platform: Platform.SPOTIFY,
    name: 'Spotify 官方规格 v2.3',
    description: 'Spotify For Artists 最新母带和封面要求',
    requiredAudioFormats: [AudioFormat.WAV, AudioFormat.FLAC],
    minSampleRate: 44100,
    maxSampleRate: 192000,
    minBitDepth: 16,
    maxBitDepth: 24,
    minDuration: 30,
    maxDuration: 300,
    targetLoudnessIntegrated: -14,
    maxLoudnessIntegrated: -10,
    maxPeakLevel: -1,
    requiredImageFormats: [ImageFormat.JPG, ImageFormat.PNG],
    minCoverWidth: 3000,
    maxCoverWidth: 3000,
    minCoverHeight: 3000,
    maxCoverHeight: 3000,
    requireSquareCover: true,
    minCoverDpi: 72,
    maxCoverFileSize: 10 * 1024 * 1024,
    allowTextOnCover: false,
    requireIsrc: true,
    requireUpc: true,
    deliveryDeadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    platformFee: 0,
    metadataGuidelines: '请勿在标题中包含"单曲"、"专辑"等字样',
    version: '2.3',
    createdBy: '系统管理员',
  });
  console.log('Created Spotify spec:', spotifySpec.id);

  const neteaseSpec = await platformSpecService.createPlatformSpec({
    platform: Platform.NETEASE,
    name: '网易云音乐规格 v1.8',
    description: '网易云音乐独立音乐人入驻要求',
    requiredAudioFormats: [AudioFormat.WAV, AudioFormat.FLAC, AudioFormat.MP3],
    minSampleRate: 44100,
    maxSampleRate: 96000,
    minBitDepth: 16,
    maxBitDepth: 24,
    minDuration: 10,
    maxDuration: 600,
    targetLoudnessIntegrated: -16,
    maxLoudnessIntegrated: -8,
    maxPeakLevel: -0.5,
    requiredImageFormats: [ImageFormat.JPG, ImageFormat.PNG],
    minCoverWidth: 1080,
    maxCoverWidth: 4096,
    minCoverHeight: 1080,
    maxCoverHeight: 4096,
    requireSquareCover: true,
    minCoverDpi: 72,
    maxCoverFileSize: 20 * 1024 * 1024,
    allowTextOnCover: true,
    requireIsrc: false,
    requireUpc: false,
    deliveryDeadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    platformFee: 0,
    metadataGuidelines: '允许封面包含歌曲名称和艺人名字',
    version: '1.8',
    createdBy: '系统管理员',
  });
  console.log('Created NetEase spec:', neteaseSpec.id);

  const qqSpec = await platformSpecService.createPlatformSpec({
    platform: Platform.QQ_MUSIC,
    name: 'QQ音乐开放平台规格 v3.1',
    description: 'QQ音乐开放平台最新规范',
    requiredAudioFormats: [AudioFormat.WAV, AudioFormat.FLAC],
    minSampleRate: 48000,
    maxSampleRate: 96000,
    minBitDepth: 24,
    maxBitDepth: 24,
    minDuration: 15,
    maxDuration: 600,
    targetLoudnessIntegrated: -14,
    maxLoudnessIntegrated: -9,
    maxPeakLevel: -1,
    requiredImageFormats: [ImageFormat.JPG],
    minCoverWidth: 2400,
    maxCoverWidth: 2400,
    minCoverHeight: 2400,
    maxCoverHeight: 2400,
    requireSquareCover: true,
    minCoverDpi: 300,
    maxCoverFileSize: 5 * 1024 * 1024,
    allowTextOnCover: false,
    requireIsrc: true,
    requireUpc: true,
    deliveryDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    platformFee: 0,
    metadataGuidelines: '必须提供原始母带，不得有平台水印',
    version: '3.1',
    createdBy: '系统管理员',
  });
  console.log('Created QQ Music spec:', qqSpec.id);

  // === 创建问题曲目样例 ===
  console.log('\nCreating problematic track sample...');

  const problemTrack = await trackService.createTrack({
    title: '深夜便利店',
    artist: '电波故障乐队',
    album: '城市观察日记',
    duration: 218.5,
    isrc: undefined,
    upc: undefined,
    genre: '独立摇滚',
    releaseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    territory: '中国大陆',
    isExplicit: false,
    paymentAmount: undefined,
    paymentTerms: 'Net 60',
    contractId: undefined,
    rosterPriority: undefined,
    lyrics: '霓虹灯照亮了街角\n24小时不打烊的骄傲\n...',
    notes: '微信群来回改了8次，制作人小王说还要再调',
    createdBy: 'A&R 小李',
  });
  console.log('Created problematic track:', problemTrack.id);

  // === 上传有问题的母带版本 1 ===
  console.log('\nUploading problematic master version 1...');
  const masterV1 = await versionService.uploadMasterFile(problemTrack.id, {
    fileName: '深夜便利店_v1_44100_16.wav',
    filePath: '/masters/深夜便利店_v1_44100_16.wav',
    fileSize: 45800000,
    duration: 218.5,
    sampleRate: 44100,
    bitDepth: 16,
    bitRate: 1411200,
    format: AudioFormat.WAV,
    channels: 2,
    checksum: 'a1b2c3d4e5f678901234567890abcdef',
    notes: '初版母带，制作人小王发来的',
    peakLevel: -0.3,
    loudnessIntegrated: -8.5,
    loudnessRange: 12.3,
    uploadedBy: '制作人小王',
  });
  console.log('Uploaded master v1:', masterV1.id, '问题：响度太高 -8.5 LUFS（Spotify要求-14）');

  // === 上传母带版本 2（修复响度但引入新问题） ===
  console.log('\nUploading master version 2...');
  const masterV2 = await versionService.uploadMasterFile(problemTrack.id, {
    fileName: '深夜便利店_v2_44100_16.wav',
    filePath: '/masters/深夜便利店_v2_44100_16.wav',
    fileSize: 45800000,
    duration: 218.5,
    sampleRate: 44100,
    bitDepth: 16,
    bitRate: 1411200,
    format: AudioFormat.WAV,
    channels: 2,
    checksum: 'b2c3d4e5f678901234567890abcdef12',
    notes: '修改了响度，但是QQ音乐要求24bit',
    peakLevel: -1.2,
    loudnessIntegrated: -14.2,
    loudnessRange: 11.8,
    uploadedBy: '母带工程师老张',
  });
  console.log('Uploaded master v2:', masterV2.id, '问题：比特深度16bit（QQ音乐要求24bit）');

  // === 上传封面版本 1（尺寸不够） ===
  console.log('\nUploading problematic cover version 1...');
  const coverV1 = await versionService.uploadCoverArt(problemTrack.id, {
    fileName: '深夜便利店_封面_v1.jpg',
    filePath: '/covers/深夜便利店_封面_v1.jpg',
    fileSize: 1200000,
    width: 1200,
    height: 1200,
    format: ImageFormat.JPG,
    dpi: 72,
    colorProfile: 'sRGB',
    checksum: 'c3d4e5f678901234567890abcdef1234',
    notes: '设计师初稿，尺寸不够',
    hasExplicitContent: false,
    hasTextOverlay: false,
    uploadedBy: '设计师小陈',
  });
  console.log('Uploaded cover v1:', coverV1.id, '问题：尺寸1200x1200（Spotify要求3000x3000）');

  // === 上传封面版本 2（尺寸够但有文字叠加） ===
  console.log('\nUploading cover version 2...');
  const coverV2 = await versionService.uploadCoverArt(problemTrack.id, {
    fileName: '深夜便利店_封面_v2.jpg',
    filePath: '/covers/深夜便利店_封面_v2.jpg',
    fileSize: 3500000,
    width: 3000,
    height: 3000,
    format: ImageFormat.JPG,
    dpi: 72,
    colorProfile: 'sRGB',
    checksum: 'd4e5f678901234567890abcdef123456',
    notes: '尺寸对了，但是加了歌名和艺人名',
    hasExplicitContent: false,
    hasTextOverlay: true,
    uploadedBy: '设计师小陈',
  });
  console.log('Uploaded cover v2:', coverV2.id, '问题：有文字叠加（Spotify不允许）');

  // === 创建交付报告 ===
  console.log('\nCreating delivery reports...');

  // Spotify 报告 - 关联最新母带v2和封面v2
  const spotifyReport = await deliveryService.createDeliveryReport({
    trackId: problemTrack.id,
    platformSpecId: spotifySpec.id,
    masterFileId: masterV2.id,
    coverArtId: coverV2.id,
    notes: '微信群讨论了8次，大家都说封面好看，但可能通不过Spotify审核',
    estimatedRevenue: 15000,
    createdBy: 'A&R 小李',
  });
  console.log('Created Spotify delivery report:', spotifyReport.id);

  // 网易云报告 - 关联最新母带v2和封面v2
  const neteaseReport = await deliveryService.createDeliveryReport({
    trackId: problemTrack.id,
    platformSpecId: neteaseSpec.id,
    masterFileId: masterV2.id,
    coverArtId: coverV2.id,
    notes: '网易云要求没那么严，应该可以过',
    estimatedRevenue: 8000,
    createdBy: 'A&R 小李',
  });
  console.log('Created NetEase delivery report:', neteaseReport.id);

  // QQ音乐报告 - 关联最新母带v2和封面v2
  const qqReport = await deliveryService.createDeliveryReport({
    trackId: problemTrack.id,
    platformSpecId: qqSpec.id,
    masterFileId: masterV2.id,
    coverArtId: coverV2.id,
    notes: 'QQ音乐要求24bit，现在只有16bit',
    estimatedRevenue: 12000,
    createdBy: 'A&R 小李',
  });
  console.log('Created QQ Music delivery report:', qqReport.id);

  // === 校验交付报告（这会自动发现规格问题并创建异常记录） ===
  console.log('\nValidating delivery reports...');

  console.log('Validating Spotify report...');
  const validatedSpotify = await deliveryService.validateDeliveryReport(spotifyReport.id, '审核员小赵');
  console.log('Spotify validation result:', validatedSpotify.status);
  if (validatedSpotify.masterValidationErrors) {
    console.log('  Master errors:', validatedSpotify.masterValidationErrors);
  }
  if (validatedSpotify.coverValidationErrors) {
    console.log('  Cover errors:', validatedSpotify.coverValidationErrors);
  }
  if (validatedSpotify.metadataValidationErrors) {
    console.log('  Metadata errors:', validatedSpotify.metadataValidationErrors);
  }

  console.log('\nValidating NetEase report...');
  const validatedNetease = await deliveryService.validateDeliveryReport(neteaseReport.id, '审核员小赵');
  console.log('NetEase validation result:', validatedNetease.status);

  console.log('\nValidating QQ Music report...');
  const validatedQQ = await deliveryService.validateDeliveryReport(qqReport.id, '审核员小赵');
  console.log('QQ Music validation result:', validatedQQ.status);
  if (validatedQQ.masterValidationErrors) {
    console.log('  Master errors:', validatedQQ.masterValidationErrors);
  }

  // === 扫描所有异常 ===
  console.log('\nScanning for all anomalies...');
  const allAnomalies = await anomalyService.scanAllAnomalies();
  console.log('Found', allAnomalies.length, 'anomalies:');

  const anomalySummary = await anomalyService.getAnomalySummary();
  console.log('\n=== Anomaly Summary ===');
  console.log('Total:', anomalySummary.total);
  console.log('Open:', anomalySummary.open);
  console.log('By severity:', anomalySummary.bySeverity);
  console.log('By type:', anomalySummary.byType);

  // === 获取完整追踪链路 ===
  console.log('\n=== Full Delivery Trace for Track ===');
  const trace = await deliveryService.getDeliveryTrace(problemTrack.id);
  console.log('Track:', trace.track?.title, '-', trace.track?.artist);
  console.log('Master versions:', trace.masterFiles.length);
  trace.masterFiles.forEach(m => console.log(`  v${m.version}: ${m.fileName} [${m.status}]`));
  console.log('Cover versions:', trace.coverArts.length);
  trace.coverArts.forEach(c => console.log(`  v${c.version}: ${c.fileName} [${c.status}]`));
  console.log('Delivery reports:', trace.deliveryReports.length);
  trace.deliveryReports.forEach(d => console.log(`  ${d.platformSpec?.name}: ${d.status}`));
  console.log('Status changes:', trace.statusChanges.length);

  // === 创建另一首正常的曲目作为对比 ===
  console.log('\n\nCreating a normal track for comparison...');

  const normalTrack = await trackService.createTrack({
    title: '午后的咖啡',
    artist: '电波故障乐队',
    album: '城市观察日记',
    duration: 245.3,
    isrc: 'CN-B12-24-00001',
    upc: '6901234567890',
    genre: '独立摇滚',
    releaseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    territory: '全球',
    isExplicit: false,
    paymentAmount: 50000,
    paymentTerms: 'Net 45',
    contractId: 'INDIE-2024-001',
    rosterPriority: 1,
    lyrics: '阳光透过玻璃窗\n咖啡的香气在流淌\n...',
    notes: '一切正常，可以交付',
    createdBy: 'A&R 小李',
  });

  const normalMaster = await versionService.uploadMasterFile(normalTrack.id, {
    fileName: '午后的咖啡_v1_96000_24.wav',
    filePath: '/masters/午后的咖啡_v1_96000_24.wav',
    fileSize: 102800000,
    duration: 245.3,
    sampleRate: 96000,
    bitDepth: 24,
    bitRate: 4608000,
    format: AudioFormat.WAV,
    channels: 2,
    checksum: 'e5f678901234567890abcdef12345678',
    notes: '完美母带，符合所有平台要求',
    peakLevel: -1.0,
    loudnessIntegrated: -14.0,
    loudnessRange: 10.5,
    uploadedBy: '母带工程师老张',
  });

  const normalCover = await versionService.uploadCoverArt(normalTrack.id, {
    fileName: '午后的咖啡_封面_v1.jpg',
    filePath: '/covers/午后的咖啡_封面_v1.jpg',
    fileSize: 4200000,
    width: 3000,
    height: 3000,
    format: ImageFormat.JPG,
    dpi: 300,
    colorProfile: 'sRGB',
    checksum: 'f678901234567890abcdef1234567890',
    notes: '完美封面，无文字，尺寸正确',
    hasExplicitContent: false,
    hasTextOverlay: false,
    uploadedBy: '设计师小陈',
  });

  const normalReport = await deliveryService.createDeliveryReport({
    trackId: normalTrack.id,
    platformSpecId: spotifySpec.id,
    masterFileId: normalMaster.id,
    coverArtId: normalCover.id,
    notes: '正常曲目，没有问题',
    estimatedRevenue: 25000,
    createdBy: 'A&R 小李',
  });

  const validatedNormal = await deliveryService.validateDeliveryReport(normalReport.id, '审核员小赵');
  console.log('Normal track validation result:', validatedNormal.status);

  console.log('\n\n=== Seeding Complete ===');
  console.log('Database has been seeded with:');
  console.log('  - 3 Platform specs (Spotify, NetEase, QQ Music)');
  console.log('  - 2 Tracks (1 problematic, 1 normal)');
  console.log('  - 5 Master files (3 for problematic track, 2 versions each)');
  console.log('  - 3 Cover files (2 for problematic track)');
  console.log('  - 4 Delivery reports');
  console.log('  - Multiple anomalies and audit logs');
  console.log('\n=== Problematic Track ID:', problemTrack.id, '===');
  console.log('This track demonstrates:');
  console.log('  1. 🔊 MASTER_VERSION_CONFLICT: 2 master versions uploaded');
  console.log('  2. 🎨 COVER_OVERWRITE: 2 cover versions uploaded');
  console.log('  3. ⚠️  SPEC_MISMATCH: Loudness too high, bit depth too low, cover has text');
  console.log('  4. ⏰ DEADLINE_RISK: Spotify deadline in 3 days');
  console.log('  5. 💰 PAYMENT_RISK: Missing payment amount and contract ID');
  console.log('  6. 📋 ROSTER_RISK: Missing roster priority');
  console.log('  7. 📝 MISSING_METADATA: Missing ISRC and UPC');
  console.log('\nYou can now start the server with: npm run dev');
  console.log('And test the API with: npm run test');

  await AppDataSource.destroy();
}

seed().catch(console.error);

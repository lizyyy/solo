import { useState, useEffect, useRef } from 'react';
import {
  Rocket,
  Database,
  Merge,
  UserCheck,
  FileSpreadsheet,
  Clock,
  HelpCircle,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Info,
  Lightbulb,
  Upload,
  MapPin,
  Users,
  Camera,
  StickyNote,
  FileCode,
  GitBranch,
  Eye,
  Shield,
  Download,
  Filter,
  Settings,
  History,
  DatabaseBackup,
  Search,
} from 'lucide-react';
import { cn } from '@/utils/cn';

interface NavSection {
  id: string;
  title: string;
  icon: React.ElementType;
  subsections?: { id: string; title: string }[];
}

const navSections: NavSection[] = [
  {
    id: 'quickstart',
    title: '快速开始',
    icon: Rocket,
  },
  {
    id: 'import',
    title: '数据导入',
    icon: Database,
    subsections: [
      { id: 'import-gis', title: '导入GIS点位' },
      { id: 'import-feedback', title: '导入居民反馈' },
      { id: 'import-photos', title: '上传巡检照片' },
      { id: 'import-notes', title: '导入街道备注' },
    ],
  },
  {
    id: 'merge',
    title: '点位归并规则',
    icon: Merge,
    subsections: [
      { id: 'merge-name', title: '名称相似度计算' },
      { id: 'merge-distance', title: '地理距离阈值' },
      { id: 'merge-confidence', title: '置信度分级' },
      { id: 'merge-conflict', title: '冲突检测机制' },
    ],
  },
  {
    id: 'review',
    title: '人工复核',
    icon: UserCheck,
    subsections: [
      { id: 'review-process', title: '复核判定流程' },
      { id: 'review-actions', title: '四种操作说明' },
      { id: 'review-evidence', title: '冲突证据查看' },
    ],
  },
  {
    id: 'export',
    title: '公示导出',
    icon: FileSpreadsheet,
    subsections: [
      { id: 'export-filter', title: '筛选待公示点位' },
      { id: 'export-columns', title: '自定义列配置' },
      { id: 'export-format', title: '导出格式说明' },
    ],
  },
  {
    id: 'trace',
    title: '数据追溯',
    icon: Clock,
    subsections: [
      { id: 'trace-logs', title: '操作日志查看' },
      { id: 'trace-source', title: '来源数据保留' },
      { id: 'trace-timeline', title: '处理时间线' },
    ],
  },
  {
    id: 'faq',
    title: '常见问题',
    icon: HelpCircle,
  },
];

export default function HelpPage() {
  const [activeSection, setActiveSection] = useState<string>('quickstart');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['import', 'merge', 'review', 'export', 'trace'])
  );
  const contentRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { rootMargin: '-100px 0px -80% 0px', threshold: 0 }
    );

    sectionRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const scrollToSection = (id: string) => {
    const el = sectionRefs.current.get(id);
    if (el && contentRef.current) {
      const top = el.offsetTop - 24;
      contentRef.current.scrollTo({ top, behavior: 'smooth' });
    }
  };

  const setSectionRef = (id: string) => (el: HTMLElement | null) => {
    if (el) {
      sectionRefs.current.set(id, el);
    }
  };

  return (
    <div className="flex h-full gap-6">
      <aside className="w-64 flex-shrink-0">
        <div className="sticky top-0 bg-white border border-neutral-200 rounded-sm shadow-card">
          <div className="p-4 border-b border-neutral-200 bg-primary-50">
            <h3 className="font-serif font-semibold text-primary-700 flex items-center gap-2">
              <HelpCircle size={18} />
              文档导航
            </h3>
          </div>
          <nav className="p-2 max-h-[calc(100vh-220px)] overflow-y-auto">
            {navSections.map((section) => (
              <div key={section.id} className="mb-1">
                <button
                  onClick={() => {
                    scrollToSection(section.id);
                    if (section.subsections) {
                      toggleSection(section.id);
                    }
                  }}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 text-sm rounded-sm transition-colors text-left',
                    activeSection === section.id
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'text-neutral-600 hover:bg-neutral-50'
                  )}
                >
                  <section.icon size={16} />
                  <span className="flex-1">{section.title}</span>
                  {section.subsections && (
                    <ChevronRight
                      size={14}
                      className={cn(
                        'transition-transform',
                        expandedSections.has(section.id) && 'rotate-90'
                      )}
                    />
                  )}
                </button>
                {section.subsections && expandedSections.has(section.id) && (
                  <ul className="ml-6 mt-1 space-y-1">
                    {section.subsections.map((sub) => (
                      <li key={sub.id}>
                        <button
                          onClick={() => scrollToSection(sub.id)}
                          className={cn(
                            'w-full flex items-center gap-2 px-3 py-1.5 text-xs rounded-sm transition-colors text-left',
                            activeSection === sub.id
                              ? 'bg-primary-100 text-primary-700'
                              : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-700'
                          )}
                        >
                          <ChevronRight size={12} />
                          {sub.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </nav>
        </div>
      </aside>

      <div ref={contentRef} className="flex-1 overflow-y-auto pr-2">
        <div className="max-w-4xl space-y-8">
          <section
            id="quickstart"
            ref={setSectionRef('quickstart')}
            className="scroll-mt-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary-100 rounded-sm flex items-center justify-center">
                <Rocket className="text-primary-600" size={22} />
              </div>
              <h2 className="text-2xl font-serif font-bold text-neutral-800">快速开始</h2>
            </div>

            <div className="prose prose-primary max-w-none">
              <div className="bg-primary-50 border-l-4 border-primary-500 p-4 mb-6">
                <div className="flex items-start gap-3">
                  <Lightbulb className="text-primary-600 flex-shrink-0 mt-0.5" size={20} />
                  <div>
                    <p className="font-medium text-primary-800 mb-1">系统用途</p>
                    <p className="text-sm text-primary-700">
                      本系统专为城市规划管理部门设计，用于多源垃圾分类投放点位数据的校对、归并、复核与公示导出。
                      通过智能化的名称匹配和地理距离计算，有效解决不同来源数据的一致性问题，提升点位管理效率。
                    </p>
                  </div>
                </div>
              </div>

              <h3 className="text-lg font-semibold text-neutral-800 mb-3">核心工作流程</h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                {[
                  { step: 1, title: '数据导入', icon: Upload, desc: '多源数据采集' },
                  { step: 2, title: '智能归并', icon: Merge, desc: '自动匹配计算' },
                  { step: 3, title: '人工复核', icon: UserCheck, desc: '冲突判定处理' },
                  { step: 4, title: '公示导出', icon: FileSpreadsheet, desc: '结果输出' },
                  { step: 5, title: '数据追溯', icon: History, desc: '全流程审计' },
                ].map((item) => (
                  <div
                    key={item.step}
                    className="bg-white border border-neutral-200 rounded-sm p-4 text-center relative"
                  >
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-primary-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                      {item.step}
                    </div>
                    <item.icon className="mx-auto text-primary-500 mb-2" size={24} />
                    <p className="font-medium text-neutral-800 text-sm">{item.title}</p>
                    <p className="text-xs text-neutral-500 mt-1">{item.desc}</p>
                  </div>
                ))}
              </div>

              <div className="bg-white border border-neutral-200 rounded-sm p-4">
                <h4 className="font-medium text-neutral-800 mb-2 flex items-center gap-2">
                  <Info size={16} className="text-primary-500" />
                  快速上手三步法
                </h4>
                <ol className="space-y-2 text-sm text-neutral-600">
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                      1
                    </span>
                    <span>在「数据导入」页面上传GIS点位、居民反馈、巡检照片和街道备注等数据</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                      2
                    </span>
                    <span>系统自动进行点位归并计算后，在「人工复核」页面处理待复核和冲突点位</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                      3
                    </span>
                    <span>在「公示导出」页面筛选已确认点位，配置导出字段后生成公示文件</span>
                  </li>
                </ol>
              </div>
            </div>
          </section>

          <section
            id="import"
            ref={setSectionRef('import')}
            className="scroll-mt-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary-100 rounded-sm flex items-center justify-center">
                <Database className="text-primary-600" size={22} />
              </div>
              <h2 className="text-2xl font-serif font-bold text-neutral-800">数据导入</h2>
            </div>

            <div className="prose prose-primary max-w-none space-y-6">
              <div className="bg-warning-50 border border-warning-200 rounded-sm p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="text-warning-600 flex-shrink-0 mt-0.5" size={20} />
                  <div>
                    <p className="font-medium text-warning-800 mb-1">数据格式要求</p>
                    <p className="text-sm text-warning-700">
                      所有导入的数据必须包含必要的关键字段，否则系统将无法正确识别和归并点位。
                      建议先下载各页面提供的模板文件，按照模板格式整理数据后再导入。
                    </p>
                  </div>
                </div>
              </div>

              <div id="import-gis" ref={setSectionRef('import-gis')} className="scroll-mt-6">
                <h3 className="text-lg font-semibold text-neutral-800 mb-3 flex items-center gap-2">
                  <MapPin size={18} className="text-primary-500" />
                  导入GIS点位
                </h3>
                <p className="text-sm text-neutral-600 mb-3">
                  GIS点位数据是系统的基础数据源，通常来自测绘部门或规划数据库。
                </p>

                <h4 className="font-medium text-neutral-700 mb-2">支持的格式</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  {['CSV', 'Excel (.xlsx)', 'Shapefile (.shp)', 'GeoJSON'].map((format) => (
                    <div
                      key={format}
                      className="bg-white border border-neutral-200 rounded-sm p-3 text-center"
                    >
                      <FileCode className="mx-auto text-primary-500 mb-1" size={20} />
                      <p className="text-xs font-medium text-neutral-700">{format}</p>
                    </div>
                  ))}
                </div>

                <h4 className="font-medium text-neutral-700 mb-2">必填字段</h4>
                <div className="bg-neutral-900 text-neutral-100 rounded-sm p-4 text-sm font-mono overflow-x-auto">
                  <pre>{`name:        点位名称（如"某某小区垃圾桶"）
longitude:   经度（WGS84坐标系，如 120.123456）
latitude:    纬度（WGS84坐标系，如 30.123456）
type:        点位类型（可回收/厨余/有害/其他）
capacity:    容量（升）
install_date: 安装日期（可选）`}</pre>
                </div>

                <div className="mt-4 bg-success-50 border border-success-200 rounded-sm p-3">
                  <p className="text-sm text-success-700 flex items-start gap-2">
                    <CheckCircle2 size={16} className="flex-shrink-0 mt-0.5" />
                    <span>
                      <strong>提示：</strong>坐标系统一使用 WGS84 经纬度格式。如果您的数据使用的是
                      GCJ-02（火星坐标系）或 BD-09（百度坐标系），系统会自动进行转换。
                    </span>
                  </p>
                </div>
              </div>

              <div id="import-feedback" ref={setSectionRef('import-feedback')} className="scroll-mt-6">
                <h3 className="text-lg font-semibold text-neutral-800 mb-3 flex items-center gap-2">
                  <Users size={18} className="text-primary-500" />
                  导入居民反馈
                </h3>
                <p className="text-sm text-neutral-600 mb-3">
                  居民反馈数据来自12345热线、社区APP或问卷调查，包含居民上报的点位问题和建议。
                </p>

                <h4 className="font-medium text-neutral-700 mb-2">数据字段说明</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-primary-50">
                        <th className="border border-neutral-200 px-4 py-2 text-left text-primary-700 font-medium">
                          字段名
                        </th>
                        <th className="border border-neutral-200 px-4 py-2 text-left text-primary-700 font-medium">
                          类型
                        </th>
                        <th className="border border-neutral-200 px-4 py-2 text-left text-primary-700 font-medium">
                          必填
                        </th>
                        <th className="border border-neutral-200 px-4 py-2 text-left text-primary-700 font-medium">
                          说明
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { name: 'feedback_id', type: '字符串', required: '是', desc: '反馈编号，唯一标识' },
                        { name: 'description', type: '字符串', required: '是', desc: '问题描述或点位名称' },
                        { name: 'address', type: '字符串', required: '是', desc: '详细地址描述' },
                        { name: 'longitude', type: '数字', required: '否', desc: '经度（如有）' },
                        { name: 'latitude', type: '数字', required: '否', desc: '纬度（如有）' },
                        { name: 'feedback_type', type: '字符串', required: '是', desc: '新增/移除/改造/其他' },
                        { name: 'feedback_time', type: '日期', required: '是', desc: '反馈时间' },
                        { name: 'contact', type: '字符串', required: '否', desc: '联系人信息' },
                      ].map((row, idx) => (
                        <tr key={idx} className="hover:bg-neutral-50">
                          <td className="border border-neutral-200 px-4 py-2 font-mono text-xs">{row.name}</td>
                          <td className="border border-neutral-200 px-4 py-2">{row.type}</td>
                          <td className="border border-neutral-200 px-4 py-2">
                            <span
                              className={cn(
                                'px-2 py-0.5 text-xs rounded-sm',
                                row.required === '是'
                                  ? 'bg-primary-100 text-primary-700'
                                  : 'bg-neutral-100 text-neutral-500'
                              )}
                            >
                              {row.required}
                            </span>
                          </td>
                          <td className="border border-neutral-200 px-4 py-2 text-neutral-600">{row.desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div id="import-photos" ref={setSectionRef('import-photos')} className="scroll-mt-6">
                <h3 className="text-lg font-semibold text-neutral-800 mb-3 flex items-center gap-2">
                  <Camera size={18} className="text-primary-500" />
                  上传巡检照片
                </h3>
                <p className="text-sm text-neutral-600 mb-3">
                  巡检人员现场拍摄的照片，系统会自动读取EXIF信息获取拍摄时间和地理位置。
                </p>

                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div className="bg-white border border-neutral-200 rounded-sm p-4">
                    <h5 className="font-medium text-neutral-800 mb-2 flex items-center gap-2">
                      <CheckCircle2 size={16} className="text-success-500" />
                      支持的图片格式
                    </h5>
                    <ul className="text-sm text-neutral-600 space-y-1">
                      <li>• JPG / JPEG（推荐，完整EXIF支持）</li>
                      <li>• PNG（EXIF信息可选）</li>
                      <li>• HEIC（iOS照片格式）</li>
                      <li>• 单张大小不超过 20MB</li>
                    </ul>
                  </div>
                  <div className="bg-white border border-neutral-200 rounded-sm p-4">
                    <h5 className="font-medium text-neutral-800 mb-2 flex items-center gap-2">
                      <Shield size={16} className="text-primary-500" />
                      批量上传说明
                    </h5>
                    <ul className="text-sm text-neutral-600 space-y-1">
                      <li>• 支持单次最多 500 张照片批量上传</li>
                      <li>• 系统自动读取GPS坐标和拍摄时间</li>
                      <li>• 支持拖拽文件夹上传</li>
                      <li>• 上传进度实时显示</li>
                    </ul>
                  </div>
                </div>

                <div className="bg-neutral-900 text-neutral-100 rounded-sm p-4 text-sm font-mono overflow-x-auto">
                  <pre>{`// EXIF 自动读取示例
{
  "photo_id": "P20240115_001",
  "file_name": "IMG_20240115_143022.jpg",
  "latitude": 30.123456,       // 自动从EXIF读取
  "longitude": 120.123456,      // 自动从EXIF读取
  "shoot_time": "2024-01-15 14:30:22",  // 自动从EXIF读取
  "device": "HUAWEI Mate 60",
  "resolution": "4032x3024"
}`}</pre>
                </div>

                <div className="mt-4 bg-warning-50 border border-warning-200 rounded-sm p-3">
                  <p className="text-sm text-warning-700 flex items-start gap-2">
                    <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                    <span>
                      <strong>注意：</strong>如果照片的EXIF信息中不包含GPS坐标，系统会将其标记为"待补充坐标"，
                      需要手动在地图上标注位置后才能参与归并计算。
                    </span>
                  </p>
                </div>
              </div>

              <div id="import-notes" ref={setSectionRef('import-notes')} className="scroll-mt-6">
                <h3 className="text-lg font-semibold text-neutral-800 mb-3 flex items-center gap-2">
                  <StickyNote size={18} className="text-primary-500" />
                  导入街道备注
                </h3>
                <p className="text-sm text-neutral-600 mb-3">
                  街道办或社区工作人员提交的点位备注信息，包括日常巡查记录、点位状态变更等。
                </p>

                <h4 className="font-medium text-neutral-700 mb-2">导入方式</h4>
                <div className="grid md:grid-cols-3 gap-3 mb-4">
                  {[
                    {
                      title: 'Excel 批量导入',
                      desc: '按模板填写后批量上传',
                      icon: FileSpreadsheet,
                    },
                    {
                      title: '在线填写',
                      desc: '系统内置表单逐条录入',
                      icon: Settings,
                    },
                    {
                      title: 'API 对接',
                      desc: '对接街道现有信息系统',
                      icon: GitBranch,
                    },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-white border border-neutral-200 rounded-sm p-4 text-center"
                    >
                      <item.icon className="mx-auto text-primary-500 mb-2" size={24} />
                      <p className="font-medium text-neutral-800 text-sm">{item.title}</p>
                      <p className="text-xs text-neutral-500 mt-1">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section
            id="merge"
            ref={setSectionRef('merge')}
            className="scroll-mt-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary-100 rounded-sm flex items-center justify-center">
                <Merge className="text-primary-600" size={22} />
              </div>
              <h2 className="text-2xl font-serif font-bold text-neutral-800">点位归并规则</h2>
            </div>

            <div className="prose prose-primary max-w-none space-y-6">
              <div className="bg-primary-50 border border-primary-200 rounded-sm p-4">
                <div className="flex items-start gap-3">
                  <Info className="text-primary-600 flex-shrink-0 mt-0.5" size={20} />
                  <div>
                    <p className="font-medium text-primary-800 mb-1">归并算法原理</p>
                    <p className="text-sm text-primary-700">
                      系统采用「名称相似度 + 地理距离」的双维度加权计算模型，综合判定多个来源的数据是否指向同一物理点位。
                      归并过程完全可追溯，所有判定规则透明可配置。
                    </p>
                  </div>
                </div>
              </div>

              <div id="merge-name" ref={setSectionRef('merge-name')} className="scroll-mt-6">
                <h3 className="text-lg font-semibold text-neutral-800 mb-3 flex items-center gap-2">
                  <Search size={18} className="text-primary-500" />
                  名称相似度计算说明
                </h3>
                <p className="text-sm text-neutral-600 mb-3">
                  名称相似度采用 Levenshtein 编辑距离算法，结合中文语义分词进行综合计算。
                </p>

                <h4 className="font-medium text-neutral-700 mb-2">计算流程</h4>
                <div className="bg-white border border-neutral-200 rounded-sm p-4 mb-4">
                  <ol className="space-y-3 text-sm text-neutral-600">
                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 bg-primary-500 text-white rounded-full flex items-center justify-center text-xs flex-shrink-0">
                        1
                      </span>
                      <div>
                        <p className="font-medium text-neutral-800">文本预处理</p>
                        <p className="mt-1">
                          去除停用词（如"垃圾桶"、"投放点"等通用词）、标准化同义词（如"小区"="社区"、"门口"="入口"）
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 bg-primary-500 text-white rounded-full flex items-center justify-center text-xs flex-shrink-0">
                        2
                      </span>
                      <div>
                        <p className="font-medium text-neutral-800">编辑距离计算</p>
                        <p className="mt-1">
                          使用 Levenshtein 算法计算两个字符串之间的最小编辑操作次数
                        </p>
                      </div>
                    </li>
                    <li className="flex items-start gap-3">
                      <span className="w-6 h-6 bg-primary-500 text-white rounded-full flex items-center justify-center text-xs flex-shrink-0">
                        3
                      </span>
                      <div>
                        <p className="font-medium text-neutral-800">相似度换算</p>
                        <p className="mt-1">
                          相似度 = 1 - (编辑距离 / 最长字符串长度)
                        </p>
                      </div>
                    </li>
                  </ol>
                </div>

                <h4 className="font-medium text-neutral-700 mb-2">计算示例</h4>
                <div className="bg-neutral-900 text-neutral-100 rounded-sm p-4 text-sm font-mono overflow-x-auto">
                  <pre>{`// 示例1：高度相似
名称A: "阳光花园小区北门垃圾桶"
名称B: "阳光花园北门垃圾投放点"
预处理后: ["阳光花园", "北门"]
相似度: 0.92 → 高相似度

// 示例2：中度相似
名称A: "人民路123号垃圾桶"
名称B: "人民路口垃圾收集点"
预处理后: ["人民路", "123号"] vs ["人民路", "口"]
相似度: 0.68 → 中等相似度

// 示例3：不相似
名称A: "城东公园垃圾桶"
名称B: "城西菜市场垃圾站"
预处理后: ["城东", "公园"] vs ["城西", "菜市场"]
相似度: 0.21 → 低相似度`}</pre>
                </div>
              </div>

              <div id="merge-distance" ref={setSectionRef('merge-distance')} className="scroll-mt-6">
                <h3 className="text-lg font-semibold text-neutral-800 mb-3 flex items-center gap-2">
                  <MapPin size={18} className="text-primary-500" />
                  地理距离阈值说明
                </h3>
                <p className="text-sm text-neutral-600 mb-3">
                  地理距离采用 Haversine 公式计算两点间的球面距离，考虑地球曲率影响。
                </p>

                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div className="bg-white border border-neutral-200 rounded-sm p-4">
                    <h5 className="font-medium text-neutral-800 mb-3">距离分级阈值</h5>
                    <div className="space-y-2">
                      {[
                        { range: '≤ 20米', label: '极近距离', color: 'danger' },
                        { range: '20-50米', label: '近距离', color: 'warning' },
                        { range: '50-100米', label: '中距离', color: 'primary' },
                        { range: '> 100米', label: '远距离', color: 'neutral' },
                      ].map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <span className="text-neutral-600">{item.range}</span>
                          <span
                            className={cn(
                              'px-2 py-0.5 text-xs rounded-sm',
                              item.color === 'danger' && 'bg-danger-100 text-danger-700',
                              item.color === 'warning' && 'bg-warning-100 text-warning-700',
                              item.color === 'primary' && 'bg-primary-100 text-primary-700',
                              item.color === 'neutral' && 'bg-neutral-100 text-neutral-500'
                            )}
                          >
                            {item.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white border border-neutral-200 rounded-sm p-4">
                    <h5 className="font-medium text-neutral-800 mb-3">距离得分换算</h5>
                    <div className="space-y-2">
                      {[
                        { range: '≤ 20米', score: '1.0' },
                        { range: '30米', score: '0.85' },
                        { range: '50米', score: '0.7' },
                        { range: '80米', score: '0.4' },
                        { range: '100米', score: '0.2' },
                        { range: '> 100米', score: '0' },
                      ].map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <span className="text-neutral-600">{item.range}</span>
                          <span className="font-mono text-primary-600 font-medium">{item.score}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-neutral-900 text-neutral-100 rounded-sm p-4 text-sm font-mono overflow-x-auto">
                  <pre>{`// Haversine 距离计算公式
a = sin²(Δφ/2) + cos(φ1) * cos(φ2) * sin²(Δλ/2)
c = 2 * atan2(√a, √(1-a))
d = R * c

其中：
  φ  = 纬度（弧度）
  λ  = 经度（弧度）
  R  = 地球半径（平均 6371km）
  d  = 两点间距离（公里）`}</pre>
                </div>
              </div>

              <div id="merge-confidence" ref={setSectionRef('merge-confidence')} className="scroll-mt-6">
                <h3 className="text-lg font-semibold text-neutral-800 mb-3 flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-primary-500" />
                  置信度分级
                </h3>
                <p className="text-sm text-neutral-600 mb-3">
                  综合得分 = 名称相似度 × 0.5 + 距离得分 × 0.5，根据综合得分进行置信度分级。
                </p>

                <div className="space-y-4">
                  {[
                    {
                      level: '自动归并',
                      range: '≥ 0.85',
                      color: 'success',
                      desc: '系统自动将多个来源数据合并为一个点位，无需人工干预。合并后的点位会保留所有来源的信息，并标记为"已自动归并"状态。',
                      icon: CheckCircle2,
                    },
                    {
                      level: '待复核',
                      range: '0.55 ~ 0.85',
                      color: 'warning',
                      desc: '系统无法准确判断，需要人工复核。这些点位会进入"人工复核"队列，由操作员根据上下文信息和冲突证据进行判定。',
                      icon: Eye,
                    },
                    {
                      level: '独立点位',
                      range: '＜ 0.55',
                      color: 'neutral',
                      desc: '判定为不同的物理点位，各自独立存在。系统会将它们作为独立的点位记录保存，并标记来源信息。',
                      icon: MapPin,
                    },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'border rounded-sm p-4',
                        item.color === 'success' && 'bg-success-50 border-success-200',
                        item.color === 'warning' && 'bg-warning-50 border-warning-200',
                        item.color === 'neutral' && 'bg-white border-neutral-200'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            'w-10 h-10 rounded-sm flex items-center justify-center flex-shrink-0',
                            item.color === 'success' && 'bg-success-100',
                            item.color === 'warning' && 'bg-warning-100',
                            item.color === 'neutral' && 'bg-neutral-100'
                          )}
                        >
                          <item.icon
                            className={cn(
                              item.color === 'success' && 'text-success-600',
                              item.color === 'warning' && 'text-warning-600',
                              item.color === 'neutral' && 'text-neutral-600'
                            )}
                            size={20}
                          />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h4
                              className={cn(
                                'font-semibold',
                                item.color === 'success' && 'text-success-800',
                                item.color === 'warning' && 'text-warning-800',
                                item.color === 'neutral' && 'text-neutral-800'
                              )}
                            >
                              {item.level}
                            </h4>
                            <span
                              className={cn(
                                'px-2 py-0.5 text-xs font-mono rounded-sm',
                                item.color === 'success' && 'bg-success-200 text-success-800',
                                item.color === 'warning' && 'bg-warning-200 text-warning-800',
                                item.color === 'neutral' && 'bg-neutral-200 text-neutral-600'
                              )}
                            >
                              综合得分 {item.range}
                            </span>
                          </div>
                          <p className="text-sm text-neutral-600">{item.desc}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div id="merge-conflict" ref={setSectionRef('merge-conflict')} className="scroll-mt-6">
                <h3 className="text-lg font-semibold text-neutral-800 mb-3 flex items-center gap-2">
                  <AlertTriangle size={18} className="text-primary-500" />
                  冲突检测机制
                </h3>
                <p className="text-sm text-neutral-600 mb-3">
                  系统在归并过程中会检测以下类型的冲突，并标记为"有冲突"状态，优先进入人工复核队列。
                </p>

                <h4 className="font-medium text-neutral-700 mb-2">冲突类型</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-danger-50">
                        <th className="border border-neutral-200 px-4 py-2 text-left text-danger-700 font-medium w-24">
                          冲突类型
                        </th>
                        <th className="border border-neutral-200 px-4 py-2 text-left text-danger-700 font-medium">
                          说明
                        </th>
                        <th className="border border-neutral-200 px-4 py-2 text-left text-danger-700 font-medium">
                          示例
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        {
                          type: '属性冲突',
                          desc: '同一位置的点位属性信息不一致，如容量、类型、安装日期等字段存在明显差异',
                          example: '来源A标记为"厨余垃圾"，来源B标记为"可回收物"',
                        },
                        {
                          type: '多对多冲突',
                          desc: 'A来源的多个点位与B来源的多个点位互有重叠，无法确定唯一对应关系',
                          example: 'A有3个点位、B有3个点位，相互之间距离都在30米以内',
                        },
                        {
                          type: '状态冲突',
                          desc: '不同来源对点位的状态描述相反，一个说"已拆除"，另一个说"正常使用"',
                          example: '居民反馈称"点位已拆除"，但街道巡查显示"正常使用"',
                        },
                        {
                          type: '类型冲突',
                          desc: '同一位置的点位类型信息矛盾',
                          example: 'GIS数据标记为"垃圾桶"，巡检照片显示为"智能回收箱"',
                        },
                      ].map((row, idx) => (
                        <tr key={idx} className="hover:bg-neutral-50">
                          <td className="border border-neutral-200 px-4 py-2 font-medium text-danger-700">
                            {row.type}
                          </td>
                          <td className="border border-neutral-200 px-4 py-2 text-neutral-600">{row.desc}</td>
                          <td className="border border-neutral-200 px-4 py-2 text-neutral-500 text-xs">
                            {row.example}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>

          <section
            id="review"
            ref={setSectionRef('review')}
            className="scroll-mt-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary-100 rounded-sm flex items-center justify-center">
                <UserCheck className="text-primary-600" size={22} />
              </div>
              <h2 className="text-2xl font-serif font-bold text-neutral-800">人工复核</h2>
            </div>

            <div className="prose prose-primary max-w-none space-y-6">
              <div className="bg-warning-50 border-l-4 border-warning-500 p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="text-warning-600 flex-shrink-0 mt-0.5" size={20} />
                  <div>
                    <p className="font-medium text-warning-800 mb-1">复核职责</p>
                    <p className="text-sm text-warning-700">
                      人工复核是保障数据质量的关键环节。复核人员需根据专业知识和实际情况，
                      对系统标记的"待复核"和"有冲突"点位进行判定，所有操作均会记录操作日志。
                    </p>
                  </div>
                </div>
              </div>

              <div id="review-process" ref={setSectionRef('review-process')} className="scroll-mt-6">
                <h3 className="text-lg font-semibold text-neutral-800 mb-3 flex items-center gap-2">
                  <GitBranch size={18} className="text-primary-500" />
                  复核判定流程
                </h3>

                <div className="bg-white border border-neutral-200 rounded-sm p-4">
                  <h4 className="font-medium text-neutral-800 mb-3">标准复核步骤</h4>
                  <ol className="space-y-4">
                    {[
                      {
                        step: 1,
                        title: '查看待复核列表',
                        desc: '在"人工复核"页面按优先级查看待处理点位。冲突点位优先级高于普通待复核点位。',
                      },
                      {
                        step: 2,
                        title: '查看点位详情',
                        desc: '点击点位查看详细信息，包括各来源数据、地图位置、相似度计算过程、冲突证据。',
                      },
                      {
                        step: 3,
                        title: '比对多源数据',
                        desc: '对比不同来源的字段差异，查看地图上的位置分布，必要时联系数据提供方核实。',
                      },
                      {
                        step: 4,
                        title: '做出复核判定',
                        desc: '根据实际情况选择合适的操作（确认归并/作为新点位/拆分/驳回）。',
                      },
                      {
                        step: 5,
                        title: '填写复核意见',
                        desc: '填写复核理由和备注，便于后续追溯和审计。',
                      },
                    ].map((item) => (
                      <li key={item.step} className="flex gap-4">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-primary-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                            {item.step}
                          </div>
                        </div>
                        <div className="flex-1 pb-4 border-b border-neutral-100 last:border-0 last:pb-0">
                          <p className="font-medium text-neutral-800">{item.title}</p>
                          <p className="text-sm text-neutral-500 mt-1">{item.desc}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>

              <div id="review-actions" ref={setSectionRef('review-actions')} className="scroll-mt-6">
                <h3 className="text-lg font-semibold text-neutral-800 mb-3 flex items-center gap-2">
                  <Settings size={18} className="text-primary-500" />
                  四种操作说明
                </h3>

                <div className="grid gap-4">
                  {[
                    {
                      action: '确认归并',
                      color: 'success',
                      icon: CheckCircle2,
                      desc: '确认多个来源的数据指向同一物理点位，将它们合并为一个点位。合并后的点位会保留所有来源的属性信息，以优先级最高的来源为主数据，其他来源数据作为补充信息保存。',
                      scenario: '适用场景：系统计算的置信度较高，经人工核实确实为同一位置。',
                    },
                    {
                      action: '作为新点位',
                      color: 'primary',
                      icon: MapPin,
                      desc: '判定该点位与已有所有点位都不相同，作为一个全新的独立点位入库。该点位会保留其原始来源信息，并开始参与后续的归并计算。',
                      scenario: '适用场景：系统建议归并，但实际为不同位置；或者是新增的点位数据。',
                    },
                    {
                      action: '拆分',
                      color: 'warning',
                      icon: GitBranch,
                      desc: '将已归并的一组点位拆分为多个独立点位。通常用于系统错误地将不同位置的点位归并在一起的情况。拆分后每个点位恢复独立状态。',
                      scenario: '适用场景：系统自动归并出错，需要将已合并的点位重新分开。',
                    },
                    {
                      action: '驳回',
                      color: 'danger',
                      icon: AlertTriangle,
                      desc: '驳回该条数据，不纳入点位库。通常用于数据质量差、信息不完整或明显错误的数据。被驳回的数据会标记为"已驳回"状态，保留但不参与后续计算。',
                      scenario: '适用场景：数据存在明显错误、坐标异常、关键信息缺失等。',
                    },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'border rounded-sm p-4',
                        item.color === 'success' && 'bg-success-50 border-success-200',
                        item.color === 'primary' && 'bg-primary-50 border-primary-200',
                        item.color === 'warning' && 'bg-warning-50 border-warning-200',
                        item.color === 'danger' && 'bg-danger-50 border-danger-200'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            'w-10 h-10 rounded-sm flex items-center justify-center flex-shrink-0',
                            item.color === 'success' && 'bg-success-200',
                            item.color === 'primary' && 'bg-primary-200',
                            item.color === 'warning' && 'bg-warning-200',
                            item.color === 'danger' && 'bg-danger-200'
                          )}
                        >
                          <item.icon
                            className={cn(
                              item.color === 'success' && 'text-success-700',
                              item.color === 'primary' && 'text-primary-700',
                              item.color === 'warning' && 'text-warning-700',
                              item.color === 'danger' && 'text-danger-700'
                            )}
                            size={20}
                          />
                        </div>
                        <div className="flex-1">
                          <h4
                            className={cn(
                              'font-semibold mb-2',
                              item.color === 'success' && 'text-success-800',
                              item.color === 'primary' && 'text-primary-800',
                              item.color === 'warning' && 'text-warning-800',
                              item.color === 'danger' && 'text-danger-800'
                            )}
                          >
                            {item.action}
                          </h4>
                          <p className="text-sm text-neutral-600 mb-2">{item.desc}</p>
                          <p className="text-xs text-neutral-500 bg-white/60 rounded-sm px-3 py-2">
                            {item.scenario}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div id="review-evidence" ref={setSectionRef('review-evidence')} className="scroll-mt-6">
                <h3 className="text-lg font-semibold text-neutral-800 mb-3 flex items-center gap-2">
                  <Eye size={18} className="text-primary-500" />
                  冲突证据查看
                </h3>
                <p className="text-sm text-neutral-600 mb-3">
                  在点位详情面板中，系统会展示所有相关的冲突证据，帮助复核人员做出准确判断。
                </p>

                <div className="bg-white border border-neutral-200 rounded-sm p-4">
                  <h4 className="font-medium text-neutral-800 mb-3">证据面板内容</h4>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <h5 className="text-sm font-medium text-primary-700 mb-2">地图视图</h5>
                      <ul className="text-sm text-neutral-600 space-y-1">
                        <li>• 多来源点位在地图上的分布</li>
                        <li>• 点位间连线及距离标注</li>
                        <li>• 比例尺和周边地标参考</li>
                        <li>• 支持卫星影像切换</li>
                      </ul>
                    </div>
                    <div>
                      <h5 className="text-sm font-medium text-primary-700 mb-2">字段对比</h5>
                      <ul className="text-sm text-neutral-600 space-y-1">
                        <li>• 多来源字段并列展示</li>
                        <li>• 差异字段高亮标注</li>
                        <li>• 数据来源和时间标记</li>
                        <li>• 缺失字段明确标识</li>
                      </ul>
                    </div>
                    <div>
                      <h5 className="text-sm font-medium text-primary-700 mb-2">计算过程</h5>
                      <ul className="text-sm text-neutral-600 space-y-1">
                        <li>• 名称相似度计算明细</li>
                        <li>• 地理距离计算结果</li>
                        <li>• 综合得分计算过程</li>
                        <li>• 置信度分级依据</li>
                      </ul>
                    </div>
                    <div>
                      <h5 className="text-sm font-medium text-primary-700 mb-2">附件资料</h5>
                      <ul className="text-sm text-neutral-600 space-y-1">
                        <li>• 巡检照片及EXIF信息</li>
                        <li>• 居民反馈原文</li>
                        <li>• 街道备注记录</li>
                        <li>• 历史处理记录</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section
            id="export"
            ref={setSectionRef('export')}
            className="scroll-mt-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary-100 rounded-sm flex items-center justify-center">
                <FileSpreadsheet className="text-primary-600" size={22} />
              </div>
              <h2 className="text-2xl font-serif font-bold text-neutral-800">公示导出</h2>
            </div>

            <div className="prose prose-primary max-w-none space-y-6">
              <div className="bg-success-50 border-l-4 border-success-500 p-4 mb-6">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="text-success-600 flex-shrink-0 mt-0.5" size={20} />
                  <div>
                    <p className="font-medium text-success-800 mb-1">数据质量保障</p>
                    <p className="text-sm text-success-700">
                      只有经过"已确认"状态的点位才能进入公示导出环节，确保对外公示的数据准确可靠。
                      导出过程保留完整的操作痕迹，可随时追溯。
                    </p>
                  </div>
                </div>
              </div>

              <div id="export-filter" ref={setSectionRef('export-filter')} className="scroll-mt-6">
                <h3 className="text-lg font-semibold text-neutral-800 mb-3 flex items-center gap-2">
                  <Filter size={18} className="text-primary-500" />
                  筛选待公示点位
                </h3>
                <p className="text-sm text-neutral-600 mb-3">
                  在导出前，可以通过多种条件筛选需要公示的点位。
                </p>

                <div className="bg-white border border-neutral-200 rounded-sm p-4 mb-4">
                  <h4 className="font-medium text-neutral-800 mb-3">筛选条件</h4>
                  <div className="grid md:grid-cols-3 gap-3">
                    {[
                      { label: '行政区域', desc: '按街道、社区筛选' },
                      { label: '点位类型', desc: '可回收/厨余/有害/其他' },
                      { label: '状态', desc: '正常/停用/待拆除' },
                      { label: '确认时间', desc: '按日期区间筛选' },
                      { label: '数据来源', desc: '按来源组合筛选' },
                      { label: '置信度', desc: '按置信度分数筛选' },
                    ].map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-neutral-50 border border-neutral-200 rounded-sm p-3"
                      >
                        <p className="font-medium text-neutral-800 text-sm">{item.label}</p>
                        <p className="text-xs text-neutral-500 mt-1">{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-neutral-900 text-neutral-100 rounded-sm p-4 text-sm font-mono overflow-x-auto">
                  <pre>{`// 筛选条件示例
{
  "district": ["西湖区"],
  "street": ["北山街道", "西溪街道"],
  "point_type": ["可回收物", "厨余垃圾"],
  "status": ["正常使用"],
  "confirm_date_start": "2024-01-01",
  "confirm_date_end": "2024-06-30",
  "confidence_min": 0.85,
  "sources": ["GIS", "街道巡查", "居民反馈"]
}`}</pre>
                </div>
              </div>

              <div id="export-columns" ref={setSectionRef('export-columns')} className="scroll-mt-6">
                <h3 className="text-lg font-semibold text-neutral-800 mb-3 flex items-center gap-2">
                  <Settings size={18} className="text-primary-500" />
                  导出自定义列配置
                </h3>
                <p className="text-sm text-neutral-600 mb-3">
                  可以根据公示需求，灵活配置导出文件的列字段。
                </p>

                <h4 className="font-medium text-neutral-700 mb-2">可选字段列表</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-primary-50">
                        <th className="border border-neutral-200 px-4 py-2 text-left text-primary-700 font-medium">
                          字段组
                        </th>
                        <th className="border border-neutral-200 px-4 py-2 text-left text-primary-700 font-medium">
                          可选字段
                        </th>
                        <th className="border border-neutral-200 px-4 py-2 text-left text-primary-700 font-medium">
                          默认导出
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        {
                          group: '基础信息',
                          fields: '点位编号、点位名称、详细地址、经度、纬度',
                          default: '是',
                        },
                        {
                          group: '属性信息',
                          fields: '点位类型、容量、数量、安装日期、状态',
                          default: '是',
                        },
                        {
                          group: '位置信息',
                          fields: '所属行政区、街道、社区、网格编号',
                          default: '是',
                        },
                        {
                          group: '归并信息',
                          fields: '置信度评分、数据来源数、归并时间、复核人',
                          default: '否',
                        },
                        {
                          group: '来源明细',
                          fields: '各来源原始名称、各来源坐标、来源更新时间',
                          default: '否',
                        },
                        {
                          group: '附件信息',
                          fields: '照片数量、反馈数量、备注数量',
                          default: '否',
                        },
                      ].map((row, idx) => (
                        <tr key={idx} className="hover:bg-neutral-50">
                          <td className="border border-neutral-200 px-4 py-2 font-medium text-neutral-800">
                            {row.group}
                          </td>
                          <td className="border border-neutral-200 px-4 py-2 text-neutral-600 text-xs">
                            {row.fields}
                          </td>
                          <td className="border border-neutral-200 px-4 py-2">
                            <span
                              className={cn(
                                'px-2 py-0.5 text-xs rounded-sm',
                                row.default === '是'
                                  ? 'bg-success-100 text-success-700'
                                  : 'bg-neutral-100 text-neutral-500'
                              )}
                            >
                              {row.default}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 bg-primary-50 border border-primary-200 rounded-sm p-3">
                  <p className="text-sm text-primary-700 flex items-start gap-2">
                    <Lightbulb size={16} className="flex-shrink-0 mt-0.5" />
                    <span>
                      <strong>提示：</strong>可以保存多个导出配置方案，如"公示简版"、"内部详版"、
                      "上报专用版"等，满足不同场景的导出需求。
                    </span>
                  </p>
                </div>
              </div>

              <div id="export-format" ref={setSectionRef('export-format')} className="scroll-mt-6">
                <h3 className="text-lg font-semibold text-neutral-800 mb-3 flex items-center gap-2">
                  <Download size={18} className="text-primary-500" />
                  导出格式说明
                </h3>
                <p className="text-sm text-neutral-600 mb-3">
                  支持多种导出格式，满足不同的使用场景。
                </p>

                <div className="grid md:grid-cols-3 gap-4">
                  {[
                    {
                      format: 'Excel (.xlsx)',
                      desc: '最常用的格式，支持多sheet导出，包含点位数据和统计汇总。',
                      features: ['多sheet工作簿', '数据筛选功能', '内嵌统计图表', '可直接编辑'],
                      icon: FileSpreadsheet,
                      color: 'success',
                    },
                    {
                      format: 'PDF',
                      desc: '用于正式公示和打印，格式固定，不易篡改，适合存档和对外发布。',
                      features: ['版式固定', '支持水印', '页码和页眉', '不可直接编辑'],
                      icon: FileSpreadsheet,
                      color: 'danger',
                    },
                    {
                      format: 'CSV',
                      desc: '纯文本格式，兼容性好，适合导入其他系统进行数据处理。',
                      features: ['通用格式', '文件体小', '纯文本内容', '可被任意系统读取'],
                      icon: FileCode,
                      color: 'primary',
                    },
                  ].map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-white border border-neutral-200 rounded-sm p-4"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <item.icon
                          className={cn(
                            item.color === 'success' && 'text-success-500',
                            item.color === 'danger' && 'text-danger-500',
                            item.color === 'primary' && 'text-primary-500'
                          )}
                          size={20}
                        />
                        <h4 className="font-medium text-neutral-800">{item.format}</h4>
                      </div>
                      <p className="text-sm text-neutral-600 mb-3">{item.desc}</p>
                      <ul className="text-xs text-neutral-500 space-y-1">
                        {item.features.map((f, i) => (
                          <li key={i} className="flex items-center gap-1">
                            <CheckCircle2 size={12} className="text-success-500" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                <div className="mt-4 bg-warning-50 border border-warning-200 rounded-sm p-3">
                  <p className="text-sm text-warning-700 flex items-start gap-2">
                    <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                    <span>
                      <strong>注意：</strong>PDF导出时会自动添加"仅供内部使用"水印，
                      如需对外公示的无水印版本，请在导出时勾选"正式公示版"选项。
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section
            id="trace"
            ref={setSectionRef('trace')}
            className="scroll-mt-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary-100 rounded-sm flex items-center justify-center">
                <Clock className="text-primary-600" size={22} />
              </div>
              <h2 className="text-2xl font-serif font-bold text-neutral-800">数据追溯</h2>
            </div>

            <div className="prose prose-primary max-w-none space-y-6">
              <div className="bg-primary-50 border-l-4 border-primary-500 p-4 mb-6">
                <div className="flex items-start gap-3">
                  <Shield className="text-primary-600 flex-shrink-0 mt-0.5" size={20} />
                  <div>
                    <p className="font-medium text-primary-800 mb-1">全流程可追溯</p>
                    <p className="text-sm text-primary-700">
                      系统对所有数据操作保留完整的审计痕迹，确保每一条数据的来龙去脉都清晰可查。
                      符合政务数据管理的规范要求，满足审计和监督需要。
                    </p>
                  </div>
                </div>
              </div>

              <div id="trace-logs" ref={setSectionRef('trace-logs')} className="scroll-mt-6">
                <h3 className="text-lg font-semibold text-neutral-800 mb-3 flex items-center gap-2">
                  <History size={18} className="text-primary-500" />
                  操作日志查看
                </h3>
                <p className="text-sm text-neutral-600 mb-3">
                  系统记录所有重要操作的详细日志，可按时间、操作人、操作类型进行筛选查询。
                </p>

                <h4 className="font-medium text-neutral-700 mb-2">日志记录内容</h4>
                <div className="bg-white border border-neutral-200 rounded-sm p-4 mb-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <h5 className="text-sm font-medium text-primary-700 mb-2">基础信息</h5>
                      <ul className="text-sm text-neutral-600 space-y-1">
                        <li>• 操作时间（精确到秒）</li>
                        <li>• 操作人姓名</li>
                        <li>• 操作类型</li>
                        <li>• 操作IP地址</li>
                      </ul>
                    </div>
                    <div>
                      <h5 className="text-sm font-medium text-primary-700 mb-2">操作详情</h5>
                      <ul className="text-sm text-neutral-600 space-y-1">
                        <li>• 涉及的点位编号</li>
                        <li>• 操作前状态</li>
                        <li>• 操作后状态</li>
                        <li>• 操作备注和理由</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <h4 className="font-medium text-neutral-700 mb-2">操作类型列表</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-neutral-50">
                        <th className="border border-neutral-200 px-4 py-2 text-left text-neutral-700 font-medium">
                          操作类型
                        </th>
                        <th className="border border-neutral-200 px-4 py-2 text-left text-neutral-700 font-medium">
                          说明
                        </th>
                        <th className="border border-neutral-200 px-4 py-2 text-left text-neutral-700 font-medium">
                          日志级别
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { type: '数据导入', desc: '导入GIS点位、居民反馈、照片等数据', level: '信息' },
                        { type: '自动归并', desc: '系统执行点位归并计算', level: '信息' },
                        { type: '确认归并', desc: '人工确认归并', level: '重要' },
                        { type: '作为新点位', desc: '人工判定为新点位', level: '重要' },
                        { type: '拆分', desc: '人工拆分已归并点位', level: '重要' },
                        { type: '驳回', desc: '人工驳回数据', level: '重要' },
                        { type: '导出', desc: '导出公示文件', level: '信息' },
                        { type: '数据删除', desc: '删除点位数据', level: '警告' },
                        { type: '系统重置', desc: '重置所有数据', level: '警告' },
                      ].map((row, idx) => (
                        <tr key={idx} className="hover:bg-neutral-50">
                          <td className="border border-neutral-200 px-4 py-2 font-medium text-neutral-800">
                            {row.type}
                          </td>
                          <td className="border border-neutral-200 px-4 py-2 text-neutral-600">{row.desc}</td>
                          <td className="border border-neutral-200 px-4 py-2">
                            <span
                              className={cn(
                                'px-2 py-0.5 text-xs rounded-sm',
                                row.level === '信息' && 'bg-primary-100 text-primary-700',
                                row.level === '重要' && 'bg-warning-100 text-warning-700',
                                row.level === '警告' && 'bg-danger-100 text-danger-700'
                              )}
                            >
                              {row.level}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div id="trace-source" ref={setSectionRef('trace-source')} className="scroll-mt-6">
                <h3 className="text-lg font-semibold text-neutral-800 mb-3 flex items-center gap-2">
                  <DatabaseBackup size={18} className="text-primary-500" />
                  来源数据保留说明
                </h3>
                <p className="text-sm text-neutral-600 mb-3">
                  系统严格保留所有原始来源数据，任何归并操作都不会删除或修改原始数据。
                </p>

                <div className="bg-white border border-neutral-200 rounded-sm p-4 mb-4">
                  <h4 className="font-medium text-neutral-800 mb-3">数据保留原则</h4>
                  <div className="space-y-3">
                    {[
                      {
                        title: '原始数据不可修改',
                        desc: '所有导入的原始数据一经入库，不可修改或删除。如需修正，需通过新版本导入，并保留历史版本。',
                      },
                      {
                        title: '归并关系独立存储',
                        desc: '点位归并关系独立存储在关联表中，与原始数据分离。归并关系可随时调整，不影响原始数据。',
                      },
                      {
                        title: '多版本追溯',
                        desc: '同一来源的多次导入数据按版本保留，可查看历史任一版本的数据状态。',
                      },
                      {
                        title: '删除标记机制',
                        desc: '数据删除采用标记删除方式，保留删除记录和原始数据，可随时恢复。',
                      },
                    ].map((item, idx) => (
                      <div key={idx} className="flex gap-3">
                        <div className="w-6 h-6 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <CheckCircle2 size={14} className="text-primary-600" />
                        </div>
                        <div>
                          <p className="font-medium text-neutral-800 text-sm">{item.title}</p>
                          <p className="text-xs text-neutral-500 mt-1">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-neutral-900 text-neutral-100 rounded-sm p-4 text-sm font-mono overflow-x-auto">
                  <pre>{`// 数据存储结构示意
原始数据表（只读）:
├── source_gis: GIS点位原始数据
├── source_feedback: 居民反馈原始数据
├── source_photos: 巡检照片原始数据
└── source_notes: 街道备注原始数据

业务数据表:
├── points: 归并后的点位主数据
├── point_sources: 点位-来源关联关系
├── merge_records: 归并操作记录
├── review_records: 复核操作记录
└── operation_logs: 全量操作日志`}</pre>
                </div>
              </div>

              <div id="trace-timeline" ref={setSectionRef('trace-timeline')} className="scroll-mt-6">
                <h3 className="text-lg font-semibold text-neutral-800 mb-3 flex items-center gap-2">
                  <Clock size={18} className="text-primary-500" />
                  处理时间线
                </h3>
                <p className="text-sm text-neutral-600 mb-3">
                  每个点位都有完整的处理时间线，记录从数据导入到最终确认的全过程。
                </p>

                <div className="bg-white border border-neutral-200 rounded-sm p-4">
                  <h4 className="font-medium text-neutral-800 mb-4">时间线示例</h4>
                  <div className="relative pl-8">
                    <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-primary-200" />
                    {[
                      {
                        time: '2024-01-15 09:30',
                        action: '数据导入',
                        desc: 'GIS点位数据导入，共256条',
                        color: 'primary',
                      },
                      {
                        time: '2024-01-15 10:15',
                        action: '居民反馈导入',
                        desc: '导入12345热线反馈数据42条',
                        color: 'primary',
                      },
                      {
                        time: '2024-01-15 14:00',
                        action: '自动归并计算',
                        desc: '系统执行归并，生成189个点位组',
                        color: 'success',
                      },
                      {
                        time: '2024-01-16 10:20',
                        action: '标记待复核',
                        desc: '点位ID:P00123 置信度0.72，进入复核队列',
                        color: 'warning',
                      },
                      {
                        time: '2024-01-16 15:45',
                        action: '人工复核',
                        desc: '张三 确认归并，理由：经现场核实为同一位置',
                        color: 'success',
                      },
                      {
                        time: '2024-01-17 09:00',
                        action: '导出公示',
                        desc: '李四 导出西湖区公示名单（含此点位）',
                        color: 'primary',
                      },
                    ].map((item, idx) => (
                      <div key={idx} className="relative mb-6 last:mb-0">
                        <div
                          className={cn(
                            'absolute -left-8 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center',
                            item.color === 'primary' && 'bg-primary-500',
                            item.color === 'success' && 'bg-success-500',
                            item.color === 'warning' && 'bg-warning-500'
                          )}
                        >
                          <div className="w-2 h-2 bg-white rounded-full" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs text-neutral-500 font-mono">{item.time}</span>
                            <span
                              className={cn(
                                'px-2 py-0.5 text-xs rounded-sm',
                                item.color === 'primary' && 'bg-primary-100 text-primary-700',
                                item.color === 'success' && 'bg-success-100 text-success-700',
                                item.color === 'warning' && 'bg-warning-100 text-warning-700'
                              )}
                            >
                              {item.action}
                            </span>
                          </div>
                          <p className="text-sm text-neutral-600">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section
            id="faq"
            ref={setSectionRef('faq')}
            className="scroll-mt-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary-100 rounded-sm flex items-center justify-center">
                <HelpCircle className="text-primary-600" size={22} />
              </div>
              <h2 className="text-2xl font-serif font-bold text-neutral-800">常见问题</h2>
            </div>

            <div className="prose prose-primary max-w-none space-y-4">
              {[
                {
                  q: '如何处理导入的脏数据？',
                  a: '系统在数据导入时会自动进行数据清洗，包括：坐标格式校验、异常值检测（如经纬度超出中国范围）、重复数据去重、缺失字段标记。对于无法自动处理的脏数据，系统会标记为"数据质量待核查"状态，并在导入报告中详细列出问题类型和建议处理方式。您可以在数据导入页面下载质量报告，根据报告进行数据修正后重新导入，或在系统中逐条处理。',
                  icon: AlertTriangle,
                  color: 'warning',
                },
                {
                  q: '相邻点位被误合并了怎么办？',
                  a: '如果发现系统将距离较近但实际不同的点位错误合并，可以在"点位详情"中点击"拆分"操作，将已归并的点位重新拆分为独立点位。拆分后每个点位恢复原始状态，可以重新参与归并计算。为了避免重复误合并，建议在拆分时添加备注说明，系统会在后续归并中参考历史复核记录。',
                  icon: GitBranch,
                  color: 'primary',
                },
                {
                  q: '系统如何进行数据备份？',
                  a: '系统采用多层级数据备份策略：1) 本地数据库自动备份，每日凌晨2点自动生成全量备份，保留最近30天的备份文件；2) 操作日志永久保留，所有数据变更都可通过操作日志追溯；3) 支持手动导出全量数据备份，可在"系统设置-数据管理"中导出完整的数据包（含原始数据、归并关系、操作日志）。建议重要操作前手动导出备份。',
                  icon: DatabaseBackup,
                  color: 'success',
                },
                {
                  q: '可以调整归并的阈值参数吗？',
                  a: '是的，系统支持自定义归并参数。在"系统设置-归并规则"中可以调整：名称相似度权重、地理距离权重、自动归并阈值（默认0.85）、待复核阈值下限（默认0.55）、地理距离临界值（默认100米）等参数。调整参数后需要重新运行归并计算才能生效。建议调整前先在小范围数据上测试效果。',
                  icon: Settings,
                  color: 'primary',
                },
                {
                  q: '照片没有GPS坐标怎么办？',
                  a: '对于没有EXIF坐标信息的照片，系统会将其标记为"待补充坐标"状态。您可以在"数据导入-巡检照片"页面找到这些照片，点击"补充坐标"按钮，在地图上手动标注照片拍摄位置。补充坐标后，照片才能参与点位归并计算。建议提醒巡检人员开启手机相机的GPS定位功能。',
                  icon: Camera,
                  color: 'warning',
                },
                {
                  q: '如何处理同一位置的属性冲突？',
                  a: '当不同来源的数据在同一位置存在属性冲突时（如类型不一致），系统会标记为"属性冲突"状态并优先进入复核队列。在人工复核时，您可以：1) 选择以某一来源的属性为准；2) 手动输入正确的属性值；3) 联系数据提供方核实后再处理。系统会记录您的选择理由，便于后续追溯。',
                  icon: AlertTriangle,
                  color: 'danger',
                },
                {
                  q: '导出的PDF文件如何添加水印？',
                  a: 'PDF导出默认添加"仅供内部使用"水印。如需对外公示的无水印版本，请在导出对话框中勾选"正式公示版"选项。正式公示版会移除水印，并添加公示专用的页眉页脚（包括公示标题、公示日期、单位名称等）。建议内部讨论使用带水印版本，对外发布使用正式公示版。',
                  icon: Download,
                  color: 'primary',
                },
                {
                  q: '操作日志可以导出吗？',
                  a: '可以。在"操作日志"页面，筛选需要的日志范围后，点击"导出日志"按钮，可以导出Excel或CSV格式的操作日志。导出内容包括：操作时间、操作人、操作类型、操作详情等完整信息。操作日志导出功能需要管理员权限，且导出行为本身也会被记录到日志中。',
                  icon: FileSpreadsheet,
                  color: 'success',
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-neutral-200 rounded-sm p-4 shadow-card hover:shadow-card-hover transition-shadow"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'w-8 h-8 rounded-sm flex items-center justify-center flex-shrink-0',
                        item.color === 'warning' && 'bg-warning-100',
                        item.color === 'primary' && 'bg-primary-100',
                        item.color === 'success' && 'bg-success-100',
                        item.color === 'danger' && 'bg-danger-100'
                      )}
                    >
                      <item.icon
                        className={cn(
                          item.color === 'warning' && 'text-warning-600',
                          item.color === 'primary' && 'text-primary-600',
                          item.color === 'success' && 'text-success-600',
                          item.color === 'danger' && 'text-danger-600'
                        )}
                        size={18}
                      />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-neutral-800 mb-2">
                        Q{idx + 1}: {item.q}
                      </h4>
                      <p className="text-sm text-neutral-600 leading-relaxed">{item.a}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 bg-primary-50 border border-primary-200 rounded-sm p-4">
              <div className="flex items-start gap-3">
                <HelpCircle className="text-primary-600 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <p className="font-medium text-primary-800 mb-1">还有其他问题？</p>
                  <p className="text-sm text-primary-700">
                    如果在使用过程中遇到文档未覆盖的问题，请联系系统管理员或技术支持团队获取帮助。
                    联系电话：400-XXX-XXXX，工作时间：工作日 9:00-17:30。
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

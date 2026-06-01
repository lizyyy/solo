import { useState, useRef } from 'react'
import { Database, FileSpreadsheet, Camera, Upload } from 'lucide-react'
import { nameMapping } from '@/data/mockData'

export default function ImportZone() {
  const [excelFile, setExcelFile] = useState<string | null>(null)
  const [photoCount, setPhotoCount] = useState<number>(0)
  const excelRef = useRef<HTMLInputElement>(null)
  const photoRef = useRef<HTMLInputElement>(null)

  const handleGisImport = () => {
    alert('GIS数据已模拟导入')
  }

  const handleExcelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = () => setExcelFile(file.name)
      reader.readAsArrayBuffer(file)
    }
  }

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) setPhotoCount(files.length)
  }

  const mappingRows = [
    { system: '管线编号', gis: '', excel: '', inspection: '' },
    { system: '腐蚀深度', gis: '', excel: '', inspection: '' },
    { system: '壁厚', gis: '', excel: '', inspection: '' },
    { system: '巡检日期', gis: '', excel: '', inspection: '' },
  ]

  const firstMapping = Object.values(nameMapping)[0]

  const fieldMap: Record<string, { gis: string; excel: string; inspection: string }> = {
    '管线编号': { gis: firstMapping?.gis ?? '', excel: firstMapping?.excel ?? '', inspection: firstMapping?.inspection ?? '' },
    '腐蚀深度': { gis: 'depth', excel: '腐蚀深度(mm)', inspection: '测量深度' },
    '壁厚': { gis: 'thickness', excel: '壁厚(mm)', inspection: '壁厚读数' },
    '巡检日期': { gis: 'inspectedAt', excel: '巡检日期', inspection: '拍摄时间' },
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-cyan-500/30 bg-white/[0.03] p-6 transition-colors hover:border-cyan-500/50">
          <Database size={32} className="mb-3 text-cyan-400" />
          <p className="mb-3 text-sm text-gray-400">GIS数据</p>
          <button
            onClick={handleGisImport}
            className="rounded-md bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-400 transition-colors hover:bg-cyan-500/30"
          >
            <Upload size={14} className="mr-1.5 inline" />
            点击模拟导入 GIS 数据
          </button>
        </div>

        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-cyan-500/30 bg-white/[0.03] p-6 transition-colors hover:border-cyan-500/50">
          <FileSpreadsheet size={32} className="mb-3 text-cyan-400" />
          <p className="mb-3 text-sm text-gray-400">Excel文件</p>
          <input
            ref={excelRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={handleExcelChange}
          />
          <button
            onClick={() => excelRef.current?.click()}
            className="rounded-md bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-400 transition-colors hover:bg-cyan-500/30"
          >
            <Upload size={14} className="mr-1.5 inline" />
            上传 Excel
          </button>
          {excelFile && (
            <p className="mt-2 text-xs text-green-400">{excelFile}</p>
          )}
        </div>

        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-cyan-500/30 bg-white/[0.03] p-6 transition-colors hover:border-cyan-500/50">
          <Camera size={32} className="mb-3 text-cyan-400" />
          <p className="mb-3 text-sm text-gray-400">巡检照片</p>
          <input
            ref={photoRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handlePhotoChange}
          />
          <button
            onClick={() => photoRef.current?.click()}
            className="rounded-md bg-cyan-500/20 px-4 py-2 text-sm font-medium text-cyan-400 transition-colors hover:bg-cyan-500/30"
          >
            <Upload size={14} className="mr-1.5 inline" />
            上传巡检照片
          </button>
          {photoCount > 0 && (
            <p className="mt-2 text-xs text-green-400">已选择 {photoCount} 张照片</p>
          )}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-semibold text-cyan-400">字段映射预览</h3>
        <div className="overflow-hidden rounded-lg border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.05]">
                <th className="px-4 py-2.5 text-left font-medium text-gray-400">系统字段</th>
                <th className="px-4 py-2.5 text-left font-medium text-gray-400">GIS字段</th>
                <th className="px-4 py-2.5 text-left font-medium text-gray-400">Excel字段</th>
                <th className="px-4 py-2.5 text-left font-medium text-gray-400">巡检字段</th>
              </tr>
            </thead>
            <tbody>
              {mappingRows.map((row) => {
                const map = fieldMap[row.system]
                return (
                  <tr key={row.system} className="border-b border-white/5">
                    <td className="px-4 py-2 text-white">{row.system}</td>
                    <td className="px-4 py-2 font-mono text-xs text-cyan-300">{map?.gis ?? ''}</td>
                    <td className="px-4 py-2 font-mono text-xs text-cyan-300">{map?.excel ?? ''}</td>
                    <td className="px-4 py-2 font-mono text-xs text-cyan-300">{map?.inspection ?? ''}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

import { useState, useCallback } from 'react'
import {
  Upload,
  Search,
  Grid3X3,
  List as ListIcon,
  Play,
  Trash2,
  Download,
  Settings,
  FolderOpen,
} from 'lucide-react'
import { useAudioStore } from '@/store/useAudioStore'
import AudioCard from '@/components/audio/AudioCard'
import Button from '@/components/ui/Button'
import Empty from '@/components/Empty'
import { mockData } from '@/mock/sampleData'
import { cn } from '@/lib/utils'

type ViewMode = 'grid' | 'list'

export default function List() {
  const audioFiles = useAudioStore((state) => state.audioFiles)
  const removeAudioFile = useAudioStore((state) => state.removeAudioFile)
  const setCurrentAudio = useAudioStore((state) => state.setCurrentAudio)

  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isDragOver, setIsDragOver] = useState(false)

  const displayFiles = audioFiles.length > 0 ? audioFiles : mockData.audioFiles

  const filteredFiles = displayFiles.filter((file) =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    console.log('Files dropped:', e.dataTransfer.files)
  }, [])

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const selectAll = () => {
    if (selectedIds.size === filteredFiles.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredFiles.map((f) => f.id)))
    }
  }

  const handleDeleteSelected = () => {
    selectedIds.forEach((id) => removeAudioFile(id))
    setSelectedIds(new Set())
  }

  const handleView = (id: string) => {
    setCurrentAudio(id)
    console.log('View detail:', id)
  }

  const handleEdit = (id: string) => {
    setCurrentAudio(id)
    console.log('Edit:', id)
  }

  const handleDelete = (id: string) => {
    removeAudioFile(id)
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  return (
    <div className="flex flex-col h-full">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'mb-6 p-8 rounded-xl border-2 border-dashed transition-all text-center',
          isDragOver
            ? 'border-accent-cyan bg-accent-cyan/5 shadow-neon'
            : 'border-border-default bg-bg-secondary hover:border-border-default/80'
        )}
      >
        <input
          type="file"
          id="file-upload"
          multiple
          accept="audio/*"
          className="hidden"
          onChange={(e) => console.log('Files selected:', e.target.files)}
        />
        <label htmlFor="file-upload" className="cursor-pointer">
          <div
            className={cn(
              'w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center transition-colors',
              isDragOver ? 'bg-accent-cyan/20' : 'bg-bg-tertiary'
            )}
          >
            <Upload
              className={cn(
                'w-8 h-8 transition-colors',
                isDragOver ? 'text-accent-cyan' : 'text-text-muted'
              )}
            />
          </div>
          <p className="text-text-primary font-medium mb-1">
            {isDragOver ? '释放文件以上传' : '拖拽音频文件到此处'}
          </p>
          <p className="text-sm text-text-muted">
            或点击选择文件，支持 MP3、WAV、M4A 等格式
          </p>
        </label>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              placeholder="搜索音频文件..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-bg-secondary border border-border-default rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-cyan focus:shadow-neon-sm transition-all w-64"
            />
          </div>

          <span className="text-sm text-text-muted">
            共 {filteredFiles.length} 个文件
            {selectedIds.size > 0 && `，已选择 ${selectedIds.size} 个`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Play className="w-4 h-4" />}
                onClick={() => console.log('Batch play:', selectedIds)}
              >
                批量播放
              </Button>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Download className="w-4 h-4" />}
                onClick={() => console.log('Batch export:', selectedIds)}
              >
                批量导出
              </Button>
              <Button
                variant="danger"
                size="sm"
                leftIcon={<Trash2 className="w-4 h-4" />}
                onClick={handleDeleteSelected}
              >
                批量删除
              </Button>
            </>
          )}

          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Settings className="w-4 h-4" />}
            onClick={() => console.log('Settings')}
          />

          <div className="flex items-center bg-bg-secondary rounded-lg border border-border-default p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                viewMode === 'grid'
                  ? 'bg-bg-tertiary text-accent-cyan'
                  : 'text-text-muted hover:text-text-secondary'
              )}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                viewMode === 'list'
                  ? 'bg-bg-tertiary text-accent-cyan'
                  : 'text-text-muted hover:text-text-secondary'
              )}
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {filteredFiles.length > 0 ? (
        <div className="flex-1 overflow-auto">
          <div className="mb-3 flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectedIds.size === filteredFiles.length && filteredFiles.length > 0}
              onChange={selectAll}
              className="w-4 h-4 rounded border-border-default bg-bg-secondary text-accent-cyan focus:ring-accent-cyan"
            />
            <span className="text-sm text-text-secondary">全选</span>
          </div>

          <div
            className={cn(
              'gap-4',
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                : 'flex flex-col'
            )}
          >
            {filteredFiles.map((file) => (
              <div key={file.id} className="relative">
                <input
                  type="checkbox"
                  checked={selectedIds.has(file.id)}
                  onChange={() => toggleSelect(file.id)}
                  className="absolute top-4 left-4 z-10 w-4 h-4 rounded border-border-default bg-bg-secondary text-accent-cyan focus:ring-accent-cyan"
                  onClick={(e) => e.stopPropagation()}
                />
                <AudioCard
                  audioFile={file}
                  selected={selectedIds.has(file.id)}
                  onSelect={toggleSelect}
                  onView={handleView}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  className={cn(viewMode === 'list' && 'flex items-stretch')}
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <Empty
            icon={<FolderOpen className="w-16 h-16" />}
            title={searchQuery ? '未找到匹配的音频文件' : '暂无音频文件'}
            description={
              searchQuery
                ? '请尝试其他搜索关键词'
                : '上传音频文件开始处理'
            }
          />
        </div>
      )}
    </div>
  )
}

import { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { Search, ChevronUp, ChevronDown, Edit2, Trash2, Music, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { useAppStore } from '@/store';
import { formatFileSize } from '@/utils/fileParser';
import { generateId } from '@/utils/fileParser';
import { cn } from '@/lib/utils';
import type { Track } from '@/types';

const columnHelper = createColumnHelper<Track>();

const StatusBadge = ({ status }: { status: Track['status'] }) => {
  const config = {
    normal: { bg: 'bg-moss-100', text: 'text-moss-700', icon: CheckCircle, label: '正常' },
    conflict: { bg: 'bg-amber-100', text: 'text-amber-700', icon: AlertCircle, label: '有冲突' },
    error: { bg: 'bg-brick-100', text: 'text-brick-700', icon: AlertCircle, label: '异常' },
    pending: { bg: 'bg-olive-100', text: 'text-olive-700', icon: Clock, label: '处理中' },
  };
  
  const { bg, text, icon: Icon, label } = config[status];
  
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium', bg, text)}>
      <Icon size={12} />
      {label}
    </span>
  );
};

export const TracksPage = () => {
  const { tracks, channelTable, updateTrack, deleteTrack } = useAppStore();
  const [globalFilter, setGlobalFilter] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Track>>({});

  const columns = [
    columnHelper.accessor('channelNo', {
      header: '通道号',
      cell: (info) => info.getValue() || '-',
      size: 100,
    }),
    columnHelper.accessor('trackName', {
      header: '曲目名称',
      cell: (info) => (
        <div className="flex items-center gap-2">
          <Music size={16} className="text-olive-500" />
          <span className="font-medium text-olive-900">{info.getValue()}</span>
        </div>
      ),
      size: 200,
    }),
    columnHelper.accessor('artist', {
      header: '艺术家',
      cell: (info) => info.getValue() || '-',
      size: 150,
    }),
    columnHelper.accessor('duration', {
      header: '时长',
      cell: (info) => info.getValue() || '-',
      size: 100,
    }),
    columnHelper.accessor('fileName', {
      header: '原始文件名',
      cell: (info) => (
        <span className="text-sm text-olive-600 truncate max-w-[200px] block" title={info.getValue()}>
          {info.getValue()}
        </span>
      ),
      size: 250,
    }),
    columnHelper.accessor('fileSize', {
      header: '文件大小',
      cell: (info) => formatFileSize(info.getValue() || 0),
      size: 120,
    }),
    columnHelper.display({
      id: 'channelMatch',
      header: '通道表',
      cell: (info) => {
        const track = info.row.original;
        const entry = track.channelTableId
          ? channelTable.find((e) => e.id === track.channelTableId)
          : undefined;
        return entry ? (
          <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
            #{entry.channelNo} {entry.trackName}
          </span>
        ) : (
          <span className="text-xs px-2 py-0.5 bg-brick-100 text-brick-600 rounded-full">未匹配</span>
        );
      },
      size: 150,
      enableSorting: false,
    }),
    columnHelper.accessor('status', {
      header: '状态',
      cell: (info) => <StatusBadge status={info.getValue()} />,
      size: 120,
    }),
    columnHelper.display({
      id: 'actions',
      header: '操作',
      cell: (info) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => startEdit(info.row.original)}
            className="p-1.5 hover:bg-olive-100 rounded-lg transition-colors text-olive-600 hover:text-olive-800"
            title="编辑"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={() => {
              if (confirm('确定要删除这条记录吗？')) {
                deleteTrack(info.row.original.id);
              }
            }}
            className="p-1.5 hover:bg-brick-100 rounded-lg transition-colors text-brick-600 hover:text-brick-800"
            title="删除"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
      size: 120,
      enableSorting: false,
    }),
  ];

  const table = useReactTable({
    data: tracks,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
  });

  const startEdit = (track: Track) => {
    setEditingId(track.id);
    setEditForm({
      channelNo: track.channelNo,
      trackName: track.trackName,
      artist: track.artist,
      duration: track.duration,
    });
  };

  const saveEdit = () => {
    if (editingId && editForm.trackName) {
      updateTrack(editingId, editForm);
      setEditingId(null);
      setEditForm({});
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  return (
    <div>
      <PageHeader
        title="曲目台账"
        subtitle="舞台通道表数据管理，查看所有已导入的曲目信息，支持编辑和删除"
        action={
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-olive-400" />
            <input
              type="text"
              placeholder="搜索曲目..."
              value={globalFilter ?? ''}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-olive-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 w-64"
            />
          </div>
        }
      />

      <div className="bg-white rounded-xl shadow-soft overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-olive-50 border-b border-olive-100">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left text-sm font-semibold text-olive-700"
                      style={{ width: header.getSize() }}
                    >
                      {header.isPlaceholder ? null : (
                        <div
                          className={cn(
                            'flex items-center gap-2',
                            header.column.getCanSort() ? 'cursor-pointer select-none' : ''
                          )}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {{
                            asc: <ChevronUp size={14} />,
                            desc: <ChevronDown size={14} />,
                          }[header.column.getIsSorted() as string] ?? null}
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    'border-b border-cream-200 hover:bg-olive-50/50 transition-colors',
                    editingId === row.id && 'bg-amber-50'
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 text-sm">
                      {editingId === row.id && cell.column.id !== 'actions' ? (
                        <input
                          type="text"
                          value={(editForm[cell.column.id as keyof typeof editForm] as string) || ''}
                          onChange={(e) =>
                            setEditForm({ ...editForm, [cell.column.id]: e.target.value })
                          }
                          className="w-full px-2 py-1 border border-amber-300 rounded focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      ) : (
                        flexRender(cell.column.columnDef.cell, cell.getContext())
                      )}
                    </td>
                  ))}
                  {editingId === row.id && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={saveEdit}
                          className="px-3 py-1 bg-moss-600 text-white rounded hover:bg-moss-700 text-xs font-medium"
                        >
                          保存
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="px-3 py-1 bg-olive-200 text-olive-700 rounded hover:bg-olive-300 text-xs font-medium"
                        >
                          取消
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {tracks.length === 0 && (
          <div className="p-12 text-center">
            <Music size={48} className="mx-auto text-olive-300 mb-4" />
            <p className="text-olive-500">暂无曲目数据</p>
            <p className="text-sm text-olive-400 mt-1">请先在导入面板添加音频文件</p>
          </div>
        )}
      </div>

      <div className="mt-4 text-sm text-olive-500">
        共 {table.getFilteredRowModel().rows.length} 条记录
      </div>
    </div>
  );
};

import { useState, useCallback } from 'react'
import { Plus, Trash2, Edit2, Save, X } from 'lucide-react'
import { useClassroomStore } from '@/store'
import Layout from '@/components/Layout'
import ConfirmDialog from '@/components/ConfirmDialog'

export default function StudentsPage() {
  const {
    students,
    clips,
    addStudent,
    removeStudent,
    updateStudent,
    updateAppState,
  } = useClassroomStore()

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editGrade, setEditGrade] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [newGrade, setNewGrade] = useState('')
  const [isAdding, setIsAdding] = useState(false)

  const handleAdd = useCallback(() => {
    if (!newName.trim()) return
    addStudent({
      id: `student-${Date.now()}`,
      projectId: 'demo-project-001',
      name: newName.trim(),
      grade: newGrade.trim(),
      notes: '',
    })
    setNewName('')
    setNewGrade('')
    setIsAdding(false)
  }, [newName, newGrade, addStudent])

  const handleEdit = useCallback((student: typeof students[0]) => {
    setEditingId(student.id)
    setEditName(student.name)
    setEditGrade(student.grade)
  }, [])

  const handleSave = useCallback(
    (id: string) => {
      updateStudent(id, { name: editName, grade: editGrade })
      setEditingId(null)
    },
    [editName, editGrade, updateStudent]
  )

  const handleSelectClip = useCallback(
    (clipId: string) => {
      updateAppState({ activeClipId: clipId, currentFrame: 0 })
    },
    [updateAppState]
  )

  return (
    <Layout>
      <div className="h-full p-6 overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold text-gray-100">学生管理</h2>
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm"
          >
            <Plus size={16} />
            添加学生
          </button>
        </div>
        <div className="flex-1 flex gap-6 overflow-hidden">
          <div className="w-72 flex flex-col bg-gray-900 rounded-xl border border-gray-800">
            <div className="p-4 border-b border-gray-800">
              <h3 className="text-sm font-medium text-gray-300">学生名单</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {isAdding && (
                <div className="p-3 rounded-lg bg-gray-800 border border-teal-600/50">
                  <input
                    autoFocus
                    placeholder="姓名"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm rounded bg-gray-900 border border-gray-700 text-gray-200 mb-2"
                  />
                  <input
                    placeholder="年级/班级"
                    value={newGrade}
                    onChange={(e) => setNewGrade(e.target.value)}
                    className="w-full px-2 py-1.5 text-sm rounded bg-gray-900 border border-gray-700 text-gray-200 mb-2"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setIsAdding(false)}
                      className="px-3 py-1 text-xs rounded bg-gray-700 text-gray-300 hover:bg-gray-600"
                    >
                      <X size={12} className="inline mr-1" />
                      取消
                    </button>
                    <button
                      onClick={handleAdd}
                      className="px-3 py-1 text-xs rounded bg-teal-600 text-white hover:bg-teal-500"
                    >
                      <Save size={12} className="inline mr-1" />
                      保存
                    </button>
                  </div>
                </div>
              )}
              {students.map((student) => (
                <div
                  key={student.id}
                  className="p-3 rounded-lg bg-gray-800 hover:bg-gray-750"
                >
                  {editingId === student.id ? (
                    <>
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-2 py-1 text-sm rounded bg-gray-900 border border-gray-700 text-gray-200 mb-2"
                      />
                      <input
                        value={editGrade}
                        onChange={(e) => setEditGrade(e.target.value)}
                        className="w-full px-2 py-1 text-sm rounded bg-gray-900 border border-gray-700 text-gray-200 mb-2"
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1 text-gray-500 hover:text-gray-300"
                        >
                          <X size={14} />
                        </button>
                        <button
                          onClick={() => handleSave(student.id)}
                          className="p-1 text-teal-400 hover:text-teal-300"
                        >
                          <Save size={14} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-sm font-medium text-gray-200">{student.name}</div>
                        {student.grade && <div className="text-xs text-gray-500 mt-0.5">{student.grade}</div>}
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleEdit(student)}
                          className="p-1 text-gray-500 hover:text-gray-300"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(student.id)}
                          className="p-1 text-gray-500 hover:text-red-400"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {students.length === 0 && !isAdding && (
                <div className="text-center text-xs text-gray-500 py-8">
                  暂无学生，点击上方按钮添加
                </div>
              )}
            </div>
          </div>
          <div className="flex-1 flex flex-col bg-gray-900 rounded-xl border border-gray-800">
            <div className="p-4 border-b border-gray-800">
              <h3 className="text-sm font-medium text-gray-300">动作片段</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {clips.map((clip) => {
                const student = students.find((s) => s.id === clip.studentId)
                return (
                  <div
                    key={clip.id}
                    className="p-4 rounded-lg bg-gray-800 hover:bg-gray-750 cursor-pointer"
                    onClick={() => handleSelectClip(clip.id)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-sm font-medium text-gray-200">{clip.name}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {student?.name || '未关联学生'} · 帧 {clip.startFrame + 1} - {clip.endFrame + 1}
                        </div>
                      </div>
                      <div className="text-xs text-gray-400">
                        {clip.frames.length} 帧 · {clip.angleResults.filter((a) => a.isAnomaly).length} 异常
                      </div>
                    </div>
                  </div>
                )
              })}
              {clips.length === 0 && (
                <div className="text-center text-xs text-gray-500 py-8">
                  暂无动作片段
                </div>
              )}
            </div>
          </div>
        </div>
        {confirmDelete && (
          <ConfirmDialog
            title="删除学生"
            message="确定要删除该学生吗？关联的动作片段不会被删除。"
            options={[
              { label: '取消', value: 'cancel', variant: 'ghost' },
              { label: '删除', value: 'delete', variant: 'danger' },
            ]}
            onSelect={(v) => {
              if (v === 'delete') removeStudent(confirmDelete)
              setConfirmDelete(null)
            }}
          />
        )}
      </div>
    </Layout>
  )
}

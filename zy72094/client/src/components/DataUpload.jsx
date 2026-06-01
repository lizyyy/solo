import React, { useRef } from 'react'

function DataUpload({ courses, selections, setCourses, setSelections, onLoadSample }) {
  const coursesInputRef = useRef(null)
  const selectionsInputRef = useRef(null)

  const handleFileUpload = (e, type) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = event.target.result
        let data
        
        if (file.name.endsWith('.json')) {
          data = JSON.parse(text)
        } else if (file.name.endsWith('.csv')) {
          data = parseCSV(text)
        }

        if (type === 'courses') {
          setCourses(Array.isArray(data) ? data : data.courses || [])
        } else {
          setSelections(Array.isArray(data) ? data : data.selections || [])
        }
      } catch (err) {
        alert('文件解析失败: ' + err.message)
      }
    }
    reader.readAsText(file)
  }

  const parseCSV = (text) => {
    const lines = text.trim().split('\n')
    const headers = lines[0].split(',').map(h => h.trim())
    const data = []

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim())
      const row = {}
      headers.forEach((header, idx) => {
        row[header] = values[idx] || ''
      })
      data.push(row)
    }

    return data
  }

  const clearData = () => {
    if (confirm('确定要清空所有数据吗？')) {
      setCourses([])
      setSelections([])
    }
  }

  return (
    <div className="card">
      <h2 className="card-title">数据管理</h2>

      <div className="grid grid-2" style={{ marginBottom: '24px' }}>
        <div style={{ border: '2px dashed #e1e8ed', borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>📚</div>
          <div style={{ fontWeight: '500', marginBottom: '8px' }}>课程数据</div>
          <div style={{ fontSize: '13px', color: '#666', marginBottom: '16px' }}>
            当前: {courses.length} 条记录
          </div>
          <div className="btn-group" style={{ justifyContent: 'center' }}>
            <input
              ref={coursesInputRef}
              type="file"
              accept=".json,.csv"
              style={{ display: 'none' }}
              onChange={(e) => handleFileUpload(e, 'courses')}
            />
            <button 
              className="btn btn-secondary"
              onClick={() => coursesInputRef.current?.click()}
            >
              📁 上传文件
            </button>
          </div>
        </div>

        <div style={{ border: '2px dashed #e1e8ed', borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎓</div>
          <div style={{ fontWeight: '500', marginBottom: '8px' }}>选课记录</div>
          <div style={{ fontSize: '13px', color: '#666', marginBottom: '16px' }}>
            当前: {selections.length} 条记录
          </div>
          <div className="btn-group" style={{ justifyContent: 'center' }}>
            <input
              ref={selectionsInputRef}
              type="file"
              accept=".json,.csv"
              style={{ display: 'none' }}
              onChange={(e) => handleFileUpload(e, 'selections')}
            />
            <button 
              className="btn btn-secondary"
              onClick={() => selectionsInputRef.current?.click()}
            >
              📁 上传文件
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginBottom: '24px' }}>
        <button className="btn btn-primary" onClick={onLoadSample}>
          📦 加载示例数据
        </button>
        <button className="btn btn-secondary" onClick={clearData}>
          🗑️ 清空数据
        </button>
      </div>

      {courses.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>📚 课程列表预览</h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>课程编号</th>
                  <th>课程名称</th>
                  <th>教师</th>
                  <th>学分</th>
                  <th>容量</th>
                  <th>已选</th>
                  <th>时间</th>
                </tr>
              </thead>
              <tbody>
                {courses.slice(0, 10).map((course, idx) => (
                  <tr key={idx}>
                    <td>
                      {course.id || '-'}
                      {!course.id && <span className="badge badge-danger" style={{ marginLeft: '4px' }}>空</span>}
                    </td>
                    <td>
                      {course.name || '-'}
                      {!course.name && <span className="badge badge-warning" style={{ marginLeft: '4px' }}>空</span>}
                    </td>
                    <td>{course.teacher || '-'}</td>
                    <td>
                      {course.credits ?? '-'}
                      {(course.credits === null || course.credits === undefined || course.credits === '') && (
                        <span className="badge badge-warning" style={{ marginLeft: '4px' }}>空</span>
                      )}
                    </td>
                    <td>{course.capacity ?? '-'}</td>
                    <td>{course.enrolled ?? '-'}</td>
                    <td style={{ fontSize: '12px', maxWidth: '200px' }}>{course.time || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {courses.length > 10 && (
            <div style={{ textAlign: 'center', marginTop: '8px', color: '#888', fontSize: '13px' }}>
              仅显示前 10 条，共 {courses.length} 条
            </div>
          )}
        </div>
      )}

      {selections.length > 0 && (
        <div>
          <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>🎓 选课记录预览</h3>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>记录编号</th>
                  <th>学号</th>
                  <th>课程编号</th>
                  <th>课程名称</th>
                  <th>选课时间</th>
                </tr>
              </thead>
              <tbody>
                {selections.slice(0, 10).map((sel, idx) => (
                  <tr key={idx}>
                    <td>{sel.id || idx + 1}</td>
                    <td>
                      {sel.studentId || '-'}
                      {!sel.studentId && <span className="badge badge-danger" style={{ marginLeft: '4px' }}>空</span>}
                    </td>
                    <td>
                      {sel.courseId || '-'}
                      {!sel.courseId && <span className="badge badge-danger" style={{ marginLeft: '4px' }}>空</span>}
                    </td>
                    <td>{sel.courseName || '-'}</td>
                    <td style={{ fontSize: '12px' }}>{sel.timestamp || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selections.length > 10 && (
            <div style={{ textAlign: 'center', marginTop: '8px', color: '#888', fontSize: '13px' }}>
              仅显示前 10 条，共 {selections.length} 条
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default DataUpload

import { useState } from 'react'
import { Card, Input, Tag, Button, List, Collapse, Badge } from 'antd'
import { Search, Video, FileText, Clock, Play } from 'lucide-react'
import { useAppStore } from '@/store'
import dayjs from 'dayjs'

const { Panel } = Collapse

export default function Scripts() {
  const { scripts, records } = useAppStore()
  const [searchText, setSearchText] = useState('')

  const filteredScripts = scripts.filter((script) => {
    if (!searchText) return true
    const search = searchText.toLowerCase()
    return (
      script.title.toLowerCase().includes(search) ||
      script.content.toLowerCase().includes(search)
    )
  })

  const getRecordCount = (scriptId: string) => {
    return records.filter((r) => r.scriptId === scriptId).length
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-gray-800">演示脚本库</h2>

      <Card bordered={false} className="stat-card">
        <div className="flex items-center gap-3 mb-6">
          <Input
            placeholder="搜索脚本标题或内容"
            prefix={<Search size={16} className="text-gray-400" />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 300 }}
            allowClear
          />
          <div className="flex-1" />
          <div className="text-sm text-gray-500">
            共 <span className="font-semibold text-gray-800">{filteredScripts.length}</span> 个脚本
          </div>
        </div>

        <List
          dataSource={filteredScripts}
          renderItem={(script) => (
            <Card className="mb-4 hover:shadow-md transition-shadow" bordered={false}>
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-primary-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Video size={28} className="text-primary-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-800 truncate">{script.title}</h3>
                    <Tag color="blue">{script.version}</Tag>
                    <Badge count={`${getRecordCount(script.id)} 次引用`} showZero color="#0F4C5C" />
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500 mb-3">
                    <span className="flex items-center gap-1">
                      <Clock size={14} />
                      更新于 {dayjs(script.updatedAt).format('YYYY-MM-DD')}
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText size={14} />
                      {script.content.split('\n').length} 个步骤
                    </span>
                  </div>
                  <Collapse ghost className="bg-gray-50 rounded-lg">
                    <Panel header="查看详细步骤" key="1">
                      <div className="space-y-3 py-2">
                        {script.content.split('\n').map((step, index) => (
                          <div key={index} className="flex items-start gap-3">
                            <div className="w-6 h-6 bg-primary-500 text-white rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                              {index + 1}
                            </div>
                            <p className="text-gray-700">{step.replace(/^步骤\d+[：:]/, '')}</p>
                          </div>
                        ))}
                      </div>
                    </Panel>
                  </Collapse>
                </div>
                <div className="flex-shrink-0">
                  <Button type="primary" icon={<Play size={14} />}>
                    播放演示
                  </Button>
                </div>
              </div>
            </Card>
          )}
        />
      </Card>
    </div>
  )
}

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import MainMenu from '@/components/menu/MainMenu'
import { useGameStore } from '@/stores/gameStore'

export default function MenuPage() {
  const navigate = useNavigate()
  const { gameHistory, loadHistory } = useGameStore()

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  const handleSelectLevel = (levelId: string) => {
    navigate(`/game/${levelId}`)
  }

  const handleShowInstructions = () => {
    alert(
      '游戏规则：\n\n' +
      '1. 将底部的配件拖拽到右侧对应器材上\n' +
      '2. 点击器材卡片展开详情，检查并标记损伤\n' +
      '3. 计算每件器材的押金金额\n' +
      '4. 注意区分真实损伤和正常使用痕迹\n' +
      '5. 有些配件可能已缺失，点击"缺失?"按钮标记\n' +
      '6. 红色物品是干扰项，点击可识别\n' +
      '7. 点击"提交"或时间结束时自动判定\n\n' +
      '评分规则：\n' +
      '- 配件匹配正确 +10，错误 -15\n' +
      '- 损伤标记正确 +15~25，漏记 -20\n' +
      '- 押金计算正确 +20，错误 -25\n' +
      '- 剩余时间每秒 +0.5 分\n' +
      '- 30秒内完成且满分额外 +50',
    )
  }

  return (
    <MainMenu
      onSelectLevel={handleSelectLevel}
      gameHistory={gameHistory}
      onShowInstructions={handleShowInstructions}
    />
  )
}

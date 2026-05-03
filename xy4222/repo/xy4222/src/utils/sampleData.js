import Project from '../models/Project'
import ArtifactImage from '../models/ArtifactImage'
import Annotation from '../models/Annotation'
import ShootingStage from '../models/ShootingStage'
import AnnotationType from '../models/AnnotationType'
import RiskLevel from '../models/RiskLevel'

export function createSampleProject() {
  const project = new Project({
    name: '青铜鼎修复项目示例',
    artifactCode: 'QD-2024-001',
    description: '这是一个示例项目，用于展示文物修复照片拼版批注台的功能。包含修复前后的对比图片和各种类型的批注示例。'
  })

  // 创建示例图片数据
  const sampleImages = [
    // 修复前 - 正面
    {
      fileName: '正面-修复前.jpg',
      part: '正面',
      stage: ShootingStage.BEFORE,
      description: '青铜鼎正面整体视图，修复前状态',
      annotations: [
        {
          type: AnnotationType.CRACK,
          riskLevel: RiskLevel.HIGH,
          position: { x: 150, y: 200, width: 120, height: 80 },
          comment: '鼎身左侧有一条明显的纵向裂纹，长度约 15cm，宽度约 2mm。裂纹从口沿延伸至腹部中部。',
          suggestion: '建议采用传统的锔钉修复法，或者使用环氧树脂进行粘接加固。需要先进行清洗和加固处理。'
        },
        {
          type: AnnotationType.STAIN,
          riskLevel: RiskLevel.MEDIUM,
          position: { x: 300, y: 300, width: 80, height: 60 },
          comment: '腹部有大面积铜绿锈迹，颜色呈深绿色，部分区域已形成粉状锈。',
          suggestion: '使用化学除锈剂配合机械方法进行除锈，除锈后需进行缓蚀处理。'
        }
      ]
    },
    // 修复前 - 底部
    {
      fileName: '底部-修复前.jpg',
      part: '底部',
      stage: ShootingStage.BEFORE,
      description: '青铜鼎底部视图，修复前状态',
      annotations: [
        {
          type: AnnotationType.DAMAGE,
          riskLevel: RiskLevel.CRITICAL,
          position: { x: 200, y: 150, width: 150, height: 100 },
          comment: '底部有一处较大缺损，约为 10cm × 8cm，缺损边缘不规整，部分金属已经氧化腐蚀。',
          suggestion: '需要进行补配修复，建议采用同材质的青铜片进行焊接或粘接，补配后进行做旧处理。'
        },
        {
          type: AnnotationType.HOLE,
          riskLevel: RiskLevel.HIGH,
          position: { x: 400, y: 250, width: 40, height: 40 },
          comment: '靠近足部有一个圆形孔洞，直径约 3cm，孔边缘有磨损痕迹。',
          suggestion: '使用青铜补片进行封堵，焊接固定后打磨平整，再进行做旧处理。'
        }
      ]
    },
    // 修复后 - 正面
    {
      fileName: '正面-修复后.jpg',
      part: '正面',
      stage: ShootingStage.AFTER,
      description: '青铜鼎正面整体视图，修复后状态',
      annotations: [
        {
          type: AnnotationType.COLOR_RESTORATION,
          riskLevel: RiskLevel.LOW,
          position: { x: 150, y: 200, width: 120, height: 80 },
          comment: '裂纹处已进行粘接加固，并进行了补色处理。修复痕迹较为隐蔽，但在侧光下仍可见。',
          suggestion: '修复效果良好，建议记录修复档案，定期检查修复部位状态。'
        }
      ]
    },
    // 修复后 - 底部
    {
      fileName: '底部-修复后.jpg',
      part: '底部',
      stage: ShootingStage.AFTER,
      description: '青铜鼎底部视图，修复后状态',
      annotations: [
        {
          type: AnnotationType.COLOR_RESTORATION,
          riskLevel: RiskLevel.LOW,
          position: { x: 200, y: 150, width: 150, height: 100 },
          comment: '缺损部位已进行补配，补配材料与原器材质相近，做旧处理效果较好。',
          suggestion: '补配修复成功，建议在修复报告中详细记录补配材料和工艺。'
        }
      ]
    },
    // 修复中 - 细节
    {
      fileName: '细节-修复中.jpg',
      part: '耳部',
      stage: ShootingStage.DURING,
      description: '青铜鼎耳部修复过程中的细节照片',
      annotations: [
        {
          type: AnnotationType.CRACK,
          riskLevel: RiskLevel.MEDIUM,
          position: { x: 100, y: 100, width: 60, height: 100 },
          comment: '耳部有细微裂纹，正在进行加固处理。图片显示了清洗后的裂纹状态。',
          suggestion: '继续进行加固处理，建议使用环氧树脂进行渗透加固。'
        }
      ]
    }
  ]

  // 添加图片到项目
  sampleImages.forEach(imgData => {
    const image = new ArtifactImage({
      filePath: `/samples/${imgData.fileName}`,
      fileName: imgData.fileName,
      artifactCode: project.artifactCode,
      part: imgData.part,
      stage: imgData.stage,
      description: imgData.description,
      annotations: imgData.annotations
    })
    project.addImage(image)
  })

  return project
}

// 导出示例数据函数
export default {
  createSampleProject
}

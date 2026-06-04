import { Router, type Request, type Response } from 'express'
import multer from 'multer'
import papaparse from 'papaparse'
import xlsx from 'xlsx'
import { authMiddleware, requireRole } from '../middleware/auth'
import { importTeacherNotes, importSamplingList } from '../services/importService'
import type { UserRole } from '../../../shared/types'

const router = Router()

const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['.csv', '.xlsx']
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'))
    if (allowedTypes.includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error('只支持 .csv 和 .xlsx 格式的文件'))
    }
  }
})

function parseFile(buffer: Buffer, filename: string): any[] {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'))

  if (ext === '.csv') {
    const result = papaparse.parse(buffer.toString('utf-8'), {
      header: true,
      skipEmptyLines: true
    })
    return result.data as any[]
  } else if (ext === '.xlsx') {
    const workbook = xlsx.read(buffer)
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    return xlsx.utils.sheet_to_json(worksheet) as any[]
  }

  throw new Error('不支持的文件格式')
}

router.post(
  '/teacher-notes',
  authMiddleware,
  requireRole('admin' as UserRole),
  upload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: '请上传文件'
        })
        return
      }

      const fileData = parseFile(req.file.buffer, req.file.originalname)
      const operator = req.user!.username

      const result = importTeacherNotes(fileData, operator)

      res.json({
        success: true,
        data: result,
        message: `成功导入 ${result.count} 条老师批注数据`
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : '导入失败'
      })
    }
  }
)

router.post(
  '/sampling-list',
  authMiddleware,
  requireRole('admin' as UserRole),
  upload.single('file'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: '请上传文件'
        })
        return
      }

      const fileData = parseFile(req.file.buffer, req.file.originalname)
      const operator = req.user!.username

      const result = importSamplingList(fileData, operator)

      res.json({
        success: true,
        data: result,
        message: `成功导入 ${result.count} 条抽样名单数据`
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : '导入失败'
      })
    }
  }
)

export default router

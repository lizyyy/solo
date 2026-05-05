import { Router } from 'express';
import multer from 'multer';
import { ProjectController } from '../controllers/projectController.js';

const upload = multer({ storage: multer.memoryStorage() });

export function createProjectRoutes(controller: ProjectController): Router {
  const router = Router();

  router.get('/', (req, res) => controller.getAllProjects(req, res));
  router.post('/', (req, res) => controller.createProject(req, res));
  router.post('/sample', (req, res) => controller.createSampleProject(req, res));
  router.get('/template', (req, res) => controller.downloadExcelTemplate(req, res));

  router.get('/:id', (req, res) => controller.getProject(req, res));
  router.put('/:id', (req, res) => controller.updateProject(req, res));
  router.delete('/:id', (req, res) => controller.deleteProject(req, res));

  router.post('/import', upload.single('file'), (req, res) => controller.importData(req, res));

  router.post('/:projectId/calculate', (req, res) => controller.calculate(req, res));
  router.get('/:projectId/history', (req, res) => controller.getCalculationHistory(req, res));

  router.get('/:projectId/export/markdown', (req, res) => controller.exportMarkdown(req, res));
  router.get('/:projectId/export/json', (req, res) => controller.exportJSON(req, res));

  router.put('/:projectId/valves/:valveId', (req, res) => controller.updateValve(req, res));
  router.put('/:projectId/notes', (req, res) => controller.saveUserNotes(req, res));

  return router;
}

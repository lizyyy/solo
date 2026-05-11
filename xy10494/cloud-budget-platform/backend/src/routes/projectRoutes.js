const express = require('express');
const projectController = require('../controllers/projectController');
const { authMiddleware, roleMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

router.get('/', projectController.getProjects);
router.get('/:id', projectController.getProjectById);

router.use(roleMiddleware('admin', 'finance'));

router.post('/', projectController.createProject);
router.put('/:id', projectController.updateProject);
router.delete('/:id', projectController.deleteProject);

router.get('/:projectId/tags', projectController.getTagRules);
router.post('/:projectId/tags', projectController.createTagRule);
router.put('/tags/:id', projectController.updateTagRule);
router.delete('/tags/:id', projectController.deleteTagRule);

module.exports = router;

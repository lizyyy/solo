const {
  getTaskList,
  getTaskById,
  getFailedTasks,
  retryTask,
  createTask,
} = require('../models/asyncTask');

function getTask(req, res) {
  try {
    const { id } = req.params;
    const task = getTaskById(id);
    if (!task) {
      return res.status(404).json({ success: false, error: '任务不存在' });
    }
    res.json({ success: true, data: task });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

function listTasks(req, res) {
  try {
    const tasks = getTaskList(req.query);
    res.json({ success: true, data: tasks });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

function listFailedTasks(req, res) {
  try {
    const tasks = getFailedTasks();
    res.json({ success: true, data: tasks });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

function retry(req, res) {
  try {
    const { id } = req.params;
    const success = retryTask(id);
    if (!success) {
      return res.status(400).json({ success: false, error: '任务无法重试' });
    }
    res.json({ success: true, message: '任务已加入重试队列' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

function create(req, res) {
  try {
    const { task_type, payload, options } = req.body;
    const task = createTask(task_type, payload, options);
    res.json({ success: true, data: { task_id: task.id } });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
}

module.exports = {
  getTask,
  listTasks,
  listFailedTasks,
  retry,
  create,
};

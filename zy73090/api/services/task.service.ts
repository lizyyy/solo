import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db.js';
import type { ReviewTask, TaskStatus } from '../../shared/types.js';

interface CreateTaskPayload {
  projectName: string;
  drawingVersion: string;
  cadSource: string;
  description?: string;
}

type UpdateTaskPayload = Partial<Omit<ReviewTask, 'id' | 'createdAt' | 'layerCount' | 'openIssueCount'>>;

export async function listTasks(status?: TaskStatus, search?: string): Promise<ReviewTask[]> {
  const db = await getDb();
  let tasks = [...db.data.tasks];

  if (status) {
    tasks = tasks.filter((t) => t.status === status);
  }

  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    tasks = tasks.filter(
      (t) =>
        t.projectName.toLowerCase().includes(q) ||
        (t.description?.toLowerCase().includes(q) ?? false),
    );
  }

  tasks.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return tasks;
}

export async function getTask(id: string): Promise<ReviewTask | null> {
  const db = await getDb();
  const task = db.data.tasks.find((t) => t.id === id);
  if (!task) return null;

  const layers = db.data.layers.filter((l) => l.taskId === id);
  const result = {
    ...task,
    layerCount: layers.length,
    openIssueCount: layers.filter(
      (l) => l.currentStatus === 'needs_modify' || l.currentStatus === 'rejected',
    ).length,
  };

  return result;
}

export async function createTask(payload: CreateTaskPayload): Promise<ReviewTask> {
  const db = await getDb();
  const now = new Date().toISOString();

  const task: ReviewTask = {
    id: uuidv4(),
    projectName: payload.projectName,
    drawingVersion: payload.drawingVersion,
    cadSource: payload.cadSource,
    description: payload.description,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    layerCount: 0,
    openIssueCount: 0,
  };

  db.data.tasks.push(task);
  await db.write();
  return task;
}

export async function updateTask(id: string, patch: UpdateTaskPayload): Promise<ReviewTask | null> {
  const db = await getDb();
  const idx = db.data.tasks.findIndex((t) => t.id === id);
  if (idx === -1) return null;

  db.data.tasks[idx] = {
    ...db.data.tasks[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  await db.write();
  return getTask(id);
}

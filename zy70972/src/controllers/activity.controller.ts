import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const createActivity = async (req: Request, res: Response) => {
  try {
    const { name, description, activityDate, totalQuota } = req.body;

    if (!name || !activityDate || !totalQuota) {
      return res.status(400).json({ error: '缺少必填字段' });
    }

    const activity = await prisma.activity.create({
      data: {
        name,
        description,
        activityDate: new Date(activityDate),
        totalQuota,
      },
    });

    res.status(201).json(activity);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const listActivities = async (req: Request, res: Response) => {
  try {
    const activities = await prisma.activity.findMany({
      orderBy: { activityDate: 'desc' },
      include: {
        _count: {
          select: {
            registrations: true,
            waitlist: true,
            batches: true,
          },
        },
      },
    });

    res.json(activities);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const getActivity = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const activity = await prisma.activity.findUnique({
      where: { id },
      include: {
        batches: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!activity) {
      return res.status(404).json({ error: '活动不存在' });
    }

    res.json(activity);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const updateActivity = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, activityDate, totalQuota } = req.body;

    const activity = await prisma.activity.update({
      where: { id },
      data: {
        name,
        description,
        activityDate: activityDate ? new Date(activityDate) : undefined,
        totalQuota,
      },
    });

    res.json(activity);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const deleteActivity = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.activity.delete({ where: { id } });
    res.json({ message: '删除成功' });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

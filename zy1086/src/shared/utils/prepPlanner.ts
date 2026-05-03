import { 
  Recipe, 
  SelectedRecipe, 
  PrepTask, 
  BatchPrepGroup,
  PrepStep
} from '@shared/types';

export interface PrepPlanOptions {
  considerDependencies: boolean;
  enableBatching: boolean;
}

interface TaskNode {
  task: PrepTask;
  dependencies: Set<string>;
  dependents: Set<string>;
  inDegree: number;
}

export function generatePrepTasks(
  recipes: Recipe[],
  selectedRecipes: SelectedRecipe[],
  options: PrepPlanOptions = { considerDependencies: true, enableBatching: true }
): { tasks: PrepTask[]; batchGroups: BatchPrepGroup[] } {
  const allTasks: PrepTask[] = [];
  const batchGroups: BatchPrepGroup[] = [];

  for (const selected of selectedRecipes) {
    const recipe = recipes.find(r => r.id === selected.recipeId);
    if (!recipe) continue;

    for (const step of recipe.prepSteps) {
      const taskId = `${recipe.id}-${step.id}`;
      
      const task: PrepTask = {
        id: taskId,
        recipeId: recipe.id,
        recipeName: recipe.name,
        stepId: step.id,
        stepNumber: step.stepNumber,
        description: step.description,
        estimatedMinutes: step.estimatedMinutes,
        dependencies: step.dependencies.map(depId => `${recipe.id}-${depId}`),
        ingredients: step.ingredients,
        isBatchable: step.canBatch,
        status: 'pending',
      };

      allTasks.push(task);
    }
  }

  if (options.enableBatching) {
    const groupedTasks = createBatchGroups(allTasks, recipes);
    return groupedTasks;
  }

  return { tasks: allTasks, batchGroups };
}

function createBatchGroups(
  tasks: PrepTask[],
  recipes: Recipe[]
): { tasks: PrepTask[]; batchGroups: BatchPrepGroup[] } {
  const batchGroups: BatchPrepGroup[] = [];
  const updatedTasks = [...tasks];
  
  const batchableTasks = tasks.filter(t => t.isBatchable);
  
  const stepTypeGroups = new Map<string, PrepTask[]>();
  
  for (const task of batchableTasks) {
    const stepType = categorizeStepType(task.description, task.ingredients);
    if (!stepTypeGroups.has(stepType)) {
      stepTypeGroups.set(stepType, []);
    }
    stepTypeGroups.get(stepType)!.push(task);
  }

  let groupCounter = 0;
  for (const [stepType, groupTasks] of stepTypeGroups) {
    if (groupTasks.length >= 2) {
      const groupId = `batch-${++groupCounter}`;
      
      const combinedIngredients = new Set<string>();
      for (const task of groupTasks) {
        for (const ing of task.ingredients) {
          combinedIngredients.add(ing);
        }
      }

      const group: BatchPrepGroup = {
        id: groupId,
        name: getBatchGroupName(stepType),
        steps: groupTasks.map(t => t.id),
        combinedIngredients: Array.from(combinedIngredients),
        estimatedMinutes: Math.max(...groupTasks.map(t => t.estimatedMinutes)),
      };

      batchGroups.push(group);

      for (const task of updatedTasks) {
        if (groupTasks.some(gt => gt.id === task.id)) {
          task.batchGroupId = groupId;
        }
      }
    }
  }

  return { tasks: updatedTasks, batchGroups };
}

function categorizeStepType(description: string, ingredients: string[]): string {
  const desc = description.toLowerCase();
  
  if (desc.includes('切') || desc.includes('丁') || desc.includes('丝') || desc.includes('片') || desc.includes('块')) {
    return '切菜';
  }
  if (desc.includes('洗') || desc.includes('清洗') || desc.includes('洗净')) {
    return '清洗';
  }
  if (desc.includes('腌') || desc.includes('腌制') || desc.includes('码味')) {
    return '腌制';
  }
  if (desc.includes('炒') || desc.includes('煎') || desc.includes('煮') || desc.includes('蒸') || desc.includes('炖')) {
    return '烹饪';
  }
  if (desc.includes('准备') || desc.includes('备料') || desc.includes('处理')) {
    return '准备';
  }
  
  return '其他';
}

function getBatchGroupName(stepType: string): string {
  const names: Record<string, string> = {
    '切菜': '合并切菜',
    '清洗': '合并清洗',
    '腌制': '合并腌制',
    '烹饪': '合并烹饪',
    '准备': '合并准备',
    '其他': '批量处理',
  };
  return names[stepType] || '批量处理';
}

export function sortTasksByDependency(tasks: PrepTask[]): PrepTask[] {
  const taskMap = new Map<string, TaskNode>();
  
  for (const task of tasks) {
    taskMap.set(task.id, {
      task,
      dependencies: new Set(task.dependencies),
      dependents: new Set(),
      inDegree: task.dependencies.length,
    });
  }

  for (const [taskId, node] of taskMap) {
    for (const depId of node.dependencies) {
      const depNode = taskMap.get(depId);
      if (depNode) {
        depNode.dependents.add(taskId);
      }
    }
  }

  const queue: string[] = [];
  const result: PrepTask[] = [];

  for (const [taskId, node] of taskMap) {
    if (node.inDegree === 0) {
      queue.push(taskId);
    }
  }

  while (queue.length > 0) {
    const taskId = queue.shift()!;
    const node = taskMap.get(taskId)!;
    
    result.push(node.task);

    for (const dependentId of node.dependents) {
      const depNode = taskMap.get(dependentId)!;
      depNode.inDegree--;
      if (depNode.inDegree === 0) {
        queue.push(dependentId);
      }
    }
  }

  if (result.length !== tasks.length) {
    console.warn('Cycle detected in task dependencies. Using original order.');
    return [...tasks].sort((a, b) => a.stepNumber - b.stepNumber);
  }

  return result;
}

export function calculateTotalPrepTime(tasks: PrepTask[]): number {
  const taskMap = new Map<string, { task: PrepTask; earliestStart: number; latestFinish: number }>();
  
  for (const task of tasks) {
    taskMap.set(task.id, {
      task,
      earliestStart: 0,
      latestFinish: 0,
    });
  }

  const sortedTasks = sortTasksByDependency(tasks);

  for (const task of sortedTasks) {
    const node = taskMap.get(task.id)!;
    
    let maxDependencyFinish = 0;
    for (const depId of task.dependencies) {
      const depNode = taskMap.get(depId);
      if (depNode) {
        maxDependencyFinish = Math.max(maxDependencyFinish, depNode.latestFinish);
      }
    }
    
    node.earliestStart = maxDependencyFinish;
    node.latestFinish = maxDependencyFinish + task.estimatedMinutes;
  }

  let maxFinish = 0;
  for (const node of taskMap.values()) {
    maxFinish = Math.max(maxFinish, node.latestFinish);
  }

  return maxFinish;
}

export function getParallelTaskGroups(tasks: PrepTask[]): PrepTask[][] {
  const taskMap = new Map<string, TaskNode>();
  
  for (const task of tasks) {
    taskMap.set(task.id, {
      task,
      dependencies: new Set(task.dependencies),
      dependents: new Set(),
      inDegree: task.dependencies.length,
    });
  }

  for (const [taskId, node] of taskMap) {
    for (const depId of node.dependencies) {
      const depNode = taskMap.get(depId);
      if (depNode) {
        depNode.dependents.add(taskId);
      }
    }
  }

  const groups: PrepTask[][] = [];
  const remainingNodes = new Set(taskMap.keys());

  while (remainingNodes.size > 0) {
    const currentGroup: PrepTask[] = [];
    const nodesToRemove: string[] = [];

    for (const taskId of remainingNodes) {
      const node = taskMap.get(taskId)!;
      
      const dependenciesSatisfied = Array.from(node.dependencies).every(
        depId => !remainingNodes.has(depId)
      );

      if (dependenciesSatisfied) {
        currentGroup.push(node.task);
        nodesToRemove.push(taskId);
      }
    }

    if (currentGroup.length === 0) {
      break;
    }

    groups.push(currentGroup);
    for (const taskId of nodesToRemove) {
      remainingNodes.delete(taskId);
    }
  }

  return groups;
}

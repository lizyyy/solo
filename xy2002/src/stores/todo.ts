import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Todo, TodoCategory, TodoPriority } from '@/types';

const STORAGE_KEY = 'hellokitty_todos';

export const useTodoStore = defineStore('todo', () => {
  const todos = ref<Todo[]>([]);

  function loadTodos() {
    try {
      const stored = uni.getStorageSync(STORAGE_KEY);
      if (stored) {
        todos.value = JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load todos:', e);
    }
  }

  function saveTodos() {
    try {
      uni.setStorageSync(STORAGE_KEY, JSON.stringify(todos.value));
    } catch (e) {
      console.error('Failed to save todos:', e);
    }
  }

  function generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  function getCategory(isImportant: boolean, isUrgent: boolean): TodoCategory {
    if (isImportant && isUrgent) return 'important-urgent';
    if (isImportant && !isUrgent) return 'important-not-urgent';
    if (!isImportant && isUrgent) return 'not-important-urgent';
    return 'not-important-not-urgent';
  }

  const activeTodos = computed(() => 
    todos.value.filter(t => !t.isCompleted)
  );

  const completedTodos = computed(() => 
    todos.value.filter(t => t.isCompleted)
  );

  const todosByCategory = computed(() => {
    const categories: Record<TodoCategory, Todo[]> = {
      'important-urgent': [],
      'important-not-urgent': [],
      'not-important-urgent': [],
      'not-important-not-urgent': []
    };
    activeTodos.value.forEach(todo => {
      categories[todo.category].push(todo);
    });
    return categories;
  });

  function getTodosByCategory(category: TodoCategory): Todo[] {
    return todos.value.filter(t => t.category === category && !t.isCompleted);
  }

  function addTodo(todo: Omit<Todo, 'id' | 'category' | 'isCompleted' | 'completedAt' | 'createdAt' | 'updatedAt'>): Todo {
    const category = getCategory(todo.isImportant, todo.isUrgent);
    const newTodo: Todo = {
      ...todo,
      id: generateId(),
      category,
      isCompleted: false,
      completedAt: null,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    todos.value.push(newTodo);
    saveTodos();
    return newTodo;
  }

  function updateTodo(id: string, updates: Partial<Omit<Todo, 'id' | 'createdAt'>>): boolean {
    const index = todos.value.findIndex(t => t.id === id);
    if (index !== -1) {
      const updatedTodo = {
        ...todos.value[index],
        ...updates,
        updatedAt: Date.now()
      };
      if (updates.isImportant !== undefined || updates.isUrgent !== undefined) {
        updatedTodo.category = getCategory(
          updates.isImportant ?? todos.value[index].isImportant,
          updates.isUrgent ?? todos.value[index].isUrgent
        );
      }
      todos.value[index] = updatedTodo;
      saveTodos();
      return true;
    }
    return false;
  }

  function completeTodo(id: string): boolean {
    const index = todos.value.findIndex(t => t.id === id);
    if (index !== -1) {
      todos.value[index].isCompleted = true;
      todos.value[index].completedAt = Date.now();
      todos.value[index].updatedAt = Date.now();
      saveTodos();
      return true;
    }
    return false;
  }

  function uncompleteTodo(id: string): boolean {
    const index = todos.value.findIndex(t => t.id === id);
    if (index !== -1) {
      todos.value[index].isCompleted = false;
      todos.value[index].completedAt = null;
      todos.value[index].updatedAt = Date.now();
      saveTodos();
      return true;
    }
    return false;
  }

  function deleteTodo(id: string): boolean {
    const index = todos.value.findIndex(t => t.id === id);
    if (index !== -1) {
      todos.value.splice(index, 1);
      saveTodos();
      return true;
    }
    return false;
  }

  const todayTodos = computed(() => {
    const today = new Date().toISOString().split('T')[0];
    return activeTodos.value.filter(t => t.dueDate === today);
  });

  const overdueTodos = computed(() => {
    const today = new Date().toISOString().split('T')[0];
    return activeTodos.value.filter(t => t.dueDate && t.dueDate < today);
  });

  const categoryNames: Record<TodoCategory, string> = {
    'important-urgent': '重要且紧急',
    'important-not-urgent': '重要不紧急',
    'not-important-urgent': '紧急不重要',
    'not-important-not-urgent': '不重要不紧急'
  };

  const categoryColors: Record<TodoCategory, string> = {
    'important-urgent': '#FF6B6B',
    'important-not-urgent': '#4ECDC4',
    'not-important-urgent': '#FFE66D',
    'not-important-not-urgent': '#95E1D3'
  };

  const priorityNames: Record<TodoPriority, string> = {
    'high': '高',
    'medium': '中',
    'low': '低'
  };

  loadTodos();

  return {
    todos,
    activeTodos,
    completedTodos,
    todosByCategory,
    todayTodos,
    overdueTodos,
    categoryNames,
    categoryColors,
    priorityNames,
    loadTodos,
    getTodosByCategory,
    addTodo,
    updateTodo,
    completeTodo,
    uncompleteTodo,
    deleteTodo
  };
});

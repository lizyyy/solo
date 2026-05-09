import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useTaskStore } from './store/taskStore';
import { wsService } from './services/websocket';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import TaskListPage from './pages/TaskListPage';
import TaskDetailPage from './pages/TaskDetailPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

function App() {
  const { user, isAuthenticated } = useAuthStore();
  const { updateTaskInList, removeTaskFromList, addTaskToList } = useTaskStore();

  useEffect(() => {
    if (isAuthenticated && user) {
      wsService.connect(user.id);

      wsService.subscribe('tasks:all');

      wsService.on('task:created', ({ task }) => {
        addTaskToList(task);
      });

      wsService.on('task:updated', ({ task }) => {
        updateTaskInList(task);
      });

      wsService.on('task:deleted', ({ taskId }) => {
        removeTaskFromList(taskId);
      });

      wsService.on('task:list-updated', ({ taskId }) => {
        console.log('Task list updated for task:', taskId);
      });
    }

    return () => {
      wsService.disconnect();
    };
  }, [isAuthenticated, user, addTaskToList, updateTaskInList, removeTaskFromList]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/tasks" replace />} />
        <Route path="tasks" element={<TaskListPage />} />
        <Route path="tasks/:id" element={<TaskDetailPage />} />
        <Route path="*" element={<Navigate to="/tasks" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
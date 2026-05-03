import React, { useState, useEffect, useCallback } from 'react';
import { Recipe, Project, Ingredient, ContainerType, ExportOptions } from '@shared/types';
import Dashboard from './pages/Dashboard';
import RecipesPage from './pages/RecipesPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import IngredientsPage from './pages/IngredientsPage';
import StoragePage from './pages/StoragePage';
import SettingsPage from './pages/SettingsPage';
import { Icons } from './components/Icons';

declare global {
  interface Window {
    electronAPI: {
      getDataPath: () => Promise<string>;
      getRecipes: () => Promise<Recipe[]>;
      getRecipeById: (id: string) => Promise<Recipe | undefined>;
      saveRecipe: (recipe: Recipe) => Promise<void>;
      deleteRecipe: (id: string) => Promise<boolean>;
      getIngredients: () => Promise<Ingredient[]>;
      saveIngredient: (ingredient: Ingredient) => Promise<void>;
      getContainerTypes: () => Promise<ContainerType[]>;
      getProjects: () => Promise<Project[]>;
      getProjectById: (id: string) => Promise<Project | undefined>;
      saveProject: (project: Project) => Promise<void>;
      deleteProject: (id: string) => Promise<boolean>;
      generateShoppingList: (projectId: string) => Promise<any[]>;
      generatePrepTasks: (projectId: string) => Promise<{ tasks: any[]; batchGroups: any[] }>;
      checkRisks: (projectId: string) => Promise<any[]>;
      exportMarkdown: (projectId: string, options: ExportOptions) => Promise<string>;
      exportShoppingListCSV: (projectId: string) => Promise<string>;
      exportStorageLabelsHTML: (projectId: string) => Promise<string>;
      showSaveDialog: (options: { title: string; defaultPath: string; filters: { name: string; extensions: string[] }[] }) => Promise<string | undefined>;
      showOpenDialog: (options: { title: string; filters: { name: string; extensions: string[] }[]; properties?: ('openFile' | 'multiSelections')[] }) => Promise<string[]>;
      writeFile: (filePath: string, content: string) => Promise<void>;
      readFile: (filePath: string) => Promise<string>;
      getSettings: () => Promise<any>;
      saveSettings: (settings: any) => Promise<void>;
      resetApp: () => Promise<void>;
      onMenuNewProject: (callback: () => void) => () => void;
      onMenuOpenProject: (callback: () => void) => () => void;
      onMenuExportProject: (callback: () => void) => () => void;
      onMenuImportProject: (callback: () => void) => () => void;
    };
  }
}

type Page = 'dashboard' | 'recipes' | 'projects' | 'project-detail' | 'ingredients' | 'storage' | 'settings';

interface NavItem {
  id: Page;
  label: string;
  icon: keyof typeof Icons;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: '仪表盘', icon: 'Dashboard' },
  { id: 'recipes', label: '菜谱管理', icon: 'Recipe' },
  { id: 'projects', label: '备餐项目', icon: 'Project' },
  { id: 'ingredients', label: '食材库', icon: 'Ingredient' },
  { id: 'storage', label: '存储管理', icon: 'Storage' },
  { id: 'settings', label: '设置', icon: 'Settings' },
];

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [containerTypes, setContainerTypes] = useState<ContainerType[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [recipesData, projectsData, ingredientsData, containersData, settingsData] = await Promise.all([
        window.electronAPI.getRecipes(),
        window.electronAPI.getProjects(),
        window.electronAPI.getIngredients(),
        window.electronAPI.getContainerTypes(),
        window.electronAPI.getSettings(),
      ]);
      setRecipes(recipesData);
      setProjects(projectsData);
      setIngredients(ingredientsData);
      setContainerTypes(containersData);
      setSettings(settingsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const unsubscribers = [
      window.electronAPI.onMenuNewProject(() => {
        setCurrentPage('projects');
        setSelectedProjectId(null);
      }),
      window.electronAPI.onMenuOpenProject(() => {
        setCurrentPage('projects');
      }),
      window.electronAPI.onMenuExportProject(() => {
        if (selectedProjectId) {
          handleExportProject(selectedProjectId);
        }
      }),
      window.electronAPI.onMenuImportProject(() => {
        handleImportProject();
      }),
    ];

    return () => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
    };
  }, [selectedProjectId]);

  const handleExportProject = async (projectId: string) => {
    const filePath = await window.electronAPI.showSaveDialog({
      title: '导出项目',
      defaultPath: 'meal-prep-project.json',
      filters: [{ name: 'JSON 文件', extensions: ['json'] }],
    });

    if (!filePath) return;

    const project = await window.electronAPI.getProjectById(projectId);
    if (!project) return;

    await window.electronAPI.writeFile(filePath, JSON.stringify(project, null, 2));
  };

  const handleImportProject = async () => {
    const filePaths = await window.electronAPI.showOpenDialog({
      title: '导入项目',
      filters: [{ name: 'JSON 文件', extensions: ['json'] }],
      properties: ['openFile'],
    });

    if (filePaths.length === 0) return;

    try {
      const content = await window.electronAPI.readFile(filePaths[0]);
      const project = JSON.parse(content) as Project;
      project.id = `project-imported-${Date.now()}`;
      project.createdDate = new Date().toISOString().split('T')[0];
      project.lastModifiedDate = project.createdDate;
      
      await window.electronAPI.saveProject(project);
      await loadData();
      
      setSelectedProjectId(project.id);
      setCurrentPage('project-detail');
    } catch (error) {
      console.error('Error importing project:', error);
      alert('导入失败，请检查文件格式');
    }
  };

  const navigateToProjectDetail = (projectId: string) => {
    setSelectedProjectId(projectId);
    setCurrentPage('project-detail');
  };

  const navigateBack = () => {
    setSelectedProjectId(null);
    setCurrentPage('projects');
  };

  const refreshData = async () => {
    setLoading(true);
    await loadData();
  };

  if (loading) {
    return (
      <div className="app-container">
        <div className="loading">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return (
          <Dashboard 
            recipes={recipes}
            projects={projects}
            onNavigateToProject={navigateToProjectDetail}
          />
        );
      case 'recipes':
        return (
          <RecipesPage 
            recipes={recipes}
            ingredients={ingredients}
            onRefresh={refreshData}
          />
        );
      case 'projects':
        return (
          <ProjectsPage 
            projects={projects}
            recipes={recipes}
            onNavigateToDetail={navigateToProjectDetail}
            onRefresh={refreshData}
          />
        );
      case 'project-detail':
        return selectedProjectId ? (
          <ProjectDetailPage 
            projectId={selectedProjectId}
            recipes={recipes}
            ingredients={ingredients}
            containerTypes={containerTypes}
            settings={settings}
            onNavigateBack={navigateBack}
            onRefresh={refreshData}
          />
        ) : null;
      case 'ingredients':
        return (
          <IngredientsPage 
            ingredients={ingredients}
            onRefresh={refreshData}
          />
        );
      case 'storage':
        return (
          <StoragePage 
            projects={projects}
            containerTypes={containerTypes}
            onRefresh={refreshData}
          />
        );
      case 'settings':
        return (
          <SettingsPage 
            settings={settings}
            onRefresh={refreshData}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <h1>
            <span>🍳</span>
            备餐小助手
          </h1>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const IconComponent = Icons[item.icon];
            return (
              <div
                key={item.id}
                className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
                onClick={() => {
                  setCurrentPage(item.id);
                  setSelectedProjectId(null);
                }}
              >
                <IconComponent />
                <span>{item.label}</span>
              </div>
            );
          })}
        </nav>
      </aside>

      <main className="main-content">
        {renderPage()}
      </main>
    </div>
  );
}

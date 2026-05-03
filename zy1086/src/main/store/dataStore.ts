import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import { Project, Recipe, Ingredient, ContainerType } from '@shared/types';
import { SAMPLE_RECIPES, SAMPLE_INGREDIENTS, SAMPLE_CONTAINER_TYPES, createSampleProject } from '@shared/data/sampleData';

interface AppData {
  recipes: Recipe[];
  ingredients: Ingredient[];
  containerTypes: ContainerType[];
  projects: Project[];
  settings: {
    defaultStorageSlots: number;
    defaultAllergens: string[];
    expiryWarningDays: number;
  };
}

const DEFAULT_DATA: AppData = {
  recipes: SAMPLE_RECIPES,
  ingredients: SAMPLE_INGREDIENTS,
  containerTypes: SAMPLE_CONTAINER_TYPES,
  projects: [],
  settings: {
    defaultStorageSlots: 4,
    defaultAllergens: ['花生', '坚果', '海鲜', '牛奶', '鸡蛋', '小麦', '大豆'],
    expiryWarningDays: 3
  }
};

export class DataStore {
  private dataPath: string;
  private data: AppData | null = null;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.dataPath = path.join(userDataPath, 'meal-prep-data.json');
  }

  async initialize(): Promise<void> {
    if (!existsSync(this.dataPath)) {
      const sampleProject = createSampleProject();
      const initialData: AppData = {
        ...DEFAULT_DATA,
        projects: [sampleProject]
      };
      await this.saveData(initialData);
      this.data = initialData;
    } else {
      await this.loadData();
    }
  }

  private async loadData(): Promise<void> {
    try {
      const rawData = await fs.readFile(this.dataPath, 'utf-8');
      this.data = JSON.parse(rawData) as AppData;
      
      if (!this.data.projects) {
        this.data.projects = [];
      }
      if (!this.data.settings) {
        this.data.settings = DEFAULT_DATA.settings;
      }
    } catch (error) {
      console.error('Error loading data:', error);
      this.data = { ...DEFAULT_DATA, projects: [createSampleProject()] };
      await this.saveData(this.data);
    }
  }

  private async saveData(data: AppData): Promise<void> {
    try {
      const jsonData = JSON.stringify(data, null, 2);
      await fs.writeFile(this.dataPath, jsonData, 'utf-8');
    } catch (error) {
      console.error('Error saving data:', error);
      throw error;
    }
  }

  async getRecipes(): Promise<Recipe[]> {
    if (!this.data) await this.loadData();
    return this.data?.recipes || [];
  }

  async getRecipeById(id: string): Promise<Recipe | undefined> {
    const recipes = await this.getRecipes();
    return recipes.find(r => r.id === id);
  }

  async saveRecipe(recipe: Recipe): Promise<void> {
    if (!this.data) await this.loadData();
    
    const existingIndex = this.data!.recipes.findIndex(r => r.id === recipe.id);
    if (existingIndex >= 0) {
      this.data!.recipes[existingIndex] = recipe;
    } else {
      this.data!.recipes.push(recipe);
    }
    
    await this.saveData(this.data!);
  }

  async deleteRecipe(id: string): Promise<boolean> {
    if (!this.data) await this.loadData();
    
    const index = this.data!.recipes.findIndex(r => r.id === id);
    if (index >= 0) {
      this.data!.recipes.splice(index, 1);
      await this.saveData(this.data!);
      return true;
    }
    return false;
  }

  async getIngredients(): Promise<Ingredient[]> {
    if (!this.data) await this.loadData();
    return this.data?.ingredients || [];
  }

  async saveIngredient(ingredient: Ingredient): Promise<void> {
    if (!this.data) await this.loadData();
    
    const existingIndex = this.data!.ingredients.findIndex(i => i.id === ingredient.id);
    if (existingIndex >= 0) {
      this.data!.ingredients[existingIndex] = ingredient;
    } else {
      this.data!.ingredients.push(ingredient);
    }
    
    await this.saveData(this.data!);
  }

  async getContainerTypes(): Promise<ContainerType[]> {
    if (!this.data) await this.loadData();
    return this.data?.containerTypes || [];
  }

  async getProjects(): Promise<Project[]> {
    if (!this.data) await this.loadData();
    return this.data?.projects || [];
  }

  async getProjectById(id: string): Promise<Project | undefined> {
    const projects = await this.getProjects();
    return projects.find(p => p.id === id);
  }

  async saveProject(project: Project): Promise<void> {
    if (!this.data) await this.loadData();
    
    project.lastModifiedDate = new Date().toISOString().split('T')[0];
    
    const existingIndex = this.data!.projects.findIndex(p => p.id === project.id);
    if (existingIndex >= 0) {
      this.data!.projects[existingIndex] = project;
    } else {
      this.data!.projects.push(project);
    }
    
    await this.saveData(this.data!);
  }

  async deleteProject(id: string): Promise<boolean> {
    if (!this.data) await this.loadData();
    
    const index = this.data!.projects.findIndex(p => p.id === id);
    if (index >= 0) {
      this.data!.projects.splice(index, 1);
      await this.saveData(this.data!);
      return true;
    }
    return false;
  }

  async exportProjectToFile(projectId: string, filePath: string): Promise<void> {
    const project = await this.getProjectById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }
    
    const jsonData = JSON.stringify(project, null, 2);
    await fs.writeFile(filePath, jsonData, 'utf-8');
  }

  async importProjectFromFile(filePath: string): Promise<Project> {
    const rawData = await fs.readFile(filePath, 'utf-8');
    const project = JSON.parse(rawData) as Project;
    
    project.id = `project-imported-${Date.now()}`;
    project.createdDate = new Date().toISOString().split('T')[0];
    project.lastModifiedDate = project.createdDate;
    
    await this.saveProject(project);
    return project;
  }

  async getSettings(): Promise<AppData['settings']> {
    if (!this.data) await this.loadData();
    return this.data?.settings || DEFAULT_DATA.settings;
  }

  async saveSettings(settings: AppData['settings']): Promise<void> {
    if (!this.data) await this.loadData();
    this.data!.settings = settings;
    await this.saveData(this.data!);
  }

  getDataPath(): string {
    return this.dataPath;
  }

  async resetToDefaults(): Promise<void> {
    const sampleProject = createSampleProject();
    this.data = {
      ...DEFAULT_DATA,
      projects: [sampleProject]
    };
    await this.saveData(this.data);
  }
}

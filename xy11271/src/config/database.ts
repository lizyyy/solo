import "reflect-metadata";
import { DataSource } from "typeorm";
import * as path from "path";

export const AppDataSource = new DataSource({
  type: "sqlite",
  database: path.join(process.cwd(), "data", "quality-inspection.db"),
  synchronize: true,
  logging: false,
  entities: [path.join(__dirname, "..", "models", "*.{ts,js}")],
  migrations: [],
  subscribers: [],
});

export async function initDatabase() {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
    console.log("数据库初始化成功");
  }
  return AppDataSource;
}

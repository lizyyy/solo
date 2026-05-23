import "reflect-metadata";
import { DataSource } from "typeorm";
import * as path from "path";
import * as fs from "fs";

const dataDir = path.resolve(__dirname, "../../data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const exportsDir = path.join(dataDir, "exports");
if (!fs.existsSync(exportsDir)) {
  fs.mkdirSync(exportsDir, { recursive: true });
}

export const AppDataSource = new DataSource({
  type: "sqlite",
  database: path.join(dataDir, "compensation.db"),
  synchronize: true,
  logging: false,
  entities: [path.join(__dirname, "../entities/*.{ts,js}")],
  migrations: [],
  subscribers: [],
});

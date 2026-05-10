import "reflect-metadata";
import { DataSource } from "typeorm";
import path from "path";
import { Pen } from "../entities/Pen";
import { VaccinationPlan } from "../entities/VaccinationPlan";
import { Veterinarian } from "../entities/Veterinarian";
import { Batch } from "../entities/Batch";
import { VaccinationRecord } from "../entities/VaccinationRecord";
import { SupplementaryRecord } from "../entities/SupplementaryRecord";
import { QuarantineReport } from "../entities/QuarantineReport";

export const AppDataSource = new DataSource({
  type: "sqlite",
  database: process.env.DB_PATH || path.join(__dirname, "../../vaccination.db"),
  synchronize: true,
  logging: false,
  entities: [
    Pen,
    VaccinationPlan,
    Veterinarian,
    Batch,
    VaccinationRecord,
    SupplementaryRecord,
    QuarantineReport,
  ],
  migrations: [],
  subscribers: [],
});

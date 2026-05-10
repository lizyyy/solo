import "reflect-metadata";
import { DataSource } from "typeorm";
import { Pen } from "../entities/Pen";
import { VaccinationPlan } from "../entities/VaccinationPlan";
import { Veterinarian } from "../entities/Veterinarian";
import { Batch } from "../entities/Batch";
import { VaccinationRecord } from "../entities/VaccinationRecord";
import { SupplementaryRecord } from "../entities/SupplementaryRecord";
import { QuarantineReport } from "../entities/QuarantineReport";

export const TestDataSource = new DataSource({
  type: "sqlite",
  database: ":memory:",
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

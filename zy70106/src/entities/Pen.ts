import { Entity, PrimaryColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { VaccinationPlan } from "./VaccinationPlan";
import { VaccinationRecord } from "./VaccinationRecord";

export type PenStatus = "active" | "inactive" | "quarantine";

@Entity()
export class Pen {
  @PrimaryColumn()
  id: string;

  @Column()
  name: string;

  @Column({ type: "varchar" })
  status: PenStatus;

  @Column()
  animalType: string;

  @Column({ type: "int" })
  animalCount: number;

  @Column({ nullable: true })
  lastVaccinationDate?: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => VaccinationPlan, (plan) => plan.pen)
  plans: VaccinationPlan[];

  @OneToMany(() => VaccinationRecord, (record) => record.pen)
  records: VaccinationRecord[];
}

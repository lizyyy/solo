import { Entity, PrimaryColumn, Column, ManyToOne, OneToMany, CreateDateColumn, UpdateDateColumn, JoinColumn } from "typeorm";
import { VaccinationPlan } from "./VaccinationPlan";
import { VaccinationRecord } from "./VaccinationRecord";

export type BatchStatus = "pending" | "in_progress" | "completed" | "cancelled";

@Entity()
export class Batch {
  @PrimaryColumn()
  id: string;

  @Column()
  batchNumber: string;

  @Column()
  vaccineName: string;

  @Column()
  manufacturer: string;

  @Column({ type: "date" })
  productionDate: Date;

  @Column({ type: "date" })
  expiryDate: Date;

  @Column({ type: "int" })
  quantity: number;

  @Column({ type: "int", default: 0 })
  usedQuantity: number;

  @Column({ type: "varchar" })
  status: BatchStatus;

  @Column()
  planId: string;

  @ManyToOne(() => VaccinationPlan, (plan) => plan.batches)
  @JoinColumn({ name: "planId" })
  plan: VaccinationPlan;

  @OneToMany(() => VaccinationRecord, (record) => record.batch)
  records: VaccinationRecord[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

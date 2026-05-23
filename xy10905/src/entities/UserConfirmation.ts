import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { CompensationPlan } from "./CompensationPlan";

export type ConfirmationStatus = "pending" | "confirmed" | "rejected";

@Entity()
export class UserConfirmation {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  idempotencyKey: string;

  @Column()
  userId: string;

  @Column()
  userName: string;

  @OneToOne(() => CompensationPlan, (plan) => plan.userConfirmation)
  @JoinColumn({ name: "compensationPlanId" })
  compensationPlan: CompensationPlan;

  @Column()
  compensationPlanId: string;

  @Column({
    type: "text",
    default: "pending",
  })
  status: ConfirmationStatus;

  @Column({ type: "datetime", nullable: true })
  confirmedAt: Date;

  @Column({ type: "text", nullable: true })
  userRemark: string;

  @Column({ type: "text", nullable: true })
  operatorRemark: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

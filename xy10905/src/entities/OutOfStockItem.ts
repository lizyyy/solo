import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { GroupBuyBatch } from "./GroupBuyBatch";
import { CompensationPlan } from "./CompensationPlan";
import { StatusHistory } from "./StatusHistory";

export type OutOfStockStatus = "pending" | "allocating" | "user_confirming" | "confirmed" | "completed" | "cancelled";

@Entity()
export class OutOfStockItem {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  productId: string;

  @Column()
  productName: string;

  @Column("int")
  orderedQuantity: number;

  @Column("int")
  availableQuantity: number;

  @Column("int")
  outOfStockQuantity: number;

  @Column("decimal", { precision: 10, scale: 2 })
  unitPrice: number;

  @Column("decimal", { precision: 10, scale: 2 })
  outOfStockAmount: number;

  @ManyToOne(() => GroupBuyBatch, (batch) => batch.outOfStockItems)
  @JoinColumn({ name: "batchId" })
  batch: GroupBuyBatch;

  @Column()
  batchId: string;

  @Column({
    type: "text",
    default: "pending",
  })
  status: OutOfStockStatus;

  @OneToMany(() => CompensationPlan, (plan) => plan.outOfStockItem)
  compensationPlans: CompensationPlan[];

  @OneToMany(() => StatusHistory, (history) => history.outOfStockItem)
  statusHistories: StatusHistory[];

  @Column({ type: "text", nullable: true })
  remark: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

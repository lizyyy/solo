import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToOne, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { OutOfStockItem } from "./OutOfStockItem";
import { UserConfirmation } from "./UserConfirmation";

export type CompensationType = "refund" | "exchange" | "points";

@Entity()
export class CompensationPlan {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  orderItemId: string;

  @Column()
  orderNo: string;

  @Column()
  userId: string;

  @Column()
  userName: string;

  @Column("int")
  outOfStockQuantity: number;

  @Column("decimal", { precision: 10, scale: 2 })
  outOfStockAmount: number;

  @Column({
    type: "text",
  })
  compensationType: CompensationType;

  @Column("decimal", { precision: 10, scale: 2, nullable: true })
  refundAmount: number;

  @Column({ nullable: true })
  exchangeProductId: string;

  @Column({ nullable: true })
  exchangeProductName: string;

  @Column("int", { nullable: true })
  exchangeQuantity: number;

  @Column("decimal", { precision: 10, scale: 2, nullable: true })
  exchangePrice: number;

  @Column("int", { nullable: true })
  pointsAmount: number;

  @ManyToOne(() => OutOfStockItem, (item) => item.compensationPlans)
  @JoinColumn({ name: "outOfStockItemId" })
  outOfStockItem: OutOfStockItem;

  @Column()
  outOfStockItemId: string;

  @Column({ default: false })
  isAllocated: boolean;

  @OneToOne(() => UserConfirmation, (confirmation) => confirmation.compensationPlan)
  userConfirmation: UserConfirmation;

  @Column({ type: "text", nullable: true })
  remark: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

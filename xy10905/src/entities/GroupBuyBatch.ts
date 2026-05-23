import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { OrderItem } from "./OrderItem";
import { OutOfStockItem } from "./OutOfStockItem";

export type BatchStatus = "active" | "closed" | "settled";

@Entity()
export class GroupBuyBatch {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  batchNo: string;

  @Column()
  name: string;

  @Column({ type: "datetime" })
  startDate: Date;

  @Column({ type: "datetime" })
  endDate: Date;

  @Column({
    type: "text",
    default: "active",
  })
  status: BatchStatus;

  @Column({ type: "text", nullable: true })
  description: string;

  @OneToMany(() => OrderItem, (orderItem) => orderItem.batch)
  orderItems: OrderItem[];

  @OneToMany(() => OutOfStockItem, (outOfStockItem) => outOfStockItem.batch)
  outOfStockItems: OutOfStockItem[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

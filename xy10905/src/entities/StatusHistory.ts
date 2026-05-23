import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from "typeorm";
import { OutOfStockItem } from "./OutOfStockItem";

@Entity()
export class StatusHistory {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @ManyToOne(() => OutOfStockItem, (item) => item.statusHistories)
  @JoinColumn({ name: "outOfStockItemId" })
  outOfStockItem: OutOfStockItem;

  @Column()
  outOfStockItemId: string;

  @Column()
  fromStatus: string;

  @Column()
  toStatus: string;

  @Column({ type: "text", nullable: true })
  reason: string;

  @Column({ nullable: true })
  operatorId: string;

  @Column({ nullable: true })
  operatorName: string;

  @CreateDateColumn()
  changedAt: Date;
}

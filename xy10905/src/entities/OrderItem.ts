import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { GroupBuyBatch } from "./GroupBuyBatch";

@Entity()
export class OrderItem {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  orderNo: string;

  @Column()
  userId: string;

  @Column()
  userName: string;

  @Column()
  productId: string;

  @Column()
  productName: string;

  @Column("decimal", { precision: 10, scale: 2 })
  price: number;

  @Column("int")
  quantity: number;

  @Column("decimal", { precision: 10, scale: 2 })
  totalAmount: number;

  @ManyToOne(() => GroupBuyBatch, (batch) => batch.orderItems)
  @JoinColumn({ name: "batchId" })
  batch: GroupBuyBatch;

  @Column()
  batchId: string;

  @Column({ type: "text", nullable: true })
  remark: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

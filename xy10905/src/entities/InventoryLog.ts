import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

export type InventoryOperationType = "write_back" | "adjust" | "reserve" | "release";

@Entity()
export class InventoryLog {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  productId: string;

  @Column()
  productName: string;

  @Column()
  batchId: string;

  @Column({
    type: "text",
  })
  operationType: InventoryOperationType;

  @Column("int")
  quantity: number;

  @Column("int")
  previousQuantity: number;

  @Column("int")
  newQuantity: number;

  @Column({ type: "text", nullable: true })
  referenceId: string;

  @Column({ type: "text", nullable: true })
  remark: string;

  @Column({ nullable: true })
  operatorId: string;

  @Column({ nullable: true })
  operatorName: string;

  @CreateDateColumn()
  createdAt: Date;
}

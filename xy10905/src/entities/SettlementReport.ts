import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from "typeorm";

@Entity()
export class SettlementReport {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  batchId: string;

  @Column()
  batchNo: string;

  @Column()
  reportNo: string;

  @Column("int")
  totalOutOfStockItems: number;

  @Column("int")
  totalCompensatedItems: number;

  @Column("decimal", { precision: 12, scale: 2 })
  totalRefundAmount: number;

  @Column("int")
  totalPointsAmount: number;

  @Column("int")
  totalExchangeItems: number;

  @Column("int")
  confirmedCount: number;

  @Column("int")
  pendingCount: number;

  @Column("int")
  rejectedCount: number;

  @Column({ type: "text", nullable: true })
  generatedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: "text", nullable: true })
  filePath: string;
}

import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from "typeorm";

export type WordCategory = "profanity" | "discrimination" | "fraud" | "privacy" | "other";

@Entity()
export class SensitiveWord {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ unique: true })
  @Index()
  word!: string;

  @Column({ type: "varchar", default: "other" })
  category!: WordCategory;

  @Column({ type: "integer", default: 1 })
  severity!: number;

  @Column({ type: "boolean", default: true })
  isActive!: boolean;

  @Column({ type: "text", nullable: true })
  description?: string;

  @Column({ type: "text", nullable: true })
  suggestion?: string;

  @Column()
  batchId!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

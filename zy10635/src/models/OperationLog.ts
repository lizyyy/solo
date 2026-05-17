import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity()
export class OperationLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  entityType: string;

  @Column()
  entityId: number;

  @Column()
  operation: string;

  @Column({ type: 'simple-json', nullable: true })
  oldValue: Record<string, any>;

  @Column({ type: 'simple-json', nullable: true })
  newValue: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  remark: string;

  @Column()
  operator: string;

  @CreateDateColumn()
  createdAt: Date;
}
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import { EntityType } from './enums';

@Entity()
@Index(['entityType', 'entityId'])
export class ModificationLog {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    type: 'simple-enum',
    enum: EntityType,
  })
  entityType!: EntityType;

  @Column()
  entityId!: number;

  @Column()
  fieldName!: string;

  @Column({ type: 'text', nullable: true })
  oldValue?: string;

  @Column({ type: 'text', nullable: true })
  newValue?: string;

  @Column({ nullable: true })
  modifiedBy?: string;

  @Column({ type: 'text', nullable: true })
  reason?: string;

  @Column({ type: 'text', nullable: true })
  clientIp?: string;

  @Column({ type: 'text', nullable: true })
  userAgent?: string;

  @Column({ type: 'text', nullable: true })
  extraMetadata?: string;

  @CreateDateColumn()
  modifiedAt!: Date;
}

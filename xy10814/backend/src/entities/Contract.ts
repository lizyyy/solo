import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { ResponseScene } from './ResponseScene';
import { ReplayHistory } from './ReplayHistory';

@Entity()
export class Contract {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ unique: true })
  path!: string;

  @Column({ default: 'GET' })
  method!: string;

  @Column('text', { nullable: true })
  description!: string;

  @Column('simple-json', { nullable: true })
  requestSchema!: Record<string, any>;

  @Column('simple-json', { nullable: true })
  responseSchema!: Record<string, any>;

  @Column({ default: true })
  isActive!: boolean;

  @Column({ default: 'production' })
  environment!: string;

  @OneToMany(() => ResponseScene, scene => scene.contract, { cascade: true })
  scenes!: ResponseScene[];

  @OneToMany(() => ReplayHistory, history => history.contract)
  replayHistories!: ReplayHistory[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

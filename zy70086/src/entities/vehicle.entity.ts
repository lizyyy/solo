import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum VehicleStatus {
  IDLE = '空闲',
  DISPATCHED = '已调度',
  ON_ROUTE = '行驶中',
  LOADING = '装载中',
  RETURNING = '返程中',
  MAINTENANCE = '维护中',
}

@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ comment: '车牌号' })
  plateNumber!: string;

  @Column({ comment: '车辆型号' })
  model!: string;

  @Column({ type: 'int', comment: '载重上限（千克）' })
  maxLoadWeight!: number;

  @Column({ type: 'int', default: 0, comment: '当前载重（千克）' })
  currentLoadWeight!: number;

  @Column({ comment: '司机姓名' })
  driverName!: string;

  @Column({ comment: '司机联系电话' })
  driverPhone!: string;

  @Column({
    type: 'simple-enum',
    enum: VehicleStatus,
    default: VehicleStatus.IDLE,
    comment: '车辆状态',
  })
  status!: VehicleStatus;

  @Column({ type: 'varchar', nullable: true, comment: '当前所在位置' })
  currentLocation!: string | null;

  @Column({ type: 'varchar', nullable: true, comment: '备注' })
  remark!: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

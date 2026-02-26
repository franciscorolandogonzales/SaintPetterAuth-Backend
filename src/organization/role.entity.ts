import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { OrganizationEntity } from './organization.entity';
import { PermissionEntity } from './permission.entity';

@Entity('roles')
export class RoleEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Null for global roles (e.g. platform_admin). */
  @Column('uuid', { nullable: true })
  organizationId!: string | null;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'organizationId' })
  organization!: OrganizationEntity | null;

  @Column()
  name!: string;

  @Column()
  slug!: string;

  @OneToMany(() => PermissionEntity, (p) => p.role)
  permissions!: PermissionEntity[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export type OneTimeLinkKind =
  | 'password_reset'
  | 'email_verification'
  | 'invitation'
  | 'mfa_setup'
  | 'mfa_recovery';

@Entity('one_time_links')
export class OneTimeLinkEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Cryptographically secure random token included in the URL. */
  @Column({ unique: true, type: 'varchar', length: 128 })
  token!: string;

  /** Event kind that this link represents. */
  @Column({ type: 'varchar', length: 32 })
  kind!: OneTimeLinkKind;

  /** User this link is for (nullable for invitation to non-existing users). */
  @Column({ type: 'uuid', nullable: true })
  userId!: string | null;

  /** Arbitrary JSON payload (e.g. organizationId, email, roleSlug). */
  @Column({ type: 'jsonb', nullable: true })
  payload!: Record<string, unknown> | null;

  @Column({ type: 'timestamp' })
  expiresAt!: Date;

  /** Set on first successful consumption; null means the link has not been used. */
  @Column({ type: 'timestamp', nullable: true })
  usedAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;
}

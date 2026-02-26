import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

/**
 * Persisted entry in the Google OAuth redirect URI allow list.
 * Each URI is scoped to an organization; only that org's admin can manage it.
 * Comparison against the incoming redirect_uri is always exact (no wildcards).
 * The effective global allow list = FRONTEND_URL + GOOGLE_ALLOWED_REDIRECT_URIS env + all rows here.
 */
@Entity('allowed_redirect_uris')
export class AllowedRedirectUriEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  organizationId!: string;

  @Column()
  uri!: string;

  @CreateDateColumn()
  createdAt!: Date;
}

/** Shared permission definitions for default roles. Exported so they can be
 *  reused by both the bootstrap seed and the org-provisioning service. */

export const ORG_ADMIN_PERMISSIONS: { action: string; resourceIdentifier: string }[] = [
  { action: 'read', resourceIdentifier: 'auth:organization' },
  { action: 'update', resourceIdentifier: 'auth:organization' },
  { action: 'read', resourceIdentifier: 'auth:user' },
  { action: 'create', resourceIdentifier: 'auth:user' },
  { action: 'create', resourceIdentifier: 'auth:service_account' },
  { action: 'read', resourceIdentifier: 'auth:service_account' },
  { action: 'delete', resourceIdentifier: 'auth:service_account' },
  { action: 'create', resourceIdentifier: 'auth:redirect_uri' },
  { action: 'read', resourceIdentifier: 'auth:redirect_uri' },
  { action: 'delete', resourceIdentifier: 'auth:redirect_uri' },
  { action: 'create', resourceIdentifier: 'auth:resource' },
  { action: 'read', resourceIdentifier: 'auth:resource' },
  { action: 'delete', resourceIdentifier: 'auth:resource' },
  { action: 'create', resourceIdentifier: 'auth:role' },
  { action: 'read', resourceIdentifier: 'auth:role' },
  { action: 'create', resourceIdentifier: 'auth:permission' },
  { action: 'read', resourceIdentifier: 'auth:permission' },
];

export const MEMBER_PERMISSIONS: { action: string; resourceIdentifier: string }[] = [
  { action: 'read', resourceIdentifier: 'auth:organization' },
  { action: 'read', resourceIdentifier: 'auth:user' },
  { action: 'read', resourceIdentifier: 'auth:resource' },
  { action: 'read', resourceIdentifier: 'auth:role' },
  { action: 'read', resourceIdentifier: 'auth:permission' },
  { action: 'read', resourceIdentifier: 'auth:redirect_uri' },
];

/** End users created by third-party apps: can only manage their own MFA and password. */
export const END_USER_PERMISSIONS: { action: string; resourceIdentifier: string }[] = [
  { action: 'update', resourceIdentifier: 'auth:mfa' },
  { action: 'read', resourceIdentifier: 'auth:mfa' },
  { action: 'update', resourceIdentifier: 'auth:password' },
];

export const ORG_ROLE_TEMPLATES: {
  slug: string;
  name: string;
  permissions: { action: string; resourceIdentifier: string }[];
}[] = [
  { slug: 'org_admin', name: 'Org Admin', permissions: ORG_ADMIN_PERMISSIONS },
  { slug: 'member', name: 'Member', permissions: MEMBER_PERMISSIONS },
  { slug: 'end_user', name: 'End User', permissions: END_USER_PERMISSIONS },
];

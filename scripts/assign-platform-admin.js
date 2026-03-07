#!/usr/bin/env node
/**
 * Asigna el rol platform_admin a un usuario por email.
 * Uso: node scripts/assign-platform-admin.js <email>
 *      SPA_POSTGRES_URL=... node scripts/assign-platform-admin.js <email>
 * Requiere: variable de entorno SPA_POSTGRES_URL (o POSTGRES_URL) o un .env en backend/.
 */

const { readFileSync, existsSync } = require('fs');
const { resolve } = require('path');
const { Client } = require('pg');

function loadEnv() {
  const envPath = resolve(__dirname, '..', '.env');
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) {
      const key = m[1];
      const val = m[2].replace(/^["']|["']$/g, '').trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

loadEnv();

const email = process.argv[2] || process.env.SPA_PLATFORM_ADMIN_EMAIL;
const postgresUrl = process.env.SPA_POSTGRES_URL || process.env.POSTGRES_URL;

if (!email) {
  console.error('Uso: node scripts/assign-platform-admin.js <email>');
  console.error('  o define SPA_PLATFORM_ADMIN_EMAIL y ejecuta sin argumentos.');
  process.exit(1);
}

if (!postgresUrl) {
  console.error('Define SPA_POSTGRES_URL o POSTGRES_URL (o crea backend/.env).');
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString: postgresUrl });
  await client.connect();

  const userRes = await client.query(
    'SELECT id FROM users WHERE email = $1 AND type = $2',
    [email, 'human']
  );
  if (userRes.rows.length === 0) {
    console.error(`Usuario no encontrado con email: ${email}`);
    console.error('Haz login al menos una vez con ese correo y vuelve a ejecutar.');
    await client.end();
    process.exit(1);
  }
  const userId = userRes.rows[0].id;

  const roleRes = await client.query(
    'SELECT id FROM roles WHERE slug = $1 AND "organizationId" IS NULL',
    ['platform_admin']
  );
  if (roleRes.rows.length === 0) {
    console.error('Rol platform_admin no encontrado. ¿Levantaste el backend al menos una vez para ejecutar el seed?');
    await client.end();
    process.exit(1);
  }
  const roleId = roleRes.rows[0].id;

  const existing = await client.query(
    'SELECT id FROM user_roles WHERE "userId" = $1 AND "roleId" = $2',
    [userId, roleId]
  );
  if (existing.rows.length > 0) {
    console.log(`El usuario ${email} ya tiene el rol platform_admin.`);
    await client.end();
    return;
  }

  await client.query(
    'INSERT INTO user_roles (id, "userId", "roleId") VALUES (gen_random_uuid(), $1, $2)',
    [userId, roleId]
  );
  console.log(`Rol platform_admin asignado a ${email}. Ya puedes acceder a la consola de gestión.`);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

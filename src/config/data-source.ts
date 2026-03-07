import { DataSource } from 'typeorm';

export default new DataSource({
  type: 'postgres',
  url: process.env.SPA_POSTGRES_URL ?? process.env.POSTGRES_URL,
  synchronize: false,
  entities: ['dist/**/*.entity.js'],
  migrations: ['dist/migrations/*.js'],
});

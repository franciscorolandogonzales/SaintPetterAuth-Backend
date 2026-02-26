export const getDatabaseConfig = () => ({
  type: 'postgres' as const,
  url: process.env.POSTGRES_URL,
  autoLoadEntities: true,
  synchronize: process.env.NODE_ENV !== 'production',
});

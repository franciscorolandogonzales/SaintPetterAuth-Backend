export const getDatabaseConfig = () => {
  // #region agent log
  const url = process.env.SPA_POSTGRES_URL ?? process.env.POSTGRES_URL;
  fetch('http://127.0.0.1:7242/ingest/bbfc576d-0bb4-453e-b278-dfbcda626b27',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'e57b5c'},body:JSON.stringify({sessionId:'e57b5c',runId:'run1',hypothesisId:'H4',location:'database.config.ts:getDatabaseConfig',message:'backend_db_config',data:{postgresUrlSet:!!url,postgresUrlLength:url?.length??0,postgresUser:process.env.SPA_POSTGRES_USER,urlHasAt:url?.includes('@')??false,urlHasColon:url?.includes(':')??false},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const isProduction = process.env.NODE_ENV === 'production';
  const useDbSyncDisabled = (process.env.SPA_USE_DB_SYNC ?? process.env.USE_DB_SYNC) === 'false';
  const synchronize = !isProduction && !useDbSyncDisabled;
  return {
    type: 'postgres' as const,
    url,
    autoLoadEntities: true,
    synchronize,
  };
};

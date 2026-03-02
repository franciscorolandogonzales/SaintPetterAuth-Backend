import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllowedRedirectUriRepository } from './allowed-redirect-uri.repository';

/**
 * Manages the allow list of redirect URIs permitted for third-party Google OAuth callbacks.
 *
 * The effective allow list = FRONTEND_URL (always) + GOOGLE_ALLOWED_REDIRECT_URIS env
 *                          + all rows in the `allowed_redirect_uris` table.
 *
 * The list is cached in memory so that `isAllowed()` stays synchronous (required by
 * GoogleAuthGuard). Call `refresh()` after any mutation of the DB table to keep the
 * cache up to date.
 *
 * Security notes:
 *   - Comparison is exact (no prefix or wildcard matching) to prevent bypass attacks.
 *   - Never log full redirect URIs during validation (may contain sensitive query params).
 */
@Injectable()
export class RedirectAllowlistService implements OnModuleInit {
  private allowedUris: Set<string> = new Set();
  private readonly defaultUrl: string;
  private readonly envUris: string[];

  constructor(
    private readonly config: ConfigService,
    private readonly allowedRedirectUriRepo: AllowedRedirectUriRepository,
  ) {
    this.defaultUrl = config.get<string>('FRONTEND_URL') ?? 'http://localhost:5678';

    const rawList = config.get<string>('GOOGLE_ALLOWED_REDIRECT_URIS') ?? '';
    this.envUris = rawList
      .split(',')
      .map((u) => u.trim())
      .filter((u) => u.length > 0);

    // Populate with env values immediately so the service is usable even before onModuleInit
    this.allowedUris = new Set([this.defaultUrl, ...this.envUris]);
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.refresh();
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/bbfc576d-0bb4-453e-b278-dfbcda626b27',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'redirect-allowlist.service.ts:onModuleInit:success',message:'allowlist loaded from DB',hypothesisId:'H5',data:{allowedCount:this.allowedUris.size,uris:Array.from(this.allowedUris)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
    } catch (err) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/bbfc576d-0bb4-453e-b278-dfbcda626b27',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'redirect-allowlist.service.ts:onModuleInit:error',message:'refresh() failed on module init',hypothesisId:'H5',data:{error:String(err)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      // Don't rethrow; fall back to env-only allowlist
    }
  }

  /**
   * Reloads the allow list from DB + env. Call after any insert or delete on
   * the `allowed_redirect_uris` table so the cache stays consistent.
   */
  async refresh(): Promise<void> {
    const dbEntities = await this.allowedRedirectUriRepo.findAll();
    const dbUris = dbEntities.map((e) => e.uri);
    this.allowedUris = new Set([this.defaultUrl, ...this.envUris, ...dbUris]);
  }

  /**
   * Returns true if the given URI is in the configured allow list.
   * Synchronous — reads only from the in-memory cache.
   */
  isAllowed(uri: string): boolean {
    return this.allowedUris.has(uri);
  }

  /**
   * Returns the default redirect base URL (FRONTEND_URL).
   */
  getDefaultUrl(): string {
    return this.defaultUrl;
  }
}

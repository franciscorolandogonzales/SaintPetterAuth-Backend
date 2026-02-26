import Handlebars from 'handlebars';

export interface CompiledTemplate {
  subject: string;
  renderHtml: Handlebars.TemplateDelegate;
  renderText: Handlebars.TemplateDelegate;
}

export interface RenderedTemplate {
  subject: string;
  html: string;
  text: string;
}

interface TemplateDefinition {
  subject: string;
  html: string;
  text: string;
}

const TEMPLATES: Record<string, TemplateDefinition> = {
  'password-reset': {
    subject: 'Reset your password — SaintPetter Auth',
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h2>Reset your password</h2>
  <p>You requested a password reset for your SaintPetter Auth account.</p>
  <p>Click the link below to set a new password. This link expires in 1 hour.</p>
  <p style="margin: 24px 0;">
    <a href="{{resetLink}}" style="background:#1a1a1a;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;">
      Reset password
    </a>
  </p>
  <p style="color:#666;font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
  <p style="color:#666;font-size:13px;">Link: {{resetLink}}</p>
</body>
</html>
    `.trim(),
    text: `Reset your password — SaintPetter Auth

You requested a password reset. Click the link below (expires in 1 hour):

{{resetLink}}

If you didn't request this, ignore this email.`,
  },

  'email-verification': {
    subject: 'Verify your email — SaintPetter Auth',
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h2>Verify your email address</h2>
  <p>Thanks for signing up to SaintPetter Auth. Please verify your email address to complete registration.</p>
  <p style="margin: 24px 0;">
    <a href="{{verificationLink}}" style="background:#1a1a1a;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;">
      Verify email
    </a>
  </p>
  <p style="color:#666;font-size:13px;">This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.</p>
  <p style="color:#666;font-size:13px;">Link: {{verificationLink}}</p>
</body>
</html>
    `.trim(),
    text: `Verify your email — SaintPetter Auth

Thanks for signing up. Please verify your email address (link expires in 24 hours):

{{verificationLink}}

If you didn't create an account, ignore this email.`,
  },

  'new-login-alert': {
    subject: 'New login to your account — SaintPetter Auth',
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h2>New login detected</h2>
  <p>A new login was detected on your SaintPetter Auth account.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0;">
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Date</td>
      <td style="padding:8px;border-bottom:1px solid #eee;">{{loginDate}}</td>
    </tr>
    {{#if ipAddress}}
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;color:#666;">IP address</td>
      <td style="padding:8px;border-bottom:1px solid #eee;">{{ipAddress}}</td>
    </tr>
    {{/if}}
    {{#if userAgent}}
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee;color:#666;">Device</td>
      <td style="padding:8px;border-bottom:1px solid #eee;">{{userAgent}}</td>
    </tr>
    {{/if}}
  </table>
  <p style="color:#666;font-size:13px;">If this wasn't you, please change your password immediately.</p>
</body>
</html>
    `.trim(),
    text: `New login detected — SaintPetter Auth

A new login was detected on your account.

Date: {{loginDate}}
{{#if ipAddress}}IP: {{ipAddress}}{{/if}}
{{#if userAgent}}Device: {{userAgent}}{{/if}}

If this wasn't you, please change your password immediately.`,
  },

  'mfa-change': {
    subject: 'Two-factor authentication changed — SaintPetter Auth',
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
  <h2>Two-factor authentication changed</h2>
  <p>Your two-factor authentication settings were changed on your SaintPetter Auth account.</p>
  <p><strong>Change:</strong> {{changeDescription}}</p>
  <p><strong>Date:</strong> {{changeDate}}</p>
  <p style="color:#666;font-size:13px;">If you didn't make this change, please contact support and change your password immediately.</p>
</body>
</html>
    `.trim(),
    text: `Two-factor authentication changed — SaintPetter Auth

Your 2FA settings were changed.

Change: {{changeDescription}}
Date: {{changeDate}}

If you didn't make this change, please contact support and change your password immediately.`,
  },
};

export class TemplateRegistry {
  private readonly compiled = new Map<string, CompiledTemplate>();

  constructor() {
    for (const [key, def] of Object.entries(TEMPLATES)) {
      this.compiled.set(key, {
        subject: def.subject,
        renderHtml: Handlebars.compile(def.html),
        renderText: Handlebars.compile(def.text),
      });
    }
  }

  render(templateKey: string, data: Record<string, unknown>): RenderedTemplate {
    const tmpl = this.compiled.get(templateKey);
    if (!tmpl) {
      throw new Error(`Notification template not found: "${templateKey}"`);
    }
    return {
      subject: tmpl.subject,
      html: tmpl.renderHtml(data),
      text: tmpl.renderText(data),
    };
  }

  has(templateKey: string): boolean {
    return this.compiled.has(templateKey);
  }
}

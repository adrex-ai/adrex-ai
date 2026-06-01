import { google } from "googleapis";
import crypto from "crypto";
import http from "http";
import open from "open";
import { URL } from "url";

const SCOPES = ["https://www.googleapis.com/auth/adwords"];

export interface GoogleAdsCredentials {
  clientId: string;
  clientSecret: string;
  developerToken: string;
  refreshToken?: string;
  loginCustomerId?: string;
}

let cachedCredentials: GoogleAdsCredentials | null = null;

export function loadGoogleAdsCredentials(): GoogleAdsCredentials {
  if (cachedCredentials) return cachedCredentials;

  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
  const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;

  if (!clientId || !clientSecret || !developerToken) {
    throw new Error(
      "Missing Google Ads credentials. Set GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, and GOOGLE_ADS_DEVELOPER_TOKEN environment variables."
    );
  }

  cachedCredentials = {
    clientId,
    clientSecret,
    developerToken,
    refreshToken,
    loginCustomerId,
  };
  return cachedCredentials;
}

export async function startGoogleOAuthFlow(
  clientId: string,
  clientSecret: string
): Promise<string> {
  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    "http://localhost:9876/callback"
  );

  // CSRF protection: a random state must round-trip through the OAuth provider.
  const state = crypto.randomBytes(16).toString("hex");

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
    state,
  });

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      if (!req.url?.startsWith("/callback")) return;

      const url = new URL(req.url, "http://localhost:9876");
      const code = url.searchParams.get("code");

      if (url.searchParams.get("state") !== state) {
        res.writeHead(400);
        res.end("Invalid OAuth state — request rejected.");
        server.close();
        reject(new Error("OAuth state mismatch — possible CSRF, request rejected"));
        return;
      }

      if (!code) {
        res.writeHead(400);
        res.end("No authorization code received.");
        server.close();
        reject(new Error("No authorization code received"));
        return;
      }

      try {
        const { tokens } = await oauth2Client.getToken(code);
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(
          "<html><body><h2>Adrex AI - Google Ads Connected!</h2><p>You can close this window.</p></body></html>"
        );
        server.close();
        resolve(tokens.refresh_token!);
      } catch (err) {
        res.writeHead(500);
        res.end("Failed to exchange authorization code.");
        server.close();
        reject(err);
      }
    });

    server.listen(9876, () => {
      open(authUrl);
    });

    setTimeout(() => {
      server.close();
      reject(new Error("OAuth flow timed out after 120 seconds"));
    }, 120_000);
  });
}

export function isGoogleAdsConfigured(): boolean {
  return !!(
    process.env.GOOGLE_ADS_CLIENT_ID &&
    process.env.GOOGLE_ADS_CLIENT_SECRET &&
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN &&
    process.env.GOOGLE_ADS_REFRESH_TOKEN
  );
}

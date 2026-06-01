import http from "http";
import open from "open";
import { URL } from "url";

const META_GRAPH_URL = "https://graph.facebook.com/v21.0";

export interface MetaAdsCredentials {
  appId: string;
  appSecret: string;
  accessToken?: string;
}

let cachedCredentials: MetaAdsCredentials | null = null;

export function loadMetaAdsCredentials(): MetaAdsCredentials {
  if (cachedCredentials) return cachedCredentials;

  const appId = process.env.META_ADS_APP_ID;
  const appSecret = process.env.META_ADS_APP_SECRET;
  const accessToken = process.env.META_ADS_ACCESS_TOKEN;

  if (!appId || !appSecret) {
    throw new Error(
      "Missing Meta Ads credentials. Set META_ADS_APP_ID and META_ADS_APP_SECRET environment variables."
    );
  }

  cachedCredentials = { appId, appSecret, accessToken };
  return cachedCredentials;
}

export async function exchangeForLongLivedToken(
  shortLivedToken: string,
  appId: string,
  appSecret: string
): Promise<string> {
  const url = `${META_GRAPH_URL}/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${shortLivedToken}`;

  const response = await fetch(url);
  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `Failed to exchange token: ${error.error?.message || response.statusText}`
    );
  }

  const data = await response.json();
  return data.access_token;
}

export async function startMetaOAuthFlow(
  appId: string,
  appSecret: string
): Promise<string> {
  const redirectUri = "http://localhost:9877/callback";
  const scopes = "ads_management,ads_read,business_management";

  const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&response_type=code`;

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      if (!req.url?.startsWith("/callback")) return;

      const url = new URL(req.url, "http://localhost:9877");
      const code = url.searchParams.get("code");

      if (!code) {
        res.writeHead(400);
        res.end("No authorization code received.");
        server.close();
        reject(new Error("No authorization code received"));
        return;
      }

      try {
        const tokenUrl = `${META_GRAPH_URL}/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${code}`;
        const tokenResponse = await fetch(tokenUrl);
        const tokenData = await tokenResponse.json();

        if (!tokenResponse.ok) {
          throw new Error(
            tokenData.error?.message || "Failed to exchange code"
          );
        }

        const longLivedToken = await exchangeForLongLivedToken(
          tokenData.access_token,
          appId,
          appSecret
        );

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(
          "<html><body><h2>Adrex AI - Meta Ads Connected!</h2><p>You can close this window.</p></body></html>"
        );
        server.close();
        resolve(longLivedToken);
      } catch (err) {
        res.writeHead(500);
        res.end("Failed to complete authentication.");
        server.close();
        reject(err);
      }
    });

    server.listen(9877, () => {
      open(authUrl);
    });

    setTimeout(() => {
      server.close();
      reject(new Error("OAuth flow timed out after 120 seconds"));
    }, 120_000);
  });
}

export function isMetaAdsConfigured(): boolean {
  return !!(
    process.env.META_ADS_APP_ID &&
    process.env.META_ADS_APP_SECRET &&
    process.env.META_ADS_ACCESS_TOKEN
  );
}

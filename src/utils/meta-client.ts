/**
 * Shared Meta Graph API client.
 *
 * The access token is sent via the `Authorization: Bearer` header rather than a
 * query-string parameter, so it is never written into request URLs (which can
 * leak into server/proxy access logs).
 */

import { loadMetaAdsCredentials } from "../auth/meta-oauth.js";

const GRAPH_URL = "https://graph.facebook.com/v21.0";

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const creds = loadMetaAdsCredentials();
  if (!creds.accessToken) {
    throw new Error("Meta Ads access token not configured. Set META_ADS_ACCESS_TOKEN.");
  }
  return { Authorization: `Bearer ${creds.accessToken}`, ...extra };
}

async function parseError(response: Response): Promise<never> {
  let message = response.statusText;
  try {
    const error = await response.json();
    message = error.error?.message || message;
  } catch {
    // Non-JSON error body — fall back to status text.
  }
  throw new Error(message);
}

export async function metaGet(
  path: string,
  params: Record<string, string> = {}
): Promise<any> {
  const query = new URLSearchParams(params).toString();
  const url = `${GRAPH_URL}${path}${query ? `?${query}` : ""}`;
  const response = await fetch(url, { headers: authHeaders() });
  if (!response.ok) await parseError(response);
  return response.json();
}

export async function metaPost(
  path: string,
  body: Record<string, any> = {}
): Promise<any> {
  const response = await fetch(`${GRAPH_URL}${path}`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  if (!response.ok) await parseError(response);
  return response.json();
}

export async function metaDelete(path: string): Promise<any> {
  const response = await fetch(`${GRAPH_URL}${path}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!response.ok) await parseError(response);
  return response.json();
}

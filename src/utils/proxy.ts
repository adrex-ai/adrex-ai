const DEFAULT_API_URL = "https://api.adrex.ai/api/v1";

export interface AdrexProxyConfig {
  apiKey: string;
  apiUrl: string;
}

export function getProxyConfig(): AdrexProxyConfig | null {
  const apiKey = process.env.ADREX_API_KEY;
  if (!apiKey) return null;

  const apiUrl = process.env.ADREX_API_URL || DEFAULT_API_URL;
  return { apiKey, apiUrl };
}

export function isHostedMode(): boolean {
  return !!process.env.ADREX_API_KEY;
}

export async function proxyToolCall(
  config: AdrexProxyConfig,
  tool: string,
  params: Record<string, any>
): Promise<string> {
  const response = await fetch(`${config.apiUrl}/mcp/call`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": config.apiKey,
    },
    body: JSON.stringify({ tool, params }),
  });

  if (response.status === 401) {
    return "Invalid or expired API key. Generate a new one at https://adrex.ai/settings";
  }

  if (response.status === 429) {
    const data = await response.json();
    return data.detail || "Daily tool call limit reached. Upgrade at https://adrex.ai/pricing";
  }

  if (!response.ok) {
    const text = await response.text();
    return `Adrex API error (${response.status}): ${text}`;
  }

  const data = await response.json();

  if (!data.success) {
    return `Error: ${data.error}`;
  }

  return data.result;
}

export async function getProxyStatus(config: AdrexProxyConfig): Promise<any> {
  const response = await fetch(`${config.apiUrl}/mcp/status`, {
    headers: { "X-API-Key": config.apiKey },
  });

  if (!response.ok) {
    throw new Error(`Status check failed: ${response.statusText}`);
  }

  return response.json();
}

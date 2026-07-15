import postgres from "postgres";

const RENDER_API = "https://api.render.com/v1";
const NEON_API = "https://console.neon.tech/api/v2";

async function requestJson(
  url: string,
  init: RequestInit,
  timeoutMs = 20_000
): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    if (!response.ok)
      throw new Error(
        data?.message || data?.error || `HTTP ${response.status}`
      );
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getRenderService(apiKey: string, serviceId: string) {
  return requestJson(
    `${RENDER_API}/services/${encodeURIComponent(serviceId)}`,
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    }
  );
}

export async function syncRenderEnvironment(
  apiKey: string,
  serviceId: string,
  variables: Record<string, string>
) {
  return requestJson(
    `${RENDER_API}/services/${encodeURIComponent(serviceId)}/env-vars`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(
        Object.entries(variables).map(([key, value]) => ({ key, value }))
      ),
    }
  );
}

export async function triggerRenderDeploy(apiKey: string, serviceId: string) {
  return requestJson(
    `${RENDER_API}/services/${encodeURIComponent(serviceId)}/deploys`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ clearCache: "do_not_clear" }),
    }
  );
}

export async function getNeonProject(apiKey: string, projectId: string) {
  return requestJson(`${NEON_API}/projects/${encodeURIComponent(projectId)}`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
  });
}

export async function testDatabaseConnection(databaseUrl: string) {
  const client = postgres(databaseUrl, {
    max: 1,
    connect_timeout: 10,
    idle_timeout: 2,
    prepare: false,
  });
  try {
    const result = await client`select 1 as ok`;
    return result[0]?.ok === 1;
  } finally {
    await client.end({ timeout: 2 });
  }
}

export async function checkPublicHealth(publicUrl: string) {
  const url = `${publicUrl.replace(/\/+$/, "")}/health`;
  return requestJson(url, { headers: { Accept: "application/json" } }, 15_000);
}

export async function testAiProvider(
  provider: string,
  apiKey: string,
  baseUrl?: string
) {
  const normalized = provider.toLowerCase();
  if (normalized === "gemini") {
    const url = `${(baseUrl || "https://generativelanguage.googleapis.com/v1beta").replace(/\/+$/, "")}/models?key=${encodeURIComponent(apiKey)}`;
    await requestJson(url, { headers: { Accept: "application/json" } });
    return true;
  }
  const defaultUrl =
    normalized === "groq"
      ? "https://api.groq.com/openai/v1"
      : normalized === "deepseek"
        ? "https://api.deepseek.com"
        : "https://api.openai.com/v1";
  await requestJson(`${(baseUrl || defaultUrl).replace(/\/+$/, "")}/models`, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
  });
  return true;
}

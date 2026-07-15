import axios from "axios";

const EVOLUTION_URL = (process.env.EVOLUTION_API_URL || "").replace(/\/+$/, "");
const API_KEY = process.env.EVOLUTION_API_KEY || "";
const INSTANCE_NAME = process.env.EVOLUTION_INSTANCE_NAME || "bot-verticale";
const TIMEOUT_MS = Number(process.env.EVOLUTION_TIMEOUT_MS || 15_000);

export async function sendEvolutionText(phoneNumber: string, text: string) {
  if (!EVOLUTION_URL || !API_KEY)
    throw new Error("Evolution API não configurada");
  const number = phoneNumber.replace(/\D/g, "");
  if (!number) throw new Error("Número de destino ausente");
  const response = await axios.post(
    `${EVOLUTION_URL}/message/sendText/${INSTANCE_NAME}`,
    { number, text },
    { headers: { apikey: API_KEY }, timeout: TIMEOUT_MS }
  );
  const externalMessageId =
    response.data?.key?.id ||
    response.data?.message?.key?.id ||
    response.data?.id;
  return {
    payload: response.data,
    externalMessageId:
      typeof externalMessageId === "string" ? externalMessageId : undefined,
  };
}

export function summarizeDeliveryHealth(records: any[], nowMs = Date.now()) {
  const outbound = records
    .filter(message => message?.key?.fromMe)
    .sort(
      (a, b) =>
        Number(b.messageTimestamp || 0) - Number(a.messageTimestamp || 0)
    )
    .slice(0, 20);
  const statusOf = (message: any) => {
    const updates = Array.isArray(message.MessageUpdate)
      ? message.MessageUpdate
      : [];
    return String(
      updates.at(-1)?.status || message.status || "PENDING"
    ).toUpperCase();
  };
  const historicalStatuses = outbound.map(statusOf);
  const recentCutoff = Math.floor(nowMs / 1000) - 24 * 60 * 60;
  const recent = outbound.filter(
    message => Number(message.messageTimestamp || 0) >= recentCutoff
  );
  const recentStatuses = recent.map(statusOf);
  const isError = (status: string) => ["ERROR", "FAILED"].includes(status);
  const isDelivered = (status: string) =>
    ["DELIVERY_ACK", "READ", "PLAYED"].includes(status);
  const isPending = (status: string) =>
    ["PENDING", "SERVER_ACK"].includes(status);
  const errors = recentStatuses.filter(isError).length;
  return {
    checked: recent.length,
    errors,
    delivered: recentStatuses.filter(isDelivered).length,
    pending: recentStatuses.filter(isPending).length,
    latestStatus: recentStatuses[0] || "NO_RECENT_MESSAGES",
    latestActivityAt: outbound[0]?.messageTimestamp
      ? new Date(Number(outbound[0].messageTimestamp) * 1000).toISOString()
      : null,
    historicalChecked: outbound.length,
    historicalErrors: historicalStatuses.filter(isError).length,
    windowHours: 24,
    healthy: errors === 0,
  };
}

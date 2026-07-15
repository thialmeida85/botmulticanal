import { describe, expect, it } from "vitest";
import { summarizeDeliveryHealth } from "./evolution";

const now = Date.UTC(2026, 6, 15, 18, 0, 0);
const record = (hoursAgo: number, status: string) => ({
  key: { fromMe: true },
  messageTimestamp: Math.floor((now - hoursAgo * 3_600_000) / 1000),
  MessageUpdate: [{ status }],
});

describe("Evolution delivery health", () => {
  it("keeps old failures as history without marking the current state as failed", () => {
    const result = summarizeDeliveryHealth(
      [record(30, "ERROR"), record(48, "ERROR"), record(72, "DELIVERY_ACK")],
      now
    );
    expect(result.errors).toBe(0);
    expect(result.checked).toBe(0);
    expect(result.historicalErrors).toBe(2);
    expect(result.healthy).toBe(true);
    expect(result.latestStatus).toBe("NO_RECENT_MESSAGES");
  });

  it("reports a real failure inside the 24 hour window", () => {
    const result = summarizeDeliveryHealth(
      [record(2, "ERROR"), record(3, "DELIVERY_ACK")],
      now
    );
    expect(result.checked).toBe(2);
    expect(result.errors).toBe(1);
    expect(result.delivered).toBe(1);
    expect(result.healthy).toBe(false);
  });
});

import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { notify, outboxTransport, type Notification } from "./notifier.server";

const raised: Notification = {
  workflow: "refund-request-raised",
  recipients: [{ id: "7", name: "Pat Admin" }],
  data: {
    buyerName: "Liam",
    courseTitle: "Test Course",
    link: "/admin/refunds",
  },
};

describe("notify", () => {
  it("writes one file per Notification to the outbox when Knock is not configured", async () => {
    const directory = mkdtempSync(join(tmpdir(), "notifications-"));
    const second = { ...raised, recipients: [{ id: "8", name: "Sam Admin" }] };

    await notify([raised, second], outboxTransport(directory));

    const written = readdirSync(directory).map((file) =>
      JSON.parse(readFileSync(join(directory, file), "utf8"))
    );
    expect(written).toHaveLength(2);
    expect(written).toContainEqual(raised);
    expect(written).toContainEqual(second);
  });

  it("logs a failing transport instead of throwing", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = {
      send: async () => {
        throw new Error("Knock is down");
      },
    };

    await expect(notify([raised], failing)).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledWith(
      expect.stringContaining("refund-request-raised"),
      expect.objectContaining({ message: "Knock is down" })
    );
    error.mockRestore();
  });
});

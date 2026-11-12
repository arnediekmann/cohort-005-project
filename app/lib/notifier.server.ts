import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Knock } from "@knocklabs/node";

// ─── In-app Notifications ───
// Knock delivers every Notification when KNOCK_API_KEY is set. Without a key
// (local dev, tests) each Notification is written to .outbox/notifications/ as
// a JSON file instead. Domain code builds Notifications as data; routes pass
// them to `notify` after the write that caused them.

/** Who gets a Notification. Only the Cadence user id and name go to Knock. */
export type NotificationRecipient = { id: string; name: string };

export type Notification = {
  /** The Knock workflow key, e.g. "refund-request-raised". */
  workflow: string;
  recipients: NotificationRecipient[];
  /** What the in-app template shows; `link` is the path a click opens. */
  data: Record<string, string>;
};

export interface NotificationTransport {
  send(notification: Notification): Promise<void>;
}

export function knockTransport(apiKey: string): NotificationTransport {
  const knock = new Knock({ apiKey });
  return {
    async send({ workflow, recipients, data }) {
      await knock.workflows.trigger(workflow, { recipients, data });
    },
  };
}

export function outboxTransport(directory: string): NotificationTransport {
  return {
    async send(notification) {
      mkdirSync(directory, { recursive: true });
      const file = join(
        directory,
        `${Date.now()}-${crypto.randomUUID()}-${notification.workflow}.json`
      );
      writeFileSync(file, JSON.stringify(notification, null, 2));
    },
  };
}

function defaultTransport(): NotificationTransport {
  const apiKey = process.env.KNOCK_API_KEY;
  return apiKey
    ? knockTransport(apiKey)
    : outboxTransport(join(".outbox", "notifications"));
}

/**
 * Sends each Notification. Never throws: a failed Notification is logged and
 * must not break the action that caused it. No retry.
 */
export async function notify(
  notifications: Notification[],
  transport: NotificationTransport = defaultTransport()
): Promise<void> {
  for (const notification of notifications) {
    try {
      await transport.send(notification);
    } catch (error) {
      console.error(
        `Notification "${notification.workflow}" failed to send:`,
        error
      );
    }
  }
}

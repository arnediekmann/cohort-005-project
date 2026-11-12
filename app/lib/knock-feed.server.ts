import { signUserToken } from "@knocklabs/node/lib/tokenSigner";

type KnockEnv = Partial<
  Record<
    "KNOCK_PUBLIC_API_KEY" | "KNOCK_FEED_CHANNEL_ID" | "KNOCK_SIGNING_KEY",
    string
  >
>;

export type KnockFeedConfig = {
  publicApiKey: string;
  feedChannelId: string | undefined;
  userId: string;
  userToken: string | undefined;
};

// What the client needs for the Notification Feed. Null means the Knock
// provider stays disabled and the bell shows an empty feed.
export async function knockFeedConfig(
  env: KnockEnv,
  currentUserId: number | null
): Promise<KnockFeedConfig | null> {
  if (!env.KNOCK_PUBLIC_API_KEY || currentUserId === null) {
    return null;
  }
  const userId = String(currentUserId);
  return {
    publicApiKey: env.KNOCK_PUBLIC_API_KEY,
    feedChannelId: env.KNOCK_FEED_CHANNEL_ID,
    userId,
    userToken: env.KNOCK_SIGNING_KEY
      ? await signUserToken(userId, { signingKey: env.KNOCK_SIGNING_KEY })
      : undefined,
  };
}

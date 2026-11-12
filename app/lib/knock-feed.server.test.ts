import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { knockFeedConfig } from "./knock-feed.server";

describe("knockFeedConfig", () => {
  it("disables the feed when there is no public key", async () => {
    expect(await knockFeedConfig({}, 7)).toBeNull();
  });

  it("disables the feed when nobody is signed in", async () => {
    expect(
      await knockFeedConfig({ KNOCK_PUBLIC_API_KEY: "pk_test" }, null)
    ).toBeNull();
  });

  it("returns the public key, feed channel and user id without a token when there is no signing key", async () => {
    expect(
      await knockFeedConfig(
        { KNOCK_PUBLIC_API_KEY: "pk_test", KNOCK_FEED_CHANNEL_ID: "feed-1" },
        7
      )
    ).toEqual({
      publicApiKey: "pk_test",
      feedChannelId: "feed-1",
      userId: "7",
      userToken: undefined,
    });
  });

  it("signs a user token for the current user when there is a signing key", async () => {
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const signingKey = privateKey
      .export({ type: "pkcs8", format: "pem" })
      .toString();

    const config = await knockFeedConfig(
      {
        KNOCK_PUBLIC_API_KEY: "pk_test",
        KNOCK_FEED_CHANNEL_ID: "feed-1",
        KNOCK_SIGNING_KEY: signingKey,
      },
      7
    );

    const payload = JSON.parse(
      Buffer.from(config?.userToken?.split(".")[1] ?? "", "base64url").toString()
    );
    expect(payload.sub).toBe("7");
  });
});

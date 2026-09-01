import { describe, expect, it } from "vitest";
import { chatSessionDisplayTitle } from "./chat-session-title";

describe("chatSessionDisplayTitle", () => {
  it("uses New chat for an explicitly empty channel-created Chat", () => {
    expect(chatSessionDisplayTitle("")).toBe("新聊天");
    expect(chatSessionDisplayTitle(null)).toBe("新聊天");
    expect(chatSessionDisplayTitle(undefined)).toBe("新聊天");
  });

  it("preserves a stored or manually renamed title", () => {
    expect(chatSessionDisplayTitle("Investigate deploy")).toBe(
      "Investigate deploy",
    );
  });
});

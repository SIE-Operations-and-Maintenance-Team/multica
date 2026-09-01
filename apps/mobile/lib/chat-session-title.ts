export const NEW_CHAT_TITLE = "新聊天";

export function chatSessionDisplayTitle(title: string | null | undefined): string {
  return title || NEW_CHAT_TITLE;
}

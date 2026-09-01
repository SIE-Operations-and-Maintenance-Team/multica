/**
 * Empty-state surface shown when the active session has no messages.
 *
 * Two modes mirror web (packages/views/chat/components/chat-window.tsx
 * `EmptyState`):
 *
 *   - first-time (the workspace has never started a chat) → educate and
 *     offer conversation starters so the composer is not a blank dead end.
 *   - returning (at least one prior session exists) → lead with starter
 *     starters. Tapping prefills the draft so the user can edit before sending.
 *
 * Copy mirrors the web `chat.json` namespace 1:1. Mobile doesn't have
 * i18n yet so the strings are inlined in English — when mobile adopts
 * i18n the lookup keys (`empty_state.first_time_title` etc.) are already
 * established on the web side, so the migration is a literal
 * key-by-key swap.
 */
import { View } from "react-native";
import type { Agent, AgentConversationStarter } from "@multica/core/types";
import { Text } from "@/components/ui/text";
import { Button } from "@/components/ui/button";

const FALLBACK_CONVERSATION_STARTERS: AgentConversationStarter[] = [
  {
    label: "你能帮我做什么？",
    prompt: "你最擅长帮什么忙？简单介绍一下。",
  },
  {
    label: "建议一个首个任务",
    prompt: "建议三个我可以委托给你的实用任务。",
  },
  {
    label: "推荐一个操作",
    prompt:
      "根据你对工作区的了解，推荐一个有用的首个操作。",
  },
];

interface Props {
  hasSessions: boolean;
  agent: Agent | null;
  onPickPrompt: (text: string) => void;
}

export function ChatEmptyState({ hasSessions, agent, onPickPrompt }: Props) {
  const title = agent ? `Hi, I'm ${agent.name}` : "与你的智能体聊天";
  const configured = (agent?.conversation_starters ?? []).filter(
    (item) => item.label.trim() && item.prompt.trim(),
  );
  const starters = configured.length > 0 ? configured : FALLBACK_CONVERSATION_STARTERS;
  return (
    <View className="flex-1 items-center justify-center px-6 py-8 gap-5">
      <View className="items-center gap-1">
        <Text className="text-base font-semibold text-foreground text-center">
          {title}
        </Text>
        {agent?.description ? (
          <Text className="text-sm text-muted-foreground text-center">
            {agent.description}
          </Text>
        ) : null}
        {!hasSessions ? (
          <Text className="text-sm text-muted-foreground text-center">
            Pick an example to start, then edit it before sending.
          </Text>
        ) : null}
      </View>
      {agent ? (
        <View className="w-full max-w-xs gap-2">
          {starters.map((item, index) => (
            <Button
              key={index}
              variant="outline"
              onPress={() => onPickPrompt(item.prompt)}
              className="h-auto justify-start px-3 py-2.5"
              accessibilityLabel={item.label}
            >
              <Text className="text-sm text-foreground">{item.label}</Text>
            </Button>
          ))}
        </View>
      ) : null}
    </View>
  );
}

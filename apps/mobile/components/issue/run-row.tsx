/**
 * Single row inside the agent-runs formSheet route
 * (`app/(app)/[workspace]/issue/[id]/runs.tsx`). Same component for active
 * and past tasks —
 * the trailing Cancel button is conditional on `status in {queued,
 * dispatched, running}`, and the status badge / colour swaps based on the
 * AgentTask.status enum.
 *
 * Tapping a past row is a no-op in v1 — the transcript-detail screen is
 * explicitly out of scope per /Users/qingnaiyuan/.claude/plans/
 * ok-plan-linked-taco.md.
 */
import { Alert, Pressable, View } from "react-native";
import type { AgentTask } from "@multica/core/types";
import { Text } from "@/components/ui/text";
import { ActorAvatar } from "@/components/ui/actor-avatar";
import { useCancelTask } from "@/data/mutations/issues";
import { useActorLookup } from "@/data/use-actor-name";
import { timeAgo } from "@/lib/time-ago";

interface Props {
  task: AgentTask;
  issueId: string;
}

const ACTIVE_STATUSES: readonly AgentTask["status"][] = [
  "queued",
  "dispatched",
  "running",
];

export function RunRow({ task, issueId }: Props) {
  const { getName } = useActorLookup();
  const isActive = ACTIVE_STATUSES.includes(task.status);
  const summary = task.trigger_summary?.trim() || fallbackSummary(task);
  // Past tasks use completed_at when present (server fills it for terminal
  // statuses); active tasks fall back to created_at so the user sees how
  // long it's been waiting.
  const timestamp = task.completed_at || task.created_at;

  return (
    <View className="flex-row items-start gap-3 py-2">
      <ActorAvatar type="agent" id={task.agent_id} size={28} showPresence />
      <View className="flex-1 gap-1">
        <Text
          className="text-sm text-foreground"
          numberOfLines={2}
        >
          <Text className="font-medium">{getName("agent", task.agent_id)}</Text>
          <Text className="text-muted-foreground"> · {summary}</Text>
        </Text>
        <View className="flex-row items-center gap-2">
          <StatusBadge task={task} />
          <Text className="text-xs text-muted-foreground">
            {timestamp ? timeAgo(timestamp) : ""}
          </Text>
        </View>
      </View>
      {isActive ? <CancelButton taskId={task.id} issueId={issueId} /> : null}
    </View>
  );
}

function StatusBadge({ task }: { task: AgentTask }) {
  const label = STATUS_LABEL[task.status] ?? task.status;
  const cls = STATUS_CLASS[task.status] ?? "text-muted-foreground";
  // For failed tasks, surface the failure_reason inline so users don't have
  // to drill in. Missing / empty / unrecognised stays as just "Failed".
  if (task.status === "failed" && task.failure_reason) {
    const reasonLabel = FAILURE_REASON_LABEL[task.failure_reason];
    if (reasonLabel) {
      return (
        <Text className={`text-xs ${cls}`}>
          {label} · {reasonLabel}
        </Text>
      );
    }
  }
  return <Text className={`text-xs ${cls}`}>{label}</Text>;
}

function CancelButton({
  taskId,
  issueId,
}: {
  taskId: string;
  issueId: string;
}) {
  const mutation = useCancelTask(issueId);

  const onPress = () => {
    Alert.alert(
      "取消任务？",
      "智能体将在当前步骤完成后停止。",
      [
        { text: "继续运行", style: "cancel" },
        {
          text: "取消任务",
          style: "destructive",
          onPress: () => mutation.mutate(taskId),
        },
      ],
    );
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={mutation.isPending}
      className="px-3 py-1.5 rounded-md bg-secondary active:opacity-70"
    >
      <Text className="text-xs font-medium text-foreground">取消</Text>
    </Pressable>
  );
}

function fallbackSummary(task: AgentTask): string {
  switch (task.kind) {
    case "comment":
      return "评论任务";
    case "autopilot":
      return "自动运行";
    case "chat":
      return "聊天任务";
    case "quick_create":
      return "快速创建";
    case "direct":
    default:
      return "任务";
  }
}

const STATUS_LABEL: Record<AgentTask["status"], string> = {
  queued: "排队中",
  dispatched: "启动中",
  waiting_local_directory: "等待目录",
  running: "运行中",
  completed: "完成",
  failed: "失败",
  cancelled: "已取消",
};

const STATUS_CLASS: Record<AgentTask["status"], string> = {
  queued: "text-muted-foreground",
  dispatched: "text-brand",
  waiting_local_directory: "text-muted-foreground",
  running: "text-brand",
  completed: "text-muted-foreground",
  failed: "text-destructive",
  cancelled: "text-muted-foreground",
};

// Short badge copy — deliberately terser than lib/failure-reason-label.ts,
// which backs a full-width chat bubble; this one shares a single line with the
// status word and a timestamp.
//
// Keyed by the raw wire value, not a closed enum: `failure_reason` is an open
// string that grows as classifier rules land. It held only the six
// pre-MUL-1949 coarse values until MUL-5370, so every refined `agent_error.*`
// the backend has written since fell through and the badge read just "Failed".
// An unrecognised reason still does — a compact badge is the one place where
// web's raw-wire-value fallback would overflow the row.
const FAILURE_REASON_LABEL: Record<string, string> = {
  queued_expired: "队列过期",
  runtime_offline: "运行时离线",
  runtime_recovery: "运行时恢复",
  timeout: "超时",
  iteration_limit: "迭代达上限",
  agent_blocked: "需要输入",
  api_invalid_request: "请求被拒绝",
  skill_bundle_unavailable: "技能下载失败",
  runtime_cli_timeout: "运行时 CLI 超时",

  "agent_error.provider_auth_or_access": "认证失败",
  "agent_error.provider_quota_limit": "配额耗尽",
  "agent_error.provider_capacity_or_rate_limit": "触发限流",
  "agent_error.provider_server_error": "服务商错误",
  "agent_error.provider_network": "网络错误",
  "agent_error.process_failure": "进程崩溃",
  "agent_error.empty_or_unparseable_output": "无有效输出",
  "agent_error.agent_timeout": "智能体超时",
  "agent_error.context_overflow": "上下文溢出",
  "agent_error.missing_config": "配置缺失",
  "agent_error.model_not_found_or_unavailable": "模型不可用",
  "agent_error.runtime_version_unsupported": "CLI 不支持",
  "agent_error.runtime_missing_executable": "CLI 未安装",
  "agent_error.unknown": "智能体错误",

  agent_error: "智能体错误",
  codex_semantic_inactivity: "Codex 无活动",
  manual: "手动",
};

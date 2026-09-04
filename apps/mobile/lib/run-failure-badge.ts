/**
 * Short badge copy for a run's `failure_reason`, shown inline on the agent-runs
 * row next to the status word and a timestamp.
 *
 * Deliberately terser than `lib/failure-reason-label.ts`, which backs a
 * full-width chat bubble; this one shares a single line.
 *
 * Keyed by the raw wire value, not a closed enum: `failure_reason` is an open
 * string that grows as classifier rules land, and an installed build will meet
 * reasons it predates. An unrecognised reason returns undefined so the row
 * falls back to a bare status word — a compact badge is the one place where
 * web's raw-wire-value fallback would overflow the row.
 *
 * Lives in lib/ rather than inside run-row.tsx so the lookup is covered by
 * mobile's node-only vitest lane: the map spent from MUL-5370 to #7913 holding
 * copy that no run could reach, because AgentTaskSchema was erasing every
 * refined reason before the row ever looked one up. A map no test can see is
 * how that goes unnoticed.
 */
const FAILURE_REASON_BADGE: Record<string, string> = {
  queued_expired: "队列过期",
  runtime_offline: "运行时离线",
  runtime_recovery: "运行时恢复",
  timeout: "超时",
  iteration_limit: "迭代达上限",
  agent_blocked: "需要输入",
  api_invalid_request: "请求被拒绝",
  skill_bundle_unavailable: "技能下载失败",
  runtime_cli_timeout: "运行时 CLI 超时",
  environment_prepare_failed: "环境准备失败",

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

export function runFailureBadgeLabel(
  reason: string | null | undefined,
): string | undefined {
  if (!reason) return undefined;
  return FAILURE_REASON_BADGE[reason];
}

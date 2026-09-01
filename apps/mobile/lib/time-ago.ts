/**
 * Mobile time-ago formatter. Mirrors the algorithm in
 * packages/views/inbox/components/inbox-list-item.tsx `useTimeAgo` so
 * "X minutes ago" reads identically across web/desktop and mobile (Behavioral
 * parity rule in apps/mobile/CLAUDE.md). The web version is i18n-driven via
 * useT; mobile v1 is English-only — when mobile ships i18n, mirror that
 * structure.
 */
export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} 周前`;
  return new Date(dateStr).toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric",
  });
}

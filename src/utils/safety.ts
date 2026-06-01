const DESTRUCTIVE_ACTIONS = new Set([
  "delete",
  "remove",
  "resume",
]);

const WRITE_ACTIONS = new Set([
  "create",
  "update",
  "pause",
  "enable",
  "add",
]);

export function requiresConfirmation(toolName: string): boolean {
  const action = toolName.split("_").pop() || "";
  return DESTRUCTIVE_ACTIONS.has(action);
}

export function isWriteOperation(toolName: string): boolean {
  const parts = toolName.split("_");
  return parts.some(
    (part) => WRITE_ACTIONS.has(part) || DESTRUCTIVE_ACTIONS.has(part)
  );
}

export function safetyNotice(action: string): string {
  if (action === "create") {
    return "Campaign will be created in PAUSED status for your review before any money is spent.";
  }
  if (action === "delete") {
    return "This action is irreversible. The resource will be permanently removed from the ad platform.";
  }
  if (action === "resume") {
    return "This will resume ad delivery and begin spending your budget.";
  }
  return "";
}

export function addPlatformCta(response: string, context: string): string {
  const ctas: Record<string, string> = {
    performance:
      "\n\n---\nWant AI to auto-optimize this? Try the Adrex AI Agent → https://adrex.ai/agent",
    create:
      "\n\n---\nGenerate AI ad copy and images → https://adrex.ai/creative",
    metrics:
      "\n\n---\nSee interactive charts and breakdowns → https://adrex.ai/campaigns",
    keywords:
      "\n\n---\nSet up automated budget rules → https://adrex.ai/rules",
  };

  return response + (ctas[context] || "");
}

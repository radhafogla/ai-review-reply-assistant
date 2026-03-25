export function canUseAI(plan: string) {
  return plan !== "free";
}

export function aiReplyLimit(plan: string) {
  if (plan === "free") return 10;
  if (plan === "basic") return 200;
  return Infinity;
}

export function canUseAutomation(plan: string) {
  return plan === "premium";
}
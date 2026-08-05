import { PendingAction, IPendingAction, PendingActionType } from "../db/models/PendingAction";

const EXPIRY_MINUTES = 30;

export async function proposeAction(
  telegramId: number,
  type: PendingActionType,
  description: string,
  payload: Record<string, unknown>
): Promise<IPendingAction> {
  // Only one open proposal per user at a time — a new proposal supersedes
  // any earlier unconfirmed one so "yes" always refers to the latest ask.
  await PendingAction.updateMany({ telegramId, status: "pending" }, { $set: { status: "cancelled" } });

  return PendingAction.create({
    telegramId,
    type,
    description,
    payload,
    status: "pending",
    expiresAt: new Date(Date.now() + EXPIRY_MINUTES * 60 * 1000),
  });
}

export async function getLatestPending(telegramId: number): Promise<IPendingAction | null> {
  return PendingAction.findOne({ telegramId, status: "pending", expiresAt: { $gt: new Date() } }).sort({
    createdAt: -1,
  });
}

export async function markConfirmed(id: string): Promise<void> {
  await PendingAction.updateOne({ _id: id }, { $set: { status: "confirmed" } });
}

export async function markCancelled(id: string): Promise<void> {
  await PendingAction.updateOne({ _id: id }, { $set: { status: "cancelled" } });
}

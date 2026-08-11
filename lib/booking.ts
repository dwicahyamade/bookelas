export function remainingSlots(capacity: number, approvedCount: number) {
  return Math.max(0, capacity - approvedCount);
}

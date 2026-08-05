export function currentTimeInTz(timezone: string): { hhmm: string; dayOfWeek: number } {
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      weekday: "short",
    }).formatToParts(now);

    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    const hour = get("hour").padStart(2, "0");
    const minute = get("minute").padStart(2, "0");
    const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

    return { hhmm: `${hour}:${minute}`, dayOfWeek: weekdayMap[get("weekday")] ?? 0 };
  } catch {
    const now = new Date();
    return { hhmm: `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`, dayOfWeek: now.getUTCDay() };
  }
}

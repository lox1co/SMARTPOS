import { config } from "./config.js";

function dateParts(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: config.APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { year: Number(values["year"]), month: Number(values["month"]), day: Number(values["day"]) };
}

export function businessDate(date = new Date()): string {
  const { year, month, day } = dateParts(date);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function businessDateTime(date = new Date()): Date {
  return new Date(
    `${businessDate(date)}T${new Intl.DateTimeFormat("en-GB", {
      timeZone: config.APP_TIMEZONE,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).format(date)}.000Z`,
  );
}

export function dayBounds(day: string): { start: Date; end: Date } {
  return {
    start: new Date(`${day}T00:00:00.000Z`),
    end: new Date(`${day}T23:59:59.999Z`),
  };
}

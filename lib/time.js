import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

export const DEFAULT_APP_TIMEZONE = "Asia/Shanghai";
export const DEFAULT_APP_TIMEZONE_LABEL = "UTC+8 (Asia/Shanghai)";
export const TIMEZONE_OPTIONS = [
  { value: "Asia/Shanghai", label: "UTC+8 (Asia/Shanghai)" },
  { value: "UTC", label: "UTC+0" },
  { value: "America/New_York", label: "UTC-4/-5 (New York)" },
  { value: "America/Los_Angeles", label: "UTC-7/-8 (Los Angeles)" },
];
export const INPUT_DATE_FORMAT = "YYYY-MM-DD HH:mm:ss";
export const DATE_ONLY_FORMAT = "YYYY-MM-DD";

export function isSupportedTimeZone(value) {
  return TIMEZONE_OPTIONS.some((option) => option.value === value);
}

export function resolveAppTimeZone(value) {
  return isSupportedTimeZone(value) ? value : DEFAULT_APP_TIMEZONE;
}

const LOCAL_INPUT_FORMATS = [
  INPUT_DATE_FORMAT,
  "YYYY-MM-DD HH:mm",
  "YYYY-MM-DDTHH:mm:ss",
  "YYYY-MM-DDTHH:mm",
  DATE_ONLY_FORMAT,
];

function isValidDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function hasExplicitTimezone(value) {
  return /(?:Z|[+-]\d{2}:\d{2})$/i.test(value);
}

function parseLocalString(value, timeZone) {
  for (const format of LOCAL_INPUT_FORMATS) {
    try {
      const parsed = dayjs.tz(value, format, timeZone);
      if (parsed.isValid()) {
        return parsed;
      }
    } catch {
      // dayjs.tz can throw RangeError for malformed strings; try the next parser.
    }
  }

  return null;
}

export function parseAppDate(value, timeZone = DEFAULT_APP_TIMEZONE) {
  const resolvedTimeZone = resolveAppTimeZone(timeZone);
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (dayjs.isDayjs(value)) {
    return value.tz(resolvedTimeZone);
  }

  if (isValidDate(value)) {
    return dayjs(value).tz(resolvedTimeZone);
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const localParsed = parseLocalString(normalized, resolvedTimeZone);
  if (localParsed) {
    return localParsed;
  }

  try {
    const parsed = hasExplicitTimezone(normalized)
      ? dayjs(normalized).tz(resolvedTimeZone)
      : dayjs.tz(normalized, resolvedTimeZone);

    return parsed.isValid() ? parsed : null;
  } catch {
    return null;
  }
}

export function toUtcISOString(value, timeZone = DEFAULT_APP_TIMEZONE) {
  const parsed = parseAppDate(value, timeZone);
  return parsed ? parsed.utc().toISOString() : "";
}

export function toInputDateTimeValue(value, timeZone = DEFAULT_APP_TIMEZONE) {
  const resolvedTimeZone = resolveAppTimeZone(timeZone);
  const parsed = parseAppDate(value, resolvedTimeZone);
  return parsed ? parsed.tz(resolvedTimeZone).format(INPUT_DATE_FORMAT) : "";
}

export function toAppDateKey(value = new Date(), timeZone = DEFAULT_APP_TIMEZONE) {
  const resolvedTimeZone = resolveAppTimeZone(timeZone);
  const parsed = parseAppDate(value, resolvedTimeZone);
  return parsed ? parsed.tz(resolvedTimeZone).format(DATE_ONLY_FORMAT) : "";
}

export function startOfAppDay(value = new Date(), timeZone = DEFAULT_APP_TIMEZONE) {
  const resolvedTimeZone = resolveAppTimeZone(timeZone);
  const parsed = parseAppDate(value, resolvedTimeZone);
  return parsed ? parsed.tz(resolvedTimeZone).startOf("day") : null;
}

export function diffAppCalendarDays(startValue, endValue, timeZone = DEFAULT_APP_TIMEZONE) {
  const start = startOfAppDay(startValue, timeZone);
  const end = startOfAppDay(endValue, timeZone);

  if (!start || !end) {
    return 0;
  }

  return Math.max(0, end.diff(start, "day"));
}

export function formatInAppTimeZone(value, locale, options = {}, timeZone = DEFAULT_APP_TIMEZONE) {
  const resolvedTimeZone = resolveAppTimeZone(timeZone);
  const parsed = parseAppDate(value, resolvedTimeZone);
  if (!parsed) {
    return "";
  }

  return new Intl.DateTimeFormat(locale, {
    timeZone: resolvedTimeZone,
    ...options,
  }).format(parsed.toDate());
}

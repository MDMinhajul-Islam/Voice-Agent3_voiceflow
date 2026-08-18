const CAL_BASE_URL = "https://api.cal.com/v2";
const SLOT_API_VERSION = "2024-09-04";
const BOOKING_API_VERSION = "2026-02-25";

function config() {
  const values = {
    apiKey: process.env.CAL_API_KEY,
    username: process.env.CAL_USERNAME,
    eventTypeSlug: process.env.CAL_EVENT_TYPE_SLUG,
    timeZone: process.env.CAL_TIMEZONE || "America/Chicago",
  };
  if (!values.apiKey || !values.username || !values.eventTypeSlug) throw new Error("Cal.com is not configured on this server.");
  return values;
}

async function calFetch(path, { method = "GET", body, version = SLOT_API_VERSION } = {}) {
  const { apiKey } = config();
  const response = await fetch(`${CAL_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: 'Bearer ' + apiKey,
      "cal-api-version": version,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(12_000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.status === "error") {
    const message = payload?.error?.message || payload?.message || `Cal.com request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return payload.data;
}

function validDate(value) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)); }

export async function checkCalendarAvailability(args) {
  const { username, eventTypeSlug, timeZone: defaultZone } = config();
  const start = String(args.start_date || "");
  const end = String(args.end_date || start);
  const timeZone = String(args.time_zone || defaultZone);
  if (!validDate(start) || !validDate(end)) throw new Error("start_date and end_date must use YYYY-MM-DD.");
  const daySpan = (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000;
  if (daySpan < 0 || daySpan > 14) throw new Error("The availability range must be between 1 and 15 days.");
  const query = new URLSearchParams({ eventTypeSlug, username, start, end, timeZone, format: "range" });
  const data = await calFetch(`/slots?${query}`);
  const slots = Object.values(data || {}).flat().map((slot) => ({ start: slot.start, end: slot.end })).slice(0, 24);
  return { success: true, time_zone: timeZone, duration_minutes: 45, available_slots: slots, message: slots.length ? `Found ${slots.length} available slots.` : "No available slots were found in that range." };
}

async function verifyExactSlot(startTime) {
  const instant = new Date(startTime);
  if (Number.isNaN(instant.getTime())) throw new Error("start_time must be a valid ISO 8601 date-time.");
  const before = new Date(instant.getTime() - 86_400_000).toISOString().slice(0, 10);
  const after = new Date(instant.getTime() + 86_400_000).toISOString().slice(0, 10);
  const result = await checkCalendarAvailability({ start_date: before, end_date: after, time_zone: "UTC" });
  const target = instant.getTime();
  return result.available_slots.some((slot) => new Date(slot.start).getTime() === target);
}

export async function bookAppointment(args) {
  const { username, eventTypeSlug, timeZone: defaultZone } = config();
  const required = ["start_time", "customer_name", "customer_email", "customer_phone", "appointment_type", "stock_ids"];
  for (const field of required) if (!args[field] || (Array.isArray(args[field]) && !args[field].length)) throw new Error(`${field} is required.`);
  if (!/^\S+@\S+\.\S+$/.test(args.customer_email)) throw new Error("A valid customer_email is required.");
  const start = new Date(args.start_time);
  if (Number.isNaN(start.getTime()) || start.getTime() <= Date.now()) throw new Error("start_time must be a future ISO 8601 date-time.");
  if (!(await verifyExactSlot(start.toISOString()))) return { success: false, code: "slot_unavailable", message: "That slot is no longer available. Check availability again and offer another returned slot." };
  const stockIds = Array.isArray(args.stock_ids) ? args.stock_ids.join(", ") : String(args.stock_ids);
  const attendee = { name: String(args.customer_name), email: String(args.customer_email), timeZone: String(args.customer_time_zone || defaultZone), language: "en" };
  if (args.customer_phone) attendee.phoneNumber = String(args.customer_phone);
  const data = await calFetch("/bookings", {
    method: "POST",
    version: BOOKING_API_VERSION,
    body: {
      start: start.toISOString(),
      attendee,
      eventTypeSlug,
      username,
      metadata: { source: "retell_voice_agent", appointment_type: String(args.appointment_type), stock_ids: stockIds, notes: String(args.notes || "") },
    },
  });
  return { success: true, booking_id: data.uid || String(data.id || ""), status: data.status || "accepted", start: data.start || start.toISOString(), end: data.end || null, time_zone: attendee.timeZone, appointment_type: String(args.appointment_type), stock_ids: stockIds, message: "Appointment booked successfully." };
}

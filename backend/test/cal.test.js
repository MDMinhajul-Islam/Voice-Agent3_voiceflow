import test from "node:test";
import assert from "node:assert/strict";
import { checkCalendarAvailability, bookAppointment } from "../src/cal.js";

const originalFetch = globalThis.fetch;
Object.assign(process.env, { CAL_API_KEY: "cal_test_secret", CAL_USERNAME: "northstar", CAL_EVENT_TYPE_SLUG: "test-drive", CAL_TIMEZONE: "America/Chicago" });
test.after(() => { globalThis.fetch = originalFetch; });

test("checks slots using the required Cal API version and configured event", async () => {
  globalThis.fetch = async (url, options) => {
    assert.match(String(url), /eventTypeSlug=test-drive/);
    assert.match(String(url), /username=northstar/);
    assert.equal(options.headers["cal-api-version"], "2024-09-04");
    return new Response(JSON.stringify({ status: "success", data: { "2030-01-10": [{ start: "2030-01-10T10:00:00-06:00", end: "2030-01-10T10:45:00-06:00" }] } }), { status: 200 });
  };
  const result = await checkCalendarAvailability({ start_date: "2030-01-10", end_date: "2030-01-10", time_zone: "America/Chicago" });
  assert.equal(result.success, true);
  assert.equal(result.available_slots.length, 1);
});

test("rechecks the exact slot before creating a booking", async () => {
  let bookingWrites = 0;
  globalThis.fetch = async (url, options) => {
    if (String(url).includes("/slots?")) return new Response(JSON.stringify({ status: "success", data: { "2030-01-10": [{ start: "2030-01-10T16:00:00Z", end: "2030-01-10T16:45:00Z" }] } }), { status: 200 });
    bookingWrites += 1;
    assert.equal(options.headers["cal-api-version"], "2026-02-25");
    const body = JSON.parse(options.body);
    assert.equal(body.eventTypeSlug, "test-drive");
    assert.equal(body.attendee.email, "buyer@example.com");
    return new Response(JSON.stringify({ status: "success", data: { uid: "booking_123", status: "accepted", start: body.start } }), { status: 201 });
  };
  const result = await bookAppointment({ start_time: "2030-01-10T16:00:00Z", customer_name: "Buyer", customer_email: "buyer@example.com", customer_time_zone: "America/Chicago", appointment_type: "test_drive", stock_ids: ["NVA-001"] });
  assert.equal(result.success, true);
  assert.equal(result.booking_id, "booking_123");
  assert.equal(bookingWrites, 1);
});

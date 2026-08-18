import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { recommendVehicles, scoreVehicle } from "../src/recommendation.js";

const vehicles = JSON.parse(await readFile(new URL("../data/vehicles.us.json", import.meta.url), "utf8"));

const profile = {
  purchase: { condition: "new", budget: { min: 28000, max: 43000, currency: "USD", flexible: false } },
  household: { regularPassengers: 5, maximumPassengers: 7, elderlyAccessRequired: true, luggageNeed: "high" },
  usage: { primaryPurpose: "family", cityPercent: 55, highwayPercent: 45, roughRoadPercent: 0, roadCondition: "smooth", parkingConstraint: "normal", frequentLongTrips: true },
  preferences: { bodyTypes: ["suv", "mpv"], fuelTypes: ["hybrid", "open"], requiredFeatures: [], priorities: ["space", "efficiency", "safety", "comfort"], excludedMakes: [] }
};

test("recommends no more than requested limit", () => {
  const result = recommendVehicles(vehicles, profile, 3);
  assert.equal(result.recommendations.length, 3);
});

test("large-family profile ranks an MPV or three-row SUV above sedans", () => {
  const result = recommendVehicles(vehicles, profile, 3);
  assert.ok(["mpv", "suv"].includes(result.recommendations[0].vehicle.bodyType));
  assert.notEqual(result.recommendations[0].vehicle.model, "Civic Sedan");
});

test("hard-excludes a vehicle with insufficient seats", () => {
  const largeFamily = structuredClone(profile);
  largeFamily.household.regularPassengers = 8;
  const civic = vehicles.find(vehicle => vehicle.model === "Civic Sedan");
  const result = scoreVehicle(civic, largeFamily);
  assert.equal(result.excluded, true);
  assert.ok(result.excludedBy.includes("insufficient_seats"));
});

test("returns explanations, compromises, confidence and inventory warning", () => {
  const result = recommendVehicles(vehicles, profile, 1).recommendations[0].result;
  assert.ok(result.reasons.length > 0);
  assert.ok(result.compromises.length > 0);
  assert.ok(result.confidence > 0 && result.confidence <= 100);
  assert.equal(result.requiresInventoryConfirmation, true);
});

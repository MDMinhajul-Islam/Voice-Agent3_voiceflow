const DEFAULT_WEIGHTS = Object.freeze({
  budget: 25,
  passengerFit: 20,
  usageFit: 15,
  priorities: 15,
  bodyType: 8,
  fuelType: 7,
  requiredFeatures: 7,
  ownership: 3
});

const PRIORITY_TAGS = {
  safety: ["safety"], space: ["large_family", "three_rows", "cargo_flexibility"],
  comfort: ["comfort_priority", "road_trip"], efficiency: ["fuel_efficient"],
  performance: ["performance"], reliability: ["reliable"], resale: ["resale"],
  technology: ["technology"], off_road: ["rough_road", "off_road"], low_maintenance: ["low_maintenance"]
};

const clamp = value => Math.max(0, Math.min(1, value));
const normalized = value => String(value ?? "").trim().toLowerCase();

function budgetScore(vehicle, profile) {
  const max = profile.purchase?.budget?.max;
  const min = profile.purchase?.budget?.min;
  if (!max || vehicle.price.type === "contact") return { score: 0.5, evidence: "Budget fit needs a current price." };
  const price = vehicle.price.amount;
  if (price <= max && (!min || price >= min * 0.65)) return { score: 1, evidence: `Starting MSRP $${price.toLocaleString("en-US")} is within budget.` };
  if (price <= max * 1.08 && profile.purchase.budget.flexible) return { score: 0.65, evidence: `Starting MSRP is slightly above the stated budget but flexibility was allowed.` };
  if (price < (min || 0) * 0.65) return { score: 0.65, evidence: "Well below budget; verify that equipment expectations are met." };
  return { score: 0, evidence: `Starting MSRP $${price.toLocaleString("en-US")} exceeds the stated maximum.` };
}

function passengerScore(vehicle, profile) {
  const regular = profile.household?.regularPassengers;
  const maximum = profile.household?.maximumPassengers ?? regular;
  if (!regular) return { score: 0.5, evidence: "Passenger requirement is unknown." };
  if (vehicle.capacity.seats < regular) return { score: 0, evidence: `Only ${vehicle.capacity.seats} seats for ${regular} regular passengers.` };
  if (maximum && vehicle.capacity.seats >= maximum) return { score: 1, evidence: `${vehicle.capacity.seats} seats cover the maximum passenger need.` };
  return { score: 0.75, evidence: `${vehicle.capacity.seats} seats cover regular use but not every occasional passenger.` };
}

function usageScore(vehicle, profile) {
  const tags = new Set(vehicle.suitabilityTags);
  const usage = profile.usage ?? {};
  const fits = [];
  if ((usage.cityPercent ?? 0) >= 60) fits.push(tags.has("city_commute") || tags.has("city_and_highway") || ["sedan", "hatchback", "crossover"].includes(vehicle.bodyType));
  if ((usage.highwayPercent ?? 0) >= 40 || usage.frequentLongTrips) fits.push(tags.has("highway") || tags.has("city_and_highway") || tags.has("road_trip") || tags.has("comfort_priority"));
  if ((usage.roughRoadPercent ?? 0) >= 20 || usage.roadCondition === "rough") fits.push(tags.has("rough_road") || vehicle.bodyType === "suv" || vehicle.bodyType === "pickup");
  if (usage.parkingConstraint === "tight") fits.push(tags.has("tight_parking") || vehicle.bodyType === "sedan" || vehicle.bodyType === "hatchback");
  if (!fits.length) return { score: 0.6, evidence: "No strong usage constraint was supplied." };
  const score = fits.filter(Boolean).length / fits.length;
  return { score, evidence: score >= 0.75 ? "Its body style and suitability match the stated driving pattern." : "It matches some, but not all, usage conditions." };
}

function listPreferenceScore(actual, requested = []) {
  const choices = requested.map(normalized).filter(value => value && value !== "open");
  if (!choices.length) return 0.7;
  return choices.includes(normalized(actual)) ? 1 : 0;
}

function priorityScore(vehicle, profile) {
  const priorities = profile.preferences?.priorities ?? [];
  if (!priorities.length) return { score: 0.5, evidence: "Priorities have not been ranked." };
  const haystack = new Set([...vehicle.suitabilityTags, ...vehicle.safetyFeatures.map(normalized)]);
  const hits = priorities.filter(priority => {
    if (priority === "price") return true;
    if (priority === "safety") return vehicle.safetyFeatures.length >= 2;
    return (PRIORITY_TAGS[priority] ?? []).some(tag => haystack.has(tag));
  });
  return { score: hits.length / priorities.length, evidence: `Matches ${hits.length} of ${priorities.length} stated priorities.` };
}

function featureScore(vehicle, profile) {
  const required = profile.preferences?.requiredFeatures ?? [];
  if (!required.length) return { score: 1, evidence: "No mandatory feature mismatch." };
  const vehicleFeatures = [...vehicle.features, ...vehicle.safetyFeatures].map(normalized);
  const missing = required.filter(feature => !vehicleFeatures.some(item => item.includes(normalized(feature))));
  return { score: 1 - missing.length / required.length, evidence: missing.length ? `Needs verification for: ${missing.join(", ")}.` : "All required features are represented in verified data." };
}

function ownershipScore(vehicle, profile) {
  const priorities = new Set(profile.preferences?.priorities ?? []);
  const values = [];
  if (priorities.has("resale")) values.push(vehicle.ownership.resaleOutlook === "high" ? 1 : vehicle.ownership.resaleOutlook === "medium" ? 0.65 : 0.35);
  if (priorities.has("low_maintenance")) values.push(vehicle.ownership.partsAvailability === "high" ? 1 : vehicle.ownership.partsAvailability === "medium" ? 0.65 : 0.35);
  return { score: values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0.6, evidence: values.length ? "Ownership data was included in scoring." : "Ownership preference was not a deciding factor." };
}

function hardExclusions(vehicle, profile) {
  const reasons = [];
  const regular = profile.household?.regularPassengers;
  if (regular && vehicle.capacity.seats < regular) reasons.push("insufficient_seats");
  const max = profile.purchase?.budget?.max;
  if (max && !profile.purchase.budget.flexible && vehicle.price.amount > max * 1.12) reasons.push("over_budget");
  const excluded = (profile.preferences?.excludedMakes ?? []).map(normalized);
  if (excluded.includes(normalized(vehicle.make))) reasons.push("excluded_make");
  return reasons;
}

export function scoreVehicle(vehicle, profile, weights = DEFAULT_WEIGHTS) {
  const excludedBy = hardExclusions(vehicle, profile);
  const components = {
    budget: budgetScore(vehicle, profile), passengerFit: passengerScore(vehicle, profile), usageFit: usageScore(vehicle, profile), priorities: priorityScore(vehicle, profile),
    bodyType: { score: listPreferenceScore(vehicle.bodyType, profile.preferences?.bodyTypes), evidence: "Body-type preference evaluated." },
    fuelType: { score: listPreferenceScore(vehicle.powertrain.fuelType, profile.preferences?.fuelTypes), evidence: "Fuel preference evaluated." },
    requiredFeatures: featureScore(vehicle, profile), ownership: ownershipScore(vehicle, profile)
  };
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const raw = Object.entries(weights).reduce((sum, [key, weight]) => sum + clamp(components[key].score) * weight, 0) / totalWeight;
  const verifiedFields = vehicle.provenance.sources.flatMap(source => source.fields).length;
  const confidence = clamp(0.35 + Math.min(verifiedFields / 30, 0.45) + (vehicle.provenance.verificationStatus === "verified" ? 0.2 : 0));
  return {
    vehicleId: vehicle.id, excluded: excludedBy.length > 0, excludedBy,
    score: Math.round(raw * 100), confidence: Math.round(confidence * 100), components,
    reasons: Object.values(components).filter(item => item.score >= 0.75).slice(0, 3).map(item => item.evidence),
    compromises: [...vehicle.limitations, ...Object.values(components).filter(item => item.score < 0.5).map(item => item.evidence)].slice(0, 4),
    requiresInventoryConfirmation: vehicle.inventory.status === "unknown"
  };
}

export function recommendVehicles(vehicles, profile, limit = 3) {
  const scored = vehicles.map(vehicle => ({ vehicle, result: scoreVehicle(vehicle, profile) }));
  const eligible = scored.filter(item => !item.result.excluded).sort((a, b) => b.result.score - a.result.score || b.result.confidence - a.result.confidence);
  return { recommendations: eligible.slice(0, limit), excluded: scored.filter(item => item.result.excluded), evidenceComplete: eligible.every(item => item.result.confidence >= 60) };
}

export { DEFAULT_WEIGHTS };

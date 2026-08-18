# Velocity automotive advisor backend

This directory contains the source-of-truth definitions and the secure Retell web-call endpoint.

- `config/agent-persona.md`: global Voiceflow agent instructions and safety policy.
- `config/discovery-policy.json`: adaptive question selection and consent rules.
- `schemas/customer-discovery.schema.json`: normalized conversation/customer state.
- `schemas/vehicle.schema.json`: normalized vehicle, inventory, and source-verification model.
- `data/vehicles.us.json`: initial US-market dataset using official manufacturer sources; live dealer stock remains unknown.
- `src/recommendation.js`: explainable weighted scoring with hard exclusions, confidence, reasons, and compromises.
- `test/recommendation.test.js`: recommendation behavior tests.

Retell orchestrates the voice conversation. Vehicle filtering, scoring, live inventory, and booking should be implemented as backend tools rather than embedded as large prompt tables.

## Run the website with Retell

1. Copy `.env.example` to `.env` at the project root.
2. Enter `RETELL_API_KEY` and `RETELL_AGENT_ID` in `.env`. Never add the API key to frontend code or commit it.
3. From the project root run `npm install`, then `npm run dev`.
4. Open `http://127.0.0.1:5173`. Loopback addresses are treated as a secure microphone context by browsers.

For a production-style local run, use `npm run build` followed by `npm start`, then open `http://127.0.0.1:8787`.

## Deploy with Dokploy

Create an Application from this Git repository and select **Dockerfile** as the build type. Keep the Dockerfile path as `Dockerfile` and container port as `8787`. Add a domain with HTTPS, then configure these environment variables in Dokploy:

```env
RETELL_API_KEY=your_private_retell_api_key
RETELL_AGENT_ID=your_retell_agent_id
CAL_API_KEY=your_private_cal_api_key
CAL_USERNAME=your_cal_username
CAL_EVENT_TYPE_SLUG=northstar-vehicle-consultation-or-test-drive
CAL_TIMEZONE=America/Chicago
RETELL_TOOL_SECRET=generate_a_long_random_secret
PUBLIC_ORIGIN=https://cars.example.com
PORT=8787
HOST=0.0.0.0
```

Set the health-check path to `/api/health`. `PUBLIC_ORIGIN` must exactly match the public HTTPS origin, without a trailing slash. Do not put the Retell API key in build arguments, frontend variables, Dockerfile, or Git.

The Retell calendar custom functions are `POST /api/tools/check-calendar-availability` and `POST /api/tools/book-appointment`. Both require the `X-Tool-Secret` header to match `RETELL_TOOL_SECRET`. Tool definitions ready for the Retell dashboard are stored under `backend/retell/tools/`.

The current dataset verifies selected vehicle facts against US manufacturer sources. It is not dealership inventory. Records without field-level sources remain unknown and must not be presented to customers as confirmed facts.

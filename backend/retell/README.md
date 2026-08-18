# Retell baseline preparation

This folder translates the instructor lab into reproducible project configuration.

## Ready locally

- `agent-config.json`: Single Prompt agent, fictional dealership, timezone, KB, and Cal.com tool names.
- `single-prompt.md`: copy-ready Avery prompt supporting both beginner and experienced buyers.
- `knowledge-base-instruction.txt`: retrieval-query guidance kept below Retell's 500-character limit.
- `post-call-analysis.json`: thirteen structured analysis categories.
- `test-cases.json`: thirteen regression cases including failed booking, no match, sold/in-transit inventory, and prompt injection.
- `knowledge-base/Car_Dealership_Starter_Inventory.xlsx`: source workbook to upload unchanged.

## Requires account access

1. Create a Retell Single Prompt voice agent.
2. Create and attach the `Northstar Training Inventory` knowledge base.
3. Paste the prompt and KB instruction.
4. Create the 45-minute Cal.com event in `America/Chicago` and configure both exact tool names.
5. Add the post-call categories.
6. Run text tests, saved simulations, a web call, and the failed-tool path.

Never store the Cal.com API key, Retell API key, phone numbers, or caller personal data in this repository.

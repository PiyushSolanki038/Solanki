# Background Jobs (V2)

## Supported Job Types
- `document.generate`
- `document.generate_pdf`
- `email.send`
- `email.reminder`
- `contract.expiry_alert`

## Worker Command
- `npm run jobs:worker`

## Contract Expiry Alert Enqueue Command
- `npm run jobs:enqueue-expiry-alerts`
- Optional env: `CONTRACT_EXPIRY_LOOKAHEAD_DAYS` (default: `30`)

## Operational Notes
- Jobs are stored in `background_jobs`.
- Worker picks jobs in queue order by `priority`, then `created_at`.
- Failed jobs retry until `max_attempts`.
- Contract expiry enqueue script avoids duplicate queued/processing alerts for the same contract.

# Functions

Azure Function App for benchmark workers.

## What is implemented now

- Queue-triggered scaffold on `benchmark-jobs`
- Logs queue metadata and message payload
- No embedding or benchmark logic yet

## Local setup

1. Install Azure Functions Core Tools (`func`) if missing.
2. Copy `local.settings.example.json` to `local.settings.json`.
3. Replace storage settings with your real connection string if not using Azurite.
4. Install dependencies:
   ```bash
   python -m pip install -r requirements.txt
   ```
5. Run locally:
   ```bash
   func start
   ```

## Notes

- On this machine, `func` is currently not installed (`command not found`).
- Queue trigger uses app setting name `AZURE_STORAGE_CONNECTION_STRING`.

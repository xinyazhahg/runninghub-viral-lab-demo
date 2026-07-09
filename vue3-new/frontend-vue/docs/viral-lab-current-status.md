# Viral Lab Current Status

## API Key Security

- RunningHub API Key is backend-only.
- Frontend Vue code must not contain or send `RUNNINGHUB_API_KEY`.
- Frontend requests to `/api/video-to-text` and `/api/generate-video` send only files, prompt text, duration, and aspect ratio.
- localStorage stores UI state such as uploaded video metadata, parsed results, prompts, versions, and logs. It must not store API keys.
- Backend reads the key from `process.env.RUNNINGHUB_API_KEY`.
- If the backend key is missing, API responses return: `后端未配置 RunningHub API Key`.

## Local Setup

Create a backend `.env` from `backend后段接口/.env.example` or export the variable before starting the backend:

```bash
export RUNNINGHUB_API_KEY=your_runninghub_key
```

Do not put real keys in frontend `.env` files or committed files.

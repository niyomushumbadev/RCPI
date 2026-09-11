# R-CPI AI service

This internal FastAPI service is called only by the Node.js gateway. Set `AI_SERVICE_TOKEN` to require the `X-AI-Service-Token` header, then run:

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

The endpoint returns a stable, versionable decision-support contract. The current implementation is a transparent baseline classifier; validated NLP and computer-vision models can replace the service functions without changing the Node.js or React contracts.
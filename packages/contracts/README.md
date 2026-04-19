# Contracts

Generated API contracts live here.

Suggested flow once the backend settles:

```bash
curl http://localhost:7777/openapi.json > packages/contracts/openapi.json
```

Then generate a typed JavaScript client from that OpenAPI file for `apps/cli`.

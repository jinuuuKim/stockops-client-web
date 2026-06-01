# StockOps Client Web

Store/client-facing StockOps portal for scoped inventory lookup, purchase-order requests, purchase-order history, and AI chat access.

## Features

- HttpOnly refresh-cookie session restoration through `POST /api/v1/auth/refresh`
- Role and permission based navigation for `ADMIN`, `CENTER`, `WAREHOUSE`, `STORE_MANAGER`, and `STORE_STAFF`
- Inventory lookup with keyword, location, and low-stock filters
- Purchase-order request flow using the current StockOps API contract
- AI chatbot overlay prepared for `/api/v1/ai/chat` and `/api/v1/ai/chat/history`

## Local Setup

```powershell
npm install
npm run dev
```

The app expects an API proxy at `/api` by default. For direct API access:

```powershell
$env:VITE_API_BASE_URL = 'http://localhost:18080/api'
npm run dev
```

## Verification

```powershell
npm run test:run
npm run lint
npm run build
```

## Docker

```powershell
docker build -t stockops-client-web --build-arg VITE_API_BASE_URL=/api .
docker run --rm -p 18082:80 stockops-client-web
```

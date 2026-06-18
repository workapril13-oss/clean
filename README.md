# Supply Cost Tracker

A single-page React app for cleaning businesses to track product inventory, job supply usage, gross margin, and supply-cost alerts.

## Features

- Product inventory with editable cost per unit
- Job logger with cleaner assignment and supply usage line items
- Automatic margin and margin percentage calculations
- Dashboard views by client, cleaner, and product
- Alerts for jobs where supply cost exceeds 15% of the client charge

## Stack

- React + TypeScript
- Vite
- Tailwind CSS
- Recharts

## Run

Install dependencies and start the app with your local Node.js toolchain:

```bash
npm install
npm run dev
```

## Notes

- The app uses in-memory React state only.
- Seed data is preloaded for products, cleaners, and jobs.

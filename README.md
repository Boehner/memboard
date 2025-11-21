# 🧠 MemBoard – Creator Data Dashboard

MemBoard is a minimal React app that demonstrates **how creators can connect to the Memory Protocol**, view their data connections, and simulate $MEM earnings.

> Built for the [Memory Protocol Builder Rewards](https://memory.build).

## Features

- Connect Memory ID or wallet
- Fetch and display data graph
- Show mock $MEM earnings potential
- Built with React + Tailwind + Vite

## Setup

```bash
git clone https://github.com/YOUR_USERNAME/memboard.git
cd memboard
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### WalletConnect Project ID (RainbowKit)

This app now uses RainbowKit + wagmi for wallet connection. To enable WalletConnect compatible wallets you must supply a Project ID.

1. Create a free WalletConnect Cloud account: https://www.walletconnect.com/
2. Generate a Project ID.
3. Create a `.env` file in the project root:

```
VITE_WALLETCONNECT_PROJECT_ID=YOUR_PROJECT_ID_HERE
```

4. Restart the dev server.

If you do not set the variable, a placeholder `YOUR_PROJECT_ID` is used and WalletConnect based connections may fail.

## File Overview

- `src/api/memory.js` – API handler for Memory Protocol
- `src/components/` – modular React components
- `src/App.jsx` – main UI logic
- `src/main.jsx` – RainbowKit / wagmi / React Query provider setup

import { spawn } from "node:child_process";

console.log("Starting BrandGen full-stack development workspace...");

// 1. Start Express API server on Port 3001
const apiProcess = spawn("npx", [
  "tsx",
  "artifacts/api-server/src/index.ts"
], {
  env: {
    ...process.env,
    PORT: "3001",
    NODE_ENV: "development"
  },
  stdio: "inherit",
  shell: true
});

// 2. Start Vite development server on Port 3000 (accessible externally)
const viteProcess = spawn("npm", [
  "run",
  "dev",
  "--workspace=@workspace/brand-generator",
  "--",
  "--port",
  "3000"
], {
  env: {
    ...process.env,
    PORT: "3000",
    BASE_PATH: "/",
    NODE_ENV: "development"
  },
  stdio: "inherit",
  shell: true
});

// Handle graceful shutdown
const cleanup = () => {
  console.log("\nStopping all development servers...");
  try {
    apiProcess.kill();
  } catch (e) {}
  try {
    viteProcess.kill();
  } catch (e) {}
  process.exit(0);
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("exit", cleanup);

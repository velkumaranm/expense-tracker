import { spawn } from "node:child_process";

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

const spawnProc = (label, args) => {
  const child = spawn(npmCmd, args, {
    stdio: "inherit",
    shell: false,
  });
  child.on("exit", (code) => {
    if (code !== 0) {
      console.error(`${label} exited with code ${code}`);
      process.exit(code || 1);
    }
  });
  return child;
};

const proxy = spawnProc("proxy", ["run", "proxy"]);
const vite = spawnProc("vite", ["run", "dev"]);

const shutdown = () => {
  proxy.kill("SIGTERM");
  vite.kill("SIGTERM");
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

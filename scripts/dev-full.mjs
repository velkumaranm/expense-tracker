import { spawn } from "node:child_process";
import net from "node:net";

const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
const PROXY_HOST = "127.0.0.1";
const PROXY_PORT = 8787;

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

const canConnect = (host, port) =>
  new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.setTimeout(800, () => {
      socket.destroy();
      resolve(false);
    });
  });

const proxyRunning = await canConnect(PROXY_HOST, PROXY_PORT);
const proxy = proxyRunning ? null : spawnProc("proxy", ["run", "proxy"]);
const vite = spawnProc("vite", ["run", "dev"]);

if (proxyRunning) {
  console.log(`proxy already running on http://${PROXY_HOST}:${PROXY_PORT} — reusing existing process`);
}

const shutdown = () => {
  if (proxy) proxy.kill("SIGTERM");
  vite.kill("SIGTERM");
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

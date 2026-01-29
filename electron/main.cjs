const { app, BrowserWindow } = require("electron");
const http = require("http");
const next = require("next");

let server;

async function startNextServer() {
  const appDir = app.getAppPath();
  const nextApp = next({ dev: false, dir: appDir });
  const handle = nextApp.getRequestHandler();

  await nextApp.prepare();

  server = http.createServer((req, res) => handle(req, res));

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}

async function createWindow() {
  const url = await startNextServer();
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  await win.loadURL(url);
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (server) {
    server.close();
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});

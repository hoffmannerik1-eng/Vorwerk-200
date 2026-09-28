const http = require("http");
const net = require("net");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PORT = 3000;
const VR_PORT = 49001;

function getLocalSubnet() {
  const interfaces = os.networkInterfaces();

  for (const name of Object.keys(interfaces)) {
    for (const info of interfaces[name] || []) {
      if (info.family === "IPv4" && !info.internal) {
        const parts = info.address.split(".");
        return parts.slice(0, 3).join(".");
      }
    }
  }

  return null;
}

function testPort(ip, timeout = 500) {
  return new Promise(resolve => {
    const socket = new net.Socket();

    const done = result => {
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeout);

    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));

    socket.connect(VR_PORT, ip);
  });
}

async function findVR200() {
  const subnet = getLocalSubnet();

  if (!subnet) return [];

  const found = [];

  // Kleine parallele Suche im lokalen WLAN
  const jobs = [];

  for (let i = 1; i <= 254; i++) {
    const ip = `${subnet}.${i}`;

    jobs.push(
      testPort(ip).then(open => {
        if (open) found.push(ip);
      })
    );
  }

  await Promise.all(jobs);
  return found;
}

const server = http.createServer(async (req, res) => {

  if (req.url === "/api/find") {
    try {
      const robots = await findVR200();

      res.writeHead(200, {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      });

      res.end(JSON.stringify({
        success: true,
        robots
      }));

    } catch (error) {
      res.writeHead(500, {
        "Content-Type": "application/json"
      });

      res.end(JSON.stringify({
        success: false,
        error: error.message
      }));
    }

    return;
  }

  let file = req.url === "/" ? "/index.html" : req.url;
  file = path.join(__dirname, "public", file);

  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Nicht gefunden");
      return;
    }

    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8"
    });

    res.end(data);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("");
  console.log("VR200 Browser-Steuerung läuft!");
  console.log(`PC:     http://localhost:${PORT}`);
  console.log(`Tablet:  http://DEINE-PC-IP:${PORT}`);
  console.log("");
});

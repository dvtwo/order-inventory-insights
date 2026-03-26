import { createRequestHandler } from "@react-router/node";
import { createReadableStreamFromReadable } from "@react-router/node";
import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { handler as remixHandler } from "../build/server/index.js";

const port = process.env.PORT || 3000;

const requestHandler = createRequestHandler({
  build: remixHandler,
  mode: process.env.NODE_ENV,
});

const server = createServer(async (req, res) => {
  const body = new PassThrough();
  const stream = createReadableStreamFromReadable(body);

  try {
    const response = await requestHandler(req);
    response.body?.pipe(body);
    res.writeHead(response.status, Object.fromEntries(response.headers));
    stream.pipe(res);
  } catch (error) {
    console.error(error);
    res.writeHead(500);
    res.end("Internal Server Error");
  }
});

server.listen(port, () => {
  console.log(`🚀 Server listening on port ${port}`);
});

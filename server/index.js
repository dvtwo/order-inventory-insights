import { createRequestHandler } from "@react-router/node";
import * as build from "../build/server/index.js";
import { createServer } from "node:http";

const port = process.env.PORT || 3000;

const requestHandler = createRequestHandler({
  build,
  mode: process.env.NODE_ENV,
});

const server = createServer(requestHandler);

server.listen(port, () => {
  console.log(`🚀 Server listening on port ${port}`);
});

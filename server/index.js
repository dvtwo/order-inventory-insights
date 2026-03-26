import handler from "../build/server/index.js";
import { createServer } from "node:http";

const port = process.env.PORT || 3000;

const server = createServer(handler);

server.listen(port, () => {
  console.log(`🚀 Server listening on port ${port}`);
});

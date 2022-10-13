import express from "express";
import path from "path";
import { Server } from "socket.io";
import http from "http";
import type Client from "../api/class/Client";
// @ts-ignore
import exceptionHandler from "express-exception-handler";
exceptionHandler.handle();
import cors from "cors";

import error from "../api/middlewares/error";

const app = express();


const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

io.on("connection", (socket) => {
  logger.info(`A user with id ${socket.id} is connected`);
  
  socket.on("disconnect", () => {
    console.log(`socket ${socket.id} disconnected`);
  });
});

export { io };

app.use(
  cors({
    origin: "*",
  })
);
app.use(express.json());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../api/views"));

declare global {
  var WhatsAppInstances: Map<string, Client>;
}

global.WhatsAppInstances = new Map<string, Client>();

import routes from "../api/routes/";
import { logger } from "../api/utils";

app.use("/", routes);
app.use(error.handler);

export default server;

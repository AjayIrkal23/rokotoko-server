import { Server } from "socket.io";

declare module "fastify" {
  interface FastifyInstance {
    io: Server;
  }
}

declare module "fastify" {
  interface FastifyRequest {
    user?: {
      email: string;
      super_adminid: boolean;
      [key: string]: any;
    };
  }
}

type ParseRTSPBody = {
  rtspUrl: string;
  camera_brand: string;
};

declare global {
  var io: Server;
}

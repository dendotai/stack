import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";

// The only routes on this router are Better Auth's (ADR 0004); app-owned
// endpoints live in the web app. registerRoutes also builds auth once at push
// time, which is what makes a missing auth variable fail the deploy.
const http = httpRouter();

authComponent.registerRoutes(http, createAuth);

export default http;

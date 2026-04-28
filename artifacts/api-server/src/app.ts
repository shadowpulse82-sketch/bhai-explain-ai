import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

app.use("/api", router);

app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const e = err as { type?: string; status?: number; message?: string };
  req.log?.error({ err }, "request error");
  if (res.headersSent) return;
  if (e?.type === "entity.too.large" || e?.status === 413) {
    res.status(413).json({
      error:
        "That photo is too big. Try a smaller picture (or one zoomed in on just the question).",
    });
    return;
  }
  res.status(e?.status ?? 500).json({
    error: e?.message ?? "Something went wrong on the server.",
  });
});

export default app;

import "dotenv/config";
import cors from "cors";
import { ethers } from "ethers";
import express, { Request, Response } from "express";
import { paymentMiddleware } from "x402-express";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT) || 3000;
const PAY_TO = (process.env.PAY_TO_ADDRESS ||
  "0x0000000000000000000000000000000000000000") as `0x${string}`;
const FACILITATOR_URL = (process.env.FACILITATOR_URL ||
  "https://x402.org/facilitator") as `${string}://${string}`;
const BASE_RPC_URL =
  process.env.BASE_RPC_URL || "https://mainnet.base.org";

const provider = new ethers.JsonRpcProvider(BASE_RPC_URL);

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    service: "x402-node",
    network: "base",
  });
});

app.use(
  paymentMiddleware(
    PAY_TO,
    {
      "GET /api/status": {
        price: "$0.001",
        network: "base",
        config: {
          description: "Base x402 node status and latest block info",
        },
      },
    },
    {
      url: FACILITATOR_URL,
    }
  )
);

app.get("/api/status", async (_req: Request, res: Response) => {
  try {
    const blockNumber = await provider.getBlockNumber();
    res.status(200).json({
      network: "base",
      latestBlock: blockNumber,
      payTo: PAY_TO,
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to read Base RPC",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`x402-node listening on port ${PORT}`);
});

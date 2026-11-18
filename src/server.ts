import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { ethers } from 'ethers';
import { paymentMiddleware } from 'x402-express';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const PAY_TO = process.env.PAY_TO || '0x0000000000000000000000000000000000000000';
const NETWORK = (process.env.NETWORK || 'base') as 'base' | 'base-sepolia';
const RPC_URL = process.env.RPC_URL || 'https://mainnet.base.org';

const provider = new ethers.JsonRpcProvider(RPC_URL);

// Enforce x402 USDC micro-payments on paid endpoints
app.use(
  paymentMiddleware(PAY_TO, {
    'POST /api/decode-tx': {
      price: '$0.005',
      network: NETWORK,
      config: {
        description: 'Decode raw EVM transaction calldata and value into plain parameters',
      },
    },
    'GET /api/scan-unclaimed': {
      price: '$0.01',
      network: NETWORK,
      config: {
        description: 'Scan wallet address activity and on-chain eligibility metrics on Base',
      },
    },
  })
);

// Free health check endpoint for Render
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'online', network: NETWORK, payTo: PAY_TO });
});

// Paid Endpoint 1: Calldata Decoder ($0.005 USDC)
app.post('/api/decode-tx', (req: Request, res: Response) => {
  try {
    const { data, value } = req.body;
    if (!data || typeof data !== 'string' || !data.startsWith('0x')) {
      res.status(400).json({ error: 'Valid hex calldata string required in body.data' });
      return;
    }

    const selector = data.slice(0, 10);
    const paramsHex = data.slice(10);
    const chunks = paramsHex.match(/.{1,64}/g) || [];
    const ethValue = value ? ethers.formatEther(BigInt(value)) : '0.0';

    res.json({
      network: NETWORK,
      selector,
      ethValue,
      parameterCount: chunks.length,
      rawWords: chunks.map((c, i) => ({ index: i, hex: `0x${c}` })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to decode transaction' });
  }
});

// Paid Endpoint 2: Wallet Activity & Eligibility Scanner ($0.01 USDC)
app.get('/api/scan-unclaimed', async (req: Request, res: Response) => {
  try {
    const address = req.query.address as string;
    if (!address || !ethers.isAddress(address)) {
      res.status(400).json({ error: 'Valid EVM wallet address required as ?address=0x...' });
      return;
    }

    const [balanceWei, txCount] = await Promise.all([
      provider.getBalance(address),
      provider.getTransactionCount(address),
    ]);

    res.json({
      address,
      network: NETWORK,
      nativeBalanceEth: ethers.formatEther(balanceWei),
      outboundTxCount: txCount,
      activeStatus: txCount > 0 ? 'active' : 'dormant',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to scan wallet' });
  }
});

app.listen(PORT, () => {
  console.log(`x402 Node running on port ${PORT} [${NETWORK}] -> Routing USDC to ${PAY_TO}`);
});

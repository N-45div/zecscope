import { FastifyInstance } from 'fastify'

export async function registerZcashRoutes(app: FastifyInstance) {
  app.get('/chain-info', async () => {
    // TODO: wire this to lightwalletd GetInfo via gRPC
    return {
      network: 'zcash-mainnet',
      height: 0,
      saplingActivationHeight: 0,
    }
  })

  app.get('/blocks', async (request) => {
    const query = request.query as { startHeight?: string; endHeight?: string }

    const startHeight = Number(query.startHeight ?? '0')
    const endHeight = Number(query.endHeight ?? '0')

    // TODO: implement real lightwalletd GetBlockRange call here
    return {
      startHeight,
      endHeight,
      blocks: [],
    }
  })
}

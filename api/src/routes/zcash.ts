import { FastifyInstance } from 'fastify'
import { getBlockRange, getLightdInfo } from '../lightwalletdClient'

export async function registerZcashRoutes(app: FastifyInstance) {
  app.get('/chain-info', async (request, reply) => {
    try {
      const info = await getLightdInfo()

      const height = Number(info.blockHeight)
      const saplingActivationHeight = Number(info.saplingActivationHeight)

      return {
        network: info.chainName === 'main' ? 'zcash-mainnet' : 'zcash-testnet',
        height,
        saplingActivationHeight,
      }
    } catch (err) {
      request.log.error({ err }, 'Failed to fetch lightwalletd info')
      return reply.code(502).send({ error: 'Failed to reach lightwalletd backend' })
    }
  })

  app.get('/blocks', async (request, reply) => {
    const query = request.query as { startHeight?: string; endHeight?: string }

    try {
      const info = await getLightdInfo()
      const tipHeight = Number(info.blockHeight)

      const startHeight = query.startHeight ? Number(query.startHeight) : Math.max(tipHeight - 1_000, 0)
      const endHeight = query.endHeight ? Number(query.endHeight) : tipHeight

      if (Number.isNaN(startHeight) || Number.isNaN(endHeight)) {
        return reply.code(400).send({ error: 'Invalid startHeight or endHeight' })
      }

      const blocks = await getBlockRange({
        start: { height: startHeight },
        end: { height: endHeight },
      })

      return {
        startHeight,
        endHeight,
        count: blocks.length,
        blocks,
      }
    } catch (err) {
      request.log.error({ err }, 'Failed to fetch blocks from lightwalletd')
      return reply.code(502).send({ error: 'Failed to fetch blocks from lightwalletd backend' })
    }
  })
}

import Fastify from 'fastify'
import { registerZcashRoutes } from './routes/zcash'

const server = Fastify({
  logger: true,
})

server.register(
  async (app) => {
    app.get('/health', async () => {
      return { status: 'ok' }
    })

    await registerZcashRoutes(app)
  },
  { prefix: '/api' },
)

const PORT = Number(process.env.PORT || 4000)

server
  .listen({ port: PORT, host: '0.0.0.0' })
  .then((address) => {
    server.log.info(`API server listening at ${address}`)
  })
  .catch((err) => {
    server.log.error(err)
    process.exit(1)
  })

import path from 'node:path'
import * as grpc from '@grpc/grpc-js'
import * as protoLoader from '@grpc/proto-loader'

const DEFAULT_ENDPOINT = process.env.LIGHTWALLETD_ENDPOINT ?? 'mainnet.lightwalletd.com:9067'

const serviceProtoPath = path.resolve(
  __dirname,
  '../../proto/service.proto',
)
const includeDir = path.resolve(__dirname, '../../proto')

const packageDefinition = protoLoader.loadSync(serviceProtoPath, {
  keepCase: false,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
  includeDirs: [includeDir],
})

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const zcashProto = grpc.loadPackageDefinition(packageDefinition) as any

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CompactTxStreamer = zcashProto.cash.z.wallet.sdk.rpc.CompactTxStreamer as any

const client = new CompactTxStreamer(
  DEFAULT_ENDPOINT,
  grpc.credentials.createSsl(),
)

export type LightdInfoMessage = {
  version: string
  vendor: string
  taddrSupport: boolean
  chainName: string
  saplingActivationHeight: string | number
  consensusBranchId: string
  blockHeight: string | number
  gitCommit: string
  branch: string
  buildDate: string
  buildUser: string
  estimatedHeight: string | number
}

export async function getLightdInfo(): Promise<LightdInfoMessage> {
  return new Promise((resolve, reject) => {
    client.GetLightdInfo({}, (err: grpc.ServiceError | null, resp: LightdInfoMessage) => {
      if (err) return reject(err)
      resolve(resp)
    })
  })
}

export type BlockRangeRequest = {
  start: { height: number }
  end: { height: number }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getBlockRange(req: BlockRangeRequest): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const blocks: any[] = []

    const stream = client.GetBlockRange(req)

    stream.on('data', (block: unknown) => {
      blocks.push(block)
    })

    stream.on('error', (err: grpc.ServiceError) => {
      reject(err)
    })

    stream.on('end', () => {
      resolve(blocks)
    })
  })
}

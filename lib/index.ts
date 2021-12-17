import debug from 'debug';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { Buffer } from 'buffer';

// eslint-disable-next-line no-unused-vars
export enum FlowNetwork {
  // eslint-disable-next-line no-unused-vars
  EMULATOR,
  // eslint-disable-next-line no-unused-vars
  TESTNET,
  // eslint-disable-next-line no-unused-vars
  MAINNET
}

// eslint-disable-next-line no-unused-vars
enum FlowWorkType {
  // eslint-disable-next-line no-unused-vars
  SCRIPT,
  // eslint-disable-next-line no-unused-vars
  TRANSACTION,
  // eslint-disable-next-line no-unused-vars
  GetLatestBlockHeader,
  // eslint-disable-next-line no-unused-vars
  GetBlockHeaderByID,
  // eslint-disable-next-line no-unused-vars
  GetBlockHeaderByHeight,
  // eslint-disable-next-line no-unused-vars
  GetLatestBlock,
  // eslint-disable-next-line no-unused-vars
  GetBlockByID,
  // eslint-disable-next-line no-unused-vars
  GetBlockByHeight,
  // eslint-disable-next-line no-unused-vars
  GetCollectionByID,
  // eslint-disable-next-line no-unused-vars
  GetTransaction,
  // eslint-disable-next-line no-unused-vars
  GetTransactionResult,
  // eslint-disable-next-line no-unused-vars
  GetAccountAtLatestBlock,
  // eslint-disable-next-line no-unused-vars
  GetAccountAtBlockHeight,
  // eslint-disable-next-line no-unused-vars
  GetEventsForHeightRange,
}

// eslint-disable-next-line no-unused-vars
enum FlowWorkerStatus {
  // eslint-disable-next-line no-unused-vars
  CONNECTING,
  // eslint-disable-next-line no-unused-vars
  IDLE,
  // eslint-disable-next-line no-unused-vars
  PROCESSING,
}

export interface FlowKey {
  keyID: number;
  private: string;
  public?: string;
}

export interface Account {
  keys: Array<AccountKey>;
  contracts: Object;
  address: Buffer;
  balance: string;
  code: Buffer;
}

export interface Block {
  id: Buffer;
  parent_id: Buffer;
  height: number;
  timestamp: Timestamp;
  collection_guarantees: Array<CollectionGuarantee>;
  block_seals: Array<BlockSeal>;
  signatures: Array<Buffer>;
}

export interface Timestamp {
  // Represents seconds of UTC time since Unix epoch
  // 1970-01-01T00:00:00Z. Must be from 0001-01-01T00:00:00Z to
  // 9999-12-31T23:59:59Z inclusive.
  seconds: number;

  // Non-negative fractions of a second at nanosecond resolution. Negative
  // second values with fractions must still have non-negative nanos values
  // that count forward in time. Must be from 0 to 999,999,999
  // inclusive.
  nanos: number;
}

export interface CollectionGuarantee {
  collection_id: Buffer;
  signatures: Array<Buffer>;
}

export interface BlockSeal {
  block_id: Buffer;
  execution_receipt_id: Buffer;
  execution_receipt_signatures: Array<Buffer>;
  result_approval_signatures: Array<Buffer>;
}

export interface AccountKey {
  id: number;
  public_key: Buffer,
  sign_algo: number;
  hash_algo: number;
  weight: number;
  sequence_number: number;
  revoked: Boolean;
}

interface FlowWork {
  type: FlowWorkType;
  script?: string;
  arguments?: Array<any>;
  proposer?: FlowKey;
  callback?: Function;
}

export class Flow {
  private serviceAccountAddress: string;
  private network: string;
  private privateKeys: Array<FlowKey> = [];
  private workers: Array<FlowWorker> = [];
  private work: Array<FlowWork> = [];
  private dbg: debug.IDebugger;
  private error: any;
  private shutdown: Boolean = false;
  private tickTimeout: number = 20;

  constructor(network: FlowNetwork | string, serviceAccountAddress: string, privateKeys: Array<FlowKey>, tick?: number) {
    tick ? this.tickTimeout = tick : 20;
    this.dbg = debug('Flow');
    switch (network) {
      case FlowNetwork.EMULATOR:
        this.network = '127.0.0.1:3569';
        break;
      case FlowNetwork.TESTNET:
        this.network = 'access.devnet.nodes.onflow.org:9000';
        break;
      case FlowNetwork.MAINNET:
        this.network = 'access.mainnet.nodes.onflow.org:9000';
        break;

      default:
        this.network = network;
        break;
    }
    this.serviceAccountAddress = serviceAccountAddress.replace(/\b0x/g, '');
    this.privateKeys = privateKeys;
  }

  async start(): Promise<void> {
    this.dbg('Starting Flow.ts');
    this.dbg('Access Node:', this.network);
    this.dbg('Private Keys:', this.privateKeys.length);

    const processingConnections: Promise<any>[] = [];
    this.privateKeys.forEach((k) => {
      processingConnections.push(new Promise(async (p) => {
        const worker = new FlowWorker(k.private, k.keyID, this.network);
        await worker.connect();
        this.workers.push(worker);
        p(true);
      }));
    });
    await Promise.all(processingConnections);
    this.dbg('Workers:', this.workers.length);
    this.dbg('Flow.ts Ready');
    this.tick();
  }
  private async tick() {
    const beginningCount = this.work.length;
    if (beginningCount > 0) {
      this.workers.forEach((w) => {
        if (this.work.length > 0 && w.status == FlowWorkerStatus.IDLE) {
          w.process(this.work.splice(0, 1)[0]);
        }
      });
      if (this.work.length > 0) {
        this.dbg('All workers are busy, work remaining:', this.work.length);
      }
      if (this.shutdown) this.dbg('Cleaning up for shutdown');
    }
    if (this.error) console.log('Error:', this.error);
    if (!this.shutdown || this.work.length > 0) setTimeout(() => this.tick(), this.tickTimeout);
  }
  stop() {
    this.shutdown = true;
  }
  async get_account(accountAddress: string, blockHeight?: number): Promise<Account | Error> {
    return new Promise((p) => {
      const cb = (err: Error, res: any) => {
        if (err) p(err);
        p(res['account']);
      };
      if (typeof blockHeight == 'number') {
        this.work.push({
          type: FlowWorkType.GetAccountAtBlockHeight,
          arguments: [accountAddress, blockHeight],
          callback: cb,
        });
      } else {
        this.work.push({
          type: FlowWorkType.GetAccountAtLatestBlock,
          arguments: [accountAddress],
          callback: cb,
        });
      }
    });
  }
  async execute_script(script: string, arg: any[]): Promise<any> {
    return new Promise((p) => {
      const cb = (err: Error, res: any) => {
        if (err) p(err);
        this.dbg('execute_script response is:', res);
        p(res);
      };
      this.work.push({
        type: FlowWorkType.SCRIPT,
        script: script,
        arguments: arg,
        callback: cb,
      });
    });
  }
  async execute_transaction(script: string, arg: any[]): Promise<any> {
    return new Promise((p) => {
      const cb = (err: Error, res: any) => {
        if (err) p(err);
        this.dbg('execute_transaction response is:', res);
        p(res);
      };
      this.work.push({
        type: FlowWorkType.TRANSACTION,
        script: script,
        arguments: arg,
        callback: cb,
      });
    });
  }
  async create_account(newAccountKeys: Array<FlowKey>): Promise<any> {
    return new Promise((p) => {
      const cb = (err: Error, res: any) => {
        if (err) p(err);
        this.dbg('execute_transaction response is:', res);
        p(res);
      };
      // prep out transaction here
      const createAcct = '';
      this.work.push({
        type: FlowWorkType.TRANSACTION,
        script: createAcct,
        arguments: [],
        callback: cb,
      });
    });
  }
  async get_block(blockId?: string, blockHeight?: number, sealed?: boolean): Promise<Block | Error> {
    const isSealed = sealed ? sealed : false;
    return new Promise((p) => {
      const cb = (err: Error, res: any) => {
        if (err) p(err);
        p(res['block']);
      };
      if (blockId) {
        this.work.push({
          type: FlowWorkType.GetBlockByID,
          arguments: [blockId, isSealed],
          callback: cb,
        });
      } else if (blockHeight) {
        this.work.push({
          type: FlowWorkType.GetBlockByHeight,
          arguments: [blockHeight, isSealed],
          callback: cb,
        });
      } else {
        this.work.push({
          type: FlowWorkType.GetLatestBlock,
          arguments: [isSealed],
          callback: cb,
        });
      }
    });
  }
}

class FlowWorker {
  key: string;
  id: number;
  dbg: debug.IDebugger;
  private network: string;
  private access: any;
  private client: any;
  public status: number;
  constructor(key: string, id: number, network: string) {
    const debugLog: debug.IDebugger = debug(`FlowWorker::${id}::Constructor`);
    this.dbg = debug(`FlowWorker::${id}`);
    this.key = key;
    this.id = id;
    this.network = network;
    this.status = FlowWorkerStatus.CONNECTING;
    debugLog('Worker registered');
    debugLog('Loading Protobufs');
    const packageDefinition = protoLoader.loadSync('flow.proto', {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    this.access = (<any>grpc.loadPackageDefinition(packageDefinition).flow)['access'];
  }
  async connect(): Promise<void> {
    return new Promise((p) => {
      this.dbg('Connecting');
      this.client = new this.access['AccessAPI'](this.network, grpc.credentials.createInsecure());
      this.client.ping({}, (err: any) => {
        if (err) {
          this.dbg('Error while connecting');
          return Promise.reject(Error('Could not establish connection'));
        } else {
          this.status = FlowWorkerStatus.IDLE;
          this.dbg('Connection success');
          p();
        }
      });
    });
  }
  process(work: FlowWork): Promise<void> {
    this.status = FlowWorkerStatus.PROCESSING;
    return new Promise(async (p) => {
      this.dbg('Processing', FlowWorkType[work.type]);
      // process the work
      switch (work.type) {
        case FlowWorkType.GetAccountAtLatestBlock:
          if (work.arguments) {
            const bufArg = Buffer.from(work.arguments[0].toString().replace(/\b0x/g, ''), 'hex');
            this.client.getAccountAtLatestBlock({ address: bufArg }, (err: any, res: any) => {
              if (work.callback) work.callback(err, res);
              this.status = FlowWorkerStatus.IDLE;
              p();
            });
          } else {
            if (work.callback) work.callback(Error('Account argument required. Proper usage: Flow.get_account(\'0xf8d6e0586b0a20c7\')'));
            this.status = FlowWorkerStatus.IDLE;
            p();
          }
          break;

        case FlowWorkType.GetAccountAtBlockHeight:
          if (work.arguments) {
            const bufArg = Buffer.from(work.arguments[0].toString().replace(/\b0x/g, ''), 'hex');
            this.client.getAccountAtBlockHeight({ address: bufArg, block_height: parseInt(work.arguments[1]) }, (err: any, res: any) => {
              if (work.callback) work.callback(err, res);
              this.status = FlowWorkerStatus.IDLE;
              p();
            });
          } else {
            if (work.callback) work.callback(Error('Account argument required. Proper usage: Flow.get_account(\'0xf8d6e0586b0a20c7\')'));
            this.status = FlowWorkerStatus.IDLE;
            p();
          }
          break;

        case FlowWorkType.GetLatestBlock:
          if (work.arguments) {
            if (typeof work.arguments[0] !== 'boolean') return Promise.reject(Error(`arg 0 must be a bool: GetLatestBlock, found ${work.arguments[0]}`));
            this.client.getLatestBlock({ is_sealed: work.arguments[0] }, (err: any, res: any) => {
              if (work.callback) work.callback(err, res);
              this.status = FlowWorkerStatus.IDLE;
              p();
            });
          } else {
            if (work.callback) work.callback(Error('is_sealed was not provided'));
            this.status = FlowWorkerStatus.IDLE;
            p();
          }
          break;

        default:
          this.dbg(FlowWorkType[work.type], 'is not implemented.');
          if (work.callback) work.callback(Error(`${FlowWorkType[work.type]} is not implemented`));
          this.status = FlowWorkerStatus.IDLE;
          p();
          break;
      }
    });
  }
}

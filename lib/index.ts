/* eslint-disable camelcase */
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { Account, Block, Event, Transaction, TransactionQueuedResponse, TransactionResultResponse } from './models';
import { flowProto } from './flowproto';
export * from './models';
import * as fs from 'fs';

export class Flow {
  private access: any;
  private client: any;
  private network: string;
  constructor(network: string) {
    this.network = network;
  }
  public async start() {
    await new Promise((p) => fs.writeFile('flow.proto', flowProto, p));
    const packageDefinition = protoLoader.loadSync('./flow.proto', {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    switch (this.network) {
      case 'testnet':
        this.network = 'access.devnet.nodes.onflow.org:9000';
        break;
      case 'localhost':
        this.network = '127.0.0.1:3569';
        break;
      case 'mainnet':
        this.network = 'access.mainnet.nodes.onflow.org:9000';
        break;

      default:
        break;
    }
    this.access = (<any>grpc.loadPackageDefinition(packageDefinition).flow)['access'];
    this.client = new this.access['AccessAPI'](this.network, grpc.credentials.createInsecure());
  }
  public async getLatestBlock(sealed: boolean = false): Promise<Block | Error> {
    return await new Promise<Block | Error>((p) => {
      this.client.getLatestBlock({ is_sealed: sealed }, (err: Error, res: any) => {
        if (err) return p(err);
        p(res['block']);
      });
    });
  }
  public async getTransaction(transactionId: Buffer): Promise<Transaction | Error> {
    return await new Promise<Transaction | Error>((p) => {
      this.client.getTransaction({ id: transactionId }, (err: any, res: any) => {
        if (err) return p(err);
        p(res['transaction']);
      });
    });
  }
  public async getTransactionResult(transactionId: Buffer): Promise<TransactionResultResponse | Error> {
    return await new Promise<TransactionResultResponse | Error>((p) => {
      this.client.getTransactionResult({ id: transactionId }, (err: any, res: any) => {
        if (err) return p(err);
        p({ id: transactionId, ...res });
      });
    });
  }
  public async submitTransaction(transaction: Transaction): Promise<TransactionQueuedResponse | Error> {
    return await new Promise<TransactionQueuedResponse | Error>((p) => {
      this.client.sendTransaction({ transaction: transaction }, (err: Error, res: any) => {
        if (err) return p(err);
        p(res);
      });
    });
  }
  public async getAccount(address: Buffer): Promise<Account | Error> {
    return await new Promise<Account | Error>((p) => {
      this.client.getAccountAtLatestBlock({ address }, (err: any, res: any) => {
        if (err) return Promise.reject(err);
        p(res['account']);
      });
    });
  }
  public async executeScript(script: Buffer, args: Buffer[]): Promise<{ value: Buffer } | Error> {
    return await new Promise<any | Error>((p) => {
      this.client.executeScriptAtLatestBlock({ script: script, arguments: args }, (err: any, res: any) => {
        if (err) return p(err);
        p(res);
      });
    });
  }
  public async getEventsWithinBlockHeight(type: string, startHeight: number, endHeight: number): Promise<Event[] | Error> {
    return await new Promise<Event[] | Error>((p) => {
      this.client.getEventsForHeightRange({ type, start_height: startHeight, end_height: endHeight }, (err: any, res: any) => {
        if (err) return p(err);
        p(res['results'].map((x: any) => x.events).flat());
      });
    });
  }
  public async getEvents(type: string, blockIds: Array<Buffer>): Promise<Event[] | Error> {
    return await new Promise<Event[] | Error>((p) => {
      this.client.getEventsForBlockIDs({ type, block_ids: blockIds }, (err: any, res: any) => {
        if (err) return p(err);
        p(res['results'].map((x: any) => x.events).flat());
      });
    });
  }
}

/* eslint-disable camelcase */
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { Account, Block, Event, Transaction, TransactionQueuedResponse, TransactionResultResponse } from './models';
import { flowProto } from './flowproto';

export class Flow {
  private access: any;
  private client: any;
  constructor() {
    const packageDefinition = protoLoader.loadFileDescriptorSetFromBuffer(Buffer.from(flowProto, 'utf-8'), {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    this.access = (<any>grpc.loadPackageDefinition(packageDefinition).flow)['access'];
  }
  public async getLatestBlock(sealed: boolean = false): Promise<Block | Error> {
    return await new Promise<Block | Error>((p) => {
      this.client.getLatestBlock({ is_sealed: sealed }, (err: Error, res: any) => {
        if (err) return p(err);
        p(res['block'][0]);
      });
    });
  }
  public async getBlock(blockId: Buffer): Promise<Block | Error> {
    return await new Promise<Block | Error>((p) => {
    });
  }
  public async getBlocksByHeight(heightIds: Array<number>): Promise<Block[] | Error> {
    return await new Promise<Block[] | Error>((p) => {
    });
  }
  public async getBlocksInRange(startHeight: number, endHeight: number): Promise<Block[] | Error> {
    return await new Promise<Block[] | Error>((p) => {
    });
  }
  public async getTransaction(transactionId: Buffer): Promise<Transaction | Error> {
    return await new Promise<Transaction | Error>((p) => {
    });
  }
  public async getTransactionResult(transactionId: Buffer): Promise<TransactionResultResponse | Error> {
    return await new Promise<TransactionResultResponse | Error>((p) => {
      this.client.getTransactionResult({ id: transactionId }, (err: any, res: any) => {
        if (err) return p(err);
        p(res['transaction']); // double check on this
      });
    });
  }
  public async submitTransaction(transaction: Transaction): Promise<TransactionQueuedResponse | Error> {
    return await new Promise<TransactionQueuedResponse | Error>((p) => {
      this.client.sendTransaction({ transaction: transaction }, (err: Error, res: any) => {
        if (err) return p(err);
        p(res['transaction']);
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
  public async executeScript(script: Buffer, args: Buffer[]): Promise<any | Error> {
    return await new Promise<any | Error>((p) => {
      this.client.executeScriptAtLatestBlock({ script: script, arguments: args }, (err: any, res: any) => {
        if (err) return p(err);
        p(res);
      });
    });
  }
  public async getEventsWithinBlockHeight(type: string, startHeight: number, endHeight: number): Promise<Event | Error> {
    return await new Promise<Event | Error>((p) => {
    });
  }
  public async getEvents(type: string, blockIds: Array<string>): Promise<Event | Error> {
    return await new Promise<Event | Error>((p) => {
    });
  }
}

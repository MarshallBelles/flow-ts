import debug from 'debug';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { Buffer } from 'buffer';
import { ec as EC } from 'elliptic';
import { SHA3 } from 'sha3';

export const encode = (input: any) => {
  if (Array.isArray(input)) {
    const output = [];
    for (let i = 0; i < input.length; i++) {
      output.push(encode(input[i]));
    }
    const buf = Buffer.concat(output);
    return Buffer.concat([encodeLength(buf.length, 192), buf]);
  } else {
    const inputBuf = toBuffer(input);
    return inputBuf.length === 1 && inputBuf[0] < 128 ?
      inputBuf :
      Buffer.concat([encodeLength(inputBuf.length, 128), inputBuf]);
  }
};

const safeParseInt = (v: any, base: any) => {
  if (v.slice(0, 2) === '00') {
    throw new Error('invalid RLP: extra zeros');
  }
  return parseInt(v, base);
};

const encodeLength = (len: number, offset: number) => {
  if (len < 56) {
    return Buffer.from([len + offset]);
  } else {
    const hexLength = intToHex(len);
    const lLength = hexLength.length / 2;
    const firstByte = intToHex(offset + 55 + lLength);
    return Buffer.from(firstByte + hexLength, 'hex');
  }
};

export const decode = (input: any, stream: any) => {
  if (stream === void 0) {
    stream = false;
  }
  if (!input || input.length === 0) {
    return Buffer.from([]);
  }
  const inputBuffer = toBuffer(input);
  const decoded = _decode(inputBuffer);
  if (stream) {
    return decoded;
  }
  if (decoded.remainder.length !== 0) {
    throw new Error('invalid remainder');
  }
  return decoded.data;
};

export const getLength = (input: any) => {
  if (!input || input.length === 0) {
    return Buffer.from([]);
  }
  const inputBuffer = toBuffer(input);
  const firstByte = inputBuffer[0];
  if (firstByte <= 0x7f) {
    return inputBuffer.length;
  } else if (firstByte <= 0xb7) {
    return firstByte - 0x7f;
  } else if (firstByte <= 0xbf) {
    return firstByte - 0xb6;
  } else if (firstByte <= 0xf7) {
    return firstByte - 0xbf;
  } else {
    const llength = firstByte - 0xf6;
    const length = safeParseInt(inputBuffer.slice(1, llength).toString('hex'), 16);
    return llength + length;
  }
};

const _decode = (input: any): any => {
  let length; let llength; let data; let innerRemainder; let d;
  const decoded = [];
  const firstByte = input[0];
  if (firstByte <= 0x7f) {
    return {
      data: input.slice(0, 1),
      remainder: input.slice(1),
    };
  } else if (firstByte <= 0xb7) {
    length = firstByte - 0x7f;
    if (firstByte === 0x80) {
      data = Buffer.from([]);
    } else {
      data = input.slice(1, length);
    }
    if (length === 2 && data[0] < 0x80) {
      throw new Error('invalid rlp encoding: byte must be less 0x80');
    }
    return {
      data: data,
      remainder: input.slice(length),
    };
  } else if (firstByte <= 0xbf) {
    llength = firstByte - 0xb6;
    length = safeParseInt(input.slice(1, llength).toString('hex'), 16);
    data = input.slice(llength, length + llength);
    if (data.length < length) {
      throw new Error('invalid RLP');
    }
    return {
      data: data,
      remainder: input.slice(length + llength),
    };
  } else if (firstByte <= 0xf7) {
    length = firstByte - 0xbf;
    innerRemainder = input.slice(1, length);
    while (innerRemainder.length) {
      d = _decode(innerRemainder);
      decoded.push(d.data);
      innerRemainder = d.remainder;
    }
    return {
      data: decoded,
      remainder: input.slice(length),
    };
  } else {
    llength = firstByte - 0xf6;
    length = safeParseInt(input.slice(1, llength).toString('hex'), 16);
    const totalLength = llength + length;
    if (totalLength > input.length) {
      throw new Error('invalid rlp: total length is larger than the data');
    }
    innerRemainder = input.slice(llength, totalLength);
    if (innerRemainder.length === 0) {
      throw new Error('invalid rlp, List has a invalid length');
    }
    while (innerRemainder.length) {
      d = _decode(innerRemainder);
      decoded.push(d.data);
      innerRemainder = d.remainder;
    }
    return {
      data: decoded,
      remainder: input.slice(totalLength),
    };
  }
};

const isHexPrefixed = (str: string) => {
  return str.slice(0, 2) === '0x';
};

const stripHexPrefix = (str: string) => {
  if (typeof str !== 'string') {
    return str;
  }
  return isHexPrefixed(str) ? str.slice(2) : str;
};

const intToHex = (integer: number) => {
  if (integer < 0) {
    throw new Error('Invalid integer as argument, must be unsigned!');
  }
  const hex = integer.toString(16);
  return hex.length % 2 ? '0' + hex : hex;
};

const padToEven = (a: any) => {
  return a.length % 2 ? '0' + a : a;
};

const intToBuffer = (integer: number) => {
  const hex = intToHex(integer);
  return Buffer.from(hex, 'hex');
};

export const toBuffer = (v: any) => {
  if (!Buffer.isBuffer(v)) {
    if (typeof v === 'string') {
      if (isHexPrefixed(v)) {
        return Buffer.from(padToEven(stripHexPrefix(v)), 'hex');
      } else {
        return Buffer.from(v);
      }
    } else if (typeof v === 'number') {
      if (!v) {
        return Buffer.from([]);
      } else {
        return intToBuffer(v);
      }
    } else if (v === null || v === undefined) {
      return Buffer.from([]);
    } else if (v instanceof Uint8Array) {
      return Buffer.from(v);
    } else {
      throw new Error('invalid type');
    }
  }
  return v;
};

const debugLog: debug.IDebugger = debug(`functions`);

export interface TransactionResultResponse {
  status: string;
  status_code: number;
  error_message: string;
  events: Array<Event>;
}

export interface Event {
  type: string;
  transaction_id: Buffer;
  transaction_index: number;
  event_index: number;
  payload: EventPayload;
}

export interface EventPayload {
  event: string;
  value: {
    id: string;
    fields: Array<{
      name: string;
      value: {
        type: string;
        value: any
      }
    }>;
  }
}

export interface FlowKey {
  keyID: number;
  private: string;
  public: string;
}

export interface AddKey {
  public: string;
  weight: number;
}

export interface Account {
  address: Buffer;
  balance: number;
  code: Buffer;
  keys: Array<AccountKey>;
  contracts: Object;
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
  seconds: number;
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

export interface Transaction {
  script: Buffer;
  arguments: Array<Buffer>;
  reference_block_id: Buffer;
  gas_limit: number;
  proposal_key: TransactionProposalKey;
  payer: Buffer;
  authorizers: Array<Buffer>;
  payload_signatures: Array<TransactionSignature>;
  envelope_signatures: Array<TransactionSignature>;
}

export interface TransactionProposalKey {
  address: Buffer;
  key_id: number;
  sequence_number: number;
}

interface Proposal {
  address: Buffer;
  privateKey: string;
  publicKey: string;
}

export interface TransactionSignature {
  address: Buffer;
  key_id: number;
  signature: Buffer;
}

export interface Sign {
  address: string,
  key_id: number,
  private_key: string,
}

export enum TransactionStatus {
  // eslint-disable-next-line no-unused-vars
  UNKNOWN,
  // eslint-disable-next-line no-unused-vars
  PENDING,
  // eslint-disable-next-line no-unused-vars
  FINALIZED,
  // eslint-disable-next-line no-unused-vars
  EXECUTED,
  // eslint-disable-next-line no-unused-vars
  SEALED,
  // eslint-disable-next-line no-unused-vars
  EXPIRED,
}

interface Sig {
  address: string;
  keyId: number;
  sig: string;
  signerIndex?: number;
}

interface FlowWork {
  type: FlowWorkType;
  arguments: Array<any>;
  callback: Function;
  script?: Buffer;
  proposer?: Proposal;
  authorizers?: Array<Proposal>;
  payer?: Buffer;
  payload_signatures?: Array<Proposal>;
  envelope_signatures?: Array<Proposal>;
}

interface TxPayload {
  script: string;
  arguments: Buffer[];
  refBlock: string;
  gasLimit: number;
  proposalKey: TransactionProposalKey;
  payer: string;
  authorizers: string[];
}

interface TxEnvelope {
  script: string,
  arguments: Buffer[],
  refBlock: string,
  gasLimit: number,
  proposalKey: TransactionProposalKey,
  payer: string,
  authorizers: string[],
  payload_signatures: Sig[]
}

export interface Keys {
  public: string;
  private: string;
}

const encodeTransactionPayload = (tx: TxPayload): string => rlpEncode(preparePayload(tx));

const encodeTransactionEnvelope = (tx: TxEnvelope): string => rlpEncode(prepareEnvelope(tx));

const rightPaddedHexBuffer = (value: string, pad: number): Buffer => Buffer.from(value.padEnd(pad * 2, '0'), 'hex');

const leftPaddedHexBuffer = (value: string, pad: number): Buffer => Buffer.from(value.padStart(pad * 2, '0'), 'hex');

const addressBuffer = (addr: string) => leftPaddedHexBuffer(addr, 8);

const blockBuffer = (block: string) => leftPaddedHexBuffer(block, 32);

const scriptBuffer = (script: string) => Buffer.from(script, 'utf8');

const signatureBuffer = (signature: string) => Buffer.from(signature, 'hex');

// not ready for prime time just yet
/* export const keygen = (): Keys => {
  const ec = new EC('p256');
  const kp = ec.genKeyPair();
  return {
    private: kp.getPrivate().toString('hex'),
    public: kp.getPublic().encode('hex', false),
  };
}; */

const rlpEncode = (v: any): string => {
  return encode(v).toString('hex');
};

const argParse = (arg: any): Object => {
  switch (typeof arg) {
    case 'string':
      // handle string
      return {
        type: 'String',
        value: arg,
      };
    case 'boolean':
      // handle boolean
      return {
        type: 'Bool',
        value: arg,
      };
    case 'bigint':
      // handle bigint
      return {
        type: 'Int64',
        value: arg.toString(),
      };
    case 'number':
      // handle number
      if (Number.isInteger(arg)) {
        return {
          type: 'Int',
          value: arg.toString(),
        };
      } else {
        return {
          type: 'Fix64',
          value: arg.toString(),
        };
      }

    default:
      // argument is not supported, convert to string
      return {
        type: 'String',
        value: arg.toString(),
      };
  }
};

const argBuilder = (args: any[]): Buffer[] => {
  const bufs: Array<Buffer> = [];
  args.forEach((a) => {
    // handle map<any, any>
    if (a instanceof Map) {
      const mapEntries: any[] = [];
      a.forEach((v, k) => {
        mapEntries.push({
          key: argParse(k),
          value: argParse(v),
        });
      });
      bufs.push(Buffer.from(JSON.stringify({
        type: 'Dictionary',
        value: mapEntries,
      }), 'utf-8'));
      // assume its string : string
    } else if (Array.isArray(a)) {
      const arrEntries: any[] = [];
      a.forEach((e) => {
        arrEntries.push(argParse(e));
      });
      bufs.push(Buffer.from(JSON.stringify({
        type: 'Array',
        value: arrEntries,
      }), 'utf-8'));
      // handle array
    } else {
      bufs.push(Buffer.from(JSON.stringify(argParse(a))));
    }
  });
  return bufs;
};

const preparePayload = (tx: TxPayload) => {
  return [
    scriptBuffer(tx.script),
    tx.arguments,
    blockBuffer(tx.refBlock),
    tx.gasLimit,
    addressBuffer(tx.proposalKey.address.toString('hex')),
    tx.proposalKey.key_id,
    tx.proposalKey.sequence_number,
    addressBuffer(tx.payer),
    tx.authorizers.map(addressBuffer),
  ];
};

const prepareEnvelope = (tx: TxEnvelope) => {
  return [preparePayload(tx), preparePayloadSignatures(tx)];
};

const preparePayloadSignatures = (tx: TxEnvelope) => {
  return tx.payload_signatures.map((sig: Sig, i: number) => {
    return [
      i,
      sig.keyId,
      signatureBuffer(sig.sig),
    ];
  });
};

const TX_DOMAIN_TAG_HEX = rightPaddedHexBuffer(Buffer.from('FLOW-V0.0-transaction').toString('hex'), 32).toString('hex');

const transactionSignature = (msg: string, privateKey: string): string => {
  debugLog('transactionSignature:', msg, '::', privateKey);
  const ec = new EC('p256');
  const key = ec.keyFromPrivate(Buffer.from(privateKey, 'hex'));
  const sha = new SHA3(256);
  const totalMsgHex = TX_DOMAIN_TAG_HEX + msg;
  sha.update(Buffer.from(totalMsgHex, 'hex'));
  const digest = sha.digest();
  const sig = key.sign(digest);
  const n = 32;
  const r = sig.r.toArrayLike(Buffer, 'be', n);
  const s = sig.s.toArrayLike(Buffer, 'be', n);
  return Buffer.concat([r, s]).toString('hex');
};

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

const processEvents = (txr: any): void => {
  txr.events.forEach((evt: any, i: number) => {
    const pld: EventPayload = JSON.parse(evt.payload.toString('utf-8'));
    txr.events[i].payload = pld;
  });
};

const encodePublicKeyForFlow = (a: AddKey) => encode([
  Buffer.from(a.public, 'hex'), // publicKey hex to binary
  2, // P256
  3, // SHA3-256
  a.weight > 0 ? a.weight : 1, // cannot be null or negative
]).toString('hex');

const signTransaction = (transaction: Transaction, payloadSignatures: Sign[], envelopeSignatures: Sign[]): Transaction => {
  const tr = transaction;
  const payloadSigs: Sig[] = [];
  payloadSignatures.forEach((ps) => {
    debugLog('signTransaction:', ps.address, '::', ps.private_key, '::', ps.key_id);
    const payloadMsg = encodeTransactionPayload({
      script: tr.script.toString('utf-8'),
      arguments: tr.arguments,
      refBlock: tr.reference_block_id.toString('hex'),
      gasLimit: tr.gas_limit,
      proposalKey: {
        address: tr.proposal_key.address,
        key_id: tr.proposal_key.key_id,
        sequence_number: tr.proposal_key.sequence_number,
      },
      payer: tr.payer.toString('hex'),
      authorizers: tr.authorizers.map((x) => x.toString('hex')),
    });
    const thisSig = transactionSignature(payloadMsg, ps.private_key);
    tr.payload_signatures.push({ address: Buffer.from(ps.address, 'hex'), key_id: ps.key_id, signature: Buffer.from(thisSig, 'hex') });
    payloadSigs.push({ address: ps.address, keyId: ps.key_id, sig: thisSig });
  });
  debugLog(payloadSigs);
  envelopeSignatures.forEach((es) => {
    debugLog('signTransaction:', tr);
    debugLog('signTransaction:', es.address, '::', es.private_key, '::', es.key_id);
    const envelopeMsg = encodeTransactionEnvelope({
      script: tr.script.toString('utf-8'),
      arguments: tr.arguments,
      refBlock: tr.reference_block_id.toString('hex'),
      gasLimit: tr.gas_limit,
      proposalKey: {
        address: tr.proposal_key.address,
        key_id: tr.proposal_key.key_id,
        sequence_number: tr.proposal_key.sequence_number,
      },
      payer: tr.payer.toString('hex'),
      payload_signatures: payloadSigs,
      authorizers: tr.authorizers.map((x) => x.toString('hex')),
    });
    const thisSig = transactionSignature(envelopeMsg, es.private_key);
    tr.envelope_signatures.push({ address: Buffer.from(es.address, 'hex'), key_id: es.key_id, signature: Buffer.from(thisSig, 'hex') });
  });
  return tr;
};

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
  private processing: Boolean = false;

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
        const worker = new FlowWorker(k.private, k.public, k.keyID, this.network);
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
    if (!this.processing) {
      this.processing = true;
      const beginningCount = this.work.length;
      if (beginningCount > 0) {
        this.workers.forEach((w) => {
          if (this.work.length > 0 && w.status == FlowWorkerStatus.IDLE) {
            w.process(this.work.splice(0, 1)[0]);
          }
        });
        if (this.shutdown) this.dbg('Cleaning up for shutdown');
      }
      if (this.error) console.log('Error:', this.error);
      this.processing = false;
    }
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
        p(JSON.parse(Buffer.from(res.value).toString('utf8')));
      };
      this.work.push({
        type: FlowWorkType.SCRIPT,
        script: Buffer.from(script, 'utf-8'),
        arguments: arg,
        callback: cb,
      });
    });
  }
  async execute_transaction(script: string, arg: any[], authorizers?: Array<Proposal>, proposer?: Proposal, payer?: Proposal): Promise<TransactionResultResponse | Error> {
    this.dbg(proposer);

    return new Promise((p) => {
      if (!payer) payer = { address: Buffer.from(this.serviceAccountAddress, 'hex'), privateKey: '', publicKey: '' };
      const cb = (err: Error, res: any) => {
        if (err) p(err);
        p(res);
      };

      if (!proposer) proposer = payer;

      if (!authorizers) authorizers = [proposer];
      if (authorizers.length == 0) authorizers = [proposer];

      const payloadSigs: Proposal[] = [];
      const envelopeSigs: Proposal[] = [];
      authorizers.forEach((a) => {
        if (a.address != payer?.address) {
          payloadSigs.push(a);
        }
      });
      if (proposer && proposer.address != payer?.address) payloadSigs.push(proposer);
      envelopeSigs.push(payer);

      this.work.push({
        type: FlowWorkType.TRANSACTION,
        script: Buffer.from(script, 'utf-8'),
        arguments: arg,
        proposer: proposer,
        payer: payer.address,
        authorizers: authorizers,
        payload_signatures: payloadSigs,
        envelope_signatures: envelopeSigs,
        callback: cb,
      });
    });
  }
  async create_account(newAccountKeys?: Array<AddKey | string>): Promise<TransactionResultResponse | Error> {
    return new Promise((p) => {
      const cb = (err: Error, res: TransactionResultResponse) => {
        if (err) p(err);
        p(res);
      };

      const createAccountTemplate = `
        transaction(publicKeys: [String], contracts: {String: String}) {
            prepare(signer: AuthAccount) {
                let acct = AuthAccount(payer: signer)
                for key in publicKeys {
                    acct.addPublicKey(key.decodeHex())
                }
                for contract in contracts.keys {
                    acct.contracts.add(name: contract, code: contracts[contract]!.decodeHex())
                }
            }
        }`;

      const keys: Array<string> = [];

      newAccountKeys?.forEach((k) => {
        if (typeof k == 'object') {
          keys.push(encodePublicKeyForFlow(k));
        } else {
          keys.push(encodePublicKeyForFlow({ public: k, weight: 1000 }));
        }
      });

      const svcBuf = Buffer.from(this.serviceAccountAddress, 'hex');

      const prop = { address: svcBuf, privateKey: '', publicKey: '' };

      this.work.push({
        type: FlowWorkType.TRANSACTION,
        script: Buffer.from(createAccountTemplate, 'utf-8'),
        arguments: [keys, new Map<string, string>()],
        payer: svcBuf,
        proposer: prop,
        authorizers: [prop],
        payload_signatures: [],
        envelope_signatures: [prop],
        callback: cb,
      });
    });
  }
  async add_contract(contractName: string, contract: string, account: Proposal): Promise<TransactionResultResponse | Error> {
    return new Promise((p) => {
      const cb = (err: Error, res: any) => {
        if (err) p(err);
        p(res);
      };
      const addContractTemplate = `
        transaction(name: String, code: String) {
          prepare(signer: AuthAccount) {
            signer.contracts.add(name: name, code: code.decodeHex())
          }
        }
      `;
      this.work.push({
        type: FlowWorkType.TRANSACTION,
        script: Buffer.from(addContractTemplate, 'utf-8'),
        arguments: [contractName, Buffer.from(contract, 'utf-8').toString('hex')],
        payer: account.address,
        proposer: account,
        authorizers: [account],
        payload_signatures: [],
        envelope_signatures: [account],
        callback: cb,
      });
    });
  }
  async add_key(key: AddKey, account: Proposal): Promise<TransactionResultResponse | Error> {
    return new Promise((p) => {
      const cb = (err: Error, res: any) => {
        if (err) p(err);
        p(res);
      };
      const addKeyTemplate = `
        transaction(publicKey: String) {
            prepare(signer: AuthAccount) {
                signer.addPublicKey(publicKey.decodeHex())
            }
        }
      `;
      const pubKey = encodePublicKeyForFlow(key);
      this.work.push({
        type: FlowWorkType.TRANSACTION,
        script: Buffer.from(addKeyTemplate, 'utf-8'),
        arguments: [pubKey],
        payer: account.address,
        proposer: account,
        authorizers: [account],
        payload_signatures: [],
        envelope_signatures: [account],
        callback: cb,
      });
    });
  }
  async remove_key(keyIndex: number, account: Proposal): Promise<TransactionResultResponse | Error> {
    return new Promise((p) => {
      const cb = (err: Error, res: any) => {
        if (err) p(err);
        p(res);
      };
      const addKeyTemplate = `
        transaction(keyIndex: Int) {
            prepare(signer: AuthAccount) {
                signer.removePublicKey(keyIndex)
            }
        }
      `;
      this.work.push({
        type: FlowWorkType.TRANSACTION,
        script: Buffer.from(addKeyTemplate, 'utf-8'),
        arguments: [keyIndex],
        payer: account.address,
        proposer: account,
        authorizers: [account],
        payload_signatures: [],
        envelope_signatures: [account],
        callback: cb,
      });
    });
  }
  async update_contract(contractName: string, contract: string, account: Proposal): Promise<TransactionResultResponse | Error> {
    return new Promise((p) => {
      const cb = (err: Error, res: any) => {
        if (err) p(err);
        p(res);
      };
      const updateContractTemplate = `
        transaction(name: String, code: String) {
          prepare(signer: AuthAccount) {
            signer.contracts.update__experimental(name: name, code: code.decodeHex())
          }
        }
      `;
      this.work.push({
        type: FlowWorkType.TRANSACTION,
        script: Buffer.from(updateContractTemplate, 'utf-8'),
        arguments: [contractName, Buffer.from(contract, 'utf-8').toString('hex')],
        payer: account.address,
        proposer: account,
        authorizers: [account],
        payload_signatures: [],
        envelope_signatures: [account],
        callback: cb,
      });
    });
  }
  async remove_contract(contractName: string, account: Proposal): Promise<TransactionResultResponse | Error> {
    return new Promise((p) => {
      const cb = (err: Error, res: any) => {
        if (err) p(err);
        p(res);
      };
      const updateContractTemplate = `
        transaction(name: String) {
          prepare(signer: AuthAccount) {
            signer.contracts.remove(name: name)
          }
        }
      `;
      this.work.push({
        type: FlowWorkType.TRANSACTION,
        script: Buffer.from(updateContractTemplate, 'utf-8'),
        arguments: [contractName],
        payer: account.address,
        proposer: account,
        authorizers: [account],
        payload_signatures: [],
        envelope_signatures: [account],
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
  privKey: string;
  pubKey: string;
  id: number;
  dbg: debug.IDebugger;
  private network: string;
  private access: any;
  private client: any;
  public status: number;
  constructor(privKey: string, pubKey: string, id: number, network: string) {
    const debugLog: debug.IDebugger = debug(`FlowWorker::${id}::Constructor`);
    this.dbg = debug(`FlowWorker::${id}`);
    this.privKey = privKey;
    this.pubKey = pubKey;
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
  poll(work: FlowWork, transaction: Buffer, p: Function, timeout?: number) {
    const to = timeout ? timeout : 50;
    this.client.getTransactionResult({ id: transaction }, (e: Error, tr: TransactionResultResponse) => {
      switch (tr.status) {
        case 'UNKNOWN' || 'PENDING' || 'FINALIZED' || 'EXECUTED':
          setTimeout(() => {
            this.poll(work, transaction, p, to + 200); // automatic backoff
          }, to);
          break;
        case 'SEALED':
          processEvents(tr);
          work.callback(e, tr);
          this.status = FlowWorkerStatus.IDLE;
          p(); // resolve promise
          break;

        default:
          this.dbg(tr);
          work.callback(Error('Unknown error occurred while polling transaction, maybe it expired?'));
          return Promise.reject(Error('Unknown error occurred while polling transaction, maybe it expired?'));
      }
    });
  }
  getAccount(address: string | Buffer): Promise<Account> {
    return new Promise((p) => {
      if (typeof address == 'string') address = Buffer.from(address, 'hex');
      this.client.getAccountAtLatestBlock({ address }, (err: any, res: any) => {
        p(res['account']);
      });
    });
  }
  getLatestBlock(): Promise<Block> {
    return new Promise((p) => {
      this.client.getLatestBlock({ is_sealed: false }, (err: Error, res: any) => {
        if (err) return Promise.reject(err);
        p(res['block']);
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
          if (work.arguments.length == 1) {
            const bufArg = Buffer.from(work.arguments[0].toString().replace(/\b0x/g, ''), 'hex');
            const acct = await this.getAccount(bufArg);
            work.callback(null, acct);
            this.status = FlowWorkerStatus.IDLE;
            p();
          } else {
            work.callback(Error('incorrect number of arguments'));
            this.status = FlowWorkerStatus.IDLE;
            p();
          }
          break;

        case FlowWorkType.GetAccountAtBlockHeight:
          if (work.arguments.length == 2) {
            const bufArg = Buffer.from(work.arguments[0].toString().replace(/\b0x/g, ''), 'hex');
            this.client.getAccountAtBlockHeight({ address: bufArg, block_height: parseInt(work.arguments[1]) }, (err: any, res: any) => {
              work.callback(err, res);
              this.status = FlowWorkerStatus.IDLE;
              p();
            });
          } else {
            work.callback(Error('incorrect number of arguments'));
            this.status = FlowWorkerStatus.IDLE;
            p();
          }
          break;

        case FlowWorkType.GetLatestBlock:
          if (work.arguments.length == 1) {
            if (typeof work.arguments[0] !== 'boolean') return Promise.reject(Error(`arg 0 must be a bool: GetLatestBlock, found ${work.arguments[0]}`));
            this.client.getLatestBlock({ is_sealed: work.arguments[0] }, (err: any, res: any) => {
              work.callback(err, res);
              this.status = FlowWorkerStatus.IDLE;
              p();
            });
          } else {
            work.callback(Error('incorrect number of arguments'));
            this.status = FlowWorkerStatus.IDLE;
            p();
          }
          break;

        case FlowWorkType.SCRIPT:
          const args = argBuilder(work.arguments);
          this.client.executeScriptAtLatestBlock({ script: work.script, arguments: args }, (err: any, res: any) => {
            work.callback(err, res);
            this.status = FlowWorkerStatus.IDLE;
            p();
          });
          break;

        case FlowWorkType.TRANSACTION:
          if (!work.proposer || work.proposer?.privateKey == '') work.proposer = { address: work.payer ? work.payer : Buffer.alloc(0), privateKey: this.privKey, publicKey: this.pubKey };
          if (!work.payer) work.payer = work.proposer.address;
          const tArgs = argBuilder(work.arguments);
          const block = await this.getLatestBlock();
          const proposer = await this.getAccount(work.proposer.address);
          const payer = await this.getAccount(work.payer);
          const mapR = proposer.keys.map((x: AccountKey) => {
            if (x.public_key.toString('hex') == work.proposer?.publicKey) return [x.id, x.sequence_number];
          })[0];
          if (!mapR || mapR.length == 0) return Promise.reject(Error('Invalid proposer'));
          const propKey: TransactionProposalKey = {
            address: proposer.address,
            key_id: mapR[0],
            sequence_number: mapR[1],
          };
          if (!work.authorizers) work.authorizers = [work.proposer];
          if (work.authorizers.length == 0) work.authorizers = [work.proposer];
          let transaction: Transaction = {
            script: work.script ? work.script : Buffer.from('', 'utf-8'),
            arguments: tArgs,
            reference_block_id: block.id,
            gas_limit: 9999,
            proposal_key: propKey,
            payer: payer.address,
            authorizers: work.authorizers ? work.authorizers.map((x) => x.address) : [payer.address],
            payload_signatures: [],
            envelope_signatures: [],
          };
          const finalPayload: Sign[] = [];
          const finalEnvelope: Sign[] = [];
          for (const ps of work.payload_signatures ? work.payload_signatures : []) {
            if (finalPayload.filter((x) => x.address == ps.address.toString('hex')).length > 0) continue;
            const acct = await this.getAccount(ps.address);
            if (ps.publicKey == '') {
              ps.publicKey = this.pubKey;
              ps.privateKey = this.privKey;
            }
            finalPayload.push({
              address: acct.address.toString('hex'),
              key_id: acct.keys.filter((k) => k.public_key.toString('hex') == ps.publicKey)[0].id,
              private_key: ps.privateKey,
            });
          }
          for (const ps of work.envelope_signatures ? work.envelope_signatures : []) {
            if (finalEnvelope.filter((x) => x.address == ps.address.toString('hex')).length > 0) continue;
            const acct = await this.getAccount(ps.address);
            if (ps.publicKey == '') {
              ps.publicKey = this.pubKey;
              ps.privateKey = this.privKey;
            }
            finalEnvelope.push({
              address: acct.address.toString('hex'),
              key_id: acct.keys.filter((k) => k.public_key.toString('hex') == ps.publicKey)[0].id,
              private_key: ps.privateKey,
            });
          }
          transaction = signTransaction(transaction, finalPayload, finalEnvelope);
          this.dbg(transaction);
          this.client.sendTransaction({ transaction: transaction }, (err: any, trans: any) => {
            if (err) return Promise.reject(err);
            this.poll(work, trans.id, p);
          });
          break;

        default:
          this.dbg(FlowWorkType[work.type], 'is not implemented.');
          work.callback(Error(`${FlowWorkType[work.type]} is not implemented`));
          this.status = FlowWorkerStatus.IDLE;
          p();
          break;
      }
    });
  }
}

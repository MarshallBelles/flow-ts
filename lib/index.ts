/* eslint-disable camelcase */
import debug from 'debug';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { Buffer } from 'buffer';
import { ec as EC } from 'elliptic';
import { SHA3 } from 'sha3';
import * as fs from 'fs';

const debugLog: debug.IDebugger = debug(`functions`);

export const flow_proto = `
syntax = "proto3";

package flow.access;


service AccessAPI {
    // The following is copied from https://docs.onflow.org/access-api/
    // You should also reference https://github.com/onflow/flow/blob/master/protobuf/flow/access/access.proto
    rpc Ping(PingRequest) returns (PingResponse);

    rpc GetLatestBlockHeader (GetLatestBlockHeaderRequest) returns (BlockHeaderResponse);

    rpc GetBlockHeaderByID (GetBlockHeaderByIdRequest) returns (BlockHeaderResponse);

    rpc GetBlockHeaderByHeight (GetBlockHeaderByHeightRequest) returns (BlockHeaderResponse);

    rpc GetLatestBlock (GetLatestBlockRequest) returns (BlockResponse);

    rpc GetBlockByID (GetBlockByIdRequest) returns (BlockResponse);

    rpc GetBlockByHeight (GetBlockByHeightRequest) returns (BlockResponse);

    rpc GetCollectionByID (GetCollectionByIdRequest) returns (CollectionResponse);

    rpc SendTransaction (SendTransactionRequest) returns (SendTransactionResponse);

    rpc GetTransaction (GetTransactionRequest) returns (TransactionResponse);

    rpc GetTransactionResult (GetTransactionRequest) returns (TransactionResultResponse);

    rpc GetAccountAtLatestBlock(GetAccountAtLatestBlockRequest) returns (AccountResponse);

    rpc GetAccountAtBlockHeight(GetAccountAtBlockHeightRequest) returns (AccountResponse);

    rpc ExecuteScriptAtLatestBlock (ExecuteScriptAtLatestBlockRequest) returns (ExecuteScriptResponse);

    rpc ExecuteScriptAtBlockID (ExecuteScriptAtBlockIdRequest) returns (ExecuteScriptResponse);

    rpc ExecuteScriptAtBlockHeight (ExecuteScriptAtBlockHeightRequest) returns (ExecuteScriptResponse);

    rpc GetEventsForHeightRange(GetEventsForHeightRangeRequest) returns (EventsResponse);

    rpc GetEventsForBlockIDs(GetEventsForBlockIdsRequest) returns (EventsResponse);

    rpc GetNetworkParameters (GetNetworkParametersRequest) returns (GetNetworkParametersResponse);

    rpc GetLatestProtocolStateSnapshot (GetLatestProtocolStateSnapshotRequest) returns (ProtocolStateSnapshotResponse);

    rpc GetExecutionResultForBlockID(GetExecutionResultForBlockIdRequest) returns (ExecutionResultForBlockIdResponse);
}

// ping
message PingRequest {}
message PingResponse {}

// block headers
message BlockHeaderResponse {
  BlockHeader block = 1;
}
message GetLatestBlockHeaderRequest {
  bool is_sealed = 1;
}
message GetBlockHeaderByIdRequest {
  bytes id = 1;
}
message GetBlockHeaderByHeightRequest {
  uint64 height = 1;
}

// blocks
message BlockResponse {
  Block block = 1;
}
message GetLatestBlockRequest {
  bool is_sealed = 1;
}
message GetBlockByIdRequest {
  bytes id = 1;
}
message GetBlockByHeightRequest {
  uint64 height = 1;
}

// collections
message CollectionResponse {
  Collection collection = 1;
}
message GetCollectionByIdRequest {
  bytes id = 1;
}

// transactions
message SendTransactionResponse {
  bytes id = 1;
}
message SendTransactionRequest {
  Transaction transaction = 1;
}
message GetTransactionRequest {
  bytes id = 1;
}
message TransactionResponse {
  Transaction transaction = 1;
}
message TransactionResultResponse {
  TransactionStatus status = 1;
  uint32 status_code = 2;
  string error_message = 3;
  repeated Event events = 4;
}

// accounts
message AccountResponse {
  Account account = 1;
}
message GetAccountAtLatestBlockRequest {
  bytes address = 1;
}
message GetAccountAtBlockHeightRequest {
  bytes address = 1;
  uint64 block_height = 2;
}

// scripts
message ExecuteScriptResponse {
  bytes value = 1;
}
message ExecuteScriptAtLatestBlockRequest {
  bytes script = 1;
  repeated bytes arguments = 2;
}
message ExecuteScriptAtBlockIdRequest {
  bytes block_id = 1;
  bytes script = 2;
  repeated bytes arguments = 3;
}
message ExecuteScriptAtBlockHeightRequest {
  uint64 block_height = 1;
  bytes script = 2;
  repeated bytes arguments = 3;
}

// events
message EventsResponse {
  message Result {
    bytes block_id = 1;
    uint64 block_height = 2;
    repeated Event events = 3;
    Timestamp block_timestamp = 4;
  }
  repeated Result results = 1;
}
message GetEventsForHeightRangeRequest {
  string type = 1;
  uint64 start_height = 2;
  uint64 end_height = 3;
}
message GetEventsForBlockIdsRequest {
  string type = 1;
  repeated bytes block_ids = 2;
}


// network parameters
message GetNetworkParametersResponse {
  string chain_id = 1;
}
message GetNetworkParametersRequest {}

// protocol state
message ProtocolStateSnapshotResponse {
  bytes serializedSnapshot = 1;
}
message GetLatestProtocolStateSnapshotRequest {}

// execution results
message ExecutionResultForBlockIdResponse {
  ExecutionResult execution_result = 1;
}
message GetExecutionResultForBlockIdRequest {
  bytes block_id = 1;
}


message Block {
  bytes id = 1;
  bytes parent_id = 2;
  uint64 height = 3;
  Timestamp timestamp = 4;
  repeated CollectionGuarantee collection_guarantees = 5;
  repeated BlockSeal block_seals = 6;
  repeated bytes signatures = 7;
}

message BlockHeader {
  bytes id = 1;
  bytes parent_id = 2;
  uint64 height = 3;
}

message BlockSeal {
  bytes block_id = 1;
  bytes execution_receipt_id = 2;
  repeated bytes execution_receipt_signatures = 3;
  repeated bytes result_approval_signatures = 4;
}

message Collection {
  bytes id = 1;
  repeated bytes transaction_ids = 2;
}

message CollectionGuarantee {
  bytes collection_id = 1;
  repeated bytes signatures = 2;
}

message Transaction {
  bytes script = 1;
  repeated bytes arguments = 2;
  bytes reference_block_id = 3;
  uint64 gas_limit = 4;
  TransactionProposalKey proposal_key = 5;
  bytes payer = 6;
  repeated bytes authorizers = 7;
  repeated TransactionSignature payload_signatures = 8;
  repeated TransactionSignature envelope_signatures = 9;
}

message TransactionProposalKey {
  bytes address = 1;
  uint32 key_id = 2;
  uint64 sequence_number = 3;
}

message TransactionSignature {
  bytes address = 1;
  uint32 key_id = 2;
  bytes signature = 3;
}

enum TransactionStatus {
  UNKNOWN = 0;
  PENDING = 1;
  FINALIZED = 2;
  EXECUTED = 3;
  SEALED = 4;
  EXPIRED = 5;
}

message Account {
  bytes address = 1;
  uint64 balance = 2;
  bytes code = 3;
  repeated AccountKey keys = 4;
  map<string, bytes> contracts = 5;
}

message AccountKey {
  uint32 id = 1;
  bytes public_key = 2;
  uint32 sign_algo = 3;
  uint32 hash_algo = 4;
  uint32 weight = 5;
  uint32 sequence_number = 6;
  bool revoked = 7;
}

message Event {
  string type = 1;
  bytes transaction_id = 2;
  uint32 transaction_index = 3;
  uint32 event_index = 4;
  bytes payload = 5;
}

message ExecutionResult {
  bytes previous_result_id = 1;
  bytes block_id = 2;
  repeated Chunk chunks = 3;
  repeated ServiceEvent service_events = 4;
}

message Chunk {
  bytes start_state = 1;
  bytes event_collection = 2;
  bytes block_id = 3;
  uint64 total_computation_used = 4;
  uint64 number_of_transactions = 5;
  uint64 index = 6;
  bytes end_state = 7;
}

message ServiceEvent {
  string type = 1;
  bytes payload = 2;
}

message Timestamp {
  // Represents seconds of UTC time since Unix epoch
  // 1970-01-01T00:00:00Z. Must be from 0001-01-01T00:00:00Z to
  // 9999-12-31T23:59:59Z inclusive.
  int64 seconds = 1;

  // Non-negative fractions of a second at nanosecond resolution. Negative
  // second values with fractions must still have non-negative nanos values
  // that count forward in time. Must be from 0 to 999,999,999
  // inclusive.
  int32 nanos = 2;
}
`;

export interface TransactionResultResponse {
  id: Buffer;
  status: string;
  status_code: number;
  error_message: string;
  events: Array<Event>;
}

export interface TransactionQueuedResponse {
  id: Buffer;
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
        value: any;
      }
    }>;
  }
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
  address?: string;
  id?: number;
  public_key?: Buffer,
  private_key?: Buffer,
  sign_algo?: number;
  hash_algo?: number;
  weight?: number;
  sequence_number?: number;
  revoked?: Boolean;
}

export interface Transaction {
  script: Buffer;
  arguments: Array<Buffer>;
  reference_block_id: Buffer;
  gas_limit: number;
  proposal_key: {
    address: Buffer;
    key_id: number;
    sequence_number: number;
  };
  payer: Buffer;
  authorizers: Array<Buffer>;
  payload_signatures: Array<TransactionSignature>;
  envelope_signatures: Array<TransactionSignature>;
}

export interface TransactionSignature {
  address: Buffer;
  key_id: number;
  signature: Buffer;
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

interface Signature {
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
  proposer?: AccountKey;
  authorizers?: Array<AccountKey>;
  payer?: Buffer;
  payload_signatures?: Array<AccountKey>;
  envelope_signatures?: Array<AccountKey>;
  resolve?: Boolean;
}

interface TxPayload {
  script: string;
  arguments: Buffer[];
  refBlock: string;
  gasLimit: number;
  proposalKey: {
    address: Buffer;
    key_id: number;
    sequence_number: number;
  };
  payer: string;
  authorizers: string[];
}

interface TxEnvelope {
  script: string,
  arguments: Buffer[],
  refBlock: string,
  gasLimit: number,
  proposalKey: {
    address: Buffer;
    key_id: number;
    sequence_number: number;
  };
  payer: string,
  authorizers: string[],
  payload_signatures: Signature[]
}

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

const encodeTransactionPayload = (tx: TxPayload): string => rlpEncode(preparePayload(tx));

const encodeTransactionEnvelope = (tx: TxEnvelope): string => rlpEncode(prepareEnvelope(tx));

const rightPaddedHexBuffer = (value: string, pad: number): Buffer => Buffer.from(value.padEnd(pad * 2, '0'), 'hex');

const leftPaddedHexBuffer = (value: string, pad: number): Buffer => Buffer.from(value.padStart(pad * 2, '0'), 'hex');

const addressBuffer = (addr: string) => leftPaddedHexBuffer(addr, 8);

const blockBuffer = (block: string) => leftPaddedHexBuffer(block, 32);

const scriptBuffer = (script: string) => Buffer.from(script, 'utf8');

const signatureBuffer = (signature: string) => Buffer.from(signature, 'hex');

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
    addressBuffer(<string>tx.proposalKey.address.toString('hex')),
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
  const sigs: any[] = [];
  tx.authorizers.forEach((auth, i) => {
    tx.payload_signatures.forEach((sig) => {
      if (sig.address == auth) {
        sigs.push([
          i,
          sig.keyId,
          signatureBuffer(sig.sig),
        ]);
      }
    });
  });
  return sigs;
};

const TX_DOMAIN_TAG_HEX = rightPaddedHexBuffer(Buffer.from('FLOW-V0.0-transaction', 'utf-8').toString('hex'), 32).toString('hex');

const transactionSignature = (msg: string, key: AccountKey): string => {
  debugLog('transactionSignature:', msg, '::', key);
  const ec = new EC('p256');
  const k = ec.keyFromPrivate(<Buffer>key.private_key);
  // sha3(256)
  const sha = new SHA3(256);
  const totalMsgHex = TX_DOMAIN_TAG_HEX + msg;
  sha.update(Buffer.from(totalMsgHex, 'hex'));
  const digest = sha.digest();
  const sig = k.sign(digest);
  const n = 32;
  const r = sig.r.toArrayLike(Buffer, 'be', n);
  const s = sig.s.toArrayLike(Buffer, 'be', n);
  return Buffer.concat([r, s]).toString('hex');
};

const processEvents = (txr: any): void => {
  txr.events.forEach((evt: any, i: number) => {
    const pld: EventPayload = JSON.parse(evt.payload.toString('utf-8'));
    txr.events[i].payload = pld;
  });
};

const encodePublicKeyForFlow = (a: AccountKey) => encode([
  a.public_key, // publicKey hex to binary
  a.sign_algo ? a.sign_algo : 2, // only P256 is supported
  a.hash_algo ? a.hash_algo : 3, // SHA3-256
  a.weight ? a.weight : 1 > 0 ? a.weight : 1, // cannot be null or negative
]).toString('hex');

const signTransaction = (transaction: Transaction, payloadSignatures: AccountKey[], envelopeSignatures: AccountKey[]): Transaction => {
  const tr = transaction;
  const payloadSigs: Signature[] = [];
  payloadSignatures.forEach((ps) => {
    debugLog('signTransaction:', ps.address, '::', ps.private_key, '::', ps.id);
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
    const thisSig = transactionSignature(payloadMsg, ps);
    tr.payload_signatures.push({ address: Buffer.from(<string>ps.address, 'hex'), key_id: <number>ps.id, signature: Buffer.from(thisSig, 'hex') });
    payloadSigs.push({ address: <string>ps.address, keyId: <number>ps.id, sig: thisSig });
  });
  debugLog(payloadSigs);
  envelopeSignatures.forEach((es) => {
    debugLog('signTransaction:', tr);
    debugLog('signTransaction:', es.address, '::', es.private_key, '::', es.id);
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
    const thisSig = transactionSignature(envelopeMsg, es);
    tr.envelope_signatures.push({ address: Buffer.from(<string>es.address, 'hex'), key_id: <number>es.id, signature: Buffer.from(thisSig, 'hex') });
  });
  return tr;
};

export class Flow {
  private serviceAccountAddress: string;
  private network: string;
  private privateKeys: Array<AccountKey> = [];
  private workers: Array<FlowWorker> = [];
  private work: Array<FlowWork> = [];
  private dbg: debug.IDebugger;
  private error: any;
  private shutdown: Boolean = false;
  private tickTimeout: number = 20;
  private processing: Boolean = false;

  constructor(network: FlowNetwork | string, serviceAccountAddress: string, privateKeys: Array<AccountKey>, tick?: number) {
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
    this.dbg('Starting Flow-ts');
    this.dbg('Access Node:', this.network);
    this.dbg('Private Keys:', this.privateKeys.length);
    this.dbg('Writing flow.proto');
    await new Promise((p) => fs.writeFile('flow.proto', flow_proto, p));

    const processingConnections: Promise<any>[] = [];
    this.privateKeys.forEach((k) => {
      processingConnections.push(new Promise(async (p) => {
        const worker = new FlowWorker(k, this.network);
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
        p(res);
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
  async send_transaction(script: string, arg: any[], authorizers?: Array<AccountKey>, proposer?: AccountKey, payer?: AccountKey): Promise<TransactionQueuedResponse | Error> {
    return new Promise((p) => {
      if (!payer) payer = { address: this.serviceAccountAddress };
      const cb = (err: Error, res: any) => {
        if (err) p(err);
        p(res);
      };

      if (!proposer) proposer = payer;

      if (!authorizers) authorizers = [<AccountKey>proposer];

      if (authorizers.length == 0) authorizers = [<AccountKey>proposer];

      const payloadSigs: AccountKey[] = [];
      const envelopeSigs: AccountKey[] = [];
      authorizers.forEach((a) => {
        if (a.address != payer?.address) {
          payloadSigs.push(a);
        }
      });
      if (proposer && proposer.address != payer?.address) payloadSigs.push(proposer);
      envelopeSigs.push(<AccountKey>payer);

      this.work.push({
        type: FlowWorkType.TRANSACTION,
        script: Buffer.from(script, 'utf-8'),
        arguments: arg,
        proposer: proposer,
        payer: Buffer.from(<string>payer.address, 'hex'),
        authorizers: authorizers,
        payload_signatures: payloadSigs,
        envelope_signatures: envelopeSigs,
        callback: cb,
        resolve: false,
      });
    });
  }
  async execute_transaction(script: string, arg: any[], authorizers?: Array<AccountKey>, proposer?: AccountKey, payer?: AccountKey): Promise<TransactionResultResponse | Error> {
    return new Promise((p) => {
      if (!payer) payer = { address: this.serviceAccountAddress };
      const cb = (err: Error, res: any) => {
        if (err) p(err);
        p(res);
      };

      if (!proposer) proposer = payer;

      if (!authorizers) authorizers = [proposer];
      if (authorizers.length == 0) authorizers = [proposer];

      const payloadSigs: AccountKey[] = [];
      const envelopeSigs: AccountKey[] = [];
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
        payer: Buffer.from(<string>payer.address, 'hex'),
        authorizers: authorizers,
        payload_signatures: payloadSigs,
        envelope_signatures: envelopeSigs,
        callback: cb,
        resolve: true,
      });
    });
  }
  async create_account(newAccountKeys: Array<AccountKey>): Promise<TransactionResultResponse | Error> {
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
      const prop: AccountKey = { address: this.serviceAccountAddress };

      this.work.push({
        type: FlowWorkType.TRANSACTION,
        script: Buffer.from(createAccountTemplate, 'utf-8'),
        arguments: [newAccountKeys.map((k) => encodePublicKeyForFlow(k)), new Map<string, string>()],
        payer: Buffer.from(this.serviceAccountAddress, 'hex'),
        proposer: prop,
        authorizers: [prop],
        payload_signatures: [],
        envelope_signatures: [prop],
        callback: cb,
        resolve: true,
      });
    });
  }
  async add_contract(contractName: string, contract: string, account?: AccountKey): Promise<TransactionResultResponse | Error> {
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
      if (!account) account = { address: this.serviceAccountAddress };
      this.work.push({
        type: FlowWorkType.TRANSACTION,
        script: Buffer.from(addContractTemplate, 'utf-8'),
        arguments: [contractName, Buffer.from(contract, 'utf-8').toString('hex')],
        payer: Buffer.from(<string>account.address, 'hex'),
        proposer: account,
        authorizers: [account],
        payload_signatures: [],
        envelope_signatures: [account],
        callback: cb,
        resolve: true,
      });
    });
  }
  async add_key(key: AccountKey, account?: AccountKey): Promise<TransactionResultResponse | Error> {
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
      if (!account) account = { address: this.serviceAccountAddress };
      const pubKey = encodePublicKeyForFlow(key);
      this.work.push({
        type: FlowWorkType.TRANSACTION,
        script: Buffer.from(addKeyTemplate, 'utf-8'),
        arguments: [pubKey],
        payer: Buffer.from(<string>account.address, 'hex'),
        proposer: account,
        authorizers: [account],
        payload_signatures: [],
        envelope_signatures: [account],
        callback: cb,
        resolve: true,
      });
    });
  }
  async remove_key(keyIndex: number, account?: AccountKey): Promise<TransactionResultResponse | Error> {
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
      if (!account) account = { address: this.serviceAccountAddress };
      this.work.push({
        type: FlowWorkType.TRANSACTION,
        script: Buffer.from(addKeyTemplate, 'utf-8'),
        arguments: [keyIndex],
        payer: Buffer.from(<string>account.address, 'hex'),
        proposer: account,
        authorizers: [account],
        payload_signatures: [],
        envelope_signatures: [account],
        callback: cb,
        resolve: true,
      });
    });
  }
  async update_contract(contractName: string, contract: string, account?: AccountKey): Promise<TransactionResultResponse | Error> {
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
      if (!account) account = { address: this.serviceAccountAddress };
      this.work.push({
        type: FlowWorkType.TRANSACTION,
        script: Buffer.from(updateContractTemplate, 'utf-8'),
        arguments: [contractName, Buffer.from(contract, 'utf-8').toString('hex')],
        payer: Buffer.from(<string>account.address, 'hex'),
        proposer: account,
        authorizers: [account],
        payload_signatures: [],
        envelope_signatures: [account],
        callback: cb,
        resolve: true,
      });
    });
  }
  async remove_contract(contractName: string, account?: AccountKey): Promise<TransactionResultResponse | Error> {
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
      if (!account) account = { address: this.serviceAccountAddress };
      this.work.push({
        type: FlowWorkType.TRANSACTION,
        script: Buffer.from(updateContractTemplate, 'utf-8'),
        arguments: [contractName],
        payer: Buffer.from(<string>account.address, 'hex'),
        proposer: account,
        authorizers: [account],
        payload_signatures: [],
        envelope_signatures: [account],
        callback: cb,
        resolve: true,
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
  async get_transaction_result(transaction: Buffer): Promise<TransactionResultResponse | Error> {
    return new Promise((p) => {
      const cb = (err: Error, res: TransactionResultResponse) => {
        if (err) p(err);
        res.id = transaction;
        p(res);
      };
      this.work.push({
        type: FlowWorkType.GetTransactionResult,
        arguments: [transaction],
        callback: cb,
      });
    });
  }
}

class FlowWorker {
  key: AccountKey;
  dbg: debug.IDebugger;
  private network: string;
  private access: any;
  private client: any;
  public status: number;
  constructor(key: AccountKey, network: string) {
    const debugLog: debug.IDebugger = debug(`FlowWorker::${key.id}::Constructor`);
    this.dbg = debug(`FlowWorker::${key.id}`);
    this.key = key;
    this.network = network;
    this.status = FlowWorkerStatus.CONNECTING;
    debugLog('Worker registered');
    debugLog('Loading Protobufs');
    const packageDefinition = protoLoader.loadSync('./flow.proto', {
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
      if (e) {
        work.callback(e);
        p();
      } else {
        if (!tr.status) {
          work.callback(e, tr);
          this.status = FlowWorkerStatus.IDLE;
          p();
        } else {
          switch (tr.status) {
            case 'UNKNOWN' || 'PENDING' || 'FINALIZED' || 'EXECUTED':
              setTimeout(() => {
                this.poll(work, transaction, p, to + 200); // automatic backoff
              }, to);
              break;
            case 'SEALED':
              processEvents(tr);
              tr.id = transaction;
              work.callback(e, tr);
              this.status = FlowWorkerStatus.IDLE;
              p(); // resolve promise
              break;

            default:
              work.callback(e, tr);
              this.status = FlowWorkerStatus.IDLE;
              p();
          }
        }
      }
    });
  }
  getAccount(address: Buffer): Promise<Account> {
    return new Promise((p) => {
      this.client.getAccountAtLatestBlock({ address }, (err: any, res: any) => {
        if (err) return Promise.reject(err);
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

        case FlowWorkType.GetTransactionResult:
          this.client.getTransactionResult({ id: work.arguments[0] }, (err: any, res: any) => {
            work.callback(err, res);
            this.status = FlowWorkerStatus.IDLE;
            p();
          });
          break;

        case FlowWorkType.TRANSACTION:
          if (!work.proposer || !work.authorizers || !work.payer) {
            work.callback(Error('Proposer, payer, and authorizers must all be provided for a transaction'));
            p();
          }
          if (work.proposer?.address == this.key.address) work.proposer = this.key;
          work.authorizers?.forEach((ak, i) => {
            if (ak.address == this.key.address) (<AccountKey[]>work.authorizers)[i] = this.key;
          });
          work.envelope_signatures?.forEach((ak, i) => {
            if (ak.address == this.key.address) (<AccountKey[]>work.envelope_signatures)[i] = this.key;
          });
          work.payload_signatures?.forEach((ak, i) => {
            if (ak.address == this.key.address) (<AccountKey[]>work.payload_signatures)[i] = this.key;
          });
          const tArgs = argBuilder(work.arguments);
          const block = await this.getLatestBlock();
          const proposer = await this.getAccount(Buffer.from(<string>work.proposer?.address, 'hex'));
          (<AccountKey>work.proposer).sequence_number = proposer.keys.filter((x) => x.public_key?.toString('hex') == work.proposer?.public_key?.toString('hex'))[0].sequence_number;
          const payer = await this.getAccount(<Buffer>work.payer);
          let transaction: Transaction = {
            script: <Buffer>work.script,
            arguments: tArgs,
            reference_block_id: block.id,
            gas_limit: 9999,
            proposal_key: {
              address: Buffer.from(<string>work.proposer?.address, 'hex'),
              key_id: <number>work.proposer?.id,
              sequence_number: <number>work.proposer?.sequence_number,
            },
            payer: payer.address,
            authorizers: <Buffer[]>work.authorizers?.map((x) => Buffer.from(<string>x.address, 'hex')),
            payload_signatures: [],
            envelope_signatures: [],
          };
          transaction = signTransaction(transaction, <AccountKey[]>work.payload_signatures, <AccountKey[]>work.envelope_signatures);
          this.client.sendTransaction({ transaction: transaction }, (err: Error, trans: any) => {
            if (err) {
              work.callback(err);
              this.status = FlowWorkerStatus.IDLE;
              p();
            } else {
              if (work.resolve) {
                this.poll(work, trans.id, p);
              } else {
                work.callback({ id: trans.id });
                this.status = FlowWorkerStatus.IDLE;
                p();
              }
            }
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

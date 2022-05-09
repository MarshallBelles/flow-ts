import { addressBuffer, blockBuffer, rightPaddedHexBuffer, rlpEncode, scriptBuffer, signatureBuffer } from './encode';
import { AccountKey, EventPayload, Transaction, TxEnvelope, TxPayload, Signature } from './models';
import { ec as EC } from 'elliptic';
import { SHA3 } from 'sha3';

export const encodeTransactionPayload = (tx: TxPayload): string => rlpEncode(preparePayload(tx));

export const encodeTransactionEnvelope = (tx: TxEnvelope): string => rlpEncode(prepareEnvelope(tx));

export const signTransaction = (transaction: Transaction, payloadSignatures: AccountKey[], envelopeSignatures: AccountKey[]): Transaction => {
  const tr = transaction;
  const payloadSigs: Signature[] = [];
  payloadSignatures.forEach((ps) => {
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
  envelopeSignatures.forEach((es) => {
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

export const argParse = (arg: any): Object => {
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

export const argBuilder = (args: any[]): Buffer[] => {
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

export const preparePayload = (tx: TxPayload) => {
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

export const prepareEnvelope = (tx: TxEnvelope) => {
  return [preparePayload(tx), preparePayloadSignatures(tx)];
};

export const preparePayloadSignatures = (tx: TxEnvelope) => {
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

export const TX_DOMAIN_TAG_HEX = rightPaddedHexBuffer(Buffer.from('FLOW-V0.0-transaction', 'utf-8').toString('hex'), 32).toString('hex');

export const transactionSignature = (msg: string, key: AccountKey): string => {
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

export const processEvents = (txr: any): void => {
  txr.events.forEach((evt: any, i: number) => {
    const pld: EventPayload = JSON.parse(evt.payload.toString('utf-8'));
    txr.events[i].payload = pld;
  });
};

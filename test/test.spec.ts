/* eslint-disable indent */
import 'jest';
import { Flow, AccountKey } from '../lib';
import { exec, ChildProcess } from 'child_process';
import { prepareSimpleTransaction } from '../lib/encode';
import { argBuilder } from '../lib/signatures';

describe('ContractTesting', () => {
  let flow: Flow;
  let svc: AccountKey;
  let emulator: ChildProcess;

  beforeAll(async () => {
    // start emulator
    emulator = exec('flow emulator');
    // wait 1 second
    await new Promise((p) => setTimeout(p, 1000));
    svc = {
      id: 0,
      address: 'f8d6e0586b0a20c7',
      private_key: Buffer.from('ec8cd232a763fb481711a0f9ce7d1241c7bc3865689afb31e6b213d781642ea7', 'hex'),
      public_key: Buffer.from('81c12390330fdbb55340911b812b50ce7795eefe5478bc5659429f41bdf83d8b6b50f9acc730b9cae67dc29e594ade93cac33f085f07275b8d45331a754497dd', 'hex'),
      hash_algo: 3,
      sign_algo: 2,
      weight: 1000,
      sequence_number: 0,
      revoked: false,
    };
    // connect to emulator
    flow = new Flow('localhost');
    await flow.start();
  });

  afterAll(() => {
    emulator.kill();
  });
  it('getLatestBlock should work', async () => {
    const block = await flow.getLatestBlock();
    if (block instanceof Error) return Promise.reject(block);
    expect(block.height).toBeTruthy();
  });

  it('getTransaction should work', async () => {
    const script = `
      transaction {

        prepare(acct: AuthAccount) {}
      
        execute {
          log("Hello WORLD!")
        }
      }
    `;
    const transaction = await prepareSimpleTransaction(flow, script, [], svc);
    if (transaction instanceof Error) return Promise.reject(transaction);
    const tx = await flow.submitTransaction(transaction);
    if (tx instanceof Error) return Promise.reject(tx);
    // expect submitTransaction to return id
    // export interface TransactionQueuedResponse {
    //   id: Buffer;
    // }
    expect(tx.id).toBeDefined();
    const finTx = await flow.getTransaction(tx.id);
    if (finTx instanceof Error) return Promise.reject(finTx);
    // expect that a Transaction was returned
    // export interface Transaction {
    //   script: Buffer;
    //   arguments: Array<Buffer>;
    //   reference_block_id: Buffer;
    //   gas_limit: number;
    //   proposal_key: {
    //     address: Buffer;
    //     key_id: number;
    //     sequence_number: number;
    //   };
    //   payer: Buffer;
    //   authorizers: Array<Buffer>;
    //   payload_signatures: Array<TransactionSignature>;
    //   envelope_signatures: Array<TransactionSignature>;
    // }
    expect(finTx.script).toBeDefined();
    expect(finTx.arguments.length).toBeDefined();
    expect(finTx.reference_block_id).toBeDefined();
    expect(finTx.gas_limit).toBeDefined();
    expect(finTx.proposal_key).toBeDefined();
    expect(finTx.payer).toBeDefined();
    expect(finTx.authorizers).toBeDefined();
    expect(finTx.payload_signatures).toBeDefined();
    expect(finTx.envelope_signatures).toBeDefined();
  });

  it('getTransactionResult should work', async () => {
    const script = `
      transaction {

        prepare(acct: AuthAccount) {}
      
        execute {
          log("Hello WORLD!")
        }
      }
    `;
    const transaction = await prepareSimpleTransaction(flow, script, [], svc);
    if (transaction instanceof Error) return Promise.reject(transaction);
    const tx = await flow.submitTransaction(transaction);
    if (tx instanceof Error) return Promise.reject(tx);
    const finTx = await flow.getTransactionResult(tx.id);
    if (finTx instanceof Error) return Promise.reject(finTx);
    /* Expect the correct parts to be returned.
    export interface TransactionResultResponse {
      id: Buffer;
      status: string;
      status_code: number;
      error_message: string;
      events: Array<Event>;
    } */
    expect(finTx.id).toBeDefined();
    expect(finTx.status).toBeDefined();
    expect(finTx.status_code).toBeDefined();
    expect(finTx.error_message).toBeDefined();
    expect(finTx.events.length).toBeDefined();
  });


  it('getAccount should work', async () => {
    const account = await flow.getAccount(Buffer.from(svc.address, 'hex'));
    if (account instanceof Error) return debugReject(account);
    // the account we requested should be the one received
    expect(account.address.toString('hex')).toBe(svc.address);
    // the response should match the output type
    // export interface Account {
    //   address: Buffer;
    //   balance: number;
    //   code: Buffer;
    //   keys: Array<AccountKey>;
    //   contracts: Object;
    // }
    expect(account.address).toBeDefined();
    expect(account.balance).toBeDefined();
    expect(account.code).toBeDefined();
    expect(account.keys.length).toBeDefined();
    expect(account.contracts).toBeDefined();
  });

  it('executeScript should work', async () => {
    const script = `
      pub fun main(): Int {
        return 1
      }
    `;
    const scRes = await flow.executeScript(Buffer.from(script), []);
    if (scRes instanceof Error) return debugReject(scRes);
    expect(scRes).toBeTruthy();
  });

  it('executeScript should work with arguments', async () => {
    const script = `
      pub fun main(string: String, float: Fix64, int: Int): Int {
        log(string.concat(float.toString()));
        return int;
      }
    `;
    const args = argBuilder(['HelloWorld!', 1.234689, 42]);
    const scRes = await flow.executeScript(Buffer.from(script), args);
    if (scRes instanceof Error) return debugReject(scRes);
    expect(scRes.value).toBeTruthy();
    expect(JSON.parse(scRes.value.toString()).value).toBe('42');
  });

  it('getEventsWithinBlockHeight should work', async () => {
    const startingBlockHeight = await flow.getLatestBlock(true);
    if (startingBlockHeight instanceof Error) return debugReject(startingBlockHeight);
    // we need to generate some events to test
    const createAccountTemplate = `
      import Crypto
      transaction(publicKeys: [String], contracts: {String: String}) {
          prepare(signer: AuthAccount) {
            let acct = AuthAccount(payer: signer)
      
            for pkey in publicKeys {
                let key = PublicKey(
                    publicKey: pkey.decodeHex(),
                    signatureAlgorithm: SignatureAlgorithm.ECDSA_P256
                )
                acct.keys.add(publicKey: key, hashAlgorithm: HashAlgorithm.SHA3_256, weight: 1000.0)
            }
      
            for contract in contracts.keys {
                acct.contracts.add(name: contract, code: contracts[contract]!.decodeHex())
          }
        }
      }`;
    const keys: Array<string> = [svc.public_key.toString('hex')];
    const tx = await prepareSimpleTransaction(flow, createAccountTemplate, [keys, new Map<string, string>()], svc);
    if (tx instanceof Error) return debugReject(tx);
    const txRes = await flow.submitTransaction(tx);
    if (txRes instanceof Error) return debugReject(txRes);
    // get ending block height
    const endingBlockHeight = await flow.getLatestBlock(true);
    if (endingBlockHeight instanceof Error) return debugReject(endingBlockHeight);
    // get events in the range
    const events = await flow.getEventsWithinBlockHeight('flow.AccountCreated', startingBlockHeight.height, endingBlockHeight.height);
    if (events instanceof Error) return debugReject(events);
    expect(events.length).toBeGreaterThan(0);
    // make sure that the returned events follow the model
    // export interface Event {
    //   type: string;
    //   transaction_id: Buffer;
    //   transaction_index: number;
    //   event_index: number;
    //   payload: EventPayload;
    // }
    events.forEach((evt) => {
      expect(evt.type).toBeDefined();
      expect(evt.transaction_id).toBeDefined();
      expect(evt.transaction_index).toBeDefined();
      expect(evt.event_index).toBeDefined();
      expect(evt.payload).toBeDefined();
    });
  });

  it('getEvents should work', async () => {
    // first we need an event to get
    const createAccountTemplate = `
      import Crypto
      transaction(publicKeys: [String], contracts: {String: String}) {
          prepare(signer: AuthAccount) {
            let acct = AuthAccount(payer: signer)
      
            for pkey in publicKeys {
                let key = PublicKey(
                    publicKey: pkey.decodeHex(),
                    signatureAlgorithm: SignatureAlgorithm.ECDSA_P256
                )
                acct.keys.add(publicKey: key, hashAlgorithm: HashAlgorithm.SHA3_256, weight: 1000.0)
            }
      
            for contract in contracts.keys {
                acct.contracts.add(name: contract, code: contracts[contract]!.decodeHex())
          }
        }
      }`;
    // prepare transaction
    const keys: Array<string> = [svc.public_key.toString('hex')];
    const transaction = await prepareSimpleTransaction(flow, createAccountTemplate, [keys, new Map<string, string>()], svc);
    if (transaction instanceof Error) return debugReject(transaction);
    // submit transaction
    const tx = await flow.submitTransaction(transaction);
    if (tx instanceof Error) return debugReject(tx);
    // get events for that block
    const events = await flow.getEvents('flow.AccountCreated', [transaction.reference_block_id]);
    if (events instanceof Error) return debugReject(events);
    expect(events.length).toBeGreaterThan(0);
    // make sure that the returned events follow the model
    // export interface Event {
    //   type: string;
    //   transaction_id: Buffer;
    //   transaction_index: number;
    //   event_index: number;
    //   payload: EventPayload;
    // }
    events.forEach((evt) => {
      expect(evt.type).toBeDefined();
      expect(evt.transaction_id).toBeDefined();
      expect(evt.transaction_index).toBeDefined();
      expect(evt.event_index).toBeDefined();
      expect(evt.payload).toBeDefined();
    });
  });
});

const debugReject = (err: Error) => {
  console.log(err.message);
  return Promise.reject(err);
};

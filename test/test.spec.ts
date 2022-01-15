/* eslint-disable indent */
import 'jest';
import { Flow, AccountKey, FlowNetwork } from '../lib';
import { exec, ChildProcess } from 'child_process';
import { gzip } from 'zlib';

describe('ContractTesting', () => {
  let flow: Flow;
  let svc: AccountKey;
  let usr1: AccountKey;
  let usr2: AccountKey;
  let emulator: ChildProcess;
  const transactions: Buffer[] = [];

  beforeAll(async () => {
    // start emulator
    emulator = exec('flow emulator');
    // wait 1 second
    await new Promise<void>((p) => setTimeout(p, 1000));
    svc = {
      id: 0,
      address: 'f8d6e0586b0a20c7',
      private_key: Buffer.from('ec8cd232a763fb481711a0f9ce7d1241c7bc3865689afb31e6b213d781642ea7', 'hex'),
      public_key: Buffer.from('81c12390330fdbb55340911b812b50ce7795eefe5478bc5659429f41bdf83d8b6b50f9acc730b9cae67dc29e594ade93cac33f085f07275b8d45331a754497dd', 'hex'),
      hash_algo: 3,
      sign_algo: 2,
      weight: 1000,
    };
    // connect to emulator
    flow = new Flow(FlowNetwork.EMULATOR, '0xf8d6e0586b0a20c7', [svc], 5);
    await flow.start();
    // create usr1 and usr2 accounts for testing
    usr1 = {
      id: 0,
      private_key: Buffer.from('ac4fdb02a932bc4a0cae0987258316727ede1973f784b91260f5bfeccfebb900', 'hex'),
      public_key: Buffer.from('54cfa0f49e1364255eb5ac6b3b5a6fd5a23cf9a786c39640a5a0ccd9d257c85d1de75d0f928ad504af4a9791e9d1b9ed4faae0149b0ffb75094cbea4c23fc1f1', 'hex'),
      hash_algo: 3,
      sign_algo: 2,
      weight: 1000,
    };
    const acct1 = await flow.create_account([usr1]);
    if (acct1 instanceof Error) return Promise.reject(acct1);
    usr1.address = acct1.events.filter((x) => x.type == 'flow.AccountCreated')[0].payload.value.fields[0].value.value.replace(/\b0x/g, '');
    usr2 = {
      id: 0,
      private_key: Buffer.from('ac4fdb02a932bc4a0cae0987258316727ede1973f784b91260f5bfeccfebb900', 'hex'),
      public_key: Buffer.from('54cfa0f49e1364255eb5ac6b3b5a6fd5a23cf9a786c39640a5a0ccd9d257c85d1de75d0f928ad504af4a9791e9d1b9ed4faae0149b0ffb75094cbea4c23fc1f1', 'hex'),
      hash_algo: 3,
      sign_algo: 2,
      weight: 1000,
    };
    const acct2 = await flow.create_account([usr2]);
    if (acct2 instanceof Error) return Promise.reject(acct2);
    usr2.address = acct2.events.filter((x) => x.type == 'flow.AccountCreated')[0].payload.value.fields[0].value.value.replace(/\b0x/g, '');
  });

  afterAll(() => {
    // stop Flow
    flow.stop();
    emulator.kill();
  });

  it('get_account should work', async () => {
    const account = await flow.get_account(<string>usr1.address);
    if (account instanceof Error) return Promise.reject(account);
    expect(account.address.toString('hex')).toBe(<string>usr1.address);
  });

  it('get_block should work', async () => {
    const block = await flow.get_block();
    if (block instanceof Error) return Promise.reject(block);
    expect(block.height).toBeTruthy();
  });

  it('create_account should work', async () => {
    const newAcctTx = await flow.create_account([usr1]); // use same key as usr1
    if (newAcctTx instanceof Error) return Promise.reject(newAcctTx);
    expect(newAcctTx.events.filter((x) => x.type === 'flow.AccountCreated').length).toBe(1);
  });

  it('add_contract should work', async () => {
    const contract = `
      pub contract NFTS {
          pub event NFTMinted(uuid: Int, md: String)
          pub event NFTWithdraw(uuid: Int, md: String)
          pub event NFTDeposit(uuid: Int, md: String)
          pub resource NFT {
              pub let metadata: String // our metadata is a hex-encoded gzipped JSON string
              init(metadata: String) {
                  self.metadata = metadata
              }
          }
          pub resource interface NFTReceiver {
              pub fun deposit(token: @NFT)
              pub fun getIDs(): [Int]
              pub fun idExists(id: Int): Bool
              pub fun getMetadata(ids: [Int]): [String]
          }
          pub resource Collection: NFTReceiver {
              pub var ownedNFTs: @{Int: NFT}
              init () {
                  self.ownedNFTs <- {}
              }
              pub fun withdraw(withdrawID: Int): @NFT {
                  let token <- self.ownedNFTs.remove(key: withdrawID)!
                  emit NFTWithdraw(uuid: Int(token.uuid), md: token.metadata)
                  return <-token
              }
              pub fun deposit(token: @NFT) {
                  emit NFTDeposit(uuid: Int(token.uuid), md: token.metadata)
                  self.ownedNFTs[Int(token.uuid)] <-! token
              }
              pub fun idExists(id: Int): Bool {
                  return self.ownedNFTs[id] != nil
              }
              pub fun getIDs(): [Int] {
                  return self.ownedNFTs.keys
              }
              pub fun getMetadata(ids: [Int]): [String] {
                  var ret: [String] = []
                  for id in ids {
                      ret.append(self.ownedNFTs[id]?.metadata!)
                  }
                  return ret
              }
              destroy() {
                  destroy self.ownedNFTs
              }
          }
          pub fun createEmptyCollection(): @Collection {
              return <- create Collection()
          }
          pub resource NFTMinter {
              pub fun mintNFT(metadata: String): @NFT {
                  var newNFT <- create NFT(metadata: metadata)
                  emit NFTMinted(uuid: Int(newNFT.uuid), md: metadata)
                  return <-newNFT
              }
          }
        init() {
              self.account.save(<-self.createEmptyCollection(), to: /storage/NFTCollection)
              self.account.link<&{NFTReceiver}>(/public/NFTReceiver, target: /storage/NFTCollection)
              self.account.save(<-create NFTMinter(), to: /storage/NFTMinter)
        }
      }
    `;

    const txRes = await flow.add_contract('NFTS', contract, usr1); // should deploy to usr1
    if (txRes instanceof Error) return Promise.reject(txRes);
    expect(txRes.events.length).toBeGreaterThan(0);
    const tx2Res = await flow.add_contract('NFTS', contract); // should deploy to svc
    if (tx2Res instanceof Error) return Promise.reject(tx2Res);
    expect(tx2Res.events.length).toBeGreaterThan(0);
  });

  it('execute_transaction should work', async () => {
    // mint 2 NFTs
    const metadataForNFT1 = {
      ID: 1, // this is our R3V ID, not the NFT UUID
      DROP: 1, // this is the R3V Drop ID
      ARTISTS: 'Various Artists', // artist names (Multiple = 5+, Various = 20+)
      VENUE: 'NA', // venue name
      EVENT: 'NOT REAL', // the event
      DATE: '1638921600', // epoch timestamp, no milliseconds
      IPFS: 'QmUSxtU3h27vfbnSNOTREALkb3PvxD9XVVJjfRnJ5HFJ45', // the IPFS hash for the video file (always .mp4)
    };

    const metadataForNFT2 = {
      ID: 2, // this is our R3V ID, not the NFT UUID
      DROP: 1, // this is the R3V Drop ID
      ARTISTS: 'Various Artists', // artist names (Multiple = 5+, Various = 20+)
      VENUE: 'NA', // venue name
      EVENT: 'NOT REAL', // the event
      DATE: '1638921600', // epoch timestamp, no milliseconds
      IPFS: 'QmUSxtU3h27vfbnSELhK2xTkb3PvxNOTREALjfRnJ5HFJ45', // the IPFS hash for the video file (always .mp4)
    };
    const metadata1 = await new Promise<Buffer>((p) => gzip(Buffer.from(JSON.stringify(metadataForNFT1)), (e, b) => p(b)));
    const metadata2 = await new Promise<Buffer>((p) => gzip(Buffer.from(JSON.stringify(metadataForNFT2)), (e, b) => p(b)));

    const transaction = `
      import NFTS from 0x${svc.address}

      transaction(metadata: [String]) {

          let receiverRef: &{NFTS.NFTReceiver}
          let minterRef: &NFTS.NFTMinter

          prepare(acct: AuthAccount) {
              self.receiverRef = acct.getCapability<&{NFTS.NFTReceiver}>(/public/NFTReceiver)
                  .borrow()
                  ?? panic("Could not borrow receiver reference")
              self.minterRef = acct.borrow<&NFTS.NFTMinter>(from: /storage/NFTMinter)
                  ?? panic("Could not borrow minter reference")
          }

          execute {
              var i: Int = 0;
              while i < metadata.length {
                  let newNFT <- self.minterRef.mintNFT(metadata: metadata[i])
                  self.receiverRef.deposit(token: <-newNFT)
                  i = i + 1
              }
          }
      }
    `;
    const tx1 = await flow.execute_transaction(transaction, [[metadata1, metadata2]]);
    if (tx1 instanceof Error) return Promise.reject(tx1);
    if (tx1.status_code != 0) return Promise.reject(Error(tx1.error_message));
    expect(tx1.events.length).toBe(4);
  });

  it('send_transaction should work', async () => {
    // mint 2 NFTs
    const metadataForNFT1 = {
      ID: 1, // this is our R3V ID, not the NFT UUID
      DROP: 1, // this is the R3V Drop ID
      ARTISTS: 'Various Artists', // artist names (Multiple = 5+, Various = 20+)
      VENUE: 'NA', // venue name
      EVENT: 'NOT REAL', // the event
      DATE: '1638921600', // epoch timestamp, no milliseconds
      IPFS: 'QmUSxtU3h27vfbnSNOTREALkb3PvxD9XVVJjfRnJ5HFJ45', // the IPFS hash for the video file (always .mp4)
    };

    const metadataForNFT2 = {
      ID: 2, // this is our R3V ID, not the NFT UUID
      DROP: 1, // this is the R3V Drop ID
      ARTISTS: 'Various Artists', // artist names (Multiple = 5+, Various = 20+)
      VENUE: 'NA', // venue name
      EVENT: 'NOT REAL', // the event
      DATE: '1638921600', // epoch timestamp, no milliseconds
      IPFS: 'QmUSxtU3h27vfbnSELhK2xTkb3PvxNOTREALjfRnJ5HFJ45', // the IPFS hash for the video file (always .mp4)
    };
    const metadata1 = await new Promise<Buffer>((p) => gzip(Buffer.from(JSON.stringify(metadataForNFT1)), (e, b) => p(b)));
    const metadata2 = await new Promise<Buffer>((p) => gzip(Buffer.from(JSON.stringify(metadataForNFT2)), (e, b) => p(b)));

    const transaction = `
      import NFTS from 0x${svc.address}

      transaction(metadata: [String]) {

          let receiverRef: &{NFTS.NFTReceiver}
          let minterRef: &NFTS.NFTMinter

          prepare(acct: AuthAccount) {
              self.receiverRef = acct.getCapability<&{NFTS.NFTReceiver}>(/public/NFTReceiver)
                  .borrow()
                  ?? panic("Could not borrow receiver reference")
              self.minterRef = acct.borrow<&NFTS.NFTMinter>(from: /storage/NFTMinter)
                  ?? panic("Could not borrow minter reference")
          }

          execute {
              var i: Int = 0;
              while i < metadata.length {
                  let newNFT <- self.minterRef.mintNFT(metadata: metadata[i])
                  self.receiverRef.deposit(token: <-newNFT)
                  i = i + 1
              }
          }
      }
    `;
    const tx1 = await flow.send_transaction(transaction, [[metadata1, metadata2]]);
    if (tx1 instanceof Error) return Promise.reject(tx1);
    expect(tx1.id).toBeTruthy();
    transactions.push(tx1.id);
  });

  it('get_transaction_result should work', async () => {
    const txRes = await flow.get_transaction_result(transactions[0]);
    if (txRes instanceof Error) return Promise.reject(txRes);
    expect(txRes.id).toBeTruthy();
  });

  it('update_contract should work', async () => {
    const contract = `
    // this contract has an updated comment
      pub contract NFTS {
          pub event NFTMinted(uuid: Int, md: String)
          pub event NFTWithdraw(uuid: Int, md: String)
          pub event NFTDeposit(uuid: Int, md: String)
          pub resource NFT {
              pub let metadata: String // our metadata is a hex-encoded gzipped JSON string
              init(metadata: String) {
                  self.metadata = metadata
              }
          }
          pub resource interface NFTReceiver {
              pub fun deposit(token: @NFT)
              pub fun getIDs(): [Int]
              pub fun idExists(id: Int): Bool
              pub fun getMetadata(ids: [Int]): [String]
          }
          pub resource Collection: NFTReceiver {
              pub var ownedNFTs: @{Int: NFT}
              init () {
                  self.ownedNFTs <- {}
              }
              pub fun withdraw(withdrawID: Int): @NFT {
                  let token <- self.ownedNFTs.remove(key: withdrawID)!
                  emit NFTWithdraw(uuid: Int(token.uuid), md: token.metadata)
                  return <-token
              }
              pub fun deposit(token: @NFT) {
                  emit NFTDeposit(uuid: Int(token.uuid), md: token.metadata)
                  self.ownedNFTs[Int(token.uuid)] <-! token
              }
              pub fun idExists(id: Int): Bool {
                  return self.ownedNFTs[id] != nil
              }
              pub fun getIDs(): [Int] {
                  return self.ownedNFTs.keys
              }
              pub fun getMetadata(ids: [Int]): [String] {
                  var ret: [String] = []
                  for id in ids {
                      ret.append(self.ownedNFTs[id]?.metadata!)
                  }
                  return ret
              }
              destroy() {
                  destroy self.ownedNFTs
              }
          }
          pub fun createEmptyCollection(): @Collection {
              return <- create Collection()
          }
          pub resource NFTMinter {
              pub fun mintNFT(metadata: String): @NFT {
                  var newNFT <- create NFT(metadata: metadata)
                  emit NFTMinted(uuid: Int(newNFT.uuid), md: metadata)
                  return <-newNFT
              }
          }
        init() {
              self.account.save(<-self.createEmptyCollection(), to: /storage/NFTCollection)
              self.account.link<&{NFTReceiver}>(/public/NFTReceiver, target: /storage/NFTCollection)
              self.account.save(<-create NFTMinter(), to: /storage/NFTMinter)
        }
      }
    `;

    const txRes = await flow.update_contract('NFTS', contract, usr1);
    if (txRes instanceof Error) return Promise.reject(txRes);
    expect(txRes.events.length).toBeGreaterThan(0);
    const tx2Res = await flow.update_contract('NFTS', contract);
    if (tx2Res instanceof Error) return Promise.reject(tx2Res);
    expect(tx2Res.events.length).toBeGreaterThan(0);
  });

  it('specific authorizers should work', async () => {
    expect(flow).toBeInstanceOf(Flow);
    const transaction: string = `
        import NFTS from 0x${svc.address}
        transaction {
          prepare(acct: AuthAccount) {
            let collection <- NFTS.createEmptyCollection()
            acct.save<@NFTS.Collection>(<-collection, to: /storage/NFTCollection)
            acct.link<&{NFTS.NFTReceiver}>(/public/NFTReceiver, target: /storage/NFTCollection)
          }
        }
      `;
    const txRes = await flow.execute_transaction(transaction, [], [usr2], usr2);
    if (txRes instanceof Error) return Promise.reject(txRes);
    if (txRes.status_code != 0) return Promise.reject(Error(txRes.error_message));
  });

  it('remove_contract should work', async () => {
    const txRes = await flow.remove_contract('NFTS', usr1);
    if (txRes instanceof Error) return Promise.reject(txRes);
    expect(txRes.events.length).toBeGreaterThan(0);
    const tx2Res = await flow.remove_contract('NFTS');
    if (tx2Res instanceof Error) return Promise.reject(tx2Res);
    expect(tx2Res.events.length).toBeGreaterThan(0);
  });

  it('add_key should work', async () => {
    const txRes = await flow.add_key({ public_key: Buffer.from('54cfa0f49e1364255eb5ac6b3b5a6fd5a23cf9a786c39640a5a0ccd9d257c85d1de75d0f928ad504af4a9791e9d1b9ed4faae0149b0ffb75094cbea4c23fc1f1', 'hex'), weight: 1000, sign_algo: 2, hash_algo: 3 }, usr1);
    if (txRes instanceof Error) return Promise.reject(txRes);
    expect(txRes.events.length).toBeGreaterThan(0);
    const tx2Res = await flow.add_key({ public_key: Buffer.from('54cfa0f49e1364255eb5ac6b3b5a6fd5a23cf9a786c39640a5a0ccd9d257c85d1de75d0f928ad504af4a9791e9d1b9ed4faae0149b0ffb75094cbea4c23fc1f1', 'hex'), weight: 1000, sign_algo: 2, hash_algo: 3 });
    if (tx2Res instanceof Error) return Promise.reject(tx2Res);
    expect(tx2Res.events.length).toBeGreaterThan(0);
  });

  it('remove_key should work', async () => {
    const txRes = await flow.remove_key(1, usr1);
    if (txRes instanceof Error) return Promise.reject(txRes);
    expect(txRes.events.length).toBeGreaterThan(0);
    const tx2Res = await flow.remove_key(1);
    if (tx2Res instanceof Error) return Promise.reject(tx2Res);
    expect(tx2Res.events.length).toBeGreaterThan(0);
  });
});

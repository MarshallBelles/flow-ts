import { Flow, FlowKey, FlowNetwork, Keys } from '../lib';
import debug from 'debug';
const debugLog = debug('Test');

const key0: FlowKey = {
  keyID: 0,
  private: 'b456bc1273380930d7839559c8026d3ba8e6418b9d040bd7021f1eb8d67bcf75',
  public: 'a6a1f28c43c89e8d04643378c93da88b52bf09c862d30a957ee403f1e7d3a6ab3723427c2bae6d13ec019e9ef892f0130caab47cae0da6b8da68f98be95d47fe',
};
const flow = new Flow(FlowNetwork.EMULATOR, '0xf8d6e0586b0a20c7', [key0], 5);

let newTestAccount = '';
let newTestAccount2 = '';
const newTestKeys: Keys = {
  private: 'e15abdfb61b936bc327db72d51279207263ec6630a56f30dbf3ecb56f58316e1',
  public: 'f70d48c7b8fd06436a166bb3c9fd59be2b629d572a7ec01ea5389fd8a4cb7bad3922ef0313c484b0073b0a759ce4aa899371831670a2dc52848e441b29fda06d',
};
const newTestKeys2: Keys = {
  private: '93ad4acf63a80183bc6d95e846bfdb12a103f9607c8705a040795bccacecce17',
  public: '62a80713b0e2d63cdc13d8010eb6e55ad6ed5f8f3ff83c78b6faa1b94d204591276d92fe3cdc116000f3038dec4fc9d5396b8852724591530178fb5b84c9128a',
};

export const runTests = async () => {
  debugLog('Beginning Tests');
  try {
    await connectionTest();
    await getAccountTest();
    await getBlockTest();
    await createAccountTest();
    await executeTransactionTest();
    await deployContractTest();
    await updateContractTest();
    await removeContractTest();
    await addKeyTest();
    await removeKeyTest();
    flow.stop();
  } catch (error) {
    flow.stop();
    debugLog('Tests Failed');
  }
};

export const connectionTest = async (): Promise<Boolean | Error> => {
  return await new Promise(async (p) => {
    const dbg = debug('Test Connection');
    dbg('Beginning Test');
    try {
      await flow.start();
      dbg('Test Successful');
      p(true);
    } catch (error) {
      dbg('Test failed');
      p(Error(JSON.stringify(error)));
    }
  });
};

export const getAccountTest = async (): Promise<Boolean | Error> => {
  return await new Promise(async (p) => {
    const dbg = debug('Test flow.get_account');
    dbg('Beginning Test');
    try {
      const account = await flow.get_account('0xf8d6e0586b0a20c7');
      if (account instanceof Error) return Promise.reject(account);
      dbg('Account:', account.address.toString('hex'));
      dbg('Test Successful');
      p(true);
    } catch (error) {
      dbg('Test failed');
      p(Error(JSON.stringify(error)));
    }
  });
};

export const getBlockTest = async (): Promise<Boolean | Error> => {
  return await new Promise(async (p) => {
    const dbg = debug('Test flow.get_block');
    dbg('Beginning Test');
    try {
      const latestBlock = await flow.get_block();
      if (latestBlock instanceof Error) return Promise.reject(latestBlock);
      dbg('Latest block:', latestBlock.id.toString('hex'));
      dbg('Block height:', latestBlock.height);
      dbg('Test Successful');
      p(true);
    } catch (error) {
      dbg('Test failed');
      p(Error(JSON.stringify(error)));
    }
  });
};

export const createAccountTest = async (): Promise<Boolean | Error> => {
  return await new Promise(async (p) => {
    const dbg = debug('Test flow.create_account');
    dbg('Beginning Test');
    try {
      const newAccount = await flow.create_account([newTestKeys.public]);
      if (newAccount instanceof Error) return Promise.reject(newAccount);
      newTestAccount = newAccount.events.filter((x) => x.type == 'flow.AccountCreated')[0].payload.value.fields[0].value.value;
      dbg('Test Successful');
      p(true);
    } catch (error) {
      dbg('Test failed');
      p(Error(JSON.stringify(error)));
    }
  });
};

export const executeTransactionTest = async (): Promise<Boolean | Error> => {
  const simpleTransaction = `
    transaction(greeting: String) {

      let guest: String
      prepare(authorizer: AuthAccount) {
        self.guest = authorizer.address.toString()
      }
    
      execute {
        log(greeting.concat(",").concat(self.guest))
      }
    }
  `;
  const doubleAuthz = `
    transaction(greeting: String, greeting2: String) {

      let guest: String
      let guest2: String
      prepare(authorizer: AuthAccount, authorizer2: AuthAccount) {
        self.guest = authorizer.address.toString()
        self.guest2 = authorizer2.address.toString()
      }
      execute {
        log(greeting.concat(",").concat(self.guest).concat(",").concat(greeting2).concat(",").concat(self.guest2))
      }
    }
  `;
  return await new Promise(async (p) => {
    const dbg = debug('Test flow.execute_transaction');
    dbg('Beginning Test');
    try {
      const newAccount = await flow.create_account([newTestKeys2.public]);
      if (newAccount instanceof Error) return Promise.reject(newAccount);
      newTestAccount2 = newAccount.events.filter((x) => x.type == 'flow.AccountCreated')[0].payload.value.fields[0].value.value;

      const prop = {
        address: Buffer.from(newTestAccount.replace(/\b0x/g, ''), 'hex'),
        privateKey: newTestKeys.private,
        publicKey: newTestKeys.public,
      };

      const prop2 = {
        address: Buffer.from(newTestAccount2.replace(/\b0x/g, ''), 'hex'),
        privateKey: newTestKeys2.private,
        publicKey: newTestKeys2.public,
      };

      dbg('test simple transaction, authorized, proposed, and paid by the service account');
      const tx0 = await flow.execute_transaction(simpleTransaction, ['hello']);
      if (tx0 instanceof Error) return Promise.reject(tx0);
      if (tx0.status_code == 1) return Promise.reject(Error(tx0.error_message));

      dbg('test simple transaction authorized and proposed by the newTestAccount, paid by the service account');
      const tx1 = await flow.execute_transaction(simpleTransaction, ['world'], [prop], prop);
      if (tx1 instanceof Error) return Promise.reject(tx1);
      if (tx1.status_code == 1) return Promise.reject(Error(tx1.error_message));

      dbg('test simple transaction, proposed and paid by the newTestAccount');
      const tx2 = await flow.execute_transaction(simpleTransaction, ['world'], [prop], prop, prop);
      if (tx2 instanceof Error) return Promise.reject(tx2);
      if (tx2.status_code == 1) return Promise.reject(Error(tx2.error_message));

      dbg('test double authorizer transaction paid by newTestAccount');
      const tx4 = await flow.execute_transaction(doubleAuthz, ['hello', 'world'], [prop2, prop], prop, prop);
      if (tx4 instanceof Error) return Promise.reject(tx4);
      if (tx4.status_code == 1) return Promise.reject(Error(tx4.error_message));

      dbg('Test Successful');
      p(true);
    } catch (error) {
      dbg('Test failed');
      p(Error(JSON.stringify(error)));
    }
  });
};

export const deployContractTest = async (): Promise<Boolean | Error> => {
  const dbg = debug('Test flow.add_contract');
  dbg('Beginning Test');

  return new Promise(async (p) => {
    try {
      const newContract = `
        pub contract HelloWorld {
          // Declare a stored state field in HelloWorld
          //
          pub let greeting: String
      
          // Declare a function that can be called by anyone
          // who imports the contract
          //
          pub fun hello(): String {
              return self.greeting
          }
          init() {
              self.greeting = \"Hello World!\"
          }
        }
      `;
      const acct = {
        address: Buffer.from(newTestAccount.replace(/\b0x/g, ''), 'hex'),
        privateKey: newTestKeys.private,
        publicKey: newTestKeys.public,
      };
      const txResult = await flow.add_contract('HelloWorld', newContract, acct);
      if (txResult instanceof Error) return Promise.reject(txResult);
      if (txResult.events[0].type !== 'flow.AccountContractAdded') return Promise.reject(Error('failed to add contract'));
      dbg('Test Successful');
      p(true);
    } catch (error) {
      dbg('Test failed');
      p(Error(JSON.stringify(error)));
    }
  });
};

export const updateContractTest = async (): Promise<Boolean | Error> => {
  const dbg = debug('Test flow.update_contract');
  dbg('Beginning Test');

  return new Promise(async (p) => {
    try {
      const newContract = `
        pub contract HelloWorld {
          // Declare a stored state field in HelloWorld
          // this is the new line :)
          pub let greeting: String
      
          // Declare a function that can be called by anyone
          // who imports the contract
          //
          pub fun hello(): String {
              return self.greeting
          }
          init() {
              self.greeting = \"Hello World!\"
          }
        }
      `;
      const acct = {
        address: Buffer.from(newTestAccount.replace(/\b0x/g, ''), 'hex'),
        privateKey: newTestKeys.private,
        publicKey: newTestKeys.public,
      };
      const txResult = await flow.update_contract('HelloWorld', newContract, acct);
      if (txResult instanceof Error) return Promise.reject(txResult);
      if (txResult.events[0].type !== 'flow.AccountContractUpdated') return Promise.reject(Error('failed to update contract'));
      dbg('Test Successful');
      p(true);
    } catch (error) {
      dbg('Test failed');
      p(Error(JSON.stringify(error)));
    }
  });
};

export const removeContractTest = async (): Promise<Boolean | Error> => {
  const dbg = debug('Test flow.remove_contract');
  dbg('Beginning Test');

  return new Promise(async (p) => {
    try {
      const acct = {
        address: Buffer.from(newTestAccount.replace(/\b0x/g, ''), 'hex'),
        privateKey: newTestKeys.private,
        publicKey: newTestKeys.public,
      };
      const txResult = await flow.remove_contract('HelloWorld', acct);
      if (txResult instanceof Error) return Promise.reject(txResult);
      if (txResult.events[0].type !== 'flow.AccountContractRemoved') return Promise.reject(Error('failed to remove contract'));
      dbg('Test Successful');
      p(true);
    } catch (error) {
      dbg('Test failed');
      p(Error(JSON.stringify(error)));
    }
  });
};

export const addKeyTest = async (): Promise<Boolean | Error> => {
  const dbg = debug('Test flow.add_key');
  dbg('Beginning Test');

  return new Promise(async (p) => {
    try {
      const acct = {
        address: Buffer.from(newTestAccount.replace(/\b0x/g, ''), 'hex'),
        privateKey: newTestKeys.private,
        publicKey: newTestKeys.public,
      };
      const newKey = {
        public: 'db19d449532f529445e01410c0e2b9dda0c82d9b3adda9e6b9ba2c3f9b9b85c2ab740029e6bdaee99c9b9ffef9ca4bcba9e0666c7bd5e032e6a7c61eb7b5a7a6',
        weight: 1000,
      };
      const txResult = await flow.add_key(newKey, acct);
      if (txResult instanceof Error) return Promise.reject(txResult);
      if (txResult.events[0].type !== 'flow.AccountKeyAdded') return Promise.reject(Error('failed to add key'));
      dbg('Test Successful');
      p(true);
    } catch (error) {
      dbg('Test failed');
      p(Error(JSON.stringify(error)));
    }
  });
};

export const removeKeyTest = async (): Promise<Boolean | Error> => {
  const dbg = debug('Test flow.remove_key');
  dbg('Beginning Test');

  return new Promise(async (p) => {
    try {
      const acct = {
        address: Buffer.from(newTestAccount.replace(/\b0x/g, ''), 'hex'),
        privateKey: newTestKeys.private,
        publicKey: newTestKeys.public,
      };
      const txResult = await flow.remove_key(1, acct);
      if (txResult instanceof Error) return Promise.reject(txResult);
      if (txResult.events[0].type !== 'flow.AccountKeyRemoved') return Promise.reject(Error('failed to remove key'));
      dbg('Test Successful');
      p(true);
    } catch (error) {
      dbg('Test failed');
      p(Error(JSON.stringify(error)));
    }
  });
};

runTests();

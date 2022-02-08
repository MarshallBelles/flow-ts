/* eslint-disable indent */
import 'jest';
import { FlowTs, Config, API } from '../lib';

describe('ContractTesting', () => {
  let flow: FlowTs;

  beforeEach(async () => {
    const conf: Config = {
      api: API.LOCALHOST,
      project_id: 'r3volution-us-1',
      locationId: 'us-east1',
      keyId: 'NewTestKey',
      keyRingId: 'r3v-dev',
      versionId: '1',
    };
    flow = new FlowTs(conf, 'credentials.json');
  });

  it('get_account should work', async () => {
    const account = await flow.getAccount('f8d6e0586b0a20c7');
    if (account instanceof Error) return Promise.reject(account);
    expect(account.address).toBe('f8d6e0586b0a20c7');
  });

  it('get_block should work', async () => {
    const block = await flow.getBlock();
    if (block instanceof Error) return Promise.reject(block);
    expect(block[0].height).toBeTruthy();
  });

  it('create_account should work', async () => {
  });

  it('add_contract should work', async () => {
  });

  it('execute_transaction should work', async () => {
  });

  it('send_transaction should work', async () => {
  });

  it('get_transaction_result should work', async () => {
  });

  it('update_contract should work', async () => {
  });

  it('specific authorizers should work', async () => {
  });

  it('remove_contract should work', async () => {
  });

  it('add_key should work', async () => {
  });

  it('remove_key should work', async () => {
  });
});

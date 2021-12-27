import { Flow, FlowKey, FlowNetwork } from '../lib';
import { ec as EC } from 'elliptic';
import { SHA3 } from 'sha3';
import debug from 'debug';
const debugLog = debug('Sign');

const MESSAGE = 'FOO';
const MESSAGE_HEX = Buffer.from(MESSAGE).toString('hex');
const PRIVATE_KEY = 'b456bc1273380930d7839559c8026d3ba8e6418b9d040bd7021f1eb8d67bcf75';
const key0: FlowKey = {
  keyID: 0,
  private: 'b456bc1273380930d7839559c8026d3ba8e6418b9d040bd7021f1eb8d67bcf75',
  public: 'a6a1f28c43c89e8d04643378c93da88b52bf09c862d30a957ee403f1e7d3a6ab3723427c2bae6d13ec019e9ef892f0130caab47cae0da6b8da68f98be95d47fe',
};
const flow = new Flow(FlowNetwork.EMULATOR, '0xf8d6e0586b0a20c7', [key0], 5);

const VERIFY_SIG = `
    pub fun main(message: String, signature: String): Bool {
        let pk = PublicKey(
            publicKey: "a6a1f28c43c89e8d04643378c93da88b52bf09c862d30a957ee403f1e7d3a6ab3723427c2bae6d13ec019e9ef892f0130caab47cae0da6b8da68f98be95d47fe".decodeHex(),
            signatureAlgorithm: SignatureAlgorithm.ECDSA_P256
        )
        let isValid = pk.verify(
            signature: signature.decodeHex(),
            signedData: message.decodeHex(),
            domainSeparationTag: "FLOW-V0.0-user",
            hashAlgorithm: HashAlgorithm.SHA3_256
        )
        return isValid
    }`;

const rightPaddedHexBuffer = (value: string, pad: number): Buffer => Buffer.from(value.padEnd(pad * 2, '0'), 'hex');
const USER_DOMAIN_TAG_HEX = rightPaddedHexBuffer(Buffer.from('FLOW-V0.0-user').toString('hex'), 32).toString('hex');
// const TX_DOMAIN_TAG_HEX = rightPaddedHexBuffer(Buffer.from('FLOW-V0.0-transaction').toString('hex'), 32).toString('hex');

function signMessage(msg: string, privateKey: string) {
  debugLog('signing message:', msg);
  const ec = new EC('p256');
  const key = ec.keyFromPrivate(Buffer.from(privateKey, 'hex'));
  const sha = new SHA3(256);
  const totalMsgHex = USER_DOMAIN_TAG_HEX + msg;
  sha.update(Buffer.from(totalMsgHex, 'hex'));
  const digest = sha.digest();
  const sig = key.sign(digest);
  const n = 32;
  const r = sig.r.toArrayLike(Buffer, 'be', n);
  const s = sig.s.toArrayLike(Buffer, 'be', n);
  return Buffer.concat([r, s]).toString('hex');
}

export const test = async () => {
  const signature = signMessage(MESSAGE_HEX, PRIVATE_KEY);
  await flow.start();
  const verificationResult = await flow.execute_script(VERIFY_SIG, [MESSAGE_HEX, signature]);
  debugLog(verificationResult);
  flow.stop();
};

test();

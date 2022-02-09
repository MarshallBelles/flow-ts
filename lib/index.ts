import { KeyManagementServiceClient } from '@google-cloud/kms';
import { Account, API, Block, FlowRestClient } from '@marshallbelles/flow-rest';
import * as crypto from 'crypto';

export { API };

export interface Config {
  api: API;
  project_id: string;
  locationId: string;
  keyRingId: string;
  keyId: string;
  versionId: string;
}

export enum Digest {
  // eslint-disable-next-line no-unused-vars
  sha256,
  // eslint-disable-next-line no-unused-vars
  sha3_256
}

export class FlowTs {
  private KMSClient: KeyManagementServiceClient;
  private versionName: string;
  private config: Config;
  private RESTClient: FlowRestClient;

  constructor(config: Config, credentialsFile: string, KMSClientOverride?: KeyManagementServiceClient) {
    this.config = config;
    this.KMSClient = KMSClientOverride ? KMSClientOverride : new KeyManagementServiceClient({ credentials_file: credentialsFile });
    this.versionName = this.KMSClient.cryptoKeyVersionPath(
        config.project_id,
        config.locationId,
        config.keyRingId,
        config.keyId,
        config.versionId
    );
    this.RESTClient = new FlowRestClient(config.api);
  }
  private async signMessage(msg: Buffer): Promise<Buffer> {
    // Create a digest of the message. The digest needs to match the digest
    // configured for the Cloud KMS key.

    // This library only supports KMS: Elliptic Curve P-256 - SHA256 Digest

    const hash = crypto.createHash('sha256');

    hash.update(msg);
    const digest = hash.digest();

    // Optional but recommended: Compute digest's CRC32C.
    const crc32c = require('fast-crc32c');
    const digestCrc32c = crc32c.calculate(digest);

    // Sign the message with Cloud KMS
    const [signResponse] = await this.KMSClient.asymmetricSign({
      name: this.versionName,
      digest: {
        sha256: digest,
      },
      digestCrc32c: {
        value: digestCrc32c,
      },
    });

    if (!signResponse.signature) return Promise.reject(Error('Signature was not returned from KMS'));

    return Buffer.from(signResponse.signature);
  }
  public async getAccount(account: string): Promise<Account | Error> {
    return await this.RESTClient.getAccount(account);
  }
  public async getBlock(id?: string, height?: number): Promise<Block[] | Error> {
    if (id) {
      // get by id
      return await this.RESTClient.getBlock(id);
    } else if (height) {
      // get by height
      return await this.RESTClient.getBlockHeight([height]);
    } else {
      // get latest
      const latest = await this.RESTClient.getLatestBlock();
      if (latest instanceof Error) return Promise.reject(latest);
      return [latest];
    }
  }
}

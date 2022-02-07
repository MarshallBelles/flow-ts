import { KeyManagementServiceClient } from '@google-cloud/kms';
import * as crypto from 'crypto';

export interface Config {
  api: API;
  project_id: string;
  locationId: string;
  keyRingId: string;
  keyId: string;
  versionId: string;
}

export enum API {
  LOCAL,
  TESTNET,
  MAINNET
}

export enum Digest {
  sha256,
  sha3_256
}

export class FlowTs {
  private KMSClient: KeyManagementServiceClient;
  private versionName: string;
  private config: Config;

  constructor(config: Config, credentialsFile: string, KMSClientOverride?: KeyManagementServiceClient) {
    this.config = config;
    let accessNodeAPI;
    switch (config.api) {
      case API.LOCAL:
        accessNodeAPI = 'http://localhost:8080';
        break;

      case API.TESTNET:
        accessNodeAPI = 'https://rest-testnet.onflow.org';
        break;

      case API.MAINNET:
        accessNodeAPI = 'https://rest-testnet.onflow.org';
        break;

      default:
        accessNodeAPI = 'https://rest-testnet.onflow.org';
        break;
    }

    this.KMSClient = KMSClientOverride ? KMSClientOverride : new KeyManagementServiceClient({ credentials_file: credentialsFile });
    this.versionName = this.KMSClient.cryptoKeyVersionPath(
        config.project_id,
        config.locationId,
        config.keyRingId,
        config.keyId,
        config.versionId
    );
  }
  private async signMessage(msg: Buffer, dig?: Digest): Promise<Buffer> {
    // Create a digest of the message. The digest needs to match the digest
    // configured for the Cloud KMS key.

    let hash: crypto.Hash;
    switch (dig) {
      case Digest.sha256:
        hash = crypto.createHash('sha256');
        break;

      case Digest.sha3_256:
        hash = crypto.createHash('sha3-256');
        break;

      default:
        hash = crypto.createHash('sha256');
        break;
    }

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
  public async getAccount(account: string): Account {
  }
}

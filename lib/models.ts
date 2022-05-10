/* eslint-disable no-unused-vars */
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
    address: string;
    id: number;
    public_key: Buffer,
    private_key?: Buffer,
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
    UNKNOWN,
    PENDING,
    FINALIZED,
    EXECUTED,
    SEALED,
    EXPIRED,
}

export interface Signature {
    address: string;
    keyId: number;
    sig: string;
    signerIndex?: number;
}


export interface TxPayload {
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

export interface TxEnvelope {
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

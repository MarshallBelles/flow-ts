import { AccountKey } from './models';

export const encodePublicKeyForFlow = (a: AccountKey) => encode([
  a.public_key, // publicKey hex to binary
    a.sign_algo ? a.sign_algo : 2, // only P256 is supported
    a.hash_algo ? a.hash_algo : 3, // SHA3-256
    a.weight ? a.weight : 1 > 0 ? a.weight : 1, // cannot be null or negative
]).toString('hex');

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

export const safeParseInt = (v: any, base: any) => {
  if (v.slice(0, 2) === '00') {
    throw new Error('invalid RLP: extra zeros');
  }
  return parseInt(v, base);
};

export const encodeLength = (len: number, offset: number) => {
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

export const _decode = (input: any): any => {
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

export const isHexPrefixed = (str: string) => {
  return str.slice(0, 2) === '0x';
};

export const stripHexPrefix = (str: string) => {
  if (typeof str !== 'string') {
    return str;
  }
  return isHexPrefixed(str) ? str.slice(2) : str;
};

export const intToHex = (integer: number) => {
  if (integer < 0) {
    throw new Error('Invalid integer as argument, must be unsigned!');
  }
  const hex = integer.toString(16);
  return hex.length % 2 ? '0' + hex : hex;
};

export const padToEven = (a: any) => {
  return a.length % 2 ? '0' + a : a;
};

export const intToBuffer = (integer: number) => {
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

export const rightPaddedHexBuffer = (value: string, pad: number): Buffer => Buffer.from(value.padEnd(pad * 2, '0'), 'hex');

export const leftPaddedHexBuffer = (value: string, pad: number): Buffer => Buffer.from(value.padStart(pad * 2, '0'), 'hex');

export const addressBuffer = (addr: string) => leftPaddedHexBuffer(addr, 8);

export const blockBuffer = (block: string) => leftPaddedHexBuffer(block, 32);

export const scriptBuffer = (script: string) => Buffer.from(script, 'utf8');

export const signatureBuffer = (signature: string) => Buffer.from(signature, 'hex');

export const rlpEncode = (v: any): string => {
  return encode(v).toString('hex');
};

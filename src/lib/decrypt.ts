import crypto from 'crypto';
import { type SupabaseEnv } from './supabase';
import { normalizeText } from './utils';

const algorithm = 'aes-256-gcm';

function getEncryptionKey(mode: SupabaseEnv = 'test') {
  const encryptionSecret = mode === 'prod' ? process.env.ENCRYPTION_SECRET_PROD : process.env.ENCRYPTION_SECRET;

  if (!encryptionSecret) {
    throw new Error(`ENCRYPTION_SECRET${mode === 'prod' ? '_PROD' : ''}가 설정되지 않았습니다.`);
  }

  return crypto.createHash('sha256').update(encryptionSecret).digest();
}

export function decrypt(value: string, mode: SupabaseEnv = 'test') {
  const encryptionKey = getEncryptionKey(mode);

  const separatedValue = value.split(':');

  if (separatedValue.length !== 3) {
    throw new Error('암호화된 값 형식이 올바르지 않습니다.');
  }

  const initializationVector = Buffer.from(separatedValue[0], 'hex');
  const authenticationTag = Buffer.from(separatedValue[1], 'hex');
  const encryptedBuffer = Buffer.from(separatedValue[2], 'hex');

  const decipher = crypto.createDecipheriv(algorithm, encryptionKey, initializationVector);

  decipher.setAuthTag(authenticationTag);

  const decryptedBuffer = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);

  return decryptedBuffer.toString('utf8');
}

export function decryptNullable(value: string | null | undefined, mode: SupabaseEnv = 'test') {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return '';
  }

  try {
    return decrypt(normalizedValue, mode);
  } catch {
    return '';
  }
}

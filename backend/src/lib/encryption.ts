import { KMSClient, GenerateDataKeyCommand, DecryptCommand } from '@aws-sdk/client-kms';
import crypto from 'crypto';
import { logger } from './logger';

const kmsClient = new KMSClient({ region: process.env.AWS_REGION || 'us-east-1' });
const KMS_KEY_ID = process.env.AWS_KMS_KEY_ID!;

if (!KMS_KEY_ID) {
  throw new Error('AWS_KMS_KEY_ID environment variable is required');
}

// Envelope encryption: data key approach
export interface EncryptedPayload {
  encryptedData: Buffer;
  encryptedDataKey: Buffer;
  iv: Buffer;
  authTag: Buffer;
}

/**
 * Encrypt a token using AWS KMS envelope encryption
 * Step 1: Generate data key via KMS
 * Step 2: Encrypt token with AES-256-GCM using data key
 * Step 3: Store encrypted data + encrypted data key
 */
export async function encryptToken(plaintext: string): Promise<EncryptedPayload> {
  try {
    // Generate 32-byte data key (256-bit)
    const generateCommand = new GenerateDataKeyCommand({
      KeyId: KMS_KEY_ID,
      KeySpec: 'AES_256',
    });

    const generateResponse = await kmsClient.send(generateCommand);
    const plaintextDataKey = generateResponse.Plaintext as Buffer;
    const encryptedDataKey = generateResponse.CiphertextBlob as Buffer;

    // Generate 12-byte IV
    const iv = crypto.randomBytes(12);

    // Encrypt with AES-256-GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', plaintextDataKey, iv);
    const encryptedData = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    // Zero out plaintext data key immediately
    plaintextDataKey.fill(0);

    logger.debug('Token encrypted successfully');

    return {
      encryptedData,
      encryptedDataKey,
      iv,
      authTag,
    };
  } catch (error) {
    logger.error({ error }, 'Token encryption failed');
    throw error;
  }
}

/**
 * Decrypt a token using AWS KMS
 * Step 1: Call KMS Decrypt to get plaintext data key
 * Step 2: Decrypt token with AES-256-GCM
 * Step 3: Zero out plaintext immediately
 */
export async function decryptToken(
  encryptedDataKey: Buffer,
  encryptedData: Buffer,
  iv: Buffer,
  authTag: Buffer,
  callingService: string
): Promise<string> {
  try {
    // Decrypt data key via KMS
    const decryptCommand = new DecryptCommand({
      CiphertextBlob: encryptedDataKey,
    });

    const decryptResponse = await kmsClient.send(decryptCommand);
    const plaintextDataKey = decryptResponse.Plaintext as Buffer;

    // Decrypt token
    const decipher = crypto.createDecipheriv('aes-256-gcm', plaintextDataKey, iv);
    decipher.setAuthTag(authTag);
    const plaintext = decipher.update(encryptedData, undefined, 'utf8') + decipher.final('utf8');

    // Zero out plaintext data key
    plaintextDataKey.fill(0);

    // Log to audit trail
    logger.info({ calling_service: callingService }, 'Token decrypted');

    return plaintext;
  } catch (error) {
    logger.error({ error, calling_service: callingService }, 'Token decryption failed');
    throw error;
  }
}

/**
 * Extract components from stored encrypted payload
 */
export function parseEncryptedPayload(data: Buffer): EncryptedPayload {
  // Format: [iv:12bytes][authTag:16bytes][encryptedData:rest]
  // This assumes we store combined format
  const iv = data.subarray(0, 12);
  const authTag = data.subarray(12, 28);
  const encryptedData = data.subarray(28);

  return { encryptedData, encryptedDataKey: Buffer.alloc(0), iv, authTag };
}

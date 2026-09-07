export const MAX_REQUEST_BYTES = 128 * 1024;
export const MAX_USER_CHARACTERS = 4000;
export type TextMessage = { role: 'user' | 'assistant'; content: string };

export class ChatRequestError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = 'ChatRequestError';
    this.status = status;
  }
}

export function validateMessages(body: unknown): TextMessage[] {
  if (!body || typeof body !== 'object' || !('messages' in body) || !Array.isArray(body.messages)
    || body.messages.length < 1 || body.messages.length > 40) {
    throw new ChatRequestError('Send between 1 and 40 messages. Start a new conversation if needed.');
  }
  let total = 0;
  const messages = body.messages.map((message: unknown): TextMessage => {
    if (!message || typeof message !== 'object' || !('role' in message)
      || (message.role !== 'user' && message.role !== 'assistant')) {
      throw new ChatRequestError('Only user and assistant text messages are accepted.');
    }
    let content = '';
    if ('content' in message && typeof message.content === 'string') {
      content = message.content;
    } else if ('parts' in message && Array.isArray(message.parts)) {
      for (const part of message.parts) {
        if (!part || part.type !== 'text' || typeof part.text !== 'string') {
          throw new ChatRequestError('Messages must contain text only.');
        }
        content += part.text;
      }
    } else {
      throw new ChatRequestError('Each message needs text content.');
    }
    const limit = message.role === 'user' ? MAX_USER_CHARACTERS : 32000;
    if (!content.trim() || content.length > limit) {
      throw new ChatRequestError(`Message text must contain 1 to ${limit} characters.`);
    }
    total += content.length;
    if (total > 64000) throw new ChatRequestError('Conversation is too long. Start a new conversation.', 413);
    return { role: message.role, content };
  });
  if (messages[messages.length - 1].role !== 'user') {
    throw new ChatRequestError('The final message must be a user request.');
  }
  return messages;
}

/** Enforce the limit on bytes read, not just the caller's Content-Length hint. */
export async function readChatRequest(request: Request): Promise<TextMessage[]> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new ChatRequestError('Content-Type must be application/json.', 415);
  }
  if (Number(request.headers.get('content-length')) > MAX_REQUEST_BYTES) {
    throw new ChatRequestError('Request body is too large.', 413);
  }
  if (!request.body) throw new ChatRequestError('A JSON request body is required.');
  const reader = request.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let size = 0;
  let text = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_REQUEST_BYTES) {
        await reader.cancel();
        throw new ChatRequestError('Request body is too large.', 413);
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } catch (error) {
    await reader.cancel().catch(() => {});
    if (error instanceof ChatRequestError) throw error;
    throw new ChatRequestError('Could not read a UTF-8 JSON request.');
  } finally {
    reader.releaseLock();
  }
  let body: unknown;
  try { body = JSON.parse(text); } catch { throw new ChatRequestError('Request body must be valid JSON.'); }
  return validateMessages(body);
}

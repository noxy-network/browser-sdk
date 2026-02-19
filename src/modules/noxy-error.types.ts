export enum NoxyStorageErrorOperationEnum {
  VALIDATE_KEY = 'validate_key',
  CONNECT = 'connect',
  LOAD = 'load',
  SAVE = 'save',
  DELETE = 'delete',
  CLEAR = 'clear',
  ENCRYPT = 'encrypt',
  DECRYPT = 'decrypt',
}

export enum NoxyNetworkErrorOperationEnum {
  ANNOUNCE_DEVICE = 'announce_device',
  AUTHENTICATE = 'authenticate',
  SEND_MESSAGE = 'send_message',
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  PUSH_RECEIVED = 'push_received',
  RECONNECT = 'reconnect',
}

export type {
  NoxyError,
  NoxyGeneralError,
  NoxyInitializationError,
  NoxyStorageError,
  NoxyNetworkError,
} from '@/modules/noxy-error';

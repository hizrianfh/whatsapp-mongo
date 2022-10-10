import dotenv from 'dotenv';
dotenv.config();

import pino from 'pino';

import pinoPretty from 'pino-pretty';

const pinoStream = pinoPretty({
  messageFormat: '{msg}',
  customPrettifiers: {
    time: (timestamp: any) => {
      return `${timestamp.split('.')[0]}`;
    }
  }
})

export const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
}, pinoStream);
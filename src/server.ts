import dotenv from 'dotenv'
import { logger } from './api/utils';
dotenv.config()

import app from './config/express'
import config from './config/config'

import { Session } from './api/class/Session'
import { connect } from './api/services/db'
import { Db } from 'mongodb'

let server: any;

declare global {
  var mongoClient: Db;
}

server = app.listen(config.port, async () => {
  logger.info(`Listening on port ${config.port}`)
  const mongoConnection = await connect(process.env.MONGODB_URI!)
  global.mongoClient = mongoConnection.db('whatsapp')
  if (config.restoreSessionsOnStartup) {
    logger.info(`Restoring Sessions`)
    const session = new Session()
    let restoreSessions = await session.restoreSessions()
    logger.info(`${restoreSessions.length} Session(s) Restored`)
}
})

const exitHandler = () => {
  if (server) {
    server.close(() => {
      logger.info('Server closed')
      process.exit(1)
    })
  } else {
    process.exit(1)
  }
}

const unexpectedErrorHandler = (error: any) => {
  logger.error(error)
  exitHandler()
}

process.on('uncaughtException', unexpectedErrorHandler)
process.on('unhandledRejection', unexpectedErrorHandler)

process.on('SIGTERM', () => {
  logger.info('SIGTERM received')
  if (server) {
    server.close()
  }
})

module.exports = server

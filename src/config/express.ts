import express from 'express'
import path from 'path'
import Client from '../api/class/Client'
const app = express()

app.use(express.json())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true }))
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, '../api/views'))

declare global {
  var WhatsAppInstances: Map<string, Client>;
}

global.WhatsAppInstances = new Map<string, Client>()

import routes from '../api/routes/'

app.use('/', routes)

export default app

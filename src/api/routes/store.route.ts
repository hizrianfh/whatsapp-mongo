import express from 'express'
import * as controller from '../controllers/store.controller'
import keyVerify from '../middlewares/keyCheck'
import loginVerify from '../middlewares/loginCheck'

const router = express.Router()

router.route('/chats').get(keyVerify, loginVerify, controller.allChats)
router.route('/chats/:id').get(keyVerify, loginVerify, controller.allMessages)

export default router

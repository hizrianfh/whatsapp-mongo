import express from 'express'
const router = express.Router()
import instanceRoutes from './instance.route'
import messageRoutes from './message.route'
// import miscRoutes from './misc.route'
// import groupRoutes from './group.route'

router.get('/status', (req, res) => res.send('OK'))
router.use('/instance', instanceRoutes)
router.use('/message', messageRoutes)
// router.use('/group', groupRoutes)
// router.use('/misc', miscRoutes)

export default router

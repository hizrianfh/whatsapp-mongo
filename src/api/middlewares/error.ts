/* eslint-disable no-unused-vars */
// import APIError from '../errors/api.error'

const handler = (err: any, req: any, res: any, next: any) => {
    const statusCode = err.statusCode ? err.statusCode : 500

    res.setHeader('Content-Type', 'application/json')
    res.status(statusCode)
    res.json({
        error: true,
        code: statusCode,
        message: err.message,
    })
}

export default { handler }

// exports.notFound = (req, res, next) => {
//     const err = new APIError({
//         message: 'Not found',
//         status: 404,
//     })
//     return handler(err, req, res)
// }

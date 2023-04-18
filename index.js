// import { PrismaClient } from '@prisma/client'
require('dotenv').config()
const debug = require('debug')('vending-machine')

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const koa = require('koa')
const koaBody = require('koa-body')
const Router = require('koa-router')
const cors = require('@koa/cors')
const {
    validate,
    object,
    number,
    string,
    define,
    integer,
} = require('superstruct')

const port = 9000

const app = new koa()
app.use(koaBody())
app.use(
    cors({
        origin: '*',
        allowMethods: 'POST',
        allowHeaders: 'content-type',
    })
)

const validator = schema => {
    return async (ctx, next) => {
        for (const key in schema) {
            const value = ctx.request[key] || ctx[key]
            const [error] = validate(value, schema[key])
            if (error) {
                ctx.status = 422
                ctx.body = error
                return
            }
        }
        await next()
    }
}

const router = new Router()
const splitModes = [
    /**
     *  {账号}----{邮密/密码}----{APIKEY}----真
     * @param {string} data
     * @returns {Array<{account: string, emailPassword: string, openaiPassword: string, apikey: string}>}
     */
    function (data) {
        ;[...data.matchAll(/(.+?)----(.+?)----(.+?)----真/g)].map(match => {
            const [_, account, password, apikey] = match
            return {
                account,
                emailPassword: password,
                openaiPassword: password,
                apikey,
            }
        })
    },
]

router.post(
    '/restock',
    validator({
        body: object({
            goodsId: integer(),
            splitMode: define('splitMode', x =>
                is(x, integer() && x >= 0 && x < splitMode.length)
            ),
            data: string(),
        }),
    }),
    async ctx => {
        const { goodsId, splitMode, data } = ctx.request.body
        const createMany = await prisma.openaiAccount.createMany({
            data: splitModes[splitMode](data).map(o =>
                Object.assign(o, { goodsId })
            ),
        })

        ctx.body = createMany
    }
)

app.use(router.routes())
app.listen(port, () => {
    console.log(`Server running on port ${port}`)
})

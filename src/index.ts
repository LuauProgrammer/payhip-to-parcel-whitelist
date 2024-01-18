//TODO: implement ratelimiting
//TODO: implement caching

import dotenv from 'dotenv'; dotenv.config();
import fetch from 'node-fetch'
import express, { Response, Request, json } from 'express'
import { BinaryToTextEncoding, createHash } from 'crypto';

const PORT = process.env.PORT || 443
const WEBHOOK_ROUTE = process.env.WEBHOOK_ROUTE || "/"
const QUESTION_INDEX = process.env.QUESTION_INDEX || 0
const PARCEL_SECRET_KEY = process.env.PARCEL_SECRET_KEY
const PAYHIP_API_KEY = process.env.PAYHIP_API_KEY
const LOG_AND_DM_USER = process.env.LOG_AND_DM_USER
const PARCEL_PAYMENTS_BASE_URL = "https://payments.parcelroblox.com/"
const PARCEL_PUBLIC_API_BASE_URL = "https://papi.parcelroblox.com/"
const PARCEL_API_BASE_URL = "https://api.parcelroblox.com/"
const ROBLOX_USERS_API_BASE_URL = "https://users.roblox.com/"

const signature = PAYHIP_API_KEY ? generateHash(PAYHIP_API_KEY, 'sha256', 'hex') : null
const app = express()

function generateHash(string: string, algorithm?: string, encoding?: BinaryToTextEncoding): string {
    return createHash(algorithm || 'sha256').update(string).digest(encoding || 'base64')
}

console.log(generateHash("e8f4d62eeb37dab17044dc320747d73ab80575ca", 'sha256', 'hex'))

function getUserId(username: string): Promise<number | undefined> {
    return new Promise(resolve => fetch(ROBLOX_USERS_API_BASE_URL + `/v1/usernames/users`, {
        method: "POST",
        body: JSON.stringify({ "usernames": [username], "excludeBannedUsers": true }),
        headers: {
            "Content-Type": "application/json",
            "Accept-Encoding": "*",
        },
    }).then(apiResponse => {
        if (apiResponse.status !== 200) return resolve(undefined)
        apiResponse.json().then(body => {
            if ((body as any).data.length === 0) return resolve(undefined)
            resolve((body as any).data[0].id as number)
        })
    }).catch(() => resolve(undefined)))
}

function getProducts(): Promise<Array<any> | undefined> {
    return new Promise(resolve => fetch(PARCEL_API_BASE_URL + `api/hub/getproducts?type=all`, {
        method: "GET",
        headers: {
            "hub-secret-key": PARCEL_SECRET_KEY!,
            "Content-Type": "application/json",
            "Accept-Encoding": "*",
        },
    }).then(apiResponse => {
        if (apiResponse.status !== 200) return resolve(undefined)
        apiResponse.json().then(body => resolve((body as any).details.products as Array<any>))
    }).catch(() => resolve(undefined)))
}

app.use(json())

app.post(WEBHOOK_ROUTE, async function (request: Request, response: Response) {
    if (request.body.type !== "paid") { console.log(`Expected request type to be paid, got ${request.body.type}`); return response.sendStatus(200).end() }
    const requestSignature = request.body.signature
    if (signature && (!requestSignature || signature !== requestSignature)) { console.log(`Provided signature '${requestSignature || "NULL"}' does not match the known API signature.`); return response.sendStatus(403).end() }
    const questions = request.body.checkout_questions
    if (!questions) { console.log("No checkout questions found in the request body."); return response.sendStatus(200).end() }
    const question = questions[QUESTION_INDEX]
    if (!question) { console.log(`No username was found at array index ${QUESTION_INDEX}.`); return response.sendStatus(200).end() }
    const username = question.response
    const userId = await getUserId(username)
    if (!userId) { console.log(`No UserID associated with the name ${username} could be found.`); return response.sendStatus(200).end() }
    const products = await getProducts()
    if (!products) { console.log(`Error occured whilst fetching products (check your parcel secret key!). `); return response.sendStatus(200).end() }
    for (const item of request.body.items) {
        let productId
        for (const product of products) if (item.product_name.toLowerCase() === product.name.toLowerCase()) { productId = product.productID; break };
        if (!productId) { console.log(`No Product ID with the name ${item.product_name} could be found on Parcel.`); return response.sendStatus(200).end() }
        fetch(LOG_AND_DM_USER ? PARCEL_PAYMENTS_BASE_URL + `external/hub/order/complete` : PARCEL_PUBLIC_API_BASE_URL + " whitelist/add", {
            method: "POST",
            body: JSON.stringify({
                "robloxID": String(userId),
                "productID": productId
            }),
            headers: {
                "hub-secret-key": PARCEL_SECRET_KEY!,
                "Content-Type": "application/json",
                "Accept-Encoding": "*",
            },
        }).then(apiResponse => {
            if (apiResponse.status !== 200) { console.log(`Could not whitelist user (status code ${apiResponse.status}, check your parcel secret key!).`); return response.send(200).end() }
            console.log(`Successfully whitelisted user ${username} (${userId})`)
            response.sendStatus(200).end()
        }).catch(() => { console.log(`Failed to post to Parcel API (check your parcel secret key!).`); return response.sendStatus(200).end() })
    }
})

app.listen(PORT, () => console.log(`Listening on Port ${PORT}`))
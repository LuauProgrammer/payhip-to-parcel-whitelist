//TODO: delete old cached items

import dotenv from 'dotenv'; dotenv.config();
import { BinaryToTextEncoding, createHash } from 'crypto';
import express, { Response, Request, json } from 'express'
import axios from 'axios'
import { getIdFromUsername } from 'noblox.js'

const PORT = process.env.PORT || 443
const QUESTION_INDEX = process.env.QUESTION_INDEX || 0
const PAYHIP_API_KEY = process.env.PAYHIP_API_KEY
const PARCEL_SECRET_KEY = process.env.PARCEL_SECRET_KEY
const PARCEL_PUBLIC_API_BASE_URL = "https://papi.parcelroblox.com/"
const PARCEL_PRIVATE_API_BASE_URL = "https://api.parcelroblox.com/"

const signature = PAYHIP_API_KEY ? generateHash(PAYHIP_API_KEY, 'sha256', 'binary') : null
const cache = new Map()
const app = express()

function generateHash(string: string, algorithm?: string, encoding?: BinaryToTextEncoding): string {
    return createHash(algorithm || 'sha256').update(string).digest(encoding || 'base64')
}

function getUserId(username: string): Promise<number | undefined> {
    if (cache.has(username)) return Promise.resolve(cache.get(username) as number)
    return new Promise(resolve => getIdFromUsername(username).then(id => { cache.set(username, id); resolve(id) }).catch(() => resolve(undefined)))
}

function getProducts(): Promise<Array<any> | undefined> {
    return new Promise(resolve => axios.post(PARCEL_PRIVATE_API_BASE_URL + `api/hub/getproducts?type=all`, {
        data: {},
        headers: {
            "hub-secret-key": PARCEL_SECRET_KEY,
            "Content-Type": "application/json",
            "Accept-Encoding": "*",
        },
        responseType: "json"
    }).then(apiResponse => {
        if (apiResponse.status !== 200) return resolve(undefined)
        resolve(apiResponse.data.details.products)
    }).catch(() => resolve(undefined)))
}

app.use(json())

app.post("/webhook", async function (request: Request, response: Response) {
    const requestSignature = request.body.signature
    if (signature && (!requestSignature || signature !== requestSignature)) { console.log(`Provided signature '${requestSignature || "NULL"}' does not match the known API signature.`); return response.send(403).end() }
    const questions = request.body.checkout_questions
    if (!questions) { console.log("No checkout questions found in the request body."); return response.send(200).end() }
    const username = questions[QUESTION_INDEX]
    if (!username) { console.log(`No username was found at array index ${QUESTION_INDEX}.`); return response.send(200).end() }
    const userId = await getUserId(username)
    if (!userId) { console.log(`No UserID associated with the name ${username} could be found.`); return response.send(200).end() }
    const products = await getProducts()
    if (!products) { console.log(`Error occured whilst fetching products (check your parcel secret key!). `); return response.send(200).end() }
    for (const item of request.body.items) {
        let productId
        for (const product of products) if (item.name === product.name) { productId = product.productID; break };
        if (!productId) { console.log(`No Product ID with the name ${item.name} could be found on Parcel.`); return response.send(200).end() }
        axios.post(PARCEL_PUBLIC_API_BASE_URL + `whitelist/add`, {
            data: {
                robloxID: String(userId),
                productID: productId
            },
            headers: {
                "hub-secret-key": PARCEL_SECRET_KEY,
                "Content-Type": "application/json",
                "Accept-Encoding": "*",
            },
            responseType: "json"
        }).then(apiResponse => {
            if (apiResponse.status !== 200) { console.log(`Could not whitelist user (status code ${apiResponse.status}, check your parcel secret key!).`); return response.send(200).end() }
            console.log(`Successfully whitelisted user ${username} (${userId})`)
        }).catch(() => { console.log(`Failed to post to Parcel API.`); return response.send(200).end() })
    }
})

app.listen(PORT, () => console.log(`Listening on Port ${PORT}`))
# payhip-to-parcel-whitelist
A web server that automates USD payments with Parcel by using Payhip.

## Getting Started

### Preparing Payhip

First things first, lets head on over to Payhip > Settings > Advanced Settings > Checkout Questions and click 
"Display your own questions for customers to answer during checkout". Then, create a question asking the user what their ROBLOX username is. If you already have several questions up, you will need to figure out what index the question is at. Questions indexes start at 0. So your first question would be 0, second would be 1, and so on. If the index is not 0, save the index somewhere safe as we'll need it later.

### Preparing Parcel

So in order for us to whitelist our user, we'll need to get our hub secret key. To do this run this with parcel:
```
/settings
```
Then select hub settings and your hub secret key will be spoilered. Save this somewhere and dont give it to anybody.

### Cloning & Setting Up The Server

Clone this repository:
```
git clone https://github.com/LuauProgrammer/payhip-to-parcel-whitelist.git
```
```
cd payhip-to-parcel-whitelist
```
Then, download required dependencies:
```
yarn add
```

### Configuring The Environment

Here come's the harder part, setting up your env:
```
WEBHOOK_ROUTE = "/webhook" (where are we listening for incoming webhooks, default is root)
QUESTION_INDEX=<integer> (the question number that is asked at checkout to search for the customers roblox username, default is 0)
PARCEL_SECRET_KEY=<string> (bare minimum required for this to work, you can get this by running /settings with parcel and selecting hub settings)
PAYHIP_API_KEY=<string> (located in the developers tab of your payhip account settings, the api key is used to match request signatures up to the api keys hash, not required but it prevents a bad actor from forging requests to your server)
PORT=<integer> (self explanatory)
```
We went over how to get whats needed above, paste it in here. After that we can start the server:
```
yarn run build
```
```
yarn run start
```

### Adding our server to the list of webhooks to ping

In your Payhip developer tab there is a ping endpoints box. Put your domain and the route (example: https://domain.com/route/) in there and save.
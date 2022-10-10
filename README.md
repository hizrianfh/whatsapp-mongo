
# WhatsApp MongoDB

Rest API implementation of Baileys using MongoDB for store and state management.


## Installation

Download or clone this repo

```bash
git clone git@github.com:hizrianfh/whatsapp-mongo.git && cd whatsapp-mongo
```
Install dependencies with yarn
```bash
yarn install
```
Create and update .env
```bash
cp .env.sample .env
```

## Usage

For development (hot reload)

```bash
yarn dev
```

Production

```bash
# transpile ts to js, output in ./lib folder

yarn build

# Run server

yarn start
```


## Using Docker


```bash
docker compose up --build -d
```
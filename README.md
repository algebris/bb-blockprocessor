# BB block processor

As a part of BB backend experimental envoronment there are two modules at the moment.
*BlockProcessor* intended to work with blockchain fetching and processing transactions directly via RPC port.
And *Rest API* which intended for querying processed data. They both use the same database (Redis).

1. Blockchain Block Processor

This one repository https://github.com/algebris/bb-blockprocessor

2. BB REST API 

https://github.com/algebris/bb-rest-api

## Pre-requisites

### Make sure you installed latest Node.js

https://nodejs.org/en/download/

```
# node -v
v9.9.0

# npm -v
v5.6.0
```

### Redis database is installed and accessible by default

https://redis.io/download


## Installation

```
# git clone https://github.com/algebris/bb-blockprocessor
# cd bb-blockprocessor
# npm install
```

In order to setup RPC connection create .env file in your working directory (bb-blockprocessor) with these 3 lines
```
RPC_USER = algebris
RPC_PORT = 19915
RPC_PASSWD = 4EBE48KZHLc2hUEBpeREC1KPF7XJ9K66RXGuyiYrCoSA
```

or you can configure it via environment variables 
```
# export RPC_USER=algebris
# export RPC_PORT=19915
# export RPC_PASSWD = 4EBE48KZHLc2hUEBpeREC1KPF7XJ9K66RXGuyiYrCoSA
```

## Running

Just start the module with that command

```
# npm start 
```

That's all.
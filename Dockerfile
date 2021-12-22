FROM node:14.0 as build

RUN mkdir /app
ARG wallet_password
ENV default=""
ENV  MODE="mainnet"

WORKDIR /app

COPY . .

RUN mkdir public/dist logs db /secrets

RUN npm install && \
    npm install -g mocha nodemon && \
    npm run build-client


# RUN node -r esm util/approval.js

ENTRYPOINT ["/bin/bash", "-c","exec npm run start:${MODE} $wallet_password"]



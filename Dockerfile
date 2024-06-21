FROM node:20.12.1-slim

RUN apt update && apt install -y openssl procps

RUN npm install -g @nestjs/cli@10.3.2

RUN npm install @prisma/client

WORKDIR /home/node/app

USER node

CMD tail -f /dev/null
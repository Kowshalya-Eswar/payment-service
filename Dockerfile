# Dockerfile (payment-service)
FROM node:18-alpine

# create app dir
WORKDIR /app

# copy package manifests first (cache layer)
COPY package*.json ./

# install deps (use npm ci if package-lock.json exists)
RUN npm install --production

# copy app source
COPY . .

# set env defaults (can be overridden at runtime)
ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

# run the app
CMD ["npm", "start"]

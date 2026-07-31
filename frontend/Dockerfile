FROM node:20-alpine AS build
WORKDIR /app

# Vite/esbuild на postinstall качает бинарник с GitHub — без зеркала шаг часто «молчит» минутами.
ENV ESBUILD_BINARY_HOST=https://npmmirror.com/mirrors/esbuild
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

COPY package.json ./
RUN npm install --no-audit --no-fund --fetch-retries=5 --fetch-retry-mintimeout=20000

COPY . .
ARG VITE_ROOT_PATH=/extra/analyses
ENV VITE_ROOT_PATH=$VITE_ROOT_PATH
RUN npm run build

# Раздаём статику nginx'ом под префиксом /extra/analyses (serve -s ломал assets).
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html/extra/analyses
EXPOSE 80

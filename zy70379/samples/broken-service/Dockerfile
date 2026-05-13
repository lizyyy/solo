FROM node:10

WORKDIR /data/app

COPY . .

RUN npm install

USER root

EXPOSE 8080

CMD ["nodemon", "app.js"]

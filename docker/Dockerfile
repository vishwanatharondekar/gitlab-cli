FROM node:12-alpine

MAINTAINER Pierre Duchemin <pierre.duchemin@savoirfairelinux.com>

ENV LANG=C.UTF-8
ENV GITLAB_URL=
ENV GITLAB_TOKEN=

RUN apk update \
  && apk add --no-cache git
RUN npm install git-lab-cli -g

WORKDIR /home

ENTRYPOINT ["lab"]

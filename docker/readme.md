# How to run this

Change url and token in Dockerfile.

```bash
docker build . -t gitlab-cli
docker run -v $PWD:/home -ti --rm gitlab-cli merge-request -b BRANCH_NAME -t SOME_TAG -v -a USERNAME -m MR_TITLE
```
